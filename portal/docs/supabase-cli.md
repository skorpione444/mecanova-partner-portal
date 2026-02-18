# Supabase CLI Setup & Workflow

This guide covers how to set up and use the Supabase CLI for local development and database migrations in the Mecanova Partner Portal.

## Prerequisites

- Node.js and npm installed
- Docker Desktop installed and running (required for local Supabase)
- Supabase CLI (installed via npm devDependency or globally - see One-Time Setup below)
- Access to the Supabase cloud project (project ref: `maqbieodukmvycpxgqcd`)

## One-Time Setup

### 1. Install Supabase CLI

**Windows (PowerShell):**
```powershell
# Using Scoop
scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
scoop install supabase

# Or using npm
npm install -g supabase
```

**macOS:**
```bash
brew install supabase/tap/supabase
```

**Linux:**
```bash
# Using npm
npm install -g supabase

# Or download binary from GitHub releases
```

Verify installation:
```bash
supabase --version
```

**Note:** Supabase CLI is also included as a devDependency in this project (`supabase: ^2.76.9`), so running `npm install` will make it available via `npm run sb:*` scripts without global installation.

### 2. Login to Supabase

```bash
supabase login
```

This will open your browser to authenticate. After successful login, your credentials will be stored locally.

### 3. Link to Remote Project

```bash
npm run sb:link
```

This command will:
- Link your local Supabase CLI to the remote project (`maqbieodukmvycpxgqcd`)
- Prompt you for your database password (found in Supabase Dashboard → Settings → Database)
- Create a `.env` file in `supabase/` folder (this is gitignored)

**Note:** The `.env` file contains sensitive credentials and should never be committed to git.

### 4. Pull Baseline Schema

```bash
npm run sb:pull
```

This command will:
- Pull the current schema from your remote Supabase project
- Generate migration files in `supabase/migrations/`
- Create a baseline migration that represents your current production schema

After pulling, commit the baseline:
```bash
git add supabase
git commit -m "baseline: pull remote schema"
```

## Local Development Workflow

### Starting Local Supabase

```bash
npm run sb:start
```

This starts a local Supabase instance with:
- PostgreSQL database (port 54322)
- Supabase Studio (port 54323)
- API server (port 54321)
- Auth server
- Storage server
- Realtime server
- Inbucket email testing (port 54324)

**First-time startup:** This will download Docker images and may take a few minutes.

### Checking Status

```bash
npm run sb:status
```

Shows the status of all local Supabase services and their connection details.

### Resetting Local Database

```bash
npm run sb:reset
```

This command will:
- Stop the local Supabase instance
- Drop and recreate the local database
- Apply all migrations from `supabase/migrations/`
- Seed the database (if seed files exist)

**Use this when:**
- You want a fresh local database
- After pulling new migrations
- When testing migrations

### Stopping Local Supabase

```bash
npm run sb:stop
```

Stops all local Supabase services.

## Database Migration Workflow

### Creating a Migration

1. **Create a new migration file:**
   ```bash
   supabase migration new <migration_name>
   ```
   
   Example:
   ```bash
   supabase migration new rpc__get_orders__v2
   ```

2. **Edit the migration file:**
   - Location: `supabase/migrations/YYYYMMDDHHMMSS_<migration_name>.sql`
   - Write your SQL changes (see [Migration Playbook](./db-migration-playbook.md) for conventions)

3. **Test locally:**
   ```bash
   npm run sb:reset
   ```
   This applies all migrations including your new one.

4. **Test your changes:**
   - Run your Next.js app: `npm run dev`
   - Verify the changes work as expected
   - Check Supabase Studio at `http://localhost:54323`

5. **Commit the migration:**
   ```bash
   git add supabase/migrations/
   git commit -m "migration: <description>"
   ```

### Pushing Migrations to Production

**⚠️ Important:** Always test migrations locally before pushing to production!

```bash
npm run sb:push
```

