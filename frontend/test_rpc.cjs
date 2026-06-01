const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://oyhlhdlubralrgjbgtqw.supabase.co';
const supabaseAnonKey = 'sb_publishable_8493GeAz4c4Iw_4byE16Mg_RHAS4jtw';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testRPC() {
  console.log('--- TESTING RPC FUNCTION IN SUPABASE ---');
  
  // Call the function with a dummy UUID
  const dummyUUID = '00000000-0000-0000-0000-000000000000';
  console.log(`Calling clear_user_data_and_sessions with dummy UUID: ${dummyUUID}`);
  
  const { data, error } = await supabase.rpc('clear_user_data_and_sessions', {
    target_user_id: dummyUUID
  });

  if (error) {
    console.error('RPC Error occurred:');
    console.error('Message:', error.message);
    console.error('Details:', error.details);
    console.error('Hint:', error.hint);
    console.error('Code:', error.code);
  } else {
    console.log('RPC Success! Return data:', data);
  }
}

testRPC();
