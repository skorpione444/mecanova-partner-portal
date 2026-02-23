# Supabase Edge Functions

This directory contains Supabase Edge Functions (serverless functions running on Deno).

## Available Functions

### email-outbox-worker

Placeholder for email outbox processing worker. To be implemented later.

## Development

### Test Locally

```bash
# Start Supabase locally
npm run sb:start

# Serve functions locally
supabase functions serve email-outbox-worker

# Or serve all functions
supabase functions serve
```

### Deploy to Production

```bash
# Deploy a specific function
supabase functions deploy email-outbox-worker

# Deploy all functions
supabase functions deploy
```

## Function Structure

Each function should have:
- `index.ts` - Main function entry point
- `deno.json` - Deno configuration and imports

## Environment Variables

Set secrets for functions:
```bash
supabase secrets set SECRET_NAME=secret_value
```

Access secrets in functions:
```typescript
const secret = Deno.env.get("SECRET_NAME");
```

## Documentation

For more information, see:
- [Supabase Edge Functions Docs](https://supabase.com/docs/guides/functions)
- [Deno Documentation](https://deno.land/docs)






