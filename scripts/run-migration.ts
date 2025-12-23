import { readFileSync } from 'fs';
import { join } from 'path';
import { Client } from 'pg';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

async function runMigration() {
  const migrationFile = process.argv[2];
  
  if (!migrationFile) {
    console.error('Usage: tsx scripts/run-migration.ts <migration-file.sql>');
    console.error('Example: tsx scripts/run-migration.ts sql/add-participant-dependent-counts.sql');
    process.exit(1);
  }

  // Try to get DATABASE_URL from environment
  let databaseUrl = process.env.DATABASE_URL;
  
  // If DATABASE_URL is not set, try to construct it from Supabase credentials
  if (!databaseUrl) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
    const dbPassword = process.env.DATABASE_PASSWORD;
    
    if (supabaseUrl && dbPassword) {
      // Extract project reference from Supabase URL
      const projectRef = supabaseUrl.replace('https://', '').replace('.supabase.co', '');
      databaseUrl = `postgresql://postgres:${dbPassword}@db.${projectRef}.supabase.co:5432/postgres`;
    } else {
      console.error('Error: DATABASE_URL not found in environment variables.');
      console.error('Please set one of:');
      console.error('  - DATABASE_URL (full PostgreSQL connection string)');
      console.error('  - OR NEXT_PUBLIC_SUPABASE_URL + DATABASE_PASSWORD');
      console.error('\nAlternatively, you can run the SQL manually in Supabase SQL Editor:');
      console.error('  1. Go to https://app.supabase.com');
      console.error('  2. Select your project');
      console.error('  3. Go to SQL Editor');
      console.error('  4. Paste and run the SQL from:', migrationFile);
      process.exit(1);
    }
  }

  const client = new Client({
    connectionString: databaseUrl,
  });

  try {
    console.log('Connecting to database...');
    await client.connect();
    console.log('Connected successfully!');

    // Read the migration file
    const migrationPath = join(process.cwd(), migrationFile);
    console.log(`Reading migration file: ${migrationPath}`);
    const sql = readFileSync(migrationPath, 'utf-8');

    console.log('Running migration...');
    await client.query(sql);
    console.log('✅ Migration completed successfully!');

  } catch (error: any) {
    console.error('❌ Migration failed:');
    console.error(error.message);
    if (error.code === 'ECONNREFUSED') {
      console.error('\nCould not connect to database. Please check your DATABASE_URL.');
    } else if (error.code === '28P01') {
      console.error('\nAuthentication failed. Please check your database password.');
    }
    process.exit(1);
  } finally {
    await client.end();
  }
}

runMigration();

