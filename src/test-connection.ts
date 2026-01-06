#!/usr/bin/env node

import dotenv from 'dotenv';
import { supabase } from './supabase/client.js';

dotenv.config();

async function testConnection() {
  console.log('🔌 Testing Supabase connection...\n');

  try {
    // Test 1: Check if we can connect
    console.log('1. Testing basic connection...');
    const { data, error } = await supabase.from('_test').select('*').limit(0);
    
    // This will fail if connection is wrong, but that's expected
    if (error && error.code === 'PGRST116') {
      console.log('   ✅ Connection successful! (Table not found is expected)');
    } else if (error && error.message.includes('JWT')) {
      console.log('   ❌ Authentication error - check your SUPABASE_KEY');
      throw error;
    } else if (error && error.message.includes('Invalid API key')) {
      console.log('   ❌ Invalid API key - check your SUPABASE_KEY');
      throw error;
    } else if (error && error.message.includes('could not resolve')) {
      console.log('   ❌ Invalid URL - check your SUPABASE_URL');
      throw error;
    } else {
      console.log('   ✅ Connection successful!');
    }

    // Test 2: Get project info (if possible)
    console.log('\n2. Checking project configuration...');
    const url = process.env.SUPABASE_URL;
    if (url) {
      const projectId = url.match(/https?:\/\/([^.]+)\.supabase\.co/)?.[1];
      if (projectId) {
        console.log(`   ✅ Project ID: ${projectId}`);
      } else {
        console.log(`   ⚠️  URL format: ${url.substring(0, 50)}...`);
      }
    }

    console.log('\n✅ Supabase connection test completed successfully!');
    console.log('\n📝 Next steps:');
    console.log('   - Create your database tables in Supabase dashboard');
    console.log('   - Configure Row Level Security (RLS) policies');
    console.log('   - Start using the MCP server: npm run dev');
    
  } catch (error: any) {
    console.error('\n❌ Connection test failed!');
    console.error(`   Error: ${error.message}`);
    console.error('\n💡 Troubleshooting:');
    console.error('   1. Check that SUPABASE_URL is correct (should be: https://xxxxx.supabase.co)');
    console.error('   2. Check that SUPABASE_KEY is correct (anon/public key from API settings)');
    console.error('   3. Make sure your .env file exists and has the correct values');
    process.exit(1);
  }
}

testConnection();




