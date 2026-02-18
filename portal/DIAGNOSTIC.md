# Diagnostic: Supabase Environment Variables Issue

## Problem Identified

The error logs show:
```
placeholder.supabase.co/auth/v1/user:1  Failed to load resource: net::ERR_NAME_NOT_RESOLVED
Session error: AuthRetryableFetchError: Failed to fetch
```

This indicates that the Supabase client is using the **placeholder URL** instead of your real Supabase URL. This happens when environment variables are not available at build time.

## Root Cause

In Next.js, `NEXT_PUBLIC_*` environment variables are embedded into the JavaScript bundle **at build time**, not runtime. If these variables aren't set when Netlify builds your site, they won't be available in the production bundle.

## Solution: Set Environment Variables in Netlify

### Step 1: Verify Environment Variables in Netlify

1. Go to your Netlify dashboard
2. Navigate to: **Site settings** → **Environment variables**
3. Check if these variables exist:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`

### Step 2: Set/Update Environment Variables

If they're missing or incorrect:

1. Click **Add a variable**
2. Add:
   - **Key**: `NEXT_PUBLIC_SUPABASE_URL`
   - **Value**: `https://maqbieodukmvycpxgqcd.supabase.co` (your Supabase project URL)
3. Click **Add a variable** again
4. Add:
   - **Key**: `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **Value**: Your Supabase anonymous/public key (from Supabase Dashboard → Settings → API)

### Step 3: Trigger a New Build

After setting the environment variables:

1. Go to **Deploys** tab in Netlify
2. Click **Trigger deploy** → **Deploy site**
3. Wait for the build to complete

### Step 4: Verify

After the new deployment:

1. Check the browser console - you should NOT see `placeholder.supabase.co` errors
2. Try the password reset flow again
3. The console should show `[SUPABASE CLIENT]` logs confirming the URL is set

## How to Check if Variables Are Set

After deploying, open your production site and check the browser console. You should see:
- `[SUPABASE CLIENT] NEXT_PUBLIC_SUPABASE_URL: Set` (not "MISSING")
- `[SUPABASE CLIENT] NEXT_PUBLIC_SUPABASE_ANON_KEY: Set` (not "MISSING")

If you see "MISSING", the environment variables weren't set during the build.

## Important Notes

- Environment variables must be set **before** building
- Changing them after a build won't affect already-built pages
- You must trigger a new build after setting/updating environment variables
- The variables are case-sensitive: `NEXT_PUBLIC_SUPABASE_URL` (not `next_public_supabase_url`)





