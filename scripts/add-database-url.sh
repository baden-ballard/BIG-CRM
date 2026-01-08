#!/bin/bash

# Helper script to add DATABASE_URL to .env file
# Usage: ./scripts/add-database-url.sh YOUR_PASSWORD

if [ -z "$1" ]; then
    echo "Usage: ./scripts/add-database-url.sh YOUR_PASSWORD"
    echo ""
    echo "Or manually add this line to your .env file:"
    echo "DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@db.tymgrdjcamlbvhaexclh.supabase.co:5432/postgres"
    exit 1
fi

PASSWORD="$1"
PROJECT_REF="tymgrdjcamlbvhaexclh"
DATABASE_URL="postgresql://postgres:${PASSWORD}@db.${PROJECT_REF}.supabase.co:5432/postgres"

ENV_FILE=".env"

# Check if DATABASE_URL already exists
if grep -q "DATABASE_URL=" "$ENV_FILE"; then
    echo "⚠️  DATABASE_URL already exists in .env file"
    echo "   Updating it..."
    # Use sed to replace the line (works on macOS and Linux)
    if [[ "$OSTYPE" == "darwin"* ]]; then
        sed -i '' "s|^DATABASE_URL=.*|DATABASE_URL=${DATABASE_URL}|" "$ENV_FILE"
    else
        sed -i "s|^DATABASE_URL=.*|DATABASE_URL=${DATABASE_URL}|" "$ENV_FILE"
    fi
else
    echo "✅ Adding DATABASE_URL to .env file..."
    echo "DATABASE_URL=${DATABASE_URL}" >> "$ENV_FILE"
fi

echo ""
echo "✅ DATABASE_URL has been added/updated!"
echo ""
echo "⚠️  Security Note: Make sure .env is in your .gitignore file"
echo "   (It should already be there)"





