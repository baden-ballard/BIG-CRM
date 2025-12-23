# BIG CRM - Frontend Setup

## Quick Start

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Set Up Environment Variables**
   Create a `.env.local` file in the root directory:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   ```

3. **Run Development Server**
   ```bash
   npm run dev
   ```
   
   The app will be available at `http://localhost:3003`

## Features

- ✅ Glassmorphic design theme (White primary, Blue secondary, Red accents)
- ✅ Responsive navigation
- ✅ Dashboard with stats
- ✅ Groups, Participants, Programs, Providers pages
- ✅ Supabase integration
- ✅ TypeScript for type safety

## Pages

- `/` - Dashboard with overview stats
- `/groups` - List and manage groups
- `/participants` - List and manage participants
- `/programs` - List and manage programs
- `/providers` - List and manage providers

## Deployment to Vercel

1. **Push to Git**
   ```bash
   git add .
   git commit -m "Initial commit"
   git push
   ```

2. **Deploy to Vercel**
   - Connect your GitHub repository to Vercel
   - Add environment variables in Vercel dashboard:
     - `NEXT_PUBLIC_SUPABASE_URL`
     - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - Deploy!

## Color Scheme

- **Primary**: White (#ffffff)
- **Secondary**: Blue (#3b82f6)
- **Accent**: Red (#ef4444)

## Tech Stack

- Next.js 14 (App Router)
- TypeScript
- Supabase
- Framer Motion (animations)
- Glassmorphic CSS



