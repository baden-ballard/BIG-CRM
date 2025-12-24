import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_KEY || '';

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Supabase URL or Key not found in environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkRenewalActivity() {
  try {
    console.log('🔍 Checking renewal activity...\n');

    // Check recent renewals
    console.log('📋 Recent Renewals:');
    const { data: renewals, error: renewalsError } = await supabase
      .from('renewals')
      .select('id, group_id, renewal_date, created_at')
      .order('created_at', { ascending: false })
      .limit(5);

    if (renewalsError) {
      console.error('❌ Error fetching renewals:', renewalsError.message);
    } else if (!renewals || renewals.length === 0) {
      console.log('   No renewals found\n');
    } else {
      renewals.forEach((row, i) => {
        console.log(`   ${i + 1}. Renewal ID: ${row.id}`);
        console.log(`      Group ID: ${row.group_id}`);
        console.log(`      Renewal Date: ${row.renewal_date}`);
        console.log(`      Created At: ${row.created_at}\n`);
      });

      // Check plans for the most recent renewal
      if (renewals.length > 0) {
        const latestRenewal = renewals[0];
        console.log(`🔍 Checking plans for latest renewal (${latestRenewal.id}):`);
        
        const { data: plans, error: plansError } = await supabase
          .from('renewal_group_plans')
          .select(`
            group_plan_id,
            group_plans (
              id,
              plan_name,
              plan_type
            )
          `)
          .eq('renewal_id', latestRenewal.id);

        if (plansError) {
          console.error('   ❌ Error:', plansError.message);
        } else if (!plans || plans.length === 0) {
          console.log('   ⚠️  No plans found in renewal_group_plans for this renewal!\n');
        } else {
          console.log(`   Found ${plans.length} plan(s):\n`);
          plans.forEach((row: any, i: number) => {
            const plan = row.group_plans;
            console.log(`   ${i + 1}. Plan ID: ${row.group_plan_id}`);
            console.log(`      Plan Name: ${plan?.plan_name || 'NULL'}`);
            console.log(`      Plan Type: ${plan?.plan_type || 'NULL'}\n`);
          });
        }
      }
    }

    // Check recent participant_group_plan_rates
    console.log('📊 Recent Participant Group Plan Rates:');
    const { data: rates, error: ratesError } = await supabase
      .from('participant_group_plan_rates')
      .select('id, participant_group_plan_id, group_option_rate_id, employer_contribution_type, employer_contribution_amount, start_date, end_date, created_at')
      .order('created_at', { ascending: false })
      .limit(10);

    if (ratesError) {
      console.error('❌ Error fetching rates:', ratesError.message);
    } else if (!rates || rates.length === 0) {
      console.log('   No rate history records found\n');
    } else {
      console.log(`   Found ${rates.length} recent records:\n`);
      rates.forEach((row, i) => {
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

    console.log('💡 Note: PostgreSQL RAISE NOTICE messages (DEBUG logs) are in Supabase Dashboard → Logs → Postgres Logs');
    console.log('   Filter for "DEBUG" to see detailed function execution logs.\n');

  } catch (error: any) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

checkRenewalActivity();

