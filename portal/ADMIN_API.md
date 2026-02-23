# Admin Password Override API

## Overview

Server-only endpoint to set user passwords directly via Supabase Admin API. Bypasses Supabase recovery email throttling.

**Endpoint**: `POST /api/admin/set-password`

## Security

- Protected by `ADMIN_TOOL_TOKEN` Bearer authentication
- Uses Supabase Admin API (service role key) - server-only
- Never exposes secrets to client
- Never logs sensitive data

## Environment Variables Required

Set these in Netlify:

1. `SUPABASE_SERVICE_ROLE_KEY` - Your Supabase service role key (from Supabase Dashboard → Settings → API)
2. `ADMIN_TOOL_TOKEN` - A secure random token for Bearer authentication (generate with: `openssl rand -hex 32`)

## Usage

### Request Format

```bash
POST /api/admin/set-password
Authorization: Bearer <ADMIN_TOOL_TOKEN>
Content-Type: application/json

{
  "email": "user@example.com",
  "newPassword": "securepassword123"
}
```

### Response Format

**Success:**
```json
{
  "ok": true
}
```

**Error:**
```json
{
  "ok": false,
  "error": "Error message"
}
```

## Examples

### Set password for s.gueth@mecanova.de

```bash
curl -X POST https://portal.mecanova.de/api/admin/set-password \
  -H "Authorization: Bearer YOUR_ADMIN_TOOL_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "s.gueth@mecanova.de",
    "newPassword": "YourNewPassword123!"
  }'
```

### Set password for mecanova.ug@outlook.com

```bash
curl -X POST https://portal.mecanova.de/api/admin/set-password \
  -H "Authorization: Bearer YOUR_ADMIN_TOOL_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "mecanova.ug@outlook.com",
    "newPassword": "YourNewPassword123!"
  }'
```

## Error Codes

- `200` - Success
- `400` - Bad request (missing/invalid email or password)
- `401` - Unauthorized (missing/invalid Bearer token)
- `404` - User not found
- `500` - Internal server error

## Security Best Practices

1. **Keep `ADMIN_TOOL_TOKEN` secret** - Never commit to git, never expose in client code
2. **Use HTTPS only** - Always use HTTPS in production
3. **Rotate tokens regularly** - Change `ADMIN_TOOL_TOKEN` periodically
4. **Monitor usage** - Check Netlify logs for unauthorized access attempts
5. **Strong passwords** - Ensure `newPassword` meets security requirements (min 8 chars)

## Implementation Notes

- Uses Supabase Admin API `updateUserById` method
- Finds users by email (case-insensitive)
- Password validation: minimum 8 characters
- Constant-time token comparison to prevent timing attacks






