# Database Migration Playbook

This guide covers the conventions and best practices for creating and managing database migrations in the Mecanova Partner Portal.

## Migration Workflow

### 1. Create a Migration

```bash
supabase migration new <migration_name>
```

This creates a new migration file in `supabase/migrations/` with a timestamp prefix:
```
supabase/migrations/20240115120000_<migration_name>.sql
```

### 2. Edit the Migration File

Open the generated SQL file and write your changes. Use standard PostgreSQL syntax.

**For RPCs (Remote Procedure Calls):**
```sql
-- Use CREATE OR REPLACE for updates
CREATE OR REPLACE FUNCTION public.get_orders_v2(...)
RETURNS TABLE(...)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Your function logic
END;
$$;
```

**For Triggers:**
```sql
-- Drop existing trigger if updating
DROP TRIGGER IF EXISTS trigger_name ON table_name;

-- Create new trigger
CREATE TRIGGER trigger_name
  BEFORE INSERT ON table_name
  FOR EACH ROW
  EXECUTE FUNCTION function_name();
```

**For RLS Policies:**
```sql
-- Drop existing policy if updating
DROP POLICY IF EXISTS policy_name ON table_name;

-- Create new policy
CREATE POLICY policy_name ON table_name
  FOR SELECT
  USING (condition);
```

**For Enums:**
```sql
-- Add new enum value
ALTER TYPE enum_name ADD VALUE IF NOT EXISTS 'new_value';

-- Note: Removing enum values requires recreating the enum (more complex)
```

### 3. Test Locally

```bash
npm run sb:reset
```

This will:
- Drop and recreate your local database
- Apply all migrations in order
- Give you a clean slate to test

**Testing checklist:**
- ✅ Migration runs without errors
- ✅ Schema changes are applied correctly
- ✅ RLS policies work as expected
- ✅ Functions/triggers execute properly
- ✅ No breaking changes to existing functionality

### 4. Test with Application

```bash
npm run dev
```

Run your Next.js app and verify:
- API calls work correctly
- Authentication flows work
- Data access patterns match expectations
- No console errors related to database

### 5. Commit Migration

```bash
git add supabase/migrations/YYYYMMDDHHMMSS_<name>.sql
git commit -m "migration: <description>"
```

Use descriptive commit messages:
- ✅ `migration: add rpc_get_orders_v2 function`
- ✅ `migration: update rls policies for documents table`
- ❌ `migration: update db`

### 6. Push to Production

```bash
npm run sb:push
```

**Before pushing:**
- Review the diff carefully
- Ensure all team members have reviewed
- Consider backing up production for major changes
- Test in staging environment if available

## Naming Conventions

### Migration File Names

Use descriptive, lowercase names with underscores:

**RPCs:**
```
rpc__<function_name>__v<version>
```
Examples:
- `rpc__get_orders__v2`
- `rpc__create_order__v1`
- `rpc__update_profile__v3`

**Triggers:**
```
trigger__<trigger_name>__v<version>
```
Examples:
- `trigger__update_updated_at__v1`
- `trigger__sync_profile__v2`

**RLS Policies:**
```
rls__<table_name>__<change_description>
```
Examples:
- `rls__documents__add_partner_access`
- `rls__orders__update_admin_policy`
- `rls__profiles__fix_user_id_reference`

**Enums:**
```
enum__<enum_name>__<change_description>
```
Examples:
- `enum__order_status__add_cancelled`
- `enum__user_role__add_moderator`

**Schema Changes:**
```
schema__<table_name>__<change_description>
```
Examples:
- `schema__orders__add_tracking_number`
- `schema__profiles__add_phone_column`

**Data Migrations:**
```
data__<description>
```
Examples:
- `data__backfill_missing_profiles`
- `data__migrate_legacy_orders`

## Best Practices

### 1. Idempotency

Make migrations idempotent (safe to run multiple times):

