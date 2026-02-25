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

    // 2. OCCUPANCY-BASED PRICING (>70% of total workspaces booked +5%)
    // Get the hub_id for this workspace
    const { data: workspace } = await supabase
      .from('workspaces')
      .select('hub_id, capacity')
      .eq('id', workspace_id)
      .single();

    // Get all workspaces in the same hub
    const { data: allWorkspaces } = await supabase
      .from('workspaces')
      .select('id')
      .eq('hub_id', workspace.hub_id)
      .eq('is_available', true);

    const totalWorkspaces = allWorkspaces?.length || 1;

    // Get all bookings that overlap with the requested time period for workspaces in this hub
    const { data: overlappingBookings } = await supabase
      .from('bookings')
      .select('workspace_id, workspaces!inner(hub_id)')
      .eq('workspaces.hub_id', workspace.hub_id)
      .in('status', ['confirmed', 'checked_in'])
      .lte('start_time', end_time)
      .gte('end_time', start_time);

    // Count unique workspaces that have bookings during this time period
    const bookedWorkspaces = new Set(overlappingBookings?.map(b => b.workspace_id) || []).size;
    const occupancyRate = (bookedWorkspaces / totalWorkspaces) * 100;

    if (occupancyRate > 70) {
      const occupancyIncrease = calculatedPrice * 0.05; // 5% increase
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

    console.log(`📋 Found ${rules?.length || 0} pricing rules for workspace ${workspace_id}`);
    console.log(`📅 Booking Day: ${bookingDay}, Time: ${bookingTime}`);

    const appliedRules = [];

    for (const rule of rules || []) {
      // Start with applies = true (rule applies by default)
      // Set to false only if a restriction exists and doesn't match
      let applies = true;
      const reasons = [];

      // If days are specified, check if booking day matches
      if (rule.days && rule.days.length > 0) {
        if (!rule.days.includes(bookingDay)) {
          applies = false;
          reasons.push(`Day mismatch (needs ${rule.days.join(', ')}, got ${bookingDay})`);
        } else {
          reasons.push(`Day matched (${bookingDay})`);
        }
      } else {
        reasons.push('No day restriction');
      }

      // If time range is specified, check if booking time is within range
      if (rule.start_time && rule.end_time) {
        const crossesMidnight = rule.start_time > rule.end_time;
        let inTimeRange = false;

        if (crossesMidnight) {
          // For overnight ranges (e.g., 23:00 - 02:00), booking time should be >= start OR <= end
          inTimeRange = bookingTime >= rule.start_time || bookingTime <= rule.end_time;
        } else {
          // Normal range (e.g., 09:00 - 17:00), booking time should be >= start AND <= end
          inTimeRange = bookingTime >= rule.start_time && bookingTime <= rule.end_time;
        }

        if (!inTimeRange) {
          applies = false;
          reasons.push(`Time outside range (needs ${rule.start_time}-${rule.end_time}${crossesMidnight ? ' [overnight]' : ''}, got ${bookingTime})`);
        } else {
          reasons.push(`Time in range (${rule.start_time}-${rule.end_time}${crossesMidnight ? ' [overnight]' : ''})`);
        }
      } else {
        reasons.push('No time restriction');
      }

      // Apply the rule if all conditions are met
      if (applies) {
        const priceBeforeRule = calculatedPrice;
        calculatedPrice += (calculatedPrice * (rule.percentage_modifier || 0) / 100);
        calculatedPrice += (rule.flat_modifier || 0);
        const adjustment = calculatedPrice - priceBeforeRule;

        appliedRules.push({
          rule_type: rule.rule_type,
          percentage_modifier: rule.percentage_modifier,
          flat_modifier: rule.flat_modifier,
          adjustment: adjustment.toFixed(2),
          reasons: reasons.join(', ')
        });

        console.log(`✅ Applied rule: ${rule.rule_type} | ${reasons.join(', ')} | Adjustment: ₹${adjustment.toFixed(2)}`);
      } else {
        console.log(`❌ Skipped rule: ${rule.rule_type} | ${reasons.join(', ')}`);
      }
    }

    priceModifiers.appliedRules = appliedRules;

    priceModifiers.total = Math.round(calculatedPrice * 100) / 100;

    console.log('Dynamic Pricing Calculation:', {
      workspace_id,
      totalWorkspaces,
      bookedWorkspaces,
      occupancyRate: Math.round(occupancyRate * 100) / 100,
      durationHours,
      isWorkday,
      modifiers: priceModifiers
    });

    return {
      finalPrice: priceModifiers.total,
      breakdown: priceModifiers,
      occupancyRate: Math.round(occupancyRate * 100) / 100,
      isWorkday,
      average_rating: priceModifiers.average_rating || null,
      hours: durationHours,
      totalWorkspaces,
      bookedWorkspaces
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

