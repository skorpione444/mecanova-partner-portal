create type "public"."document_type_enum" as enum ('invoice', 'delivery_note', 'compliance', 'price_list', 'marketing');

create type "public"."inventory_status_enum" as enum ('in_stock', 'limited', 'out');

create type "public"."order_status_enum" as enum ('submitted', 'confirmed', 'rejected', 'shipped', 'closed', 'created', 'accepted', 'fulfilled', 'cancelled');

create type "public"."partner_type" as enum ('client', 'distributor');

create type "public"."product_asset_type_enum" as enum ('bottle_shot', 'label_pdf', 'spec_sheet', 'brand_deck');

create type "public"."product_category_enum" as enum ('tequila', 'mezcal', 'raicilla', 'other');

create type "public"."user_role" as enum ('admin', 'partner', 'client', 'distributor');


  create table "public"."client_distributors" (
    "client_id" uuid not null,
    "distributor_id" uuid not null,
    "is_default" boolean not null default false,
    "created_at" timestamp with time zone not null default now()
      );


alter table "public"."client_distributors" enable row level security;


  create table "public"."documents" (
    "id" uuid not null default gen_random_uuid(),
    "type" public.document_type_enum not null,
    "title" text not null,
    "file_path" text not null,
    "partner_id" uuid,
    "product_id" uuid,
    "created_at" timestamp with time zone not null default now()
      );


alter table "public"."documents" enable row level security;


  create table "public"."inventory_movements" (
    "id" uuid not null default gen_random_uuid(),
    "distributor_id" uuid not null,
    "product_id" uuid not null,
    "order_request_id" uuid,
    "movement_type" text not null,
    "qty_delta" integer not null,
    "created_at" timestamp with time zone not null default now()
      );


alter table "public"."inventory_movements" enable row level security;


  create table "public"."inventory_status" (
    "product_id" uuid not null,
    "status" public.inventory_status_enum not null default 'in_stock'::public.inventory_status_enum,
    "note" text,
    "updated_at" timestamp with time zone not null default now(),
    "distributor_id" uuid not null,
    "on_hand_qty" integer not null default 0
      );


alter table "public"."inventory_status" enable row level security;


  create table "public"."order_request_items" (
    "id" uuid not null default gen_random_uuid(),
    "order_request_id" uuid not null,
    "product_id" uuid not null,
    "cases_qty" integer not null,
    "created_at" timestamp with time zone not null default now()
      );


alter table "public"."order_request_items" enable row level security;


  create table "public"."order_requests" (
    "id" uuid not null default gen_random_uuid(),
    "partner_id" uuid not null,
    "created_by_user" uuid not null,
    "status" public.order_status_enum not null default 'submitted'::public.order_status_enum,
    "delivery_location" jsonb,
    "notes" text,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now(),
    "client_id" uuid,
    "distributor_id" uuid,
    "submitted_at" timestamp with time zone,
    "accepted_at" timestamp with time zone,
    "rejected_at" timestamp with time zone,
    "fulfilled_at" timestamp with time zone,
    "cancelled_at" timestamp with time zone
      );


alter table "public"."order_requests" enable row level security;


  create table "public"."partners" (
    "id" uuid not null default gen_random_uuid(),
    "name" text not null,
    "country" text,
    "vat_id" text,
    "billing_address" jsonb,
    "shipping_address" jsonb,
    "created_at" timestamp with time zone not null default now(),
    "partner_type" public.partner_type not null default 'distributor'::public.partner_type,
    "is_mecanova" boolean not null default false
      );


alter table "public"."partners" enable row level security;


  create table "public"."product_assets" (
    "id" uuid not null default gen_random_uuid(),
    "product_id" uuid not null,
    "type" public.product_asset_type_enum not null,
    "title" text,
    "file_path" text not null,
    "created_at" timestamp with time zone not null default now()
      );


alter table "public"."product_assets" enable row level security;


  create table "public"."products" (
    "id" uuid not null default gen_random_uuid(),
    "brand" text,
    "name" text not null,
    "category" public.product_category_enum not null default 'other'::public.product_category_enum,
    "abv" numeric(5,2),
    "size_ml" integer,
    "case_size" integer,
    "sku" text,
    "description" text,
    "active" boolean not null default true,
    "created_at" timestamp with time zone not null default now()
      );


alter table "public"."products" enable row level security;


  create table "public"."profiles" (
    "user_id" uuid not null,
    "partner_id" uuid,
    "role" public.user_role not null default 'partner'::public.user_role,
    "full_name" text,
    "created_at" timestamp with time zone not null default now()
      );


alter table "public"."profiles" enable row level security;

CREATE UNIQUE INDEX client_distributors_pkey ON public.client_distributors USING btree (client_id, distributor_id);

CREATE INDEX documents_partner_id_idx ON public.documents USING btree (partner_id);

CREATE UNIQUE INDEX documents_pkey ON public.documents USING btree (id);

CREATE INDEX documents_product_id_idx ON public.documents USING btree (product_id);

CREATE INDEX idx_client_distributors_client_id ON public.client_distributors USING btree (client_id);

CREATE INDEX idx_client_distributors_distributor_id ON public.client_distributors USING btree (distributor_id);

