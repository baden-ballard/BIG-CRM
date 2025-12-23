# Setting Up Environment Variables

The "Failed to fetch" error means Supabase is not configured. Follow these steps:

## Step 1: Create `.env.local` file

Create a file named `.env.local` in the root directory of your project (same level as `package.json`).

## Step 2: Get Your Supabase Credentials

1. Go to [Supabase Dashboard](https://app.supabase.com)
2. Select your project (or create a new one)
3. Go to **Settings** (gear icon) → **API**
4. Copy these values:
   - **Project URL** (this is your `NEXT_PUBLIC_SUPABASE_URL`)
   - **anon/public key** (this is your `NEXT_PUBLIC_SUPABASE_ANON_KEY`)

## Step 3: Add to `.env.local`

Add these lines to your `.env.local` file:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

**Important:** Replace `your-project-id` and `your-anon-key-here` with your actual values from Step 2.

## Step 4: Restart Your Dev Server

After adding the environment variables:

1. **Stop** your dev server (Ctrl+C or Cmd+C)
2. **Start** it again:
   ```bash
   npm run dev
   ```

**Note:** Next.js only reads `.env.local` when the server starts, so you MUST restart after adding/changing environment variables.

## Step 5: Verify It Works

1. Open your browser console (F12)
2. Try creating a group again
3. Check the console for any errors

## Troubleshooting

### Still getting "Failed to fetch"?

1. **Check the file name**: Must be exactly `.env.local` (not `.env` or `.env.example`)
2. **Check the location**: Must be in the project root (same folder as `package.json`)
3. **Check for typos**: Variable names must be exactly:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. **Restart the server**: Always restart after changing `.env.local`
5. **Check your Supabase project**: Make sure it's active and not paused

### Example `.env.local` file:

```env
NEXT_PUBLIC_SUPABASE_URL=https://abcdefghijklmnop.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFiY2RlZmdoaWprbG1ub3AiLCJyb2xlIjoiYW5vbiIsImlhdCI6MTYxNjIzOTAyMiwiZXhwIjoxOTMxODE1MDIyfQ.abcdefghijklmnopqrstuvwxyz1234567890
```

**Note:** Your actual values will be different. Never commit `.env.local` to git (it's already in `.gitignore`).

