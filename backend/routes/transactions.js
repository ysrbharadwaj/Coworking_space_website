const express = require('express');
const router = express.Router();
const { supabase } = require('../config/supabase');

/**
 * Transaction Data Adapter
 * Maps bookings data to transaction format
 * Extensible: Add new fields here without breaking existing code
 */
class TransactionAdapter {
  static fromBooking(booking) {
    // Use transaction_id from booking if available, otherwise generate from created_at
    let txnId = booking.transaction_id;
    if (!txnId && booking.created_at) {
      const dateStr = new Date(booking.created_at).toISOString().slice(0, 19).replace(/[-:T]/g, '').slice(0, 14);
      txnId = `TXN-${dateStr}`;
    } else if (!txnId) {
      txnId = `TXN-${booking.id}`;
    }

    return {
      id: booking.id,
      booking_id: booking.id,
      user: booking.user_name || 'Guest',
      workspace: booking.workspaces?.name || `Workspace #${booking.workspace_id}`,
      hub: booking.workspaces?.working_hubs?.name || '—',
      amount: parseFloat(booking.total_price) || 0,
      status: this.mapBookingStatus(booking.status),
      date: booking.created_at,
      payment_method: 'Online', // Default as column doesn't exist yet
      transaction_id: txnId,
      // Future extensible fields
      start_time: booking.start_time,
      end_time: booking.end_time
    };
  }

  static mapBookingStatus(bookingStatus) {
    const statusMap = {
      'confirmed': 'success',
      'completed': 'success',
      'cancelled': 'failed',
      'pending': 'pending'
    };
    return statusMap[bookingStatus] || 'pending';
  }
}

// Get all transactions (bookings with payment status)
router.get('/', async (req, res) => {
  try {
    // Fetch bookings with related data
    const { data: bookings, error } = await supabase
      .from('bookings')
      .select(`
        id,
        workspace_id,
        user_name,
        total_price,
        status,
        created_at,
        start_time,
        end_time,
        workspaces (
          name,
          working_hubs (
            name
          )
        )
      `)
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Transform bookings to transactions using adapter
    const transactions = (bookings || []).map(b => TransactionAdapter.fromBooking(b));

    res.json({ success: true, data: transactions });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Get single transaction
router.get('/:id', async (req, res) => {
  try {
    const { data: booking, error } = await supabase
      .from('bookings')
      .select(`
        id,
        workspace_id,
        user_name,
        total_price,
        status,
        created_at,
        start_time,
        end_time,
        workspaces (
          name,
          base_price,
          working_hubs (
            name,
            city
          )
        )
      `)
      .eq('id', req.params.id)
      .single();

    if (error) throw error;

    // Use adapter for consistent transformation
    const transaction = TransactionAdapter.fromBooking(booking);

    res.json({ success: true, data: transaction });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
