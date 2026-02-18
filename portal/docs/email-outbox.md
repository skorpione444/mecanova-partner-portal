# Email Outbox Pattern - Setup & Deployment Guide

This document describes the email outbox pattern implementation for automatic order status change notifications.

## Overview

The email outbox pattern ensures reliable email delivery by:
1. **Database trigger** enqueues email jobs into `email_outbox` table when `order_requests.status` changes
2. **Edge function worker** polls pending emails and sends via Resend API
3. **Idempotent processing** with status tracking (pending → sent/failed)

## Architecture

### Email Events

- **Status → 'submitted'**: Email sent to distributor
- **Status → 'accepted'**: Email sent to client
- **Status → 'rejected'**: Email sent to client

### Email Recipient Resolution

Recipients are automatically resolved via:
- `profiles.user_id` → `auth.users.email`
- Filtered by `profiles.partner_id` and `profiles.role`
- If no email found, email is not enqueued (silent skip)

## Required Secrets

### Local Development

For local testing with DRY_RUN mode (recommended - no real emails sent):

```env
DRY_RUN=true
SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_SERVICE_ROLE_KEY=your-local-service-role-key
PORTAL_BASE_URL=http://localhost:3000
```

**Note:** When `DRY_RUN=true`, the function will log email payloads to the console and mark emails as 'sent' without calling the Resend API. This is perfect for local testing.

For local testing with real emails (not recommended):

```env
RESEND_API_KEY=re_xxxxxxxxxxxxx
RESEND_FROM=noreply@yourdomain.com
PORTAL_BASE_URL=http://localhost:3000
CRON_SECRET=your-local-secret-key
SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_SERVICE_ROLE_KEY=your-local-service-role-key
DRY_RUN=false
```

### Production (Supabase Cloud)

Set these secrets in Supabase Dashboard → Project Settings → Edge Functions → Secrets:

- `RESEND_API_KEY`: Your Resend API key
- `RESEND_FROM`: Sender email address (must be verified in Resend)
- `PORTAL_BASE_URL`: Your production portal URL (e.g., `https://portal.example.com`)
- `CRON_SECRET`: Random secret string for cron authentication
- `SUPABASE_URL`: Your Supabase project URL (auto-set, but verify)
- `SUPABASE_SERVICE_ROLE_KEY`: Your Supabase service role key (auto-set, but verify)

## Local Testing Procedure (DRY RUN Mode)

**Important:** Local testing uses DRY_RUN mode by default, which means **no real emails are sent**. The function will log email payloads to the console and mark emails as 'sent' without calling the Resend API.

### 1. Start Local Supabase

```bash
cd portal
npm run sb:start
```

### 2. Reset Database (Apply Migrations)

```bash
npm run sb:reset
```

This applies all migrations including the email_outbox migration.

### 3. Set Local Environment Variables

The edge function will automatically use DRY_RUN mode when `DRY_RUN=true` is set. Create or update `.env.local` in the portal directory (or set environment variables):

```env
DRY_RUN=true
SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_SERVICE_ROLE_KEY=<get from: npm run sb:status>
PORTAL_BASE_URL=http://localhost:3000
```

**Note:** In DRY_RUN mode, `RESEND_API_KEY` and `RESEND_FROM` are not required.

### 4. Create Test Data and Trigger Email

Use the provided SQL test script to create test data:

```bash
# Connect to local database
supabase db connect

# Run the test script (copy/paste contents of docs/email-test.sql)
# Or use psql:
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -f portal/docs/email-test.sql
```

The test script will:
1. Create test distributor partner + auth user + profile
2. Create test client partner + auth user + profile
3. Create a test order in 'created' status
4. Update order to 'submitted' (triggers email enqueue)
5. Display the created email_outbox row

**Verify email was enqueued:**
```sql
SELECT id, status, to_email, template, subject, payload->>'order_request_id' as order_id
FROM email_outbox 
WHERE status = 'pending'
ORDER BY created_at DESC;
```

Expected result: One row with `to_email='distributor@test.local'`, `template='order_submitted_to_distributor'`.

### 5. Serve Edge Function Locally

```bash
# In portal directory, serve the function
supabase functions serve email-outbox-worker

# The function will automatically use DRY_RUN mode if DRY_RUN=true is set
# You'll see output like:
# Functions URL: http://127.0.0.1:54321/functions/v1/email-outbox-worker
```

