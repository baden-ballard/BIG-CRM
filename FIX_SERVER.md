# Fix Server Issues

## Step 1: Stop any running servers
```bash
pkill -f "next dev"
lsof -ti:3003 | xargs kill -9
```

## Step 2: Create .env.local file
Run this command:
```bash
node scripts/create-env-local.js
```

Or manually create `.env.local`:
```env
NEXT_PUBLIC_SUPABASE_URL=https://tymgrdjcamlbvhaexclh.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-from-.env-file
```

## Step 3: Install dependencies
```bash
npm install
```

## Step 4: Start the server
```bash
npm run dev
```

You should see:
```
- ready started server on 0.0.0.0:3003, url: http://localhost:3003
```

## Step 5: Open in browser
Go to: http://localhost:3003

## Common Issues:

1. **Port 3003 already in use**: Kill the process first
2. **Missing .env.local**: Create it with the script above
3. **Missing dependencies**: Run `npm install`
4. **TypeScript errors**: Check the terminal output


