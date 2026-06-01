const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://oyhlhdlubralrgjbgtqw.supabase.co';
const supabaseAnonKey = 'sb_publishable_8493GeAz4c4Iw_4byE16Mg_RHAS4jtw';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function runDiagnostics() {
  console.log('--- STARTING SUPABASE DIAGNOSTICS ---');
  
  // 1. Test connection and read profiles
  console.log('\n1. Fetching profiles...');
  const { data: profiles, error: pError } = await supabase
    .from('profiles')
    .select('*');
    
  if (pError) {
    console.error('Error fetching profiles:', pError);
  } else {
    console.log(`Successfully fetched ${profiles.length} profiles:`);
    profiles.forEach(p => {
      console.log(`- ID: ${p.id} | Email: ${p.email} | Role: ${p.role} | Enabled: ${p.is_enabled}`);
    });
  }

  // Find a target user to test delete/update (e.g., maria.manzano@konecta.com)
  const targetUser = profiles?.find(p => p.email.includes('manzano'));
  if (!targetUser) {
    console.log('\nNo test target user found containing "manzano".');
    return;
  }

  console.log(`\nFound target user: ${targetUser.email} (ID: ${targetUser.id})`);

  // 2. Test fetching daily_metrics for this user
  console.log(`\n2. Fetching daily_metrics for ${targetUser.email}...`);
  const { data: metrics, error: mError } = await supabase
    .from('daily_metrics')
    .select('*')
    .eq('user_id', targetUser.id);

  if (mError) {
    console.error('Error fetching metrics:', mError);
  } else {
    console.log(`Found ${metrics.length} metrics records for this user.`);
  }

  // 3. Test deleting daily_metrics
  console.log(`\n3. Simulating DELETE from daily_metrics for user_id = ${targetUser.id}...`);
  const { data: delMetricsData, error: delMetricsError } = await supabase
    .from('daily_metrics')
    .delete()
    .eq('user_id', targetUser.id)
    .select();

  if (delMetricsError) {
    console.error('DELETE metrics error:', delMetricsError);
  } else {
    console.log(`DELETE metrics success. Rows affected:`, delMetricsData?.length);
  }

  // 4. Test deleting profile
  console.log(`\n4. Simulating DELETE from profiles for id = ${targetUser.id}...`);
  const { data: delProfileData, error: delProfileError } = await supabase
    .from('profiles')
    .delete()
    .eq('id', targetUser.id)
    .select();

  if (delProfileError) {
    console.error('DELETE profile error:', delProfileError);
  } else {
    console.log(`DELETE profile success. Rows affected:`, delProfileData?.length);
  }
}

runDiagnostics();
