# BIG CRM - Quick Start Guide

## 🚀 Getting Started

### 1. Install Dependencies
```bash
npm install
```

### 2. Set Up Environment Variables

**Option A: Use the setup script**
```bash
./scripts/setup-env-local.sh
```

**Option B: Manual setup**
Create `.env.local` file:
```env
NEXT_PUBLIC_SUPABASE_URL=https://tymgrdjcamlbvhaexclh.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-from-.env
```

### 3. Start Development Server
```bash
npm run dev
```

The app will be available at **http://localhost:3003**

## 📁 Project Structure

```
BIG CRM/
├── app/                    # Next.js App Router pages
│   ├── page.tsx            # Dashboard
│   ├── groups/             # Groups pages
│   ├── participants/        # Participants pages
│   ├── programs/           # Programs pages
│   └── providers/           # Providers pages
├── components/              # React components
│   ├── GlassCard.tsx       # Glassmorphic card
│   ├── GlassButton.tsx     # Glassmorphic button
│   └── Navigation.tsx      # Navigation bar
├── lib/                     # Utilities
│   └── supabase.ts         # Supabase client
├── styles/                  # CSS files
│   └── glassmorphic.css    # Glassmorphic theme
└── config/                  # Configuration
    └── colors.ts           # Color palette
```

## 🎨 Design Theme

- **Primary Color**: White (#ffffff)
- **Secondary Color**: Blue (#3b82f6)
- **Accent Color**: Red (#ef4444)
- **Style**: Glassmorphic with backdrop blur effects

## 📱 Pages Available

1. **Dashboard** (`/`) - Overview with stats
2. **Groups** (`/groups`) - Manage groups and pipeline
3. **Participants** (`/participants`) - Manage participants
4. **Programs** (`/programs`) - Manage programs
5. **Providers** (`/providers`) - Manage providers

## 🔧 Available Scripts

- `npm run dev` - Start dev server on localhost:3003
- `npm run build` - Build for production
- `npm start` - Start production server
- `npm run lint` - Run ESLint

## 🚢 Deployment to Vercel

1. Push code to GitHub
2. Import project in Vercel
3. Add environment variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Deploy!

## ✨ Features Implemented

- ✅ Glassmorphic UI design
- ✅ Responsive navigation
- ✅ Dashboard with live stats
- ✅ Groups listing page
- ✅ Participants listing page
- ✅ Programs listing page
- ✅ Providers listing page
- ✅ Supabase integration
- ✅ TypeScript support

## 🎯 Next Steps

- Add create/edit forms for each entity
- Add detail pages for groups and participants
- Implement search and filtering
- Add data tables with sorting
- Create forms for adding new records


