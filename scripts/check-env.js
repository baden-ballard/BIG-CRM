#!/usr/bin/env node

/**
 * Quick script to check if environment variables are set correctly
 * Run: node scripts/check-env.js
 */

require('dotenv').config({ path: '.env.local' });
require('dotenv').config({ path: '.env' });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY;

console.log('\n🔍 Environment Variable Check\n');
console.log('='.repeat(50));

// Check URL
console.log('\n📡 Supabase URL:');
if (url) {
  console.log('   ✅ Found:', url.substring(0, 40) + '...');
  console.log('   Length:', url.length);
  console.log('   Has placeholder:', url.includes('placeholder') ? '❌ YES' : '✅ NO');
  if (url.startsWith('https://') && url.includes('.supabase.co')) {
    console.log('   Format: ✅ Valid');
  } else {
    console.log('   Format: ❌ Invalid (should start with https:// and contain .supabase.co)');
  }
} else {
  console.log('   ❌ NOT FOUND');
  console.log('   Set NEXT_PUBLIC_SUPABASE_URL or SUPABASE_URL');
}

// Check Key
console.log('\n🔑 Supabase API Key:');
if (key) {
  console.log('   ✅ Found');
  console.log('   Length:', key.length);
  console.log('   Preview:', key.substring(0, 30) + '...' + key.substring(key.length - 10));
  console.log('   Has placeholder:', key.includes('placeholder') ? '❌ YES' : '✅ NO');
  console.log('   Has spaces:', key.includes(' ') ? '❌ YES (remove spaces!)' : '✅ NO');
  console.log('   Has quotes:', (key.startsWith('"') || key.startsWith("'")) ? '❌ YES (remove quotes!)' : '✅ NO');
  
  if (key.length < 100) {
    console.log('   ⚠️  WARNING: Key seems too short (expected 200+ chars)');
    console.log('   Make sure you copied the ENTIRE key from Supabase');
  } else if (key.startsWith('eyJ')) {
    console.log('   Format: ✅ Valid JWT format');
  } else {
    console.log('   Format: ⚠️  Unexpected format (should start with eyJ)');
  }
  
  // Check if it's the right key type
  try {
    const parts = key.split('.');
    if (parts.length === 3) {
      const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
      console.log('   Role:', payload.role || 'not found');
      if (payload.role === 'anon' || payload.role === 'authenticated') {
        console.log('   Key type: ✅ Correct (anon/authenticated)');
      } else if (payload.role === 'service_role') {
        console.log('   Key type: ❌ WRONG! You used service_role key');
        console.log('   ⚠️  Use the "anon public" key instead!');
      }
    }
  } catch (e) {
    console.log('   Could not decode key (might be invalid format)');
  }
} else {
  console.log('   ❌ NOT FOUND');
  console.log('   Set NEXT_PUBLIC_SUPABASE_ANON_KEY or SUPABASE_KEY');
}

console.log('\n' + '='.repeat(50));

// Summary
console.log('\n📋 Summary:');
if (url && key && !url.includes('placeholder') && !key.includes('placeholder')) {
  console.log('   ✅ Both variables are set');
  if (key.length < 100) {
    console.log('   ⚠️  But key might be incomplete - check length');
  } else if (key.includes(' ') || key.startsWith('"') || key.startsWith("'")) {
    console.log('   ⚠️  But key has formatting issues - remove spaces/quotes');
  } else {
    console.log('   ✅ Ready to use! Restart your dev server if you just added these.');
  }
} else {
  console.log('   ❌ Missing or invalid variables');
  console.log('\n   Next steps:');
  console.log('   1. Create/update .env.local file');
  console.log('   2. Add: NEXT_PUBLIC_SUPABASE_URL=https://...');
  console.log('   3. Add: NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...');
  console.log('   4. Restart dev server: npm run dev');
}

console.log('\n');

