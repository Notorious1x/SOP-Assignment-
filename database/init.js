const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

function getDb() {
  return supabase;
}

async function initializeDatabase() {
  try {
    const { data, error } = await supabase.from('users').select('user_id').limit(1);
    if (error) throw error;
    console.log('Connected to Supabase');
  } catch (err) {
    console.error('Supabase connection failed:', err.message);
    process.exit(1);
  }
}

module.exports = { getDb, initializeDatabase };