CREATE INDEX idx_documents_partner_id ON public.documents USING btree (partner_id);

CREATE INDEX idx_inventory_status_distributor_id ON public.inventory_status USING btree (distributor_id);

CREATE INDEX idx_inventory_status_product_id ON public.inventory_status USING btree (product_id);

CREATE INDEX idx_order_request_items_order_request_id ON public.order_request_items USING btree (order_request_id);

CREATE INDEX idx_order_requests_client_created_at ON public.order_requests USING btree (client_id, created_at DESC);

CREATE INDEX idx_order_requests_client_id ON public.order_requests USING btree (client_id);

CREATE INDEX idx_order_requests_distributor_created_at ON public.order_requests USING btree (distributor_id, created_at DESC);

CREATE INDEX idx_order_requests_distributor_id ON public.order_requests USING btree (distributor_id);

CREATE INDEX idx_partners_partner_type ON public.partners USING btree (partner_type);

CREATE INDEX idx_profiles_partner_id ON public.profiles USING btree (partner_id);

CREATE INDEX idx_profiles_user_id ON public.profiles USING btree (user_id);

CREATE UNIQUE INDEX inventory_movements_pkey ON public.inventory_movements USING btree (id);

CREATE UNIQUE INDEX inventory_status_pkey ON public.inventory_status USING btree (distributor_id, product_id);

CREATE INDEX order_items_order_request_id_idx ON public.order_request_items USING btree (order_request_id);

CREATE UNIQUE INDEX order_request_items_pkey ON public.order_request_items USING btree (id);

CREATE INDEX order_requests_created_by_idx ON public.order_requests USING btree (created_by_user);

CREATE INDEX order_requests_partner_id_idx ON public.order_requests USING btree (partner_id);

CREATE UNIQUE INDEX order_requests_pkey ON public.order_requests USING btree (id);

CREATE UNIQUE INDEX partners_pkey ON public.partners USING btree (id);

CREATE UNIQUE INDEX product_assets_pkey ON public.product_assets USING btree (id);

CREATE INDEX product_assets_product_id_idx ON public.product_assets USING btree (product_id);

CREATE UNIQUE INDEX products_pkey ON public.products USING btree (id);

CREATE UNIQUE INDEX products_sku_unique ON public.products USING btree (sku) WHERE (sku IS NOT NULL);

CREATE UNIQUE INDEX profiles_pkey ON public.profiles USING btree (user_id);

CREATE UNIQUE INDEX uniq_inventory_status_distributor_product ON public.inventory_status USING btree (distributor_id, product_id);

alter table "public"."client_distributors" add constraint "client_distributors_pkey" PRIMARY KEY using index "client_distributors_pkey";

alter table "public"."documents" add constraint "documents_pkey" PRIMARY KEY using index "documents_pkey";

alter table "public"."inventory_movements" add constraint "inventory_movements_pkey" PRIMARY KEY using index "inventory_movements_pkey";

alter table "public"."inventory_status" add constraint "inventory_status_pkey" PRIMARY KEY using index "inventory_status_pkey";

alter table "public"."order_request_items" add constraint "order_request_items_pkey" PRIMARY KEY using index "order_request_items_pkey";

alter table "public"."order_requests" add constraint "order_requests_pkey" PRIMARY KEY using index "order_requests_pkey";

alter table "public"."partners" add constraint "partners_pkey" PRIMARY KEY using index "partners_pkey";

alter table "public"."product_assets" add constraint "product_assets_pkey" PRIMARY KEY using index "product_assets_pkey";

alter table "public"."products" add constraint "products_pkey" PRIMARY KEY using index "products_pkey";

alter table "public"."profiles" add constraint "profiles_pkey" PRIMARY KEY using index "profiles_pkey";

alter table "public"."client_distributors" add constraint "client_distributors_client_id_fkey" FOREIGN KEY (client_id) REFERENCES public.partners(id) ON DELETE CASCADE not valid;

alter table "public"."client_distributors" validate constraint "client_distributors_client_id_fkey";

alter table "public"."client_distributors" add constraint "client_distributors_distributor_id_fkey" FOREIGN KEY (distributor_id) REFERENCES public.partners(id) ON DELETE CASCADE not valid;

alter table "public"."client_distributors" validate constraint "client_distributors_distributor_id_fkey";

alter table "public"."documents" add constraint "documents_partner_id_fkey" FOREIGN KEY (partner_id) REFERENCES public.partners(id) ON DELETE CASCADE not valid;

alter table "public"."documents" validate constraint "documents_partner_id_fkey";

alter table "public"."documents" add constraint "documents_product_id_fkey" FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE SET NULL not valid;

alter table "public"."documents" validate constraint "documents_product_id_fkey";

alter table "public"."inventory_movements" add constraint "inventory_movements_distributor_id_fkey" FOREIGN KEY (distributor_id) REFERENCES public.partners(id) not valid;

alter table "public"."inventory_movements" validate constraint "inventory_movements_distributor_id_fkey";

alter table "public"."inventory_movements" add constraint "inventory_movements_order_request_id_fkey" FOREIGN KEY (order_request_id) REFERENCES public.order_requests(id) not valid;

