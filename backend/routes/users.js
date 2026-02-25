const express = require('express');
const router = express.Router();
const { supabase } = require('../config/supabase');

// Get all users (from bookings - unique user names and emails)
router.get('/', async (req, res) => {
  try {
    const { data: bookings, error } = await supabase
      .from('bookings')
      .select('user_name, created_at');

    if (error) throw error;

    // Aggregate unique users
    const usersMap = new Map();
    bookings.forEach(b => {
      const name = b.user_name;

      if (name) {
        if (!usersMap.has(name)) {
          usersMap.set(name, {
            name: name,
            first_booking: b.created_at,
            booking_count: 1
          });
        } else {
          const user = usersMap.get(name);
          user.booking_count++;
          if (new Date(b.created_at) < new Date(user.first_booking)) {
            user.first_booking = b.created_at;
          }
        }
      }
    });

    const users = Array.from(usersMap.values()).map((user, index) => ({
      id: index + 1,
      ...user
    }));

    res.json({ success: true, data: users });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
