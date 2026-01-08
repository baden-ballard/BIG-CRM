#!/usr/bin/env node

import dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const PROJECT_REF = 'tymgrdjcamlbvhaexclh'; // From your SUPABASE_URL

console.log('🔧 DATABASE_URL Setup Helper\n');
console.log('Your Supabase project reference:', PROJECT_REF);
console.log('\nTo set up DATABASE_URL, you need your database password.\n');

console.log('📋 Steps to get your database password:');
console.log('1. Go to: https://app.supabase.com/project/' + PROJECT_REF + '/settings/database');
console.log('2. Scroll to "Database password" section');
console.log('3. Click "Reset database password" or "Generate new password"');
console.log('4. Copy the password (save it securely!)\n');

console.log('💡 Then add this to your .env file:');
console.log('\nDATABASE_URL=postgresql://postgres:[YOUR-PASSWORD]@db.' + PROJECT_REF + '.supabase.co:5432/postgres\n');

console.log('Replace [YOUR-PASSWORD] with the password you just copied.\n');

// Check if DATABASE_URL already exists
const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  if (envContent.includes('DATABASE_URL=')) {
    console.log('✅ DATABASE_URL already exists in your .env file!');
  } else {
    console.log('⚠️  DATABASE_URL not found in .env file.');
    console.log('   Add it using the format above.\n');
  }
} else {
  console.log('⚠️  .env file not found. Create it first.\n');
}

console.log('🔄 Alternative: Use Connection Pooling (Better for Vercel)');
console.log('   Get it from: Settings > Database > Connection pooling');
console.log('   Format: postgresql://postgres.' + PROJECT_REF + ':[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres\n');





