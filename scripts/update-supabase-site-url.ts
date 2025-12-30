/**
 * Script to update Supabase Site URL and Redirect URLs
 * 
 * Usage:
 * 1. Get your access token from https://supabase.com/dashboard/account/tokens
 * 2. Set it as an environment variable: export SUPABASE_ACCESS_TOKEN="your-token"
 * 3. Run: npx tsx scripts/update-supabase-site-url.ts
 */

const PROJECT_REF = 'tymgrdjcamlbvhaexclh';
const SITE_URL = 'https://big-crm.com';
const REDIRECT_URLS = [
  'https://big-crm.com/**',
  'http://big-crm.com/**', // Include HTTP for local/dev if needed
];

async function updateSiteUrl() {
  const accessToken = process.env.SUPABASE_ACCESS_TOKEN;
  
  if (!accessToken) {
    console.error('❌ SUPABASE_ACCESS_TOKEN environment variable is required');
    console.error('   Get your token from: https://supabase.com/dashboard/account/tokens');
    process.exit(1);
  }

  try {
    console.log('🔄 Updating Supabase Site URL and Redirect URLs...');
    console.log(`   Site URL: ${SITE_URL}`);
    console.log(`   Redirect URLs: ${REDIRECT_URLS.join(', ')}`);

    const response = await fetch(
      `https://api.supabase.com/v1/projects/${PROJECT_REF}/config/auth`,
      {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          site_url: SITE_URL,
          additional_redirect_urls: REDIRECT_URLS,
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Failed to update configuration');
      console.error(`   Status: ${response.status}`);
      console.error(`   Error: ${errorText}`);
      process.exit(1);
    }

    const data = await response.json();
    console.log('✅ Successfully updated Site URL and Redirect URLs!');
    console.log('   Configuration:', JSON.stringify(data, null, 2));
    
  } catch (error) {
    console.error('❌ Error updating configuration:', error);
    process.exit(1);
  }
}

updateSiteUrl();

