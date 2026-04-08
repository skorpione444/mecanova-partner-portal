-- Fix order lifecycle:
-- • accept_order  → no longer deducts inventory (bottles still in our storage)
-- • deliver_order → deducts inventory (physical handoff to client)
-- • cancel_order  → allow cancel from any pre-final status;
--                   restore inventory only when cancelling a delivered order

-- ─── accept_order ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.accept_order(p_order_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare
  v_distributor_id uuid;
  v_status public.order_status_enum;
begin
  -- 1) Lock the order row
  select distributor_id, status
    into v_distributor_id, v_status
  from public.order_requests
  where id = p_order_id
  for update;

  if v_distributor_id is null then
    raise exception 'accept_order failed: order not found';
  end if;

  if v_status <> 'submitted'::public.order_status_enum then
    raise exception 'accept_order failed: order status must be submitted (got %)', v_status;
  end if;

  -- 2) Permission: distributor assigned to order (or admin)
  if public.mecanova_current_partner_id() <> v_distributor_id
     and not public.mecanova_is_admin() then
    raise exception 'accept_order failed: not allowed';
  end if;

  -- 3) Mark order accepted + timestamp (no inventory change — bottles still in storage)
  update public.order_requests
  set status = 'accepted'::public.order_status_enum,
      accepted_at = coalesce(accepted_at, now()),
      updated_at = now()
  where id = p_order_id;

end;
$function$;

