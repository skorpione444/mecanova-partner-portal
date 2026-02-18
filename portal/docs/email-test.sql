-- SQL Test Script for Email Outbox System
-- Creates test data and triggers email enqueueing
-- Run this after: supabase db reset

-- ============================================================================
-- 1. Create test distributor partner (if not exists)
-- ============================================================================

DO $$
DECLARE
  test_distributor_id uuid;
BEGIN
  -- Check if test distributor partner exists
  SELECT id INTO test_distributor_id
  FROM public.partners
  WHERE name = 'Test Distributor'
  LIMIT 1;

  -- Create if missing
  IF test_distributor_id IS NULL THEN
    INSERT INTO public.partners (id, name, partner_type)
    VALUES (gen_random_uuid(), 'Test Distributor', 'distributor')
    RETURNING id INTO test_distributor_id;
  END IF;

  -- Store in temp variable for later use
  PERFORM set_config('app.test_distributor_id', test_distributor_id::text, false);
END $$;

-- ============================================================================
-- 2. Create test client partner (if not exists)
-- ============================================================================

DO $$
DECLARE
  test_client_id uuid;
BEGIN
  -- Check if test client partner exists
  SELECT id INTO test_client_id
  FROM public.partners
  WHERE name = 'Test Client'
  LIMIT 1;

  -- Create if missing
  IF test_client_id IS NULL THEN
    INSERT INTO public.partners (id, name, partner_type)
    VALUES (gen_random_uuid(), 'Test Client', 'client')
    RETURNING id INTO test_client_id;
  END IF;

  -- Store in temp variable for later use
  PERFORM set_config('app.test_client_id', test_client_id::text, false);
END $$;

-- ============================================================================
-- 3. Create test distributor auth user + profile (if not exists)
-- ============================================================================

DO $$
DECLARE
  test_distributor_user_id uuid;
  test_distributor_partner_id uuid;
  test_distributor_email text := 'distributor@test.local';
  instance_uuid uuid;
BEGIN
  -- Get distributor partner ID
  SELECT id INTO test_distributor_partner_id
  FROM public.partners
  WHERE name = 'Test Distributor'
  LIMIT 1;

  -- Get instance_id (use first available or create default)
  SELECT id INTO instance_uuid FROM auth.instances LIMIT 1;
  IF instance_uuid IS NULL THEN
    instance_uuid := '00000000-0000-0000-0000-000000000000';
  END IF;

  -- Check if user exists
  SELECT id INTO test_distributor_user_id
  FROM auth.users
  WHERE email = test_distributor_email
  LIMIT 1;

  -- Create auth user if missing
  IF test_distributor_user_id IS NULL THEN
    INSERT INTO auth.users (
      id,
      instance_id,
      email,
      encrypted_password,
      email_confirmed_at,
      created_at,
      updated_at,
      raw_app_meta_data,
      raw_user_meta_data,
      is_super_admin,
      role,
      aud
    ) VALUES (
      gen_random_uuid(),
      instance_uuid,
      test_distributor_email,
      crypt('test-password', gen_salt('bf')),
      now(),
      now(),
      now(),
      '{"provider":"email","providers":["email"]}',
      '{}',
      false,
      'authenticated',
      'authenticated'
    )
    RETURNING id INTO test_distributor_user_id;
  END IF;

  -- Create profile if missing
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles WHERE user_id = test_distributor_user_id
  ) THEN
    INSERT INTO public.profiles (user_id, partner_id, role)
    VALUES (test_distributor_user_id, test_distributor_partner_id, 'distributor');
  END IF;
END $$;

-- ============================================================================
-- 4. Create test client auth user + profile (if not exists)
-- ============================================================================

DO $$
DECLARE
  test_client_user_id uuid;
  test_client_partner_id uuid;
  test_client_email text := 'client@test.local';
  instance_uuid uuid;
