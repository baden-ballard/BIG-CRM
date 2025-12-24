import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

async function debugRenewalIssue() {
  const renewalId = '0271f847-4161-4fe3-b89b-5384e0df8ba9';
  const groupId = '943798c5-948d-4f37-981b-135913b42f90';
  const planId = 'f95dfc1c-ecf0-439c-a776-0be4fae5715b';
  const renewalDate = '2026-01-01';

  console.log('🔍 Debugging renewal issue...\n');
  console.log(`Renewal ID: ${renewalId}`);
  console.log(`Group ID: ${groupId}`);
  console.log(`Plan ID: ${planId}`);
  console.log(`Renewal Date: ${renewalDate}\n`);

  // Check renewal details
  const { data: renewal } = await supabase
    .from('renewals')
    .select('*')
    .eq('id', renewalId)
    .single();

  console.log('📋 Renewal Details:');
  console.log(JSON.stringify(renewal, null, 2));
  console.log('');

  // Check participants for this group
  console.log('👥 Participants in Group:');
  const { data: participants } = await supabase
    .from('participants')
    .select('id, client_name, group_id, hire_date, termination_date, class_number')
    .eq('group_id', groupId);

  console.log(`Found ${participants?.length || 0} participants\n`);
  participants?.forEach((p, i) => {
    console.log(`   ${i + 1}. ${p.client_name} (ID: ${p.id})`);
    console.log(`      Hire Date: ${p.hire_date || 'NULL'}`);
    console.log(`      Termination Date: ${p.termination_date || 'NULL'}`);
    console.log(`      Class Number: ${p.class_number || 'NULL'}\n`);
  });

  // Check participant_group_plans for this plan
  console.log('📝 Participant Group Plans for this Plan:');
  const { data: participantPlans } = await supabase
    .from('participant_group_plans')
    .select(`
      id,
      participant_id,
      group_plan_id,
      group_plan_option_id,
      dependent_id,
      termination_date,
      participants!inner (
        id,
        client_name,
        group_id,
        hire_date,
        termination_date,
        class_number
      ),
      dependents (
        id,
        relationship
      )
    `)
    .eq('group_plan_id', planId);

  console.log(`Found ${participantPlans?.length || 0} participant_group_plans\n`);
  participantPlans?.forEach((pgp: any, i: number) => {
    const p = pgp.participants;
    console.log(`   ${i + 1}. Participant Group Plan ID: ${pgp.id}`);
    console.log(`      Participant: ${p?.client_name} (ID: ${p?.id})`);
    console.log(`      Group ID: ${p?.group_id}`);
    console.log(`      Matches renewal group: ${p?.group_id === groupId ? 'YES' : 'NO'}`);
    console.log(`      Hire Date: ${p?.hire_date || 'NULL'}`);
    console.log(`      Termination Date: ${p?.termination_date || 'NULL'}`);
    console.log(`      Class Number: ${p?.class_number || 'NULL'}`);
    console.log(`      Plan Termination Date: ${pgp.termination_date || 'NULL (Active)'}`);
    console.log(`      Dependent ID: ${pgp.dependent_id || 'NULL'}`);
    if (pgp.dependents) {
      console.log(`      Dependent Relationship: ${pgp.dependents.relationship}`);
    }
    console.log('');
  });

  // Check if participants are active on renewal date
  console.log('✅ Active Participants Check (on renewal date 2026-01-01):');
  participantPlans?.forEach((pgp: any, i: number) => {
    const p = pgp.participants;
    const isActive = 
      (!p?.hire_date || p.hire_date <= renewalDate) &&
      (!p?.termination_date || p.termination_date >= renewalDate) &&
      (!pgp.termination_date || pgp.termination_date >= renewalDate) &&
      p?.group_id === groupId;
    
    console.log(`   ${i + 1}. ${p?.client_name}: ${isActive ? '✅ ACTIVE' : '❌ INACTIVE'}`);
    if (!isActive) {
      if (p?.group_id !== groupId) console.log(`      - Group ID mismatch`);
      if (p?.hire_date && p.hire_date > renewalDate) console.log(`      - Hire date after renewal: ${p.hire_date}`);
      if (p?.termination_date && p.termination_date < renewalDate) console.log(`      - Terminated before renewal: ${p.termination_date}`);
      if (pgp.termination_date && pgp.termination_date < renewalDate) console.log(`      - Plan terminated before renewal: ${pgp.termination_date}`);
    }
  });
  console.log('');

  // Check group_option_rates for the plan options
  console.log('💰 Group Option Rates:');
  const { data: planOptions } = await supabase
    .from('group_plan_options')
    .select(`
      id,
      option,
      group_option_rates (
        id,
        rate,
        start_date,
        end_date,
        employer_contribution_type
      )
    `)
    .eq('group_plan_id', planId);

  console.log(`Found ${planOptions?.length || 0} plan options\n`);
  planOptions?.forEach((option: any, i: number) => {
    console.log(`   ${i + 1}. Option: ${option.option} (ID: ${option.id})`);
    const rates = option.group_option_rates || [];
    const activeRates = rates.filter((r: any) => 
      r.start_date <= renewalDate && (!r.end_date || r.end_date >= renewalDate)
    );
    console.log(`      Total Rates: ${rates.length}`);
    console.log(`      Active Rates (on ${renewalDate}): ${activeRates.length}`);
    activeRates.forEach((rate: any) => {
      console.log(`         - Rate ID: ${rate.id}, Rate: $${rate.rate}, Contribution Type: ${rate.employer_contribution_type || 'NULL'}`);
    });
    console.log('');
  });
}

debugRenewalIssue().catch(console.error);

