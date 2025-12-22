#!/bin/bash

# Test connection with different connection string formats

echo "Testing Supabase connection options..."
echo ""

PROJECT_REF="tymgrdjcamlbvhaexclh"
PASSWORD=$(grep DATABASE_URL .env | sed 's/.*:\(.*\)@.*/\1/')

echo "Current DATABASE_URL format:"
echo "postgresql://postgres:[PASSWORD]@db.${PROJECT_REF}.supabase.co:5432/postgres"
echo ""

echo "Alternative formats to try:"
echo ""
echo "1. Connection Pooling (Transaction mode):"
echo "   postgresql://postgres.${PROJECT_REF}:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres"
echo ""
echo "2. Connection Pooling (Session mode):"
echo "   postgresql://postgres.${PROJECT_REF}:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:5432/postgres"
echo ""
echo "3. Direct connection (IPv4 - if available):"
echo "   Check Supabase dashboard for IPv4 connection string"
echo ""

echo "To get the connection pooling URL:"
echo "1. Go to: https://app.supabase.com/project/${PROJECT_REF}/settings/database"
echo "2. Scroll to 'Connection pooling' section"
echo "3. Copy the connection string (Transaction mode recommended)"
echo "4. Replace [YOUR-PASSWORD] with your password"
echo ""


