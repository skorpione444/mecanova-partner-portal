# Supabase Auth Configuration

## Password Reset & Magic Link Setup

This application uses Supabase Auth for password reset and magic link authentication. To ensure the flow works correctly in production, configure the following in your Supabase dashboard:

### 1. Site URL Configuration

In Supabase Dashboard → Authentication → URL Configuration:

- **Site URL**: `https://portal.mecanova.de`
- **Redirect URLs**: Add the following:
  - `https://portal.mecanova.de/auth/callback`
  - `https://portal.mecanova.de/*` (wildcard for all routes)

### 2. Email Templates

The password reset email template should redirect to:
```
https://portal.mecanova.de/auth/callback
```

Or it can redirect to the root URL (`https://portal.mecanova.de`) - the application will automatically detect hash fragments and redirect to `/auth/callback`.

### 3. How It Works

1. **Password Reset Flow**:
   - User requests password reset → Supabase sends email
   - Email contains link: `https://portal.mecanova.de/#access_token=...&refresh_token=...&type=recovery`
   - User clicks link → lands on root page or `/auth/callback`
   - `/auth/callback` extracts tokens from hash, sets session via `supabase.auth.setSession()`
   - Redirects to `/auth/reset-password` with active recovery session
   - User sets new password → `supabase.auth.updateUser({ password })`
   - Redirects to `/login?reset=success`

2. **Magic Link Flow**:
   - User requests magic link → Supabase sends email
   - Email contains link: `https://portal.mecanova.de/auth/callback#access_token=...&refresh_token=...`
   - User clicks link → `/auth/callback` sets session
   - Redirects to `/dashboard`

### 4. Environment Variables

Ensure these are set in your deployment platform (Netlify):

- `NEXT_PUBLIC_SUPABASE_URL` - Your Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Your Supabase anonymous/public key

### 5. Security Notes

- Hash fragments (`#...`) are never sent to the server - they're handled entirely client-side
- The callback page clears the hash from the URL after processing for security
- Recovery sessions are temporary and cleared after password reset






