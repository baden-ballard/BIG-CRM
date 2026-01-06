# Fix: Invalid API Key Error

## The Problem

You're getting "Invalid API key" which means:
- ✅ Your connection is working (Supabase URL is correct)
- ❌ Your API key is wrong or not the right type

## How to Fix

### Step 1: Get the Correct Key

1. Go to [Supabase Dashboard](https://app.supabase.com)
2. Select your project
3. Go to **Settings** (gear icon) → **API**
4. Find the **"Project API keys"** section
5. Copy the **"anon"** or **"public"** key
   - ⚠️ **DO NOT** use the "service_role" key (that's for server-side only)
   - ✅ Use the **"anon public"** key

### Step 2: Update Your .env File

Make sure your `.env` file has:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlvdXItcHJvamVjdC1pZCIsInJvbGUiOiJhbm9uIiwiaWF0IjoxNjE2MjM5MDIyLCJleHAiOjE5MzE4MTUwMjJ9.your-actual-key-here
```

### Step 3: Common Mistakes to Avoid

❌ **Don't include quotes** around the values:
```env
# WRONG:
NEXT_PUBLIC_SUPABASE_ANON_KEY="eyJhbGc..."
# RIGHT:
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
```

❌ **Don't use service_role key** (it won't work in the browser):
```env
# WRONG - This is for server-side only:
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...service_role...
# RIGHT - Use anon/public key:
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...anon...
```

❌ **Don't have extra spaces**:
```env
# WRONG:
NEXT_PUBLIC_SUPABASE_ANON_KEY = eyJhbGc...
# RIGHT:
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
```

### Step 4: Restart Dev Server

After updating your `.env` file:
1. Stop your dev server (Ctrl+C)
2. Start it again: `npm run dev`

## Verify Your Key

The anon/public key should:
- Start with `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9`
- Be very long (hundreds of characters)
- Have "anon" role in the payload (you can decode it at jwt.io to check)

## Still Not Working?

1. Double-check you copied the **entire** key (they're very long)
2. Make sure there are no line breaks in the key
3. Try copying the key again from Supabase Dashboard
4. Check the browser console for the exact error message