BEGIN
  -- Get client partner ID
  SELECT id INTO test_client_partner_id
  FROM public.partners
  WHERE name = 'Test Client'
  LIMIT 1;

  -- Get instance_id (use first available or create default)
  SELECT id INTO instance_uuid FROM auth.instances LIMIT 1;
  IF instance_uuid IS NULL THEN
    instance_uuid := '00000000-0000-0000-0000-000000000000';
  END IF;

  -- Check if user exists
  SELECT id INTO test_client_user_id
  FROM auth.users
  WHERE email = test_client_email
  LIMIT 1;

  -- Create auth user if missing
  IF test_client_user_id IS NULL THEN
    INSERT INTO auth.users (
      id,
      instance_id,
      email,
      encrypted_password,
      email_confirmed_at,
      created_at,
      updated_at,
      raw_app_meta_data,
      raw_user_meta_data,
      is_super_admin,
      role,
      aud
    ) VALUES (
      gen_random_uuid(),
      instance_uuid,
      test_client_email,
      crypt('test-password', gen_salt('bf')),
      now(),
      now(),
      now(),
      '{"provider":"email","providers":["email"]}',
      '{}',
      false,
      'authenticated',
      'authenticated'
    )
    RETURNING id INTO test_client_user_id;
  END IF;

  -- Create profile if missing
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles WHERE user_id = test_client_user_id
  ) THEN
    INSERT INTO public.profiles (user_id, partner_id, role)
    VALUES (test_client_user_id, test_client_partner_id, 'client');
  END IF;
END $$;

-- ============================================================================
-- 5. Create test order in 'created' status
-- ============================================================================

DO $$
DECLARE
  test_order_id uuid;
  test_client_partner_id uuid;
  test_distributor_partner_id uuid;
  test_client_user_id uuid;
BEGIN
  -- Get partner IDs
  SELECT id INTO test_client_partner_id FROM public.partners WHERE name = 'Test Client' LIMIT 1;
  SELECT id INTO test_distributor_partner_id FROM public.partners WHERE name = 'Test Distributor' LIMIT 1;
  
  -- Get client user ID
  SELECT user_id INTO test_client_user_id
  FROM public.profiles
  WHERE partner_id = test_client_partner_id AND role = 'client'
  LIMIT 1;

  -- Create test order if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM public.order_requests
    WHERE client_id = test_client_partner_id
      AND distributor_id = test_distributor_partner_id
      AND status = 'created'
    LIMIT 1
  ) THEN
    INSERT INTO public.order_requests (
      partner_id,
      created_by_user,
      status,
      client_id,
      distributor_id,
      notes
    )
    VALUES (
      test_client_partner_id,
      test_client_user_id,
      'created',
      test_client_partner_id,
      test_distributor_partner_id,
      'Test order for email outbox testing'
    )
    RETURNING id INTO test_order_id;

    RAISE NOTICE 'Created test order with ID: %', test_order_id;
  ELSE
    SELECT id INTO test_order_id
    FROM public.order_requests
    WHERE client_id = test_client_partner_id
      AND distributor_id = test_distributor_partner_id
      AND status = 'created'
    LIMIT 1;
    
    RAISE NOTICE 'Using existing test order with ID: %', test_order_id;
  END IF;
END $$;

-- ============================================================================
-- 6. Update order to 'submitted' to trigger email enqueue
-- ============================================================================

DO $$
DECLARE
  test_order_id uuid;
  test_client_partner_id uuid;
  test_distributor_partner_id uuid;
BEGIN
  -- Get partner IDs
  SELECT id INTO test_client_partner_id FROM public.partners WHERE name = 'Test Client' LIMIT 1;
  SELECT id INTO test_distributor_partner_id FROM public.partners WHERE name = 'Test Distributor' LIMIT 1;

  -- Get test order ID
  SELECT id INTO test_order_id
  FROM public.order_requests
  WHERE client_id = test_client_partner_id
    AND distributor_id = test_distributor_partner_id
  ORDER BY created_at DESC
  LIMIT 1;

  IF test_order_id IS NOT NULL THEN
    -- Update to 'submitted' (this should trigger email to distributor)
    UPDATE public.order_requests
    SET 
      status = 'submitted',
      submitted_at = now()
    WHERE id = test_order_id;

    RAISE NOTICE 'Updated order % to status: submitted', test_order_id;
  ELSE
    RAISE EXCEPTION 'No test order found';
  END IF;
END $$;

-- ============================================================================
-- 7. Verify email_outbox row was created
-- ============================================================================

SELECT 
  id,
  created_at,
  status,
  to_email,
  template,
  subject,
  payload->>'order_request_id' as order_request_id,
  payload->>'status' as order_status
FROM public.email_outbox
ORDER BY created_at DESC
LIMIT 5;

