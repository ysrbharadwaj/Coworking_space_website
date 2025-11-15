const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

// Supabase client
const supabase = createClient(
  process.env.PROJECT_URL,
  process.env.API_KEY
);

// Load dummy data
const dummyData = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../dummy-data.json'), 'utf8'));

async function populateDatabase() {
  console.log('🚀 Starting database population...\n');

  try {
    // 1. Insert Working Hubs
    console.log('📍 Inserting working hubs...');
    const { data: hubs, error: hubsError } = await supabase
      .from('working_hubs')
      .insert(dummyData.working_hubs)
      .select();

    if (hubsError) {
      console.error('Error inserting hubs:', hubsError);
      return;
    }
    console.log(`✅ Inserted ${hubs.length} working hubs\n`);

    // Create hub name to ID mapping
    const hubMap = {};
    hubs.forEach(hub => {
      hubMap[hub.name] = hub.id;
    });

    // 2. Insert Workspaces
    console.log('💼 Inserting workspaces...');
    const workspacesWithHubIds = dummyData.workspaces.map(ws => ({
      hub_id: hubMap[ws.hub_name],
      name: ws.name,
      type: ws.type,
      capacity: ws.capacity,
      base_price: ws.base_price,
      amenities: ws.amenities
    }));

    const { data: workspaces, error: workspacesError } = await supabase
      .from('workspaces')
      .insert(workspacesWithHubIds)
      .select();

    if (workspacesError) {
      console.error('Error inserting workspaces:', workspacesError);
      return;
    }
    console.log(`✅ Inserted ${workspaces.length} workspaces\n`);

    // Create workspace name to ID mapping
    const workspaceMap = {};
    workspaces.forEach(ws => {
      workspaceMap[ws.name] = ws.id;
    });

    // 3. Insert Resources
    console.log('🎯 Inserting resources...');
    const resourcesWithWorkspaceIds = dummyData.resources.map(res => ({
      workspace_id: workspaceMap[res.workspace_name],
      name: res.name,
      description: res.description,
      price_per_slot: res.price_per_slot,
      quantity: res.quantity
    }));

    const { data: resources, error: resourcesError } = await supabase
      .from('resources')
      .insert(resourcesWithWorkspaceIds)
      .select();

    if (resourcesError) {
      console.error('Error inserting resources:', resourcesError);
      return;
    }
    console.log(`✅ Inserted ${resources.length} resources\n`);

    // 4. Insert Pricing Rules
    console.log('💰 Inserting pricing rules...');
    const pricingRulesWithWorkspaceIds = dummyData.pricing_rules.map(rule => ({
      workspace_id: workspaceMap[rule.workspace_name],
      rule_type: rule.rule_type,
      percentage_modifier: rule.percentage_modifier,
      flat_modifier: rule.flat_modifier,
      start_time: rule.start_time,
      end_time: rule.end_time,
      days: rule.days
    }));

    const { data: pricingRules, error: pricingError } = await supabase
      .from('pricing_rules')
      .insert(pricingRulesWithWorkspaceIds)
      .select();

    if (pricingError) {
      console.error('Error inserting pricing rules:', pricingError);
      return;
    }
    console.log(`✅ Inserted ${pricingRules.length} pricing rules\n`);

    // 5. Insert Sample Bookings
    console.log('📅 Inserting sample bookings...');
    const bookingsWithWorkspaceIds = dummyData.sample_bookings.map(booking => {
      const workspace = workspaces.find(ws => ws.name === booking.workspace_name);
      const start = new Date(booking.start_time);
      const end = new Date(booking.end_time);
      const hours = (end - start) / (1000 * 60 * 60);
      const total_price = workspace.base_price * hours;

      return {
        workspace_id: workspace.id,
        user_name: booking.user_name,
        start_time: booking.start_time,
        end_time: booking.end_time,
        total_price: total_price,
        booking_type: booking.booking_type,
        status: booking.status
      };
    });

    const { data: bookings, error: bookingsError } = await supabase
      .from('bookings')
      .insert(bookingsWithWorkspaceIds)
      .select();

    if (bookingsError) {
      console.error('Error inserting bookings:', bookingsError);
      return;
    }
    console.log(`✅ Inserted ${bookings.length} sample bookings\n`);

    // 6. Generate QR Codes for bookings
    console.log('📱 Generating QR codes for bookings...');
    const qrCodes = bookings.map(booking => ({
      booking_id: booking.id,
      qr_value: `BOOKING-${booking.id}-${Date.now()}`
    }));

    const { data: qrs, error: qrError } = await supabase
      .from('qr_codes')
      .insert(qrCodes)
      .select();

    if (qrError) {
      console.error('Error inserting QR codes:', qrError);
      return;
    }
    console.log(`✅ Generated ${qrs.length} QR codes\n`);

    // 7. Insert Ratings
    console.log('⭐ Inserting ratings...');
    const ratingsWithWorkspaceIds = dummyData.ratings.map(rating => ({
      workspace_id: workspaceMap[rating.workspace_name],
      user_name: rating.user_name,
      rating: rating.rating,
      review: rating.review
    }));

    const { data: ratings, error: ratingsError } = await supabase
      .from('ratings')
      .insert(ratingsWithWorkspaceIds)
      .select();

    if (ratingsError) {
      console.error('Error inserting ratings:', ratingsError);
      return;
    }
    console.log(`✅ Inserted ${ratings.length} ratings\n`);

    console.log('🎉 Database population completed successfully!\n');
    console.log('Summary:');
    console.log(`  - ${hubs.length} Working Hubs`);
    console.log(`  - ${workspaces.length} Workspaces`);
    console.log(`  - ${resources.length} Resources`);
    console.log(`  - ${pricingRules.length} Pricing Rules`);
    console.log(`  - ${bookings.length} Sample Bookings`);
    console.log(`  - ${qrs.length} QR Codes`);
    console.log(`  - ${ratings.length} Ratings`);

  } catch (error) {
    console.error('❌ Error populating database:', error);
  }
}

// Run the population script
populateDatabase();
