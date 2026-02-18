# Database Migrations

## Fix Profiles user_id Migration

### Problem
The `profiles` table uses `user_id` (uuid) as the primary link to `auth.users`, NOT `id`. However, SQL helper functions (`current_role()`, `current_partner_id()`, `is_admin()`) and RLS policies were incorrectly referencing `profiles.id` instead of `profiles.user_id`, causing "Profile not found" errors even when profile rows exist.

### Solution
This migration fixes:
1. SQL helper functions to query by `user_id` instead of `id`
2. RLS policies on `profiles` table to use `user_id`
3. RLS policies on other tables (`documents`, `order_requests`, `order_request_items`, `partners`, `products`, `inventory_status`) that reference profiles

### How to Apply

#### Option 1: Using Supabase Dashboard SQL Editor
1. Open your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Copy the contents of `fix_profiles_user_id.sql`
4. Paste into the SQL Editor
5. Click **Run** to execute the migration

#### Option 2: Using Supabase CLI
```bash
# If you have Supabase CLI installed
supabase db push --file migrations/fix_profiles_user_id.sql
```

### Verification Steps

After applying the migration, verify the fix:

1. **Test Admin Login**
   - Log in as an admin user (Sebastian)
   - Navigate to `/dashboard`
   - Verify profile loads correctly (no "Profile not found" error)
   - Verify role shows as "admin"
   - Verify admin-specific features work (e.g., viewing all partners, all documents)

2. **Test Partner Login**
   - Log in as a partner user
   - Navigate to `/dashboard`
   - Verify profile loads correctly
   - Verify role shows as "partner"
   - Verify partner_id is displayed
   - Verify partner-scoped data is visible (only their documents, orders)

3. **Test Role-Based Access**
   - As admin: Verify you can see all partners, all documents, all orders
   - As partner: Verify you can only see your own documents and orders
   - Verify RLS policies are working correctly

### What Changed

#### SQL Functions
- `current_role()`: Now queries `profiles.user_id = auth.uid()` instead of `profiles.id = auth.uid()`
- `current_partner_id()`: Now queries `profiles.user_id = auth.uid()` instead of `profiles.id = auth.uid()`
- `is_admin()`: Now queries `profiles.user_id = auth.uid()` instead of `profiles.id = auth.uid()`

#### RLS Policies
All policies that previously referenced `profiles.id` have been updated to use `profiles.user_id`:
- `profiles` table policies
- `documents` table policies
- `order_requests` table policies
- `order_request_items` table policies
- `partners` table policies
- `products` table policies
- `inventory_status` table policies

### Frontend Code
The frontend code was already correct - all queries use `.eq("user_id", session.user.id)`. No frontend changes are needed.

### Rollback (if needed)

If you need to rollback this migration, you'll need to:
1. Restore the original SQL functions and RLS policies
2. Ensure they reference `profiles.id` instead of `profiles.user_id`
3. Note: This would only be necessary if your schema actually uses `id` as the link (which contradicts the bug report)

### Notes
- This migration uses `DROP ... CASCADE` to ensure all dependent objects are properly recreated
- All functions are marked as `SECURITY DEFINER` to ensure they work correctly with RLS
- The migration is idempotent - you can run it multiple times safely