This command will:
- Compare your local migrations with the remote database
- Apply any new migrations to production
- Show a preview of changes before applying

**Before pushing:**
- Ensure all migrations are tested locally
- Review the diff carefully
- Consider backing up production data for major changes

## Important Rules

### ❌ DO NOT:
- Make schema changes directly in the Supabase Dashboard
- Edit functions, triggers, or RLS policies via Dashboard
- Skip local testing before pushing to production
- Commit sensitive credentials (`.env` files)

### ✅ DO:
- All database changes via migrations
- Test locally with `sb:reset` before pushing
- Commit migration files to git
- Use descriptive migration names following conventions
- Review migration diffs before pushing

## Troubleshooting

### Local Supabase won't start
- Ensure Docker is running
- Check if ports 54321-54324 are available
- Try `npm run sb:stop` then `npm run sb:start`

### Migration conflicts
- Pull latest migrations: `npm run sb:pull`
- Resolve conflicts manually in migration files
- Test with `npm run sb:reset` before pushing

### Can't link to remote project
- Verify project ref is correct: `maqbieodukmvycpxgqcd`
- Check your Supabase login: `supabase login`
- Ensure you have access to the project

### Database password issues
- Find password in Supabase Dashboard → Settings → Database
- Re-link if needed: `npm run sb:link`

## Environment Variables

When running locally, Supabase CLI automatically sets up environment variables. For your Next.js app, you may need to update `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<from supabase status>
SUPABASE_SERVICE_ROLE_KEY=<from supabase status>
```

Get these values by running `npm run sb:status`.

## Validation & Testing

### Verify Local Setup

After completing setup, validate that everything works:

```powershell
# 1. Verify Supabase CLI is available
supabase --version
# Expected: version number (e.g., 2.76.9)

# 2. Check if Supabase is running
npm run sb:status
# Expected: Either "not running" or shows service status

# 3. Start local Supabase (if not running)
npm run sb:start
# Expected: Downloads Docker images (first time), starts all services
# Should show: API URL, Studio URL, DB URL, JWT secrets

# 4. Reset database (applies all migrations)
npm run sb:reset
# Expected: Drops/recreates DB, applies migrations from supabase/migrations/
# Should complete without errors

# 5. Verify status again
npm run sb:status
# Expected: All services running, connection details shown

# 6. Optional: Verify tables exist
supabase db connect
# Then in psql prompt, run:
# \dt
# Should see: profiles, order_requests, inventory_status, documents, etc.
# \q to exit
```

### Expected Results

After running validation:
- ✅ All services start successfully
- ✅ Migrations apply without errors
- ✅ Tables exist in local database
- ✅ RLS policies are active
- ✅ Functions are callable

### Troubleshooting Validation

**If `supabase --version` fails:**
- Run `npm install` to install Supabase CLI from devDependencies
- Or install globally: `npm install -g supabase`

**If `sb:start` fails:**
- Ensure Docker Desktop is running
- Check ports 54321-54324 are available
- Try `npm run sb:stop` first, then `npm run sb:start`

**If migrations fail:**
- Check `supabase/migrations/` folder exists
- Verify migration files have correct naming: `YYYYMMDDHHMMSS_name.sql`
- Review error messages for SQL syntax issues

## Next Steps

- Read the [Migration Playbook](./db-migration-playbook.md) for naming conventions and best practices
- Read the [Validation Report](./VALIDATION_REPORT.md) for detailed setup validation
- Set up Edge Functions (see Edge Functions section below)
- Configure your local environment variables

## Edge Functions

Edge Functions are deployed separately via CLI:

```bash
# Deploy a function
supabase functions deploy <function-name>

# Deploy all functions
supabase functions deploy

# Test locally
supabase functions serve <function-name>
```

See `supabase/functions/` for available functions.

### Email Outbox Worker

For email notifications using the outbox pattern, see [Email Outbox Documentation](./email-outbox.md).

