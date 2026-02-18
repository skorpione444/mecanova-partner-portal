# Email Outbox System - Production Rollout Guide

This guide covers deploying the email outbox system to production and setting up automated email processing.

## Overview

The email outbox system automatically sends emails when order statuses change:
- **Order submitted** → Email to distributor
- **Order accepted** → Email to client
- **Order rejected** → Email to client

## Local Testing Recap (DRY_RUN)

Before deploying to production, verify everything works locally:

### 1. Start Local Supabase

```bash
cd portal
npm run sb:start
```

### 2. Reset Database (Apply Migrations)

```bash
npm run sb:reset
```

This applies all migrations including:
- `20260218000000_email_outbox.sql` - Creates email_outbox table and trigger
- `20260218010000_email_outbox_retry.sql` - Adds retry columns

### 3. Set Local Environment Variables

Create or update `.env.local`:

```env
DRY_RUN=true
SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_SERVICE_ROLE_KEY=<get from: npm run sb:status>
PORTAL_BASE_URL=http://localhost:3000
```

**Note:** In local mode, Resend config is not required - the system automatically uses DRY_RUN.

### 4. Test Email Enqueueing

Run the test script:

```bash
supabase db connect
# Copy/paste contents of portal/docs/email-test.sql
```

### 5. Test Worker Locally

```bash
# Terminal 1: Serve function
supabase functions serve email-outbox-worker

# Terminal 2: Invoke function
curl -X POST http://127.0.0.1:54321/functions/v1/email-outbox-worker \
  -H "Content-Type: application/json"
```

Expected response:
```json
{
  "processed": 1,
  "sent": 1,
  "failed": 0,
  "dry_run": true
}
```

### 6. Verify Results

```sql
SELECT id, status, to_email, template, sent_at, attempt_count
FROM email_outbox 
ORDER BY created_at DESC;
```

## Production Deployment

### Step 1: Link to Production Project

```bash
cd portal
npx supabase link --project-ref maqbieodukmvycpxgqcd
```

Enter your database password when prompted (found in Supabase Dashboard → Settings → Database).

### Step 2: Deploy Migrations

```bash
npx supabase db push
```

**⚠️ Important:** Review the migration diff before pushing. This will:
- Create `email_outbox` table
- Add retry columns (`attempt_count`, `next_retry_at`, `locked_at`, `locked_by`)
- Create trigger function `enqueue_order_emails()`
- Add trigger to `order_requests` table

### Step 3: Deploy Edge Function

```bash
npx supabase functions deploy email-outbox-worker --no-verify-jwt
```

The `--no-verify-jwt` flag allows the function to be called without JWT authentication (we use CRON_SECRET instead).

### Step 4: Set Production Secrets

In Supabase Dashboard → Project Settings → Edge Functions → Secrets, set:

#### Required Secrets

```env
APP_ENV=production
RESEND_API_KEY=re_xxxxxxxxxxxxx
RESEND_FROM=noreply@mecanova.de
PORTAL_BASE_URL=https://portal.mecanova.de
CRON_SECRET=<generate-random-long-string>
DRY_RUN=false
```

#### Optional Secrets

```env
RESEND_REPLY_TO=support@mecanova.de
```

**Generate CRON_SECRET:**
```bash
# On Linux/Mac:
openssl rand -hex 32

# On Windows (PowerShell):
-join ((48..57) + (65..90) + (97..122) | Get-Random -Count 64 | ForEach-Object {[char]$_})
```

**Important:** Never commit CRON_SECRET to git. Store it securely.

### Step 5: Set Up Automated Worker Execution

You have two options for running the worker automatically:

#### Option A: cron-job.org (Recommended for Simplicity)

