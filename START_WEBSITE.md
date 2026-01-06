# Starting the Website

## The Problem
You're seeing "Cannot GET" because the **Express API server** is running instead of the **Next.js website**.

## Solution

**Run this command in your terminal:**

```bash
cd "/Users/Baden/AI Projects/BIG CRM"
./scripts/start-frontend.sh
```

**OR manually:**

1. **Stop the Express server:**
   ```bash
   pkill -f "tsx.*server.ts"
   lsof -ti:3003 | xargs kill -9
   ```

2. **Start Next.js:**
   ```bash
   npm run dev
   ```

3. **Open browser:**
   Go to http://localhost:3003

## Note
- The Express server (`src/server.ts`) is for the MCP API backend
- The Next.js app (`app/`) is for the website frontend
- Only run ONE at a time on port 3003

## If you need both:
- Run Express on a different port (change PORT in src/server.ts)
- Or use Express only for API calls from the frontend




