const express = require('express');
const router = express.Router();
const { supabase } = require('../config/supabase');

// Get all workspaces with filters
router.get('/', async (req, res) => {
  try {
    const { hub_id, type, min_capacity, max_capacity, min_price, max_price, city, state } = req.query;

    let query = supabase
      .from('workspaces')
      .select(`
        *,
        working_hubs (
          id,
          name,
          address,
          city,
          state,
          country
        )
      `);

    if (hub_id) query = query.eq('hub_id', hub_id);
    if (type) query = query.eq('type', type);
    if (min_capacity) query = query.gte('capacity', min_capacity);
    if (max_capacity) query = query.lte('capacity', max_capacity);
    if (min_price) query = query.gte('base_price', min_price);
    if (max_price) query = query.lte('base_price', max_price);

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) throw error;

    // Filter by city/state if provided
    let filteredData = data;
    if (city) {
      filteredData = filteredData.filter(w => w.working_hubs?.city === city);
    }
    if (state) {
      filteredData = filteredData.filter(w => w.working_hubs?.state === state);
    }

    res.json({ success: true, data: filteredData });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Search workspaces with amenities
router.get('/search', async (req, res) => {
  try {
    const { amenity, sort_by } = req.query;

    let query = supabase
      .from('workspaces')
      .select(`
        *,
        working_hubs (
          id,
          name,
          address,
          city,
          state,
          country
        )
      `);

    const { data, error } = await query;

    if (error) throw error;

    let filteredData = data;

    // Filter by amenity
    if (amenity) {
      filteredData = filteredData.filter(workspace => {
        const amenities = workspace.amenities || [];
        return amenities.includes(amenity);
      });
    }

    // Sort results
    if (sort_by === 'price_asc') {
      filteredData.sort((a, b) => a.base_price - b.base_price);
    } else if (sort_by === 'price_desc') {
      filteredData.sort((a, b) => b.base_price - a.base_price);
    }

    res.json({ success: true, data: filteredData });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get workspace by ID
router.get('/:id', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('workspaces')
      .select(`
        *,
        working_hubs (
          id,
          name,
          address,
          city,
          state,
          country,
          pincode
        )
      `)
      .eq('id', req.params.id)
      .single();

    if (error) throw error;
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Create workspace (Admin)
router.post('/', async (req, res) => {
  try {
    const { hub_id, name, type, capacity, base_price, amenities } = req.body;

    const { data, error } = await supabase
      .from('workspaces')
      .insert([{ hub_id, name, type, capacity, base_price, amenities: amenities || [] }])
      .select();

    if (error) throw error;
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update workspace (Admin)
router.put('/:id', async (req, res) => {
  try {
    const { hub_id, name, type, capacity, base_price, amenities } = req.body;

    const { data, error } = await supabase
      .from('workspaces')
      .update({ hub_id, name, type, capacity, base_price, amenities })
      .eq('id', req.params.id)
      .select();

    if (error) throw error;
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Delete workspace (Admin)
router.delete('/:id', async (req, res) => {
  try {
    const { error } = await supabase
      .from('workspaces')
      .delete()
      .eq('id', req.params.id);

    if (error) throw error;
    res.json({ success: true, message: 'Workspace deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Check availability for a workspace
router.post('/:id/check-availability', async (req, res) => {
  try {
    const { date, start_time, end_time } = req.body;
    const workspace_id = req.params.id;

    // Check for conflicting bookings
    const { data: bookings, error } = await supabase
      .from('bookings')
      .select('*')
      .eq('workspace_id', workspace_id)
      .eq('status', 'confirmed')
      .gte('start_time', `${date}T00:00:00`)
      .lte('start_time', `${date}T23:59:59`);

    if (error) throw error;

    const requestedStart = new Date(`${date}T${start_time}`);
    const requestedEnd = new Date(`${date}T${end_time}`);

    const isAvailable = !bookings.some(booking => {
      const bookingStart = new Date(booking.start_time);
      const bookingEnd = new Date(booking.end_time);

      return (
        (requestedStart >= bookingStart && requestedStart < bookingEnd) ||
        (requestedEnd > bookingStart && requestedEnd <= bookingEnd) ||
        (requestedStart <= bookingStart && requestedEnd >= bookingEnd)
      );
    });

    res.json({ success: true, available: isAvailable });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
