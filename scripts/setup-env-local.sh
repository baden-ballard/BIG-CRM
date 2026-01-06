#!/bin/bash

# Script to create .env.local from .env for Next.js

ENV_FILE=".env"
ENV_LOCAL_FILE=".env.local"

if [ ! -f "$ENV_FILE" ]; then
    echo "❌ .env file not found!"
    exit 1
fi

echo "📝 Creating .env.local for Next.js..."

# Read SUPABASE_URL and SUPABASE_KEY from .env
SUPABASE_URL=$(grep "^SUPABASE_URL=" "$ENV_FILE" | cut -d'=' -f2-)
SUPABASE_KEY=$(grep "^SUPABASE_KEY=" "$ENV_FILE" | cut -d'=' -f2-)

if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_KEY" ]; then
    echo "❌ SUPABASE_URL or SUPABASE_KEY not found in .env"
    exit 1
fi

# Create .env.local with Next.js public variables
cat > "$ENV_LOCAL_FILE" << EOF
# Next.js Public Environment Variables
NEXT_PUBLIC_SUPABASE_URL=$SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=$SUPABASE_KEY
EOF

echo "✅ Created .env.local"
echo ""
echo "📋 Contents:"
cat "$ENV_LOCAL_FILE"




