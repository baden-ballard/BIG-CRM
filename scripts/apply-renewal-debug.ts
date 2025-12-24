import { readFileSync } from 'fs';
import { join } from 'path';
import { executeSQLWithConnection } from '../src/tools/execute-sql.js';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

async function applyMigration() {
  const migrationFile = 'sql/add-renewal-debug-logging-with-instrumentation.sql';
  
  try {
    // Read the migration file
    const migrationPath = join(process.cwd(), migrationFile);
    console.log(`Reading migration file: ${migrationPath}`);
    const sql = readFileSync(migrationPath, 'utf-8');

    console.log('Executing migration...');
    const result = await executeSQLWithConnection(sql);
    
    if (result.isError) {
      const content = result.content[0];
      const errorData = content && 'text' in content ? JSON.parse(content.text) : { error: 'Unknown error' };
      console.error('❌ Migration failed:');
      console.error(JSON.stringify(errorData, null, 2));
      
      if (errorData.error && errorData.error.includes('DATABASE_URL')) {
        console.error('\n📝 To run this migration manually:');
        console.error('1. Go to https://app.supabase.com');
        console.error('2. Select your project');
        console.error('3. Go to SQL Editor');
        console.error(`4. Copy and paste the contents of: ${migrationFile}`);
        console.error('5. Click "Run"');
      }
      process.exit(1);
    } else {
      console.log('✅ Migration completed successfully!');
    }
  } catch (error: any) {
    console.error('❌ Migration failed:', error.message);
    console.error('\n📝 To run this migration manually:');
    console.error('1. Go to https://app.supabase.com');
    console.error('2. Select your project');
    console.error('3. Go to SQL Editor');
    console.error(`4. Copy and paste the contents of: ${migrationFile}`);
    console.error('5. Click "Run"');
    process.exit(1);
  }
}

applyMigration();