alter table "public"."inventory_movements" validate constraint "inventory_movements_order_request_id_fkey";

alter table "public"."inventory_movements" add constraint "inventory_movements_product_id_fkey" FOREIGN KEY (product_id) REFERENCES public.products(id) not valid;

alter table "public"."inventory_movements" validate constraint "inventory_movements_product_id_fkey";

alter table "public"."inventory_status" add constraint "inventory_status_distributor_id_fkey" FOREIGN KEY (distributor_id) REFERENCES public.partners(id) not valid;

alter table "public"."inventory_status" validate constraint "inventory_status_distributor_id_fkey";

alter table "public"."inventory_status" add constraint "inventory_status_product_id_fkey" FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE not valid;

alter table "public"."inventory_status" validate constraint "inventory_status_product_id_fkey";

alter table "public"."order_request_items" add constraint "order_request_items_cases_qty_check" CHECK ((cases_qty > 0)) not valid;

alter table "public"."order_request_items" validate constraint "order_request_items_cases_qty_check";

alter table "public"."order_request_items" add constraint "order_request_items_order_request_id_fkey" FOREIGN KEY (order_request_id) REFERENCES public.order_requests(id) ON DELETE CASCADE not valid;

alter table "public"."order_request_items" validate constraint "order_request_items_order_request_id_fkey";

alter table "public"."order_request_items" add constraint "order_request_items_product_id_fkey" FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE RESTRICT not valid;

alter table "public"."order_request_items" validate constraint "order_request_items_product_id_fkey";

alter table "public"."order_requests" add constraint "order_requests_client_id_fkey" FOREIGN KEY (client_id) REFERENCES public.partners(id) not valid;

alter table "public"."order_requests" validate constraint "order_requests_client_id_fkey";

alter table "public"."order_requests" add constraint "order_requests_created_by_user_fkey" FOREIGN KEY (created_by_user) REFERENCES auth.users(id) ON DELETE RESTRICT not valid;

alter table "public"."order_requests" validate constraint "order_requests_created_by_user_fkey";

alter table "public"."order_requests" add constraint "order_requests_distributor_id_fkey" FOREIGN KEY (distributor_id) REFERENCES public.partners(id) not valid;

alter table "public"."order_requests" validate constraint "order_requests_distributor_id_fkey";

alter table "public"."order_requests" add constraint "order_requests_partner_id_fkey" FOREIGN KEY (partner_id) REFERENCES public.partners(id) ON DELETE CASCADE not valid;

alter table "public"."order_requests" validate constraint "order_requests_partner_id_fkey";

alter table "public"."product_assets" add constraint "product_assets_product_id_fkey" FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE not valid;

alter table "public"."product_assets" validate constraint "product_assets_product_id_fkey";

alter table "public"."profiles" add constraint "profiles_partner_id_fkey" FOREIGN KEY (partner_id) REFERENCES public.partners(id) ON DELETE SET NULL not valid;

alter table "public"."profiles" validate constraint "profiles_partner_id_fkey";

alter table "public"."profiles" add constraint "profiles_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."profiles" validate constraint "profiles_user_id_fkey";

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.accept_order(p_order_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare
  v_distributor_id uuid;
  v_status public.order_status_enum;
  v_insufficient boolean;
begin
  -- 1) Lock the order row (prevents race with cancel/reject/etc.)
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

  -- 3) Ensure inventory rows exist for every item (prevents silent no-op deductions)
  if exists (
    select 1
    from public.order_request_items i
    where i.order_request_id = p_order_id
      and not exists (
        select 1
        from public.inventory_status inv
        where inv.distributor_id = v_distributor_id
          and inv.product_id = i.product_id
      )
  ) then
    raise exception 'accept_order failed: missing inventory rows for one or more products';
  end if;

  -- 4) Lock all relevant inventory rows for this order (safe against concurrent accepts)
  perform 1
  from public.inventory_status inv
  join public.order_request_items i
    on i.product_id = inv.product_id
   and i.order_request_id = p_order_id
  where inv.distributor_id = v_distributor_id
  for update;

  -- 5) Check stock sufficiency under lock
  select exists (
    select 1
    from public.inventory_status inv
    join public.order_request_items i
      on i.product_id = inv.product_id
     and i.order_request_id = p_order_id
    where inv.distributor_id = v_distributor_id
      and inv.on_hand_qty < i.cases_qty
  )
  into v_insufficient;

  if v_insufficient then
    raise exception 'accept_order failed: insufficient stock for one or more items';
  end if;

  -- 6) Deduct inventory and recompute inventory status (ENUM CASTS ARE REQUIRED)
  update public.inventory_status inv
  set on_hand_qty = inv.on_hand_qty - i.cases_qty,
      status = case
        when (inv.on_hand_qty - i.cases_qty) <= 0
          then 'out'::public.inventory_status_enum
        when (inv.on_hand_qty - i.cases_qty) <= 10
          then 'limited'::public.inventory_status_enum
        else 'in_stock'::public.inventory_status_enum
      end,
      updated_at = now()
  from public.order_request_items i
  where i.order_request_id = p_order_id
    and inv.distributor_id = v_distributor_id
    and inv.product_id = i.product_id;

  -- 7) Audit trail: record inventory movements (one row per item)
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
    'order_accept',
    -i.cases_qty,
    now()
  from public.order_request_items i
  where i.order_request_id = p_order_id;

  -- 8) Mark order accepted + timestamp
  update public.order_requests
  set status = 'accepted'::public.order_status_enum,
      accepted_at = coalesce(accepted_at, now()),
      updated_at = now()
  where id = p_order_id;

