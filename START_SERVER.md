# Starting the Development Server

## Quick Start

Run this command in your terminal:

```bash
cd "/Users/Baden/AI Projects/BIG CRM"
npm install
npm run dev
```

The server will start on **http://localhost:3003**

## If you get errors:

1. **Missing dependencies**: Run `npm install` first
2. **Port already in use**: Kill the process using port 3003:
   ```bash
   lsof -ti:3003 | xargs kill -9
   ```
3. **Environment variables**: Make sure `.env.local` exists with:
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://tymgrdjcamlbvhaexclh.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   ```

## Once running:

- Open http://localhost:3003 in your browser
- The browser button should appear in Cursor's chat interface
- You can interact with the site through the browser MCP tools


