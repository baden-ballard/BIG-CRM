import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join } from 'path';

// Get environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing required environment variables:');
  console.error('  NEXT_PUBLIC_SUPABASE_URL or SUPABASE_URL');
  console.error('  SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

// Create admin client with service role key
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function applyMigration() {
  try {
    // Read the SQL file
    const sqlPath = join(process.cwd(), 'sql', 'add-renewal-debug-logging-with-instrumentation.sql');
    const sql = readFileSync(sqlPath, 'utf-8');
    
    console.log('Applying migration: add-renewal-debug-logging-with-instrumentation.sql');
    console.log('SQL file size:', sql.length, 'characters');
    
    // Split SQL into individual statements (semicolon-separated)
    // Remove comments and empty lines
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'))
      .filter(s => !s.match(/^\s*$/));
    
    console.log('Found', statements.length, 'SQL statements to execute');
    
    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      if (statement.length < 10) continue; // Skip very short statements
      
      console.log(`\nExecuting statement ${i + 1}/${statements.length}...`);
      console.log('Statement preview:', statement.substring(0, 100) + '...');
      
      try {
        const { data, error } = await supabase.rpc('exec_sql', { sql_query: statement });
        
        if (error) {
          // Try direct query execution
          const { error: queryError } = await supabase.from('_').select('*').limit(0);
          
          // If that doesn't work, try executing via REST API
          const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': supabaseServiceKey,
              'Authorization': `Bearer ${supabaseServiceKey}`
            },
            body: JSON.stringify({ sql_query: statement })
          });
          
          if (!response.ok) {
            console.error(`Error executing statement ${i + 1}:`, await response.text());
          } else {
            console.log(`✓ Statement ${i + 1} executed successfully`);
          }
        } else {
          console.log(`✓ Statement ${i + 1} executed successfully`);
        }
      } catch (err: any) {
        console.error(`Error executing statement ${i + 1}:`, err.message);
        // Continue with next statement
      }
    }
    
    console.log('\n✓ Migration completed!');
  } catch (error: any) {
    console.error('Migration failed:', error.message);
    process.exit(1);
  }
}

applyMigration();