end;
$function$
;

CREATE OR REPLACE FUNCTION public.cancel_order(p_order_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare
  v_status public.order_status_enum;
  v_created_by uuid;
  v_client_id uuid;
begin
  -- Lock the order row to prevent race with accept/reject
  select status, created_by_user, client_id
    into v_status, v_created_by, v_client_id
  from public.order_requests
  where id = p_order_id
  for update;

  if v_status is null then
    raise exception 'cancel_order failed: order not found';
  end if;

  -- Only allow cancel if still pre-accept
  if v_status not in ('created', 'submitted') then
    raise exception
      'cancel_order failed: order cannot be cancelled in status %',
      v_status;
  end if;

  -- Permission check:
  -- Allow if:
  -- 1) creator of order
  -- 2) admin
  if v_created_by <> auth.uid() and not public.mecanova_is_admin() then
    raise exception 'cancel_order failed: not allowed';
  end if;

  -- Perform cancellation
  update public.order_requests
  set status = 'cancelled'::public.order_status_enum,
      cancelled_at = coalesce(cancelled_at, now()),
      updated_at = now()
  where id = p_order_id;

end;
$function$
;

CREATE OR REPLACE FUNCTION public.create_order(p_distributor_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare
  v_client_id uuid;
  v_order_id uuid;
begin
  select p.partner_id
    into v_client_id
  from public.profiles p
  where p.user_id = auth.uid()
    and p.role = 'client';

  if v_client_id is null then
    raise exception 'create_order failed: caller is not a client';
  end if;

  if not exists (
    select 1
    from public.client_distributors cd
    where cd.client_id = v_client_id
      and cd.distributor_id = p_distributor_id
  ) then
    raise exception 'create_order failed: distributor not allowed for this client';
  end if;

  insert into public.order_requests (
    partner_id,
    client_id,
    distributor_id,
    created_by_user,
    status,
    created_at,
    updated_at
  ) values (
    v_client_id,
    v_client_id,
    p_distributor_id,
    auth.uid(),
    'created'::public.order_status_enum,
    now(),
    now()
  )
  returning id into v_order_id;

  return v_order_id;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.current_partner_id()
 RETURNS uuid
 LANGUAGE sql
 STABLE
AS $function$
  select p.partner_id
  from public.profiles p
  where p.user_id = auth.uid()
  limit 1
$function$
;

CREATE OR REPLACE FUNCTION public."current_role"()
 RETURNS text
 LANGUAGE sql
 STABLE
AS $function$
  select p.role::text
  from public.profiles p
  where p.user_id = auth.uid()
  limit 1
$function$
;

CREATE OR REPLACE FUNCTION public.fulfill_order(p_order_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare
  v_distributor_id uuid;
  v_status public.order_status_enum;
begin
  select distributor_id, status
    into v_distributor_id, v_status
  from public.order_requests
  where id = p_order_id
  for update;

  if v_distributor_id is null then
    raise exception 'fulfill_order failed: order not found';
  end if;

  if v_status <> 'accepted'::public.order_status_enum then
    raise exception 'fulfill_order failed: order status must be accepted (got %)', v_status;
  end if;

  if public.mecanova_current_partner_id() <> v_distributor_id and not public.mecanova_is_admin() then
    raise exception 'fulfill_order failed: not allowed';
  end if;

  update public.order_requests
  set status = 'fulfilled'::public.order_status_enum,
      fulfilled_at = coalesce(fulfilled_at, now()),
      updated_at = now()
  where id = p_order_id;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.is_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE
AS $function$
  select coalesce(public.current_role() = 'admin', false)
$function$
;

CREATE OR REPLACE FUNCTION public.mecanova_current_partner_id()
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select p.partner_id
  from public.profiles p
  where p.user_id = auth.uid()
  limit 1
$function$
;

CREATE OR REPLACE FUNCTION public.mecanova_current_role()
 RETURNS text
 LANGUAGE sql
 STABLE
AS $function$
  select p.role::text
  from public.profiles p
  where p.user_id = auth.uid()
  limit 1
$function$
;

CREATE OR REPLACE FUNCTION public.mecanova_is_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select coalesce((
    select (p.role = 'admin')
    from public.profiles p
    where p.user_id = auth.uid()
    limit 1
  ), false)
$function$
;

CREATE OR REPLACE FUNCTION public.reject_order(p_order_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare
  v_distributor_id uuid;
  v_status public.order_status_enum;
begin
  select distributor_id, status
    into v_distributor_id, v_status
  from public.order_requests
  where id = p_order_id
  for update;

  if v_distributor_id is null then
    raise exception 'reject_order failed: order not found';
  end if;

  if v_status <> 'submitted'::public.order_status_enum then
    raise exception 'reject_order failed: order status must be submitted (got %)', v_status;
  end if;

  if public.mecanova_current_partner_id() <> v_distributor_id and not public.mecanova_is_admin() then
    raise exception 'reject_order failed: not allowed';
  end if;

  update public.order_requests
  set status = 'rejected'::public.order_status_enum,
      rejected_at = coalesce(rejected_at, now()),
      updated_at = now()
  where id = p_order_id;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.rls_auto_enable()
 RETURNS event_trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.set_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  new.updated_at = now();
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.submit_order(p_order_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin
  update public.order_requests
  set status = 'submitted'::public.order_status_enum,
      submitted_at = coalesce(submitted_at, now()),
      updated_at = now()
  where id = p_order_id
    and status = 'created'::public.order_status_enum
    and created_by_user = auth.uid();

  if not found then
    raise exception 'submit_order failed: not found, not owner, or status not created';
  end if;
end;
$function$
;

grant delete on table "public"."client_distributors" to "anon";

grant insert on table "public"."client_distributors" to "anon";

grant references on table "public"."client_distributors" to "anon";

grant select on table "public"."client_distributors" to "anon";

grant trigger on table "public"."client_distributors" to "anon";

grant truncate on table "public"."client_distributors" to "anon";

grant update on table "public"."client_distributors" to "anon";

grant delete on table "public"."client_distributors" to "authenticated";

grant insert on table "public"."client_distributors" to "authenticated";

grant references on table "public"."client_distributors" to "authenticated";

grant select on table "public"."client_distributors" to "authenticated";

grant trigger on table "public"."client_distributors" to "authenticated";

grant truncate on table "public"."client_distributors" to "authenticated";

grant update on table "public"."client_distributors" to "authenticated";

grant delete on table "public"."client_distributors" to "service_role";

grant insert on table "public"."client_distributors" to "service_role";

grant references on table "public"."client_distributors" to "service_role";

grant select on table "public"."client_distributors" to "service_role";

grant trigger on table "public"."client_distributors" to "service_role";

grant truncate on table "public"."client_distributors" to "service_role";

grant update on table "public"."client_distributors" to "service_role";

grant delete on table "public"."documents" to "anon";

grant insert on table "public"."documents" to "anon";

grant references on table "public"."documents" to "anon";

grant select on table "public"."documents" to "anon";

grant trigger on table "public"."documents" to "anon";

grant truncate on table "public"."documents" to "anon";

grant update on table "public"."documents" to "anon";

grant delete on table "public"."documents" to "authenticated";

grant insert on table "public"."documents" to "authenticated";

grant references on table "public"."documents" to "authenticated";

grant select on table "public"."documents" to "authenticated";

grant trigger on table "public"."documents" to "authenticated";

grant truncate on table "public"."documents" to "authenticated";

grant update on table "public"."documents" to "authenticated";

grant delete on table "public"."documents" to "service_role";

grant insert on table "public"."documents" to "service_role";

grant references on table "public"."documents" to "service_role";

grant select on table "public"."documents" to "service_role";

grant trigger on table "public"."documents" to "service_role";

grant truncate on table "public"."documents" to "service_role";

grant update on table "public"."documents" to "service_role";

grant delete on table "public"."inventory_movements" to "anon";

grant insert on table "public"."inventory_movements" to "anon";

grant references on table "public"."inventory_movements" to "anon";

grant select on table "public"."inventory_movements" to "anon";

grant trigger on table "public"."inventory_movements" to "anon";

grant truncate on table "public"."inventory_movements" to "anon";

grant update on table "public"."inventory_movements" to "anon";

grant delete on table "public"."inventory_movements" to "authenticated";

grant insert on table "public"."inventory_movements" to "authenticated";

grant references on table "public"."inventory_movements" to "authenticated";

grant select on table "public"."inventory_movements" to "authenticated";

grant trigger on table "public"."inventory_movements" to "authenticated";

grant truncate on table "public"."inventory_movements" to "authenticated";

grant update on table "public"."inventory_movements" to "authenticated";

grant delete on table "public"."inventory_movements" to "service_role";

grant insert on table "public"."inventory_movements" to "service_role";

grant references on table "public"."inventory_movements" to "service_role";

grant select on table "public"."inventory_movements" to "service_role";

grant trigger on table "public"."inventory_movements" to "service_role";

grant truncate on table "public"."inventory_movements" to "service_role";

grant update on table "public"."inventory_movements" to "service_role";

grant delete on table "public"."inventory_status" to "anon";

grant insert on table "public"."inventory_status" to "anon";

grant references on table "public"."inventory_status" to "anon";

grant select on table "public"."inventory_status" to "anon";

grant trigger on table "public"."inventory_status" to "anon";

grant truncate on table "public"."inventory_status" to "anon";

grant update on table "public"."inventory_status" to "anon";

grant delete on table "public"."inventory_status" to "authenticated";

grant insert on table "public"."inventory_status" to "authenticated";

grant references on table "public"."inventory_status" to "authenticated";

grant select on table "public"."inventory_status" to "authenticated";

grant trigger on table "public"."inventory_status" to "authenticated";

grant truncate on table "public"."inventory_status" to "authenticated";

grant update on table "public"."inventory_status" to "authenticated";

grant delete on table "public"."inventory_status" to "service_role";

grant insert on table "public"."inventory_status" to "service_role";

grant references on table "public"."inventory_status" to "service_role";

grant select on table "public"."inventory_status" to "service_role";

grant trigger on table "public"."inventory_status" to "service_role";

grant truncate on table "public"."inventory_status" to "service_role";

grant update on table "public"."inventory_status" to "service_role";

grant delete on table "public"."order_request_items" to "anon";

grant insert on table "public"."order_request_items" to "anon";

grant references on table "public"."order_request_items" to "anon";

grant select on table "public"."order_request_items" to "anon";

grant trigger on table "public"."order_request_items" to "anon";

grant truncate on table "public"."order_request_items" to "anon";

grant update on table "public"."order_request_items" to "anon";

grant delete on table "public"."order_request_items" to "authenticated";

grant insert on table "public"."order_request_items" to "authenticated";

grant references on table "public"."order_request_items" to "authenticated";

grant select on table "public"."order_request_items" to "authenticated";

grant trigger on table "public"."order_request_items" to "authenticated";

grant truncate on table "public"."order_request_items" to "authenticated";

grant update on table "public"."order_request_items" to "authenticated";

grant delete on table "public"."order_request_items" to "service_role";

grant insert on table "public"."order_request_items" to "service_role";

grant references on table "public"."order_request_items" to "service_role";

grant select on table "public"."order_request_items" to "service_role";

grant trigger on table "public"."order_request_items" to "service_role";

grant truncate on table "public"."order_request_items" to "service_role";

grant update on table "public"."order_request_items" to "service_role";

grant delete on table "public"."order_requests" to "anon";

grant insert on table "public"."order_requests" to "anon";

grant references on table "public"."order_requests" to "anon";

grant select on table "public"."order_requests" to "anon";

grant trigger on table "public"."order_requests" to "anon";

grant truncate on table "public"."order_requests" to "anon";

grant update on table "public"."order_requests" to "anon";

grant delete on table "public"."order_requests" to "authenticated";

grant insert on table "public"."order_requests" to "authenticated";

grant references on table "public"."order_requests" to "authenticated";

grant select on table "public"."order_requests" to "authenticated";

grant trigger on table "public"."order_requests" to "authenticated";

grant truncate on table "public"."order_requests" to "authenticated";

grant update on table "public"."order_requests" to "authenticated";

grant delete on table "public"."order_requests" to "service_role";

grant insert on table "public"."order_requests" to "service_role";

grant references on table "public"."order_requests" to "service_role";

grant select on table "public"."order_requests" to "service_role";

grant trigger on table "public"."order_requests" to "service_role";

grant truncate on table "public"."order_requests" to "service_role";

grant update on table "public"."order_requests" to "service_role";

grant delete on table "public"."partners" to "anon";

grant insert on table "public"."partners" to "anon";

grant references on table "public"."partners" to "anon";

grant select on table "public"."partners" to "anon";

grant trigger on table "public"."partners" to "anon";

grant truncate on table "public"."partners" to "anon";

grant update on table "public"."partners" to "anon";

grant delete on table "public"."partners" to "authenticated";

grant insert on table "public"."partners" to "authenticated";

grant references on table "public"."partners" to "authenticated";

grant select on table "public"."partners" to "authenticated";

grant trigger on table "public"."partners" to "authenticated";

grant truncate on table "public"."partners" to "authenticated";

grant update on table "public"."partners" to "authenticated";

grant delete on table "public"."partners" to "service_role";

grant insert on table "public"."partners" to "service_role";

grant references on table "public"."partners" to "service_role";

grant select on table "public"."partners" to "service_role";

grant trigger on table "public"."partners" to "service_role";

grant truncate on table "public"."partners" to "service_role";

grant update on table "public"."partners" to "service_role";

grant delete on table "public"."product_assets" to "anon";

grant insert on table "public"."product_assets" to "anon";

grant references on table "public"."product_assets" to "anon";

grant select on table "public"."product_assets" to "anon";

grant trigger on table "public"."product_assets" to "anon";

grant truncate on table "public"."product_assets" to "anon";

grant update on table "public"."product_assets" to "anon";

grant delete on table "public"."product_assets" to "authenticated";

grant insert on table "public"."product_assets" to "authenticated";

grant references on table "public"."product_assets" to "authenticated";

grant select on table "public"."product_assets" to "authenticated";

grant trigger on table "public"."product_assets" to "authenticated";

grant truncate on table "public"."product_assets" to "authenticated";

grant update on table "public"."product_assets" to "authenticated";

grant delete on table "public"."product_assets" to "service_role";

grant insert on table "public"."product_assets" to "service_role";

grant references on table "public"."product_assets" to "service_role";

grant select on table "public"."product_assets" to "service_role";

grant trigger on table "public"."product_assets" to "service_role";

grant truncate on table "public"."product_assets" to "service_role";

grant update on table "public"."product_assets" to "service_role";

grant delete on table "public"."products" to "anon";

grant insert on table "public"."products" to "anon";

grant references on table "public"."products" to "anon";

grant select on table "public"."products" to "anon";

grant trigger on table "public"."products" to "anon";

grant truncate on table "public"."products" to "anon";

grant update on table "public"."products" to "anon";

grant delete on table "public"."products" to "authenticated";

grant insert on table "public"."products" to "authenticated";

grant references on table "public"."products" to "authenticated";

grant select on table "public"."products" to "authenticated";

grant trigger on table "public"."products" to "authenticated";

grant truncate on table "public"."products" to "authenticated";

grant update on table "public"."products" to "authenticated";

grant delete on table "public"."products" to "service_role";

grant insert on table "public"."products" to "service_role";

grant references on table "public"."products" to "service_role";

grant select on table "public"."products" to "service_role";

grant trigger on table "public"."products" to "service_role";

grant truncate on table "public"."products" to "service_role";

grant update on table "public"."products" to "service_role";

grant delete on table "public"."profiles" to "anon";

grant insert on table "public"."profiles" to "anon";

grant references on table "public"."profiles" to "anon";

grant select on table "public"."profiles" to "anon";

grant trigger on table "public"."profiles" to "anon";

grant truncate on table "public"."profiles" to "anon";

grant update on table "public"."profiles" to "anon";

grant delete on table "public"."profiles" to "authenticated";

grant insert on table "public"."profiles" to "authenticated";

grant references on table "public"."profiles" to "authenticated";

grant select on table "public"."profiles" to "authenticated";

grant trigger on table "public"."profiles" to "authenticated";

grant truncate on table "public"."profiles" to "authenticated";

grant update on table "public"."profiles" to "authenticated";

grant delete on table "public"."profiles" to "service_role";

grant insert on table "public"."profiles" to "service_role";

grant references on table "public"."profiles" to "service_role";

grant select on table "public"."profiles" to "service_role";

grant trigger on table "public"."profiles" to "service_role";

grant truncate on table "public"."profiles" to "service_role";

grant update on table "public"."profiles" to "service_role";


  create policy "Admins can manage client_distributors"
  on "public"."client_distributors"
  as permissive
  for all
  to authenticated
using (public.mecanova_is_admin())
with check (public.mecanova_is_admin());



  create policy "Orgs can view their mappings"
  on "public"."client_distributors"
  as permissive
  for select
  to authenticated
using ((public.mecanova_is_admin() OR (client_id = public.mecanova_current_partner_id()) OR (distributor_id = public.mecanova_current_partner_id())));



  create policy "Manage own org documents"
  on "public"."documents"
  as permissive
  for all
  to authenticated
using ((public.mecanova_is_admin() OR (partner_id = public.mecanova_current_partner_id())))
with check ((public.mecanova_is_admin() OR (partner_id = public.mecanova_current_partner_id())));



  create policy "Read own org documents"
  on "public"."documents"
  as permissive
  for select
  to authenticated
using ((public.mecanova_is_admin() OR (partner_id = public.mecanova_current_partner_id())));



  create policy "invmov_delete_none"
  on "public"."inventory_movements"
  as permissive
  for delete
  to authenticated
using (false);



  create policy "invmov_insert_own_or_admin"
  on "public"."inventory_movements"
  as permissive
  for insert
  to authenticated
with check ((public.mecanova_is_admin() OR (distributor_id = public.mecanova_current_partner_id())));



  create policy "invmov_select_own_or_admin"
  on "public"."inventory_movements"
  as permissive
  for select
  to authenticated
using ((public.mecanova_is_admin() OR (distributor_id = public.mecanova_current_partner_id())));



  create policy "invmov_update_none"
  on "public"."inventory_movements"
  as permissive
  for update
  to authenticated
using (false);



  create policy "Clients can view allowed distributor inventory"
  on "public"."inventory_status"
  as permissive
  for select
  to authenticated
using ((public.mecanova_is_admin() OR ((public.mecanova_current_role() = 'client'::text) AND (EXISTS ( SELECT 1
   FROM public.client_distributors cd
  WHERE ((cd.client_id = public.mecanova_current_partner_id()) AND (cd.distributor_id = inventory_status.distributor_id))))) OR ((public.mecanova_current_role() = 'distributor'::text) AND (distributor_id = public.mecanova_current_partner_id()))));



  create policy "Distributors can manage own inventory"
  on "public"."inventory_status"
  as permissive
  for all
  to authenticated
using ((public.mecanova_is_admin() OR ((public.mecanova_current_role() = 'distributor'::text) AND (distributor_id = public.mecanova_current_partner_id()))))
with check ((public.mecanova_is_admin() OR ((public.mecanova_current_role() = 'distributor'::text) AND (distributor_id = public.mecanova_current_partner_id()))));



  create policy "Clients can create order items"
  on "public"."order_request_items"
  as permissive
  for insert
  to authenticated
with check ((public.mecanova_is_admin() OR (EXISTS ( SELECT 1
   FROM public.order_requests r
  WHERE ((r.id = order_request_items.order_request_id) AND (r.client_id = public.mecanova_current_partner_id()))))));



  create policy "Update relevant order items"
  on "public"."order_request_items"
  as permissive
  for update
  to authenticated
using ((public.mecanova_is_admin() OR (EXISTS ( SELECT 1
   FROM public.order_requests r
  WHERE ((r.id = order_request_items.order_request_id) AND ((r.client_id = public.mecanova_current_partner_id()) OR (r.distributor_id = public.mecanova_current_partner_id())))))))
with check ((public.mecanova_is_admin() OR (EXISTS ( SELECT 1
   FROM public.order_requests r
  WHERE ((r.id = order_request_items.order_request_id) AND ((r.client_id = public.mecanova_current_partner_id()) OR (r.distributor_id = public.mecanova_current_partner_id())))))));



  create policy "order items select admin"
  on "public"."order_request_items"
  as permissive
  for select
  to authenticated
using (public.mecanova_is_admin());



  create policy "order items select client"
  on "public"."order_request_items"
  as permissive
  for select
  to authenticated
using ((EXISTS ( SELECT 1
   FROM public.order_requests o
  WHERE ((o.id = order_request_items.order_request_id) AND (o.client_id = public.mecanova_current_partner_id()) AND (public.mecanova_current_role() = 'client'::text)))));



  create policy "order items select distributor (no drafts)"
  on "public"."order_request_items"
  as permissive
  for select
  to authenticated
using ((EXISTS ( SELECT 1
   FROM public.order_requests o
  WHERE ((o.id = order_request_items.order_request_id) AND (o.distributor_id = public.mecanova_current_partner_id()) AND (public.mecanova_current_role() = 'distributor'::text) AND (o.status <> 'created'::public.order_status_enum)))));



  create policy "Clients can create orders"
  on "public"."order_requests"
  as permissive
  for insert
  to authenticated
with check ((public.mecanova_is_admin() OR ((public.mecanova_current_role() = 'client'::text) AND (client_id = public.mecanova_current_partner_id()) AND (EXISTS ( SELECT 1
   FROM public.client_distributors cd
  WHERE ((cd.client_id = order_requests.client_id) AND (cd.distributor_id = order_requests.distributor_id)))))));



  create policy "Update relevant orders"
  on "public"."order_requests"
  as permissive
  for update
  to authenticated
using ((public.mecanova_is_admin() OR (client_id = public.mecanova_current_partner_id()) OR (distributor_id = public.mecanova_current_partner_id())))
with check ((public.mecanova_is_admin() OR (client_id = public.mecanova_current_partner_id()) OR (distributor_id = public.mecanova_current_partner_id())));



  create policy "order_requests update by assigned distributor"
  on "public"."order_requests"
  as permissive
  for update
  to authenticated
using ((distributor_id = public.mecanova_current_partner_id()))
with check ((distributor_id = public.mecanova_current_partner_id()));



  create policy "order_requests update by creator in created/submitted"
  on "public"."order_requests"
  as permissive
  for update
  to authenticated
using (((created_by_user = auth.uid()) AND (status = ANY (ARRAY['created'::public.order_status_enum, 'submitted'::public.order_status_enum]))))
with check ((created_by_user = auth.uid()));



  create policy "orders select admin"
  on "public"."order_requests"
  as permissive
  for select
  to authenticated
using (public.mecanova_is_admin());



  create policy "orders select client"
  on "public"."order_requests"
  as permissive
  for select
  to authenticated
using (((public.mecanova_current_role() = 'client'::text) AND (client_id = public.mecanova_current_partner_id())));



  create policy "orders select distributor (no drafts)"
  on "public"."order_requests"
  as permissive
  for select
  to authenticated
using (((public.mecanova_current_role() = 'distributor'::text) AND (distributor_id = public.mecanova_current_partner_id()) AND (status <> 'created'::public.order_status_enum)));



  create policy "Admins can manage orgs"
  on "public"."partners"
  as permissive
  for all
  to authenticated
using (public.mecanova_is_admin())
with check (public.mecanova_is_admin());



  create policy "Users can view own org"
  on "public"."partners"
  as permissive
  for select
  to authenticated
using ((public.mecanova_is_admin() OR (id = public.mecanova_current_partner_id())));



  create policy "product_assets_select_authenticated"
  on "public"."product_assets"
  as permissive
  for select
  to authenticated
using (true);



  create policy "Admins can manage products"
  on "public"."products"
  as permissive
  for all
  to authenticated
using (public.mecanova_is_admin())
with check (public.mecanova_is_admin());



  create policy "Authenticated can read products"
  on "public"."products"
  as permissive
  for select
  to authenticated
using (true);



  create policy "Admins can manage profiles"
  on "public"."profiles"
  as permissive
  for all
  to authenticated
using (public.mecanova_is_admin())
with check (public.mecanova_is_admin());



  create policy "Users can update own profile"
  on "public"."profiles"
  as permissive
  for update
  to authenticated
using (((user_id = auth.uid()) OR public.mecanova_is_admin()))
with check (((user_id = auth.uid()) OR public.mecanova_is_admin()));



  create policy "Users can view own profile"
  on "public"."profiles"
  as permissive
  for select
  to authenticated
using (((user_id = auth.uid()) OR public.mecanova_is_admin()));


CREATE TRIGGER trg_order_requests_updated_at BEFORE UPDATE ON public.order_requests FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