### 6. Invoke Edge Function (Process Pending Emails)

In another terminal, invoke the function:

```bash
curl -X POST http://127.0.0.1:54321/functions/v1/email-outbox-worker \
  -H "Content-Type: application/json"
```

**Expected response:**
```json
{
  "processed": 1,
  "sent": 1,
  "failed": 0,
  "dry_run": true
}
```

**Check function logs** (in the terminal where you ran `supabase functions serve`):
- You should see `[DRY_RUN] Would send email:` logs with the email payload
- No actual API calls to Resend

### 7. Verify Email Was Processed

```sql
SELECT id, status, to_email, template, sent_at, last_error
FROM email_outbox 
ORDER BY created_at DESC 
LIMIT 5;
```

Expected result: Row status changed from `'pending'` to `'sent'`, `sent_at` is set.

### 8. Test Other Status Changes

You can test 'accepted' and 'rejected' status changes:

```sql
-- Get test order ID
SELECT id FROM order_requests 
WHERE notes = 'Test order for email outbox testing'
LIMIT 1;

-- Update to 'accepted' (triggers email to client)
UPDATE order_requests 
SET status = 'accepted', accepted_at = now()
WHERE notes = 'Test order for email outbox testing';

-- Check new email row
SELECT * FROM email_outbox WHERE status = 'pending' ORDER BY created_at DESC LIMIT 1;

-- Process it
-- (Invoke the function again via curl)

-- Update to 'rejected' (triggers another email to client)
UPDATE order_requests 
SET status = 'rejected', rejected_at = now()
WHERE notes = 'Test order for email outbox testing';
```

## Manual Testing (Without Test Script)

If you prefer to test with existing data:

### 1. Find an Existing Order

```sql
SELECT id, client_id, distributor_id, status 
FROM order_requests 
LIMIT 5;
```

### 2. Verify Recipient Emails Exist

```sql
-- Check distributor email
SELECT auth.users.email
FROM auth.users
JOIN public.profiles ON profiles.user_id = auth.users.id
WHERE profiles.partner_id = '<distributor-id>'
  AND profiles.role = 'distributor';

-- Check client email
SELECT auth.users.email
FROM auth.users
JOIN public.profiles ON profiles.user_id = auth.users.id
WHERE profiles.partner_id = '<client-id>'
  AND profiles.role = 'client';
```

### 3. Update Order Status

```sql
-- Update to 'submitted' (triggers email to distributor)
UPDATE order_requests 
SET status = 'submitted', submitted_at = now()
WHERE id = '<order-id>';

-- Verify email was enqueued
SELECT * FROM email_outbox WHERE status = 'pending';
```

### 4. Process Emails

Invoke the edge function as described in step 6 above.

## Deployment Procedure

### 1. Deploy Migration

```bash
cd portal
npm run sb:push
```

This pushes all pending migrations to production, including the email_outbox migration.

**⚠️ Important:** Always test migrations locally first with `npm run sb:reset`.

### 2. Deploy Edge Function

```bash
cd portal
supabase functions deploy email-outbox-worker --no-verify-jwt
```

The `--no-verify-jwt` flag allows the function to be called without JWT authentication (needed for cron jobs).

### 3. Set Production Secrets

In Supabase Dashboard:

1. Go to **Project Settings** → **Edge Functions** → **Secrets**
2. Add each required secret:
   - `RESEND_API_KEY`
   - `RESEND_FROM`
   - `PORTAL_BASE_URL`
   - `CRON_SECRET`
   - `SUPABASE_URL` (usually auto-set)
   - `SUPABASE_SERVICE_ROLE_KEY` (usually auto-set)

### 4. Set Up Scheduled Execution

You have two options for scheduling:

#### Option A: Supabase Scheduled Function (Recommended)

Supabase supports pg_cron for scheduled functions. Create a migration to set up the schedule:

```sql
-- Schedule function to run every 5 minutes
SELECT cron.schedule(
  'email-outbox-worker',
  '*/5 * * * *', -- Every 5 minutes
  $$
  SELECT net.http_post(
    url := 'https://<your-project-ref>.supabase.co/functions/v1/email-outbox-worker',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', '<your-cron-secret>'
    )
  ) AS request_id;
  $$
);
```

