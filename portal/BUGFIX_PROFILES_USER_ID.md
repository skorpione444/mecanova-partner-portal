# Bug Fix: Profiles user_id Migration

## Problem Summary
Logged-in admin users were seeing "Profile not found" even though profile rows exist in the database. The root cause was that the `profiles` table uses `user_id` (uuid) as the primary link to `auth.users`, NOT `id`. However, SQL helper functions and RLS policies were incorrectly referencing `profiles.id` instead of `profiles.user_id`.

## Solution

### 1. Frontend Code ✅
**Status: Already Correct**

All frontend code was already correctly using `user_id`:
- `portal/src/app/(portal)/dashboard/page.tsx` - Line 45: `.eq("user_id", session.user.id)`
- `portal/src/app/(portal)/documents/page.tsx` - Line 46: `.eq("user_id", session.user.id)`
- `portal/src/app/(portal)/orders/new/page.tsx` - Line 65: `.eq("user_id", session.user.id)`

**No frontend changes needed.**

### 2. Database Layer ✅
**Status: Fixed via Migration**

Created SQL migration file: `portal/migrations/fix_profiles_user_id.sql`

This migration fixes:

#### SQL Helper Functions
- `current_role()` - Now queries `profiles.user_id = auth.uid()` instead of `profiles.id = auth.uid()`
- `current_partner_id()` - Now queries `profiles.user_id = auth.uid()` instead of `profiles.id = auth.uid()`
- `is_admin()` - Now queries `profiles.user_id = auth.uid()` instead of `profiles.id = auth.uid()`

#### RLS Policies Updated
All policies that referenced `profiles.id` have been updated to use `profiles.user_id`:
- `profiles` table policies (SELECT, UPDATE)
- `documents` table policies (SELECT, INSERT, UPDATE)
- `order_requests` table policies (SELECT, INSERT, UPDATE)
- `order_request_items` table policies (SELECT, INSERT)
- `partners` table policies (SELECT)
- `products` table policies (SELECT, ALL for admins)
- `inventory_status` table policies (SELECT, ALL for admins)

## How to Apply the Fix

### Step 1: Apply the Migration
Run the SQL migration file in your Supabase project:

1. Open Supabase Dashboard → SQL Editor
2. Copy contents of `portal/migrations/fix_profiles_user_id.sql`
3. Paste and execute

OR use Supabase CLI:
```bash
supabase db push --file portal/migrations/fix_profiles_user_id.sql
```

### Step 2: Verify the Fix

#### Test Admin Login
1. Log in as admin user (Sebastian)
2. Navigate to `/dashboard`
3. ✅ Verify: Profile loads correctly (no "Profile not found" error)
4. ✅ Verify: Role shows as "admin"
5. ✅ Verify: Admin can see all partners, all documents, all orders

#### Test Partner Login
1. Log in as partner user
2. Navigate to `/dashboard`
3. ✅ Verify: Profile loads correctly
4. ✅ Verify: Role shows as "partner"
5. ✅ Verify: Partner ID is displayed
6. ✅ Verify: Partner can only see their own documents and orders

#### Test Role-Based Access
- ✅ Admin sees all data (partners, documents, orders)
- ✅ Partner sees only scoped data (own documents, own orders)
- ✅ RLS policies enforce correct access control

## Files Changed

### Created
- `portal/migrations/fix_profiles_user_id.sql` - SQL migration file
- `portal/migrations/README.md` - Migration documentation
- `portal/BUGFIX_PROFILES_USER_ID.md` - This summary document

### Modified
- None (frontend was already correct)

## Expected Outcome

After applying the migration:
1. ✅ "Profile not found" error disappears for both admin and partner users
2. ✅ Profile data loads correctly after login
3. ✅ Role-based UI works correctly (admin vs partner views)
4. ✅ RLS policies enforce correct data access
5. ✅ SQL helper functions (`current_role()`, `current_partner_id()`, `is_admin()`) work correctly

## Technical Details

### Database Schema
- `profiles` table has:
  - `id` (primary key, auto-generated)
  - `user_id` (uuid, foreign key to `auth.users.id`)
  - `role` (text: 'admin' or 'partner')
  - `partner_id` (uuid, nullable, foreign key to `partners.id`)

### Key Insight
The `profiles` table uses `user_id` as the link to `auth.users`, not `id`. All queries and policies must use `user_id` to correctly match authenticated users to their profiles.

## Rollback

If needed, you can rollback by restoring the original SQL functions and policies that reference `profiles.id`. However, this would only be necessary if your schema actually uses `id` as the link (which contradicts the bug report).

## Notes

- Migration is idempotent - safe to run multiple times
- Uses `DROP ... CASCADE` to ensure all dependent objects are properly recreated
- All functions marked as `SECURITY DEFINER` for correct RLS behavior
- Frontend code required no changes - was already correct






