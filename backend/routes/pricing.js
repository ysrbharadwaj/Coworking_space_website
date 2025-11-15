const express = require('express');
const router = express.Router();
const { supabase } = require('../config/supabase');
const { calculateDynamicPrice } = require('../utils/pricing');

// Get all pricing rules
router.get('/', async (req, res) => {
  try {
    const { workspace_id } = req.query;
    
    let query = supabase
      .from('pricing_rules')
      .select(`
        *,
        workspaces (
          id,
          name,
          type
        )
      `)
      .order('created_at', { ascending: false });

    if (workspace_id) query = query.eq('workspace_id', workspace_id);

    const { data, error } = await query;

    if (error) throw error;
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get pricing rule by ID
router.get('/:id', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('pricing_rules')
      .select('*')
      .eq('id', req.params.id)
      .single();

    if (error) throw error;
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Create pricing rule (Admin)
router.post('/', async (req, res) => {
  try {
    const {
      workspace_id,
      rule_type,
      percentage_modifier,
      flat_modifier,
      start_time,
      end_time,
      days
    } = req.body;
    
    const { data, error } = await supabase
      .from('pricing_rules')
      .insert([{
        workspace_id,
        rule_type,
        percentage_modifier: percentage_modifier || 0,
        flat_modifier: flat_modifier || 0,
        start_time,
        end_time,
        days: days || []
      }])
      .select();

    if (error) throw error;
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update pricing rule (Admin)
router.put('/:id', async (req, res) => {
  try {
    const {
      workspace_id,
      rule_type,
      percentage_modifier,
      flat_modifier,
      start_time,
      end_time,
      days
    } = req.body;
    
    const { data, error } = await supabase
      .from('pricing_rules')
      .update({
        workspace_id,
        rule_type,
        percentage_modifier,
        flat_modifier,
        start_time,
        end_time,
        days
      })
      .eq('id', req.params.id)
      .select();

    if (error) throw error;
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Delete pricing rule (Admin)
router.delete('/:id', async (req, res) => {
  try {
    const { error } = await supabase
      .from('pricing_rules')
      .delete()
      .eq('id', req.params.id);

    if (error) throw error;
    res.json({ success: true, message: 'Pricing rule deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Calculate price for a booking with dynamic pricing
router.post('/calculate', async (req, res) => {
  try {
    const { workspace_id, start_time, end_time, booking_type } = req.body;

    // Get workspace details
    const { data: workspace, error: workspaceError } = await supabase
      .from('workspaces')
      .select('*')
      .eq('id', workspace_id)
      .single();

    if (workspaceError) throw workspaceError;

    // Use enhanced dynamic pricing
    const pricingResult = await calculateDynamicPrice(
      workspace_id,
      workspace.base_price,
      start_time,
      end_time,
      booking_type
    );

    res.json({
      success: true,
      data: {
        workspace_name: workspace.name,
        base_price: workspace.base_price,
        final_price: pricingResult.finalPrice,
        breakdown: pricingResult.breakdown,
        occupancy_rate: pricingResult.occupancyRate,
        is_workday: pricingResult.isWorkday,
        booking_type
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
