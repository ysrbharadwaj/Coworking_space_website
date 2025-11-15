const { supabase } = require('../config/supabase');

async function calculateDynamicPrice(workspace_id, base_price, start_time, end_time, booking_type) {
  try {
    const start = new Date(start_time);
    const end = new Date(end_time);
    const durationHours = (end - start) / (1000 * 60 * 60);
    
    // Base price calculation
    let calculatedPrice = base_price;
    
    if (booking_type === 'daily') {
      calculatedPrice *= 8; // 8 hours per day
    } else if (booking_type === 'monthly') {
      calculatedPrice *= 8 * 22; // 8 hours * 22 working days
    } else {
      calculatedPrice *= durationHours;
    }

    let priceModifiers = {
      base: calculatedPrice,
      workday: 0,
      occupancy: 0,
      rating: 0,
      total: calculatedPrice
    };

    // 1. WORKDAY PRICING (Monday-Friday +8%)
    const dayOfWeek = start.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
    const isWorkday = dayOfWeek >= 1 && dayOfWeek <= 5;
    
    if (isWorkday) {
      const workdayIncrease = calculatedPrice * 0.08; // 8% increase
      priceModifiers.workday = workdayIncrease;
      calculatedPrice += workdayIncrease;
    }

    // 2. OCCUPANCY-BASED PRICING (>70% occupancy +15%)
    const { data: workspace } = await supabase
      .from('workspaces')
      .select('capacity')
      .eq('id', workspace_id)
      .single();

    // Get all bookings for this workspace on the same date
    const startDate = start.toISOString().split('T')[0];
    const { data: existingBookings } = await supabase
      .from('bookings')
      .select('*')
      .eq('workspace_id', workspace_id)
      .in('status', ['confirmed', 'checked_in'])
      .gte('start_time', `${startDate}T00:00:00`)
      .lte('start_time', `${startDate}T23:59:59`);

    // Calculate occupancy rate (assuming 10 available slots per day)
    const maxSlotsPerDay = 10;
    const currentBookings = existingBookings?.length || 0;
    const occupancyRate = (currentBookings / maxSlotsPerDay) * 100;

    if (occupancyRate > 70) {
      const occupancyIncrease = calculatedPrice * 0.15; // 15% increase
      priceModifiers.occupancy = occupancyIncrease;
      calculatedPrice += occupancyIncrease;
    }

    // 3. RATING-BASED PRICING (Rating >= 4.0 +5%)
    const { data: ratings } = await supabase
      .from('ratings')
      .select('rating')
      .eq('workspace_id', workspace_id);

    if (ratings && ratings.length > 0) {
      const avgRating = ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length;
      
      if (avgRating >= 4.0) {
        const ratingIncrease = calculatedPrice * 0.05; // 5% increase for good rating
        priceModifiers.rating = ratingIncrease;
        calculatedPrice += ratingIncrease;
      }
      
      priceModifiers.average_rating = Math.round(avgRating * 10) / 10;
    }

    // Apply additional pricing rules from database
    const { data: rules } = await supabase
      .from('pricing_rules')
      .select('*')
      .eq('workspace_id', workspace_id);

    const bookingDay = start.toLocaleDateString('en-US', { weekday: 'short' });
    const bookingTime = start.toTimeString().slice(0, 5);

    for (const rule of rules || []) {
      let applies = false;

      if (rule.days && rule.days.length > 0 && rule.days.includes(bookingDay)) {
        applies = true;
      }

      if (rule.start_time && rule.end_time) {
        if (bookingTime >= rule.start_time && bookingTime <= rule.end_time) {
          applies = true;
        }
      }

      if (applies) {
        calculatedPrice += (calculatedPrice * (rule.percentage_modifier || 0) / 100);
        calculatedPrice += (rule.flat_modifier || 0);
      }
    }

    priceModifiers.total = Math.round(calculatedPrice * 100) / 100;

    return {
      finalPrice: priceModifiers.total,
      breakdown: priceModifiers,
      occupancyRate: Math.round(occupancyRate * 100) / 100,
      isWorkday,
      average_rating: priceModifiers.average_rating || null
    };
  } catch (error) {
    console.error('Error calculating dynamic price:', error);
    return {
      finalPrice: base_price * durationHours,
      breakdown: { base: base_price * durationHours, total: base_price * durationHours },
      occupancyRate: 0,
      isWorkday: false
    };
  }
}

module.exports = { calculateDynamicPrice };

