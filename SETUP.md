# Supabase Connection Setup Guide

## Step 1: Get Your Supabase Credentials

1. **Go to your Supabase Dashboard**
   - Visit https://app.supabase.com
   - Sign in to your account
   - Select your project (or create a new one)

2. **Get Your Project URL and API Key**
   - Go to **Settings** → **API** (or click on your project → Settings → API)
   - You'll find:
     - **Project URL**: Something like `https://xxxxx.supabase.co`
     - **anon/public key**: A long string starting with `eyJ...` (this is your public API key)

## Step 2: Create Your .env File

1. **Create a `.env` file** in the project root (same directory as `package.json`)

2. **Add your credentials**:
   ```env
   SUPABASE_URL=https://your-project-id.supabase.co
   SUPABASE_KEY=your-anon-public-key-here
   PORT=3003
   ```

   Replace:
   - `your-project-id` with your actual Supabase project ID
   - `your-anon-public-key-here` with your actual anon/public key

## Step 3: Install Dependencies

```bash
npm install
```

## Step 4: Test the Connection

```bash
npm run test-connection
```

This will verify that:
- ✅ Your credentials are correct
- ✅ You can connect to Supabase
- ✅ Your API key has the right permissions

## Step 5: Start the Server

```bash
npm run dev
```

The server will start on `http://localhost:3003`

## Troubleshooting

### Error: "SUPABASE_URL environment variable is required"
- Make sure your `.env` file exists in the project root
- Check that the variable names are exactly `SUPABASE_URL` and `SUPABASE_KEY`

### Error: "Invalid API key" or "JWT" errors
- Double-check your `SUPABASE_KEY` - make sure you're using the **anon/public** key, not the service_role key
- Copy the key directly from Supabase dashboard (Settings → API → anon public)

### Error: "could not resolve" or connection errors
- Verify your `SUPABASE_URL` is correct
- Make sure it starts with `https://` and ends with `.supabase.co`
- Check that your Supabase project is active (not paused)

### Still having issues?
- Make sure you've installed dependencies: `npm install`
- Check that your `.env` file doesn't have quotes around the values
- Verify your Supabase project is not paused or deleted

## Next Steps

Once connected, you can:
1. Create your database tables in the Supabase dashboard
2. Set up Row Level Security (RLS) policies
3. Start using the API endpoints or MCP tools



