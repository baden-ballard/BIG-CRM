#!/usr/bin/env node

import dotenv from 'dotenv';
import { executeSQL } from './tools/execute-sql.js';

dotenv.config();

async function testSQL() {
  console.log('🧪 Testing SQL execution...\n');

  // Test with a simple query that won't modify anything
  const testSQL = 'SELECT version();';

  try {
    console.log('Executing test SQL:', testSQL);
    const result = await executeSQL(testSQL);

    if (result.isError) {
      const content = result.content[0];
      const errorData = content && 'text' in content ? JSON.parse(content.text) : { error: 'Unknown error' };
      console.error('❌ Error:', errorData);
      
      if (errorData.error && errorData.error.includes('DATABASE_URL')) {
        console.error('\n💡 Make sure DATABASE_URL is set in your .env file');
      }
      process.exit(1);
    }

    const content = result.content[0];
    const data = content && 'text' in content ? JSON.parse(content.text) : {};
    console.log('✅ SQL execution successful!');
    console.log('\nResult:', JSON.stringify(data, null, 2));
    console.log('\n🎉 Your DATABASE_URL is configured correctly!');
    console.log('   You can now use the execute_sql tool to create tables.');
    
  } catch (error: any) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

testSQL();