**Note:** Replace `<your-project-ref>` with your actual project reference and `<your-cron-secret>` with your CRON_SECRET value.

#### Option B: External Cron Service

Use an external service (e.g., cron-job.org, GitHub Actions, etc.) to call the function:

```bash
# Example cron job (runs every 5 minutes)
*/5 * * * * curl -X POST https://<your-project-ref>.supabase.co/functions/v1/email-outbox-worker \
  -H "x-cron-secret: <your-cron-secret>" \
  -H "Content-Type: application/json"
```

### 5. Verify Deployment

Test the deployed function:

```bash
curl -X POST https://<your-project-ref>.supabase.co/functions/v1/email-outbox-worker \
  -H "x-cron-secret: <your-cron-secret>" \
  -H "Content-Type: application/json"
```

Expected response:
```json
{
  "processed": 0,
  "sent": 0,
  "failed": 0
}
```

## Monitoring

### Check Email Outbox Status

```sql
-- Pending emails
SELECT COUNT(*) FROM email_outbox WHERE status = 'pending';

-- Failed emails (need attention)
SELECT id, to_email, template, last_error, created_at 
FROM email_outbox 
WHERE status = 'failed' 
ORDER BY created_at DESC;

-- Recent sent emails
SELECT id, to_email, template, sent_at 
FROM email_outbox 
WHERE status = 'sent' 
ORDER BY sent_at DESC 
LIMIT 10;
```

### Function Logs

View logs in Supabase Dashboard:
- **Edge Functions** → **email-outbox-worker** → **Logs**

Or via CLI:
```bash
supabase functions logs email-outbox-worker
```

## Troubleshooting

### Emails Not Being Enqueued

1. **Check trigger exists:**
   ```sql
   SELECT * FROM pg_trigger WHERE tgname = 'trigger_enqueue_order_emails';
   ```

2. **Check recipient resolution:**
   ```sql
   -- Test distributor email resolution
   SELECT auth.users.email
   FROM auth.users
   JOIN public.profiles ON profiles.user_id = auth.users.id
   WHERE profiles.partner_id = '<distributor-id>'
     AND profiles.role = 'distributor';
   ```

3. **Check order status change:**
   - Trigger only fires on `UPDATE OF status`
   - Status must actually change (OLD.status != NEW.status)

### Emails Not Being Sent

1. **Check function logs** for errors
2. **Verify Resend API key** is correct
3. **Verify RESEND_FROM** email is verified in Resend dashboard
4. **Check failed emails:**
   ```sql
   SELECT id, last_error FROM email_outbox WHERE status = 'failed';
   ```

### Function Returns 401 Unauthorized

- Verify `CRON_SECRET` matches between:
  - Function secrets (Supabase Dashboard)
  - Cron job request header (`x-cron-secret`)

### Function Returns 500 Error

- Check function logs for detailed error messages
- Verify all required secrets are set
- Verify Supabase service role key has correct permissions

## Database Schema

### email_outbox Table

```sql
CREATE TABLE public.email_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
  to_email text NOT NULL,
  template text NOT NULL,
  subject text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}',
  order_request_id uuid REFERENCES public.order_requests(id) ON DELETE CASCADE,
  last_error text,
  sent_at timestamptz
);
```

### Indexes

- `idx_email_outbox_status` - For querying pending emails
- `idx_email_outbox_created_at` - For ordering by creation time
- `idx_email_outbox_order_request_id` - For order-related queries

## Security Considerations

1. **Service Role Key**: The edge function uses the service role key to bypass RLS. Keep this secret secure.
2. **CRON_SECRET**: Use a strong random secret to prevent unauthorized function invocations.
3. **RLS Policies**: The `email_outbox` table has RLS enabled with a policy allowing service role access.
4. **Email Validation**: Recipient emails are resolved from authenticated users only (via `auth.users`).

## Performance

- **Batch Size**: Function processes up to 25 emails per invocation
- **Error Isolation**: One failed email doesn't stop processing of others
- **Idempotency**: Function can be safely called multiple times (pending emails are processed, sent emails are skipped)

## Future Enhancements

- Retry logic for failed emails
- Email templates with more detailed content
- Webhook notifications for failed emails
- Metrics and monitoring dashboard
- Rate limiting per recipient

