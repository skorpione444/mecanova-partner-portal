# Manual Setup Checklist

This checklist contains the steps you must run manually (because they require your Supabase login or local machine interaction).

## Prerequisites

- [ ] Node.js and npm installed
- [ ] Git repository cloned and ready

## Step-by-Step Setup

### 1. Verify Supabase CLI Installation

```bash
supabase --version
```

**Expected output:** Version number (e.g., `1.123.0`)

**If not installed:**
- **Windows:** `scoop install supabase` or `npm install -g supabase`
- **macOS:** `brew install supabase/tap/supabase`
- **Linux:** `npm install -g supabase` or download from GitHub releases

### 2. Login to Supabase

```bash
supabase login
```

**What happens:**
- Opens your browser for authentication
- Stores credentials locally
- You'll see "Successfully logged in" message

### 3. Link to Remote Project

```bash
npm run sb:link
```

**What happens:**
- Prompts for database password (found in Supabase Dashboard → Settings → Database)
- Creates `supabase/.env` file (gitignored, contains credentials)
- Links local CLI to project `maqbieodukmvycpxgqcd`

**Note:** The `.env` file contains sensitive credentials and is already in `.gitignore`.

### 4. Pull Baseline Schema

```bash
npm run sb:pull
```

**What happens:**
- Pulls current schema from remote Supabase project
- Generates migration files in `supabase/migrations/`
- Creates baseline migration representing current production schema

**After completion:**
```bash
git add supabase
git commit -m "baseline: pull remote schema"
```

### 5. Start Local Supabase

```bash
npm run sb:start
```

**What happens:**
- Downloads Docker images (first time only, may take a few minutes)
- Starts local PostgreSQL database
- Starts Supabase Studio, API, Auth, Storage, Realtime services
- Shows connection details

**Expected output:**
```
Started supabase local development setup.

         API URL: http://127.0.0.1:54321
     GraphQL URL: http://127.0.0.1:54321/graphql/v1
          DB URL: postgresql://postgres:postgres@127.0.0.1:54322/postgres
      Studio URL: http://127.0.0.1:54323
    Inbucket URL: http://127.0.0.1:54324
      JWT secret: super-secret-jwt-token-with-at-least-32-characters-long
        anon key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
service_role key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### 6. Reset Local Database

```bash
npm run sb:reset
```

**What happens:**
- Stops local Supabase instance
- Drops and recreates local database
- Applies all migrations from `supabase/migrations/`
- Restarts services

**This ensures your local database matches the baseline.**

### 7. Verify Status

```bash
npm run sb:status
```

**What happens:**
- Shows status of all local Supabase services
- Displays connection URLs and keys
- Confirms everything is running

**Expected output:** All services should show "Running" status.

## Verification

After completing all steps:

1. **Check Supabase Studio:**
   - Open http://127.0.0.1:54323 in your browser
   - You should see your database schema

2. **Check migrations:**
   ```bash
   ls supabase/migrations/
   ```
   - Should show at least one migration file (baseline)

3. **Test local connection:**
   - Update your `.env.local` with local Supabase URLs (from `sb:status`)
   - Run `npm run dev`
   - Verify your app connects to local Supabase

## Troubleshooting

### "supabase: command not found"
- Install Supabase CLI (see Step 1)
- Restart your terminal

### "Docker is not running"
- Start Docker Desktop
- Wait for it to fully start
- Try `npm run sb:start` again

### "Port already in use"
- Stop any existing Supabase instances: `npm run sb:stop`
- Check if ports 54321-54324 are available
- Kill processes using those ports if needed

### "Database password incorrect"
- Find password in Supabase Dashboard → Settings → Database
- Re-run `npm run sb:link` with correct password

### "Project not found" or "Access denied"
- Verify project ref: `maqbieodukmvycpxgqcd`
- Ensure you have access to the project
- Check your Supabase login: `supabase login`

## Next Steps

After completing this checklist:

1. Read [supabase-cli.md](./supabase-cli.md) for daily workflow
2. Read [db-migration-playbook.md](./db-migration-playbook.md) for migration conventions
3. Start developing with local Supabase!

## Quick Reference

```bash
# Start local Supabase
npm run sb:start

# Stop local Supabase
npm run sb:stop

# Check status
npm run sb:status

# Reset database (apply all migrations)
npm run sb:reset

# Pull latest schema from remote
npm run sb:pull

# Push migrations to remote
npm run sb:push
```





