import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

async function fixPlanType() {
  const planId = 'f95dfc1c-ecf0-439c-a776-0be4fae5715b';

  console.log('🔧 Fixing plan type...\n');

  // Update plan type to Composite
  const { data, error } = await supabase
    .from('group_plans')
    .update({ plan_type: 'Composite' })
    .eq('id', planId)
    .select()
    .single();

  if (error) {
    console.error('❌ Error updating plan:', error.message);
    return;
  }

  console.log('✅ Plan type updated successfully!');
  console.log(`   Plan ID: ${data.id}`);
  console.log(`   Plan Name: ${data.plan_name}`);
  console.log(`   Plan Type: ${data.plan_type} ✅\n`);
  
  console.log('💡 Now run the renewal again and it should create rate history records!');
}

fixPlanType().catch(console.error);

