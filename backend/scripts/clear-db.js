const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

// Supabase client
const supabase = createClient(
  process.env.PROJECT_URL,
  process.env.API_KEY
);

async function clearDatabase() {
  console.log('🗑️  Starting database cleanup...\n');

  try {
    // Delete in reverse order of dependencies
    console.log('Deleting QR codes...');
    await supabase.from('qr_codes').delete().neq('id', 0);
    console.log('✅ QR codes deleted\n');

    console.log('Deleting ratings...');
    await supabase.from('ratings').delete().neq('id', 0);
    console.log('✅ Ratings deleted\n');

    console.log('Deleting booking resources...');
    await supabase.from('booking_resources').delete().neq('id', 0);
    console.log('✅ Booking resources deleted\n');

    console.log('Deleting bookings...');
    await supabase.from('bookings').delete().neq('id', 0);
    console.log('✅ Bookings deleted\n');

    console.log('Deleting pricing rules...');
    await supabase.from('pricing_rules').delete().neq('id', 0);
    console.log('✅ Pricing rules deleted\n');

    console.log('Deleting resources...');
    await supabase.from('resources').delete().neq('id', 0);
    console.log('✅ Resources deleted\n');

    console.log('Deleting workspaces...');
    await supabase.from('workspaces').delete().neq('id', 0);
    console.log('✅ Workspaces deleted\n');

    console.log('Deleting working hubs...');
    await supabase.from('working_hubs').delete().neq('id', 0);
    console.log('✅ Working hubs deleted\n');

    console.log('🎉 Database cleared successfully!\n');

  } catch (error) {
    console.error('❌ Error clearing database:', error);
  }
}

// Run the cleanup script
clearDatabase();
