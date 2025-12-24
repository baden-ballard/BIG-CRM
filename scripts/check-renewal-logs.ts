import { Client } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

async function checkRenewalLogs() {
  const databaseUrl = process.env.DATABASE_URL;
  
  if (!databaseUrl) {
    console.error('DATABASE_URL not found in environment variables.');
    process.exit(1);
  }

  const client = new Client({
    connectionString: databaseUrl,
    ssl: {
      rejectUnauthorized: false,
    },
  });

  try {
    await client.connect();
    console.log('✅ Connected to database\n');

    // Check recent renewals
    console.log('📋 Recent Renewals:');
    const renewalsResult = await client.query(`
      SELECT 
        id,
        group_id,
        renewal_date,
        created_at
      FROM renewals
      ORDER BY created_at DESC
      LIMIT 5
    `);
    
    if (renewalsResult.rows.length === 0) {
      console.log('   No renewals found\n');
    } else {
      renewalsResult.rows.forEach((row, i) => {
        console.log(`   ${i + 1}. Renewal ID: ${row.id}`);
        console.log(`      Group ID: ${row.group_id}`);
        console.log(`      Renewal Date: ${row.renewal_date}`);
        console.log(`      Created At: ${row.created_at}\n`);
      });
    }

    // Check recent participant_group_plan_rates
    console.log('📊 Recent Participant Group Plan Rates:');
    const ratesResult = await client.query(`
      SELECT 
        id,
        participant_group_plan_id,
        group_option_rate_id,
        employer_contribution_type,
        employer_contribution_amount,
        start_date,
        end_date,
        created_at
      FROM participant_group_plan_rates
      ORDER BY created_at DESC
      LIMIT 10
    `);
    
    if (ratesResult.rows.length === 0) {
      console.log('   No rate history records found\n');
    } else {
      console.log(`   Found ${ratesResult.rows.length} recent records:\n`);
      ratesResult.rows.forEach((row, i) => {
        console.log(`   ${i + 1}. Record ID: ${row.id}`);
        console.log(`      Participant Group Plan ID: ${row.participant_group_plan_id}`);
        console.log(`      Group Option Rate ID: ${row.group_option_rate_id}`);
        console.log(`      Contribution Type: ${row.employer_contribution_type || 'NULL'}`);
        console.log(`      Contribution Amount: ${row.employer_contribution_amount || 'NULL'}`);
        console.log(`      Start Date: ${row.start_date || 'NULL'}`);
        console.log(`      End Date: ${row.end_date || 'NULL (Active)'}`);
        console.log(`      Created At: ${row.created_at}\n`);
      });
    }

    // Check if there are plans in renewal_group_plans for the most recent renewal
    if (renewalsResult.rows.length > 0) {
      const latestRenewal = renewalsResult.rows[0];
      console.log(`🔍 Checking plans for latest renewal (${latestRenewal.id}):`);
      
      const plansResult = await client.query(`
        SELECT 
          rgp.group_plan_id,
          gp.plan_name,
          gp.plan_type
        FROM renewal_group_plans rgp
        LEFT JOIN group_plans gp ON gp.id = rgp.group_plan_id
        WHERE rgp.renewal_id = $1
      `, [latestRenewal.id]);
      
      if (plansResult.rows.length === 0) {
        console.log('   ⚠️  No plans found in renewal_group_plans for this renewal!\n');
      } else {
        console.log(`   Found ${plansResult.rows.length} plan(s):\n`);
        plansResult.rows.forEach((row, i) => {
          console.log(`   ${i + 1}. Plan ID: ${row.group_plan_id}`);
          console.log(`      Plan Name: ${row.plan_name || 'NULL'}`);
          console.log(`      Plan Type: ${row.plan_type || 'NULL'}\n`);
        });
      }
    }

    console.log('💡 Note: PostgreSQL RAISE NOTICE messages (DEBUG logs) are stored in Supabase Dashboard → Logs → Postgres Logs');
    console.log('   Check there for detailed function execution logs.\n');

  } catch (error: any) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

checkRenewalLogs();

