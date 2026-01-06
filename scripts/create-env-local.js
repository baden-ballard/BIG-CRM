#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '..', '.env');
const envLocalPath = path.join(__dirname, '..', '.env.local');

if (!fs.existsSync(envPath)) {
  console.error('❌ .env file not found!');
  process.exit(1);
}

const envContent = fs.readFileSync(envPath, 'utf-8');
const lines = envContent.split('\n');

let supabaseUrl = '';
let supabaseKey = '';

lines.forEach(line => {
  if (line.startsWith('SUPABASE_URL=')) {
    supabaseUrl = line.split('=').slice(1).join('=');
  }
  if (line.startsWith('SUPABASE_KEY=')) {
    supabaseKey = line.split('=').slice(1).join('=');
  }
});

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ SUPABASE_URL or SUPABASE_KEY not found in .env');
  process.exit(1);
}

const envLocalContent = `# Next.js Public Environment Variables
NEXT_PUBLIC_SUPABASE_URL=${supabaseUrl}
NEXT_PUBLIC_SUPABASE_ANON_KEY=${supabaseKey}
`;

fs.writeFileSync(envLocalPath, envLocalContent);
console.log('✅ Created .env.local');
console.log('\n📋 Contents:');
console.log(envLocalContent);




