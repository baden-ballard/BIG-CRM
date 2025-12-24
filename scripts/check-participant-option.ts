import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkParticipantOption() {
  const participantPlanId = '1374753b-be0d-45d2-9fe7-193b6e9c317c';

  console.log('🔍 Checking participant group plan details...\n');

  const { data: pgp, error } = await supabase
    .from('participant_group_plans')
    .select(`
      *,
      group_plan_options (
        id,
        option
      )
    `)
    .eq('id', participantPlanId)
    .single();

  if (error) {
    console.error('❌ Error:', error.message);
    return;
  }

  console.log('📝 Participant Group Plan Details:');
  console.log(`   ID: ${pgp.id}`);
  console.log(`   Participant ID: ${pgp.participant_id}`);
  console.log(`   Group Plan ID: ${pgp.group_plan_id}`);
  console.log(`   Group Plan Option ID: ${pgp.group_plan_option_id || 'NULL ⚠️'}`);
  if (pgp.group_plan_options) {
    console.log(`   Option: ${pgp.group_plan_options.option}`);
  }
  console.log(`   Group Option Rate ID: ${pgp.group_option_rate_id || 'NULL'}`);
  console.log(`   Termination Date: ${pgp.termination_date || 'NULL (Active)'}`);
  console.log('');
}

checkParticipantOption().catch(console.error);

