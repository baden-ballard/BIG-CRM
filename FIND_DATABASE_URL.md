# How to Find Your Supabase DATABASE_URL

## Method 1: Connection String (Easiest)

1. **Go to your Supabase Dashboard**
   - Visit https://app.supabase.com
   - Select your project

2. **Navigate to Settings**
   - Click on **Settings** (gear icon) in the left sidebar
   - Or go directly: https://app.supabase.com/project/[YOUR-PROJECT]/settings/database

3. **Find "Connection string" section**
   - Scroll down to the **"Connection string"** section
   - You'll see different connection options:
     - **URI** (this is what you need!)
     - **JDBC**
     - **Golang**
     - **Python**
     - **Node.js**

4. **Copy the URI connection string**
   - Click on the **URI** tab
   - You'll see something like:
     ```
     postgresql://postgres:[YOUR-PASSWORD]@db.xxxxx.supabase.co:5432/postgres
     ```
   - Click the copy button or select and copy it

5. **Replace [YOUR-PASSWORD]**
   - The connection string will have `[YOUR-PASSWORD]` as a placeholder
   - You need to replace this with your actual database password
   - **Don't know your password?** See Method 2 below

## Method 2: If You Don't Know Your Database Password

1. **Reset your database password**
   - Go to Settings > Database
   - Look for **"Database password"** section
   - Click **"Reset database password"** or **"Generate new password"**
   - Copy the new password (save it somewhere safe!)

2. **Construct the connection string manually**
   - Format: `postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres`
   - You can get `[PROJECT-REF]` from your `SUPABASE_URL`
     - If your SUPABASE_URL is `https://xxxxx.supabase.co`
     - Then `xxxxx` is your project reference
   - Example: `postgresql://postgres:yourpassword123@db.xxxxx.supabase.co:5432/postgres`

## Method 3: Using Connection Pooling (Recommended for Production)

Supabase also provides a connection pooling URL which is better for serverless environments:

1. **Go to Settings > Database**
2. **Find "Connection pooling" section**
3. **Copy the "Connection string"** (Transaction mode)
   - Format: `postgresql://postgres.[PROJECT-REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres`

## Quick Check: What You Need

Your `.env` file should have:
```env
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@db.PROJECT_REF.supabase.co:5432/postgres
```

Where:
- `YOUR_PASSWORD` = Your database password (reset it if you don't know it)
- `PROJECT_REF` = The part before `.supabase.co` in your SUPABASE_URL

## Still Can't Find It?

If you're still having trouble:
1. Check if you're looking in the right project
2. Make sure you have admin access to the project
3. Try the "Reset database password" option to get a fresh password
4. The connection string might be under "Database" > "Connection info" in some Supabase versions



