import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkPlanType() {
  const planId = 'f95dfc1c-ecf0-439c-a776-0be4fae5715b';

  console.log('🔍 Checking plan details...\n');

  const { data: plan, error } = await supabase
    .from('group_plans')
    .select('*')
    .eq('id', planId)
    .single();

  if (error) {
    console.error('❌ Error:', error.message);
    return;
  }

  console.log('📋 Plan Details:');
  console.log(`   ID: ${plan.id}`);
  console.log(`   Plan Name: ${plan.plan_name}`);
  console.log(`   Plan Type: ${plan.plan_type} ⚠️`);
  console.log(`   Employer Contribution Type: ${plan.employer_contribution_type || 'NULL'}`);
  console.log(`   Employer Contribution Value: ${plan.employer_contribution_value || 'NULL'}`);
  console.log('');

  // Check the options - are they numeric (age bands) or text (composite)?
  const { data: options } = await supabase
    .from('group_plan_options')
    .select('id, option')
    .eq('group_plan_id', planId);

  console.log('📝 Plan Options:');
  options?.forEach((opt, i) => {
    const isNumeric = /^\d+$/.test(opt.option);
    console.log(`   ${i + 1}. "${opt.option}" - ${isNumeric ? 'Numeric (Age Banded)' : 'Text (Composite)'}`);
  });
  console.log('');

  console.log('💡 Analysis:');
  const hasNumericOptions = options?.some(opt => /^\d+$/.test(opt.option));
  const hasTextOptions = options?.some(opt => !/^\d+$/.test(opt.option));
  
  if (plan.plan_type === 'Age Banded' && hasTextOptions) {
    console.log('   ⚠️  MISMATCH: Plan type is "Age Banded" but has text options (like "E+CDRN")');
    console.log('   This should be "Composite" plan type!');
  } else if (plan.plan_type === 'Composite' && hasNumericOptions) {
    console.log('   ⚠️  MISMATCH: Plan type is "Composite" but has numeric options');
    console.log('   This should be "Age Banded" plan type!');
  } else {
    console.log('   ✅ Plan type matches option format');
  }
}

checkPlanType().catch(console.error);

