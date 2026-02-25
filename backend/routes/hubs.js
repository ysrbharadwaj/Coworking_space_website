const express = require('express');
const router = express.Router();
const { supabase } = require('../config/supabase');

// Get all hubs
router.get('/', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('working_hubs')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get hub by ID
router.get('/:id', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('working_hubs')
      .select('*')
      .eq('id', req.params.id)
      .single();

    if (error) throw error;
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Create hub (Admin)
router.post('/', async (req, res) => {
  try {
    const { name, address, city, state, country, pincode, latitude, longitude } = req.body;

    const { data, error } = await supabase
      .from('working_hubs')
      .insert([{ name, address, city, state, country, pincode, latitude, longitude }])
      .select();

    if (error) throw error;
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update hub (Admin)
router.put('/:id', async (req, res) => {
  try {
    const { name, address, city, state, country, pincode, latitude, longitude } = req.body;

    const { data, error } = await supabase
      .from('working_hubs')
      .update({ name, address, city, state, country, pincode, latitude, longitude })
      .eq('id', req.params.id)
      .select();

    if (error) throw error;
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Delete hub (Admin)
router.delete('/:id', async (req, res) => {
  try {
    const { error } = await supabase
      .from('working_hubs')
      .delete()
      .eq('id', req.params.id);

    if (error) throw error;
    res.json({ success: true, message: 'Hub deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Filter hubs by location
router.get('/filter/location', async (req, res) => {
  try {
    const { city, state, country } = req.query;
    let query = supabase.from('working_hubs').select('*');

    if (city) query = query.eq('city', city);
    if (state) query = query.eq('state', state);
    if (country) query = query.eq('country', country);

    const { data, error } = await query;

    if (error) throw error;
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