```sql
-- ✅ Good: Uses IF NOT EXISTS
CREATE TABLE IF NOT EXISTS new_table (...);

-- ✅ Good: Uses IF EXISTS
DROP FUNCTION IF EXISTS old_function();

-- ❌ Bad: Will fail on second run
CREATE TABLE new_table (...);
```

### 2. Use Transactions

Supabase migrations run in transactions automatically, but be aware:
- If any statement fails, the entire migration rolls back
- DDL statements (CREATE, ALTER, DROP) are transactional in PostgreSQL

### 3. Order Matters

Migrations are applied in chronological order (by timestamp). Consider dependencies:

```sql
-- Migration 1: Create function
CREATE FUNCTION helper_function() ...

-- Migration 2: Use function (depends on Migration 1)
CREATE FUNCTION uses_helper() ...
  SELECT helper_function();
```

### 4. Breaking Changes

For breaking changes:
1. Create a migration that adds new columns/functions alongside old ones
2. Update application code to use new schema
3. Create a follow-up migration to remove old columns/functions

Example:
```sql
-- Migration 1: Add new column, keep old
ALTER TABLE orders ADD COLUMN status_v2 text;
-- Keep status column for now

-- Migration 2 (after app update): Remove old column
ALTER TABLE orders DROP COLUMN status;
ALTER TABLE orders RENAME COLUMN status_v2 TO status;
```

### 5. RLS Policy Updates

When updating RLS policies, always drop the old one first:

```sql
-- Drop old policy
DROP POLICY IF EXISTS old_policy_name ON table_name;

-- Create new policy
CREATE POLICY new_policy_name ON table_name
  FOR SELECT
  USING (updated_condition);
```

### 6. Function Updates

Use `CREATE OR REPLACE` for function updates:

```sql
CREATE OR REPLACE FUNCTION public.get_orders()
RETURNS TABLE(...)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Updated logic here
END;
$$;
```

**Note:** `CREATE OR REPLACE` doesn't work if you change:
- Function name
- Parameter names/types
- Return type

For these cases, drop and recreate:
```sql
DROP FUNCTION IF EXISTS old_function_name(parameter_types);
CREATE FUNCTION new_function_name(...) ...;
```

### 7. Testing Checklist

Before committing a migration:

- [ ] Migration runs successfully with `sb:reset`
- [ ] No syntax errors
- [ ] Schema changes are correct (verify in Studio)
- [ ] RLS policies work as expected
- [ ] Functions/triggers execute properly
- [ ] Application code works with changes
- [ ] No breaking changes (or migration path documented)
- [ ] Migration is idempotent

## Common Patterns

### Adding a New Table

```sql
CREATE TABLE IF NOT EXISTS public.new_table (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  -- your columns here
);

-- Add RLS
ALTER TABLE public.new_table ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view own rows" ON public.new_table
  FOR SELECT
  USING (auth.uid() = user_id);
```

### Adding a Column

```sql
ALTER TABLE public.existing_table
  ADD COLUMN IF NOT EXISTS new_column text;
```

### Creating an Index

```sql
CREATE INDEX IF NOT EXISTS idx_table_column
  ON public.table_name(column_name);
```

### Updating a Function

```sql
CREATE OR REPLACE FUNCTION public.function_name(...)
RETURNS ...
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Updated implementation
END;
$$;
```

## Troubleshooting

### Migration Fails

1. Check the error message in the terminal
2. Test the SQL directly in Supabase Studio SQL Editor
3. Verify syntax with PostgreSQL documentation
4. Check for dependencies (functions, tables, types)

### Migration Order Issues

If migrations depend on each other:
- Ensure timestamps are correct (migrations run in order)
- Consider combining related changes into one migration
- Use `supabase migration list` to see migration order

### RLS Policy Conflicts

If policies conflict:
- Review all policies on the table: `SELECT * FROM pg_policies WHERE tablename = 'table_name';`
- Ensure policies don't overlap incorrectly
- Test with different user roles

## Resources

- [Supabase Migration Docs](https://supabase.com/docs/guides/cli/local-development#database-migrations)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [Supabase RLS Guide](https://supabase.com/docs/guides/auth/row-level-security)