-- ─── deliver_order ───────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.deliver_order(p_order_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  v_distributor_id uuid;
  v_status public.order_status_enum;
  v_insufficient boolean;
BEGIN
  SELECT distributor_id, status
    INTO v_distributor_id, v_status
  FROM public.order_requests
  WHERE id = p_order_id
  FOR UPDATE;

  IF v_distributor_id IS NULL THEN
    RAISE EXCEPTION 'deliver_order failed: order not found';
  END IF;

  IF v_status <> 'accepted'::public.order_status_enum THEN
    RAISE EXCEPTION 'deliver_order failed: order status must be accepted (got %)', v_status;
  END IF;

  IF public.mecanova_current_partner_id() <> v_distributor_id
     AND NOT public.mecanova_is_admin() THEN
    RAISE EXCEPTION 'deliver_order failed: not allowed';
  END IF;

  -- Ensure inventory rows exist for every item
  IF EXISTS (
    SELECT 1
    FROM public.order_request_items i
    WHERE i.order_request_id = p_order_id
      AND NOT EXISTS (
        SELECT 1
        FROM public.inventory_status inv
        WHERE inv.distributor_id = v_distributor_id
          AND inv.product_id = i.product_id
      )
  ) THEN
    RAISE EXCEPTION 'deliver_order failed: missing inventory rows for one or more products';
  END IF;

  -- Lock inventory rows for this order
  PERFORM 1
  FROM public.inventory_status inv
  JOIN public.order_request_items i
    ON i.product_id = inv.product_id
   AND i.order_request_id = p_order_id
  WHERE inv.distributor_id = v_distributor_id
  FOR UPDATE;

  -- Check stock sufficiency
  SELECT EXISTS (
    SELECT 1
    FROM public.inventory_status inv
    JOIN public.order_request_items i
      ON i.product_id = inv.product_id
     AND i.order_request_id = p_order_id
    WHERE inv.distributor_id = v_distributor_id
      AND inv.on_hand_qty < i.cases_qty
  )
  INTO v_insufficient;

  IF v_insufficient THEN
    RAISE EXCEPTION 'deliver_order failed: insufficient stock for one or more items';
  END IF;

  -- Deduct inventory
  UPDATE public.inventory_status inv
  SET on_hand_qty = inv.on_hand_qty - i.cases_qty,
      status = CASE
        WHEN (inv.on_hand_qty - i.cases_qty) <= 0
          THEN 'out'::public.inventory_status_enum
        WHEN (inv.on_hand_qty - i.cases_qty) <= 10
          THEN 'limited'::public.inventory_status_enum
        ELSE 'in_stock'::public.inventory_status_enum
      END,
      updated_at = now()
  FROM public.order_request_items i
  WHERE i.order_request_id = p_order_id
    AND inv.distributor_id = v_distributor_id
    AND inv.product_id = i.product_id;

  -- Audit trail
  INSERT INTO public.inventory_movements (
    distributor_id,
    product_id,
    order_request_id,
    movement_type,
    qty_delta,
    created_at
  )
  SELECT
    v_distributor_id,
    i.product_id,
    p_order_id,
    'order_deliver',
    -i.cases_qty,
    now()
  FROM public.order_request_items i
  WHERE i.order_request_id = p_order_id;

  UPDATE public.order_requests
  SET status = 'delivered'::public.order_status_enum,
      delivered_at = COALESCE(delivered_at, now()),
      updated_at = now()
  WHERE id = p_order_id;
END;
$function$;

-- ─── cancel_order ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.cancel_order(p_order_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare
  v_status         public.order_status_enum;
  v_distributor_id uuid;
  v_created_by     uuid;
begin
  -- Lock the order row
  select status, distributor_id, created_by_user
    into v_status, v_distributor_id, v_created_by
  from public.order_requests
  where id = p_order_id
  for update;

  if v_status is null then
    raise exception 'cancel_order failed: order not found';
  end if;

  -- Allow cancel from any non-terminal status
  if v_status in ('rejected', 'cancelled') then
    raise exception
      'cancel_order failed: order cannot be cancelled in status %', v_status;
  end if;

  -- Permission: creator or admin
  if v_created_by <> auth.uid() and not public.mecanova_is_admin() then
    raise exception 'cancel_order failed: not allowed';
  end if;

  -- If cancelling a delivered order: restore inventory
  if v_status = 'delivered'::public.order_status_enum and v_distributor_id is not null then

    -- Lock inventory rows
    perform 1
    from public.inventory_status inv
    join public.order_request_items i
      on i.product_id = inv.product_id
     and i.order_request_id = p_order_id
    where inv.distributor_id = v_distributor_id
    for update;

    -- Restore stock
    update public.inventory_status inv
    set on_hand_qty = inv.on_hand_qty + i.cases_qty,
        status = case
          when (inv.on_hand_qty + i.cases_qty) <= 0
            then 'out'::public.inventory_status_enum
          when (inv.on_hand_qty + i.cases_qty) <= 10
            then 'limited'::public.inventory_status_enum
          else 'in_stock'::public.inventory_status_enum
        end,
        updated_at = now()
    from public.order_request_items i
    where i.order_request_id = p_order_id
      and inv.distributor_id = v_distributor_id
      and inv.product_id = i.product_id;

    -- Insert rows for products not yet in inventory_status (edge case)
    insert into public.inventory_status (product_id, distributor_id, on_hand_qty, status)
    select
      i.product_id,
      v_distributor_id,
      i.cases_qty,
      case when i.cases_qty <= 10 then 'limited'::public.inventory_status_enum
           else 'in_stock'::public.inventory_status_enum end
    from public.order_request_items i
    where i.order_request_id = p_order_id
      and not exists (
        select 1 from public.inventory_status inv2
        where inv2.distributor_id = v_distributor_id
          and inv2.product_id = i.product_id
      );

    -- Audit trail
    insert into public.inventory_movements (
      distributor_id,
      product_id,
      order_request_id,
      movement_type,
      qty_delta,
      created_at
    )
    select
      v_distributor_id,
      i.product_id,
      p_order_id,
      'order_cancel_reversal',
      i.cases_qty,
      now()
    from public.order_request_items i
    where i.order_request_id = p_order_id;

  end if;

  -- Update status
  update public.order_requests
  set status = 'cancelled'::public.order_status_enum,
      cancelled_at = coalesce(cancelled_at, now()),
      updated_at = now()
  where id = p_order_id;

end;
$function$;
