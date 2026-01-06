# Fix: Environment Variables Not Working

## The Problem

Your `.env` file has `SUPABASE_URL` and `SUPABASE_KEY`, but Next.js client-side code needs variables prefixed with `NEXT_PUBLIC_`.

## Quick Fix

Add these lines to your `.env` file (or create `.env.local`):

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

**You can copy the values from your existing variables:**
- `NEXT_PUBLIC_SUPABASE_URL` = same value as `SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` = same value as `SUPABASE_KEY`

## Why Two Sets of Variables?

- **`SUPABASE_URL` / `SUPABASE_KEY`**: Used by server-side code (API routes, server components)
- **`NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`**: Used by client-side code (browser)

Next.js only exposes variables prefixed with `NEXT_PUBLIC_` to the browser for security reasons.

## After Adding Variables

1. **Restart your dev server** (stop with Ctrl+C, then run `npm run dev` again)
2. The form should now work!

## Your `.env` File Should Look Like:

```env
# Server-side variables (for API routes, server components)
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_KEY=your-anon-key-here

# Client-side variables (for browser code) - REQUIRED for forms to work
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

**Note:** The values are the same, you just need both sets with different names.