1. Go to [cron-job.org](https://cron-job.org) and create a free account
2. Create a new cron job:
   - **URL:** `https://maqbieodukmvycpxgqcd.supabase.co/functions/v1/email-outbox-worker`
   - **Schedule:** Every 1-5 minutes (e.g., `*/2 * * * *` for every 2 minutes)
   - **Request Method:** POST
   - **Headers:**
     ```
     Content-Type: application/json
     x-cron-secret: <your-CRON_SECRET-value>
     ```
   - **Request Body:** (leave empty or `{}`)

3. Test the cron job manually
4. Monitor execution logs in cron-job.org dashboard

#### Option B: GitHub Actions (Recommended for Version Control)

Create `.github/workflows/email-outbox-worker.yml`:

```yaml
name: Email Outbox Worker

on:
  schedule:
    # Run every 2 minutes
    - cron: '*/2 * * * *'
  workflow_dispatch: # Allow manual trigger

jobs:
  process-emails:
    runs-on: ubuntu-latest
    steps:
      - name: Invoke Email Outbox Worker
        run: |
          curl -X POST \
            -H "Content-Type: application/json" \
            -H "x-cron-secret: ${{ secrets.SUPABASE_CRON_SECRET }}" \
            https://maqbieodukmvycpxgqcd.supabase.co/functions/v1/email-outbox-worker
```

**Set GitHub Secret:**
1. Go to your repository → Settings → Secrets and variables → Actions
2. Add secret: `SUPABASE_CRON_SECRET` = your CRON_SECRET value

**Note:** GitHub Actions free tier allows 2000 minutes/month. For more frequent runs, consider cron-job.org or Supabase pg_cron.

### Step 6: Verify Production Deployment

#### Check Function Logs

```bash
npx supabase functions logs email-outbox-worker
```

Or in Supabase Dashboard:
- Edge Functions → email-outbox-worker → Logs

#### Test Manually

```bash
curl -X POST \
  -H "Content-Type: application/json" \
  -H "x-cron-secret: <your-CRON_SECRET>" \
  https://maqbieodukmvycpxgqcd.supabase.co/functions/v1/email-outbox-worker
```

Expected response:
```json
{
  "processed": 0,
  "sent": 0,
  "failed": 0,
  "dry_run": false
}
```

#### Check Email Outbox Status

```sql
-- Pending emails
SELECT COUNT(*) FROM email_outbox WHERE status = 'pending';

-- Failed emails (need attention)
SELECT id, to_email, template, last_error, attempt_count, next_retry_at
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

#### Trigger Test Email

Update an order status to trigger email enqueueing:

```sql
-- Update an order to 'submitted' (triggers email to distributor)
UPDATE order_requests 
SET status = 'submitted', submitted_at = now()
WHERE id = '<some-order-id>';

-- Check if email was enqueued
SELECT * FROM email_outbox WHERE status = 'pending' ORDER BY created_at DESC LIMIT 1;

-- Wait for worker to process (check logs or query again)
SELECT * FROM email_outbox WHERE id = '<email-id>';
```

## Production Monitoring

### Key Metrics to Monitor

1. **Pending Email Count**
   ```sql
   SELECT COUNT(*) FROM email_outbox WHERE status = 'pending';
   ```

2. **Failed Email Count**
   ```sql
   SELECT COUNT(*) FROM email_outbox WHERE status = 'failed';
   ```

3. **Average Processing Time**
   ```sql
   SELECT 
     AVG(EXTRACT(EPOCH FROM (sent_at - created_at))) as avg_seconds
   FROM email_outbox 
   WHERE status = 'sent' 
     AND sent_at IS NOT NULL;
   ```

4. **Retry Statistics**
   ```sql
   SELECT 
     attempt_count,
     COUNT(*) as count
   FROM email_outbox
   WHERE status = 'failed'
   GROUP BY attempt_count
   ORDER BY attempt_count;
   ```

### Alerting Recommendations

Set up alerts for:
- Failed email count > threshold (e.g., 10)
- Pending emails older than 1 hour
- Worker not running (check cron job status)

## Troubleshooting

### Emails Not Being Sent

1. **Check function logs** for errors
2. **Verify Resend API key** is correct and active
3. **Check RESEND_FROM** email is verified in Resend dashboard
4. **Review failed emails:**
   ```sql
   SELECT id, last_error, attempt_count FROM email_outbox WHERE status = 'failed';
   ```

### Function Returns 401 Unauthorized

- Verify `CRON_SECRET` matches between:
  - Supabase Dashboard secrets
  - Cron job/GitHub Actions header (`x-cron-secret`)

### Function Returns 500 Error

- Check function logs for detailed error messages
- Verify all required secrets are set
- Verify `APP_ENV=production` is set (or `NODE_ENV=production`)

### Emails Stuck in Pending

- Check if worker is running (cron job status)
- Check for locked rows (stale locks):
  ```sql
  SELECT id, locked_at, locked_by 
  FROM email_outbox 
  WHERE locked_at IS NOT NULL 
    AND locked_at < now() - interval '5 minutes';
  ```
- Manually unlock if needed:
  ```sql
  UPDATE email_outbox 
  SET locked_at = NULL, locked_by = NULL 
  WHERE locked_at < now() - interval '5 minutes';
  ```

## Security Checklist

- ✅ CRON_SECRET is set and matches in cron job/GitHub Actions
- ✅ Function deployed with `--no-verify-jwt` (uses CRON_SECRET instead)
- ✅ Resend API key is valid and has proper permissions
- ✅ RESEND_FROM email is verified in Resend dashboard
- ✅ `APP_ENV=production` is set (enforces strict security)
- ✅ `DRY_RUN=false` in production (ensures real emails are sent)
- ✅ Secrets are stored securely (never in git)

## Rollback Plan

If issues occur:

1. **Disable cron job** (stop automatic execution)
2. **Set DRY_RUN=true** temporarily:
   ```bash
   # In Supabase Dashboard → Edge Functions → Secrets
   DRY_RUN=true
   ```
3. **Investigate logs** and fix issues
4. **Re-enable** when ready

## Support

For issues or questions:
- Check function logs: `npx supabase functions logs email-outbox-worker`
- Review email_outbox table status
- Check Resend dashboard for delivery status
- Review cron job execution logs

