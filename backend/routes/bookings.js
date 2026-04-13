const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { supabase } = require('../config/supabase');
const { calculateDynamicPrice } = require('../utils/pricing');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { validate, rules } = require('../middleware/validate');
const { sendBookingConfirmationEmail } = require('../services/bookingEmailEvents');

const ACTIVE_BOOKING_STATUSES = ['confirmed', 'checked_in'];
const DEFAULT_HOLD_TTL_SECONDS = 10 * 60;
const WAITLIST_ACTIVE_STATUSES = ['pending', 'offered'];
const WAITLIST_OFFER_TTL_SECONDS = 5 * 60;
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@workspace.com';

function isMissingPaymentStatusColumnError(error) {
  const message = String(error?.message || '').toLowerCase();
  const details = String(error?.details || '').toLowerCase();
  const hint = String(error?.hint || '').toLowerCase();
  const schemaCacheVariant = (message.includes('schema cache') || details.includes('schema cache') || hint.includes('schema cache'))
    && (message.includes('payment_status') || details.includes('payment_status') || hint.includes('payment_status'));

  return error?.code === '42703'
    || (message.includes('payment_status') && message.includes('does not exist'))
    || (details.includes('payment_status') && details.includes('does not exist'))
    || schemaCacheVariant;
}

function buildSlotKey(workspaceId, startTime, endTime) {
  return `${workspaceId}:${new Date(startTime).toISOString()}:${new Date(endTime).toISOString()}`;
}

function normalizeIsoTime(value) {
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return null;
  return dt.toISOString();
}

function canonicalizeSlot(workspaceId, startTime, endTime) {
  const numericWorkspaceId = Number(workspaceId);
  const startIso = normalizeIsoTime(startTime);
  const endIso = normalizeIsoTime(endTime);

  if (!Number.isFinite(numericWorkspaceId) || !startIso || !endIso) {
    return null;
  }

  return {
    workspaceId: numericWorkspaceId,
    startIso,
    endIso,
    slotKey: buildSlotKey(numericWorkspaceId, startIso, endIso)
  };
}

async function cleanupExpiredHolds() {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('booking_holds')
    .select('id, slot_key')
    .eq('is_active', true)
    .lt('expires_at', now);

  if (error) throw error;
  if (!data || data.length === 0) return [];

  const ids = data.map(row => row.id);
  const { error: updateError } = await supabase
    .from('booking_holds')
    .update({ is_active: false, status: 'expired' })
    .in('id', ids)
    .eq('is_active', true);

  if (updateError) throw updateError;
  return data.map(row => row.slot_key).filter(Boolean);
}

async function cleanupExpiredWaitlistOffers() {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('booking_waitlist')
    .select('id, slot_key, offer_hold_token')
    .eq('status', 'offered')
    .lt('offer_expires_at', now);

  if (error) throw error;
  if (!data || data.length === 0) return [];

  const ids = data.map(row => row.id);
  const tokens = data.map(row => row.offer_hold_token).filter(Boolean);

  if (tokens.length > 0) {
    const { error: holdError } = await supabase
      .from('booking_holds')
      .update({ is_active: false, status: 'expired' })
      .in('hold_token', tokens)
      .eq('is_active', true);
    if (holdError) throw holdError;
  }

  const { error: updateError } = await supabase
    .from('booking_waitlist')
    .update({
      status: 'expired',
      offer_hold_token: null,
      offer_expires_at: null
    })
    .in('id', ids);

  if (updateError) throw updateError;
  return data.map(row => row.slot_key).filter(Boolean);
}

async function tryPromoteWaitlistForSlot(slotKey, preferredEntry = null) {
  if (!slotKey) return false;

  const { data: activeOffer, error: offerErr } = await supabase
    .from('booking_waitlist')
    .select('id')
    .eq('slot_key', slotKey)
    .eq('status', 'offered')
    .limit(1);

  if (offerErr) throw offerErr;
  if (Array.isArray(activeOffer) && activeOffer.length > 0) return false;

  let candidate = null;

  if (preferredEntry) {
    if (preferredEntry.slot_key !== slotKey || preferredEntry.status !== 'pending') {
      return false;
    }
    candidate = preferredEntry;
  } else {
    const { data: candidates, error: candidateErr } = await supabase
      .from('booking_waitlist')
      .select('*')
      .eq('slot_key', slotKey)
      .eq('status', 'pending')
      .order('priority', { ascending: true })
      .order('created_at', { ascending: true })
      .limit(1);

    if (candidateErr) throw candidateErr;
    candidate = candidates && candidates.length > 0 ? candidates[0] : null;
  }

  if (!candidate) return false;

  // Ensure slot is actually free
  const { data: bookingConflict, error: bookingErr } = await supabase
    .from('bookings')
    .select('id')
    .eq('workspace_id', candidate.workspace_id)
    .in('status', ACTIVE_BOOKING_STATUSES)
    .lt('start_time', candidate.end_time)
    .gt('end_time', candidate.start_time)
    .limit(1);

  if (bookingErr) throw bookingErr;
  if (Array.isArray(bookingConflict) && bookingConflict.length > 0) return false;

  const { data: holdConflict, error: holdErr } = await supabase
    .from('booking_holds')
    .select('id')
    .eq('workspace_id', candidate.workspace_id)
    .eq('is_active', true)
    .gt('expires_at', new Date().toISOString())
    .lt('start_time', candidate.end_time)
    .gt('end_time', candidate.start_time)
    .limit(1);

  if (holdErr) throw holdErr;
  if (Array.isArray(holdConflict) && holdConflict.length > 0) return false;

  const holdToken = crypto.randomUUID();
  const offerExpiresAt = new Date(Date.now() + WAITLIST_OFFER_TTL_SECONDS * 1000).toISOString();

  const { error: insertHoldErr } = await supabase
    .from('booking_holds')
    .insert([{
      hold_token: holdToken,
      workspace_id: candidate.workspace_id,
      user_email: candidate.user_email,
      start_time: candidate.start_time,
      end_time: candidate.end_time,
      slot_key: candidate.slot_key,
      expires_at: offerExpiresAt,
      is_active: true,
      status: 'offered'
    }]);

  if (insertHoldErr) {
    if (insertHoldErr.code === '23505' || insertHoldErr.code === '23P01') {
      return false;
    }
    throw insertHoldErr;
  }

  const { data: updatedEntry, error: updateErr } = await supabase
    .from('booking_waitlist')
    .update({
      status: 'offered',
      offer_hold_token: holdToken,
      offer_expires_at: offerExpiresAt
    })
    .eq('id', candidate.id)
    .eq('status', 'pending')
    .select()
    .maybeSingle();

  if (updateErr || !updatedEntry) {
    await supabase
      .from('booking_holds')
      .update({ is_active: false, status: 'released' })
      .eq('hold_token', holdToken)
      .eq('is_active', true);

    if (updateErr) throw updateErr;
    return false;
  }

  return true;
}

async function calculateQueuePosition(slotKey, entryId) {
  if (!slotKey || !entryId) return null;

  const { data, error } = await supabase
    .from('booking_waitlist')
    .select('id, priority, created_at')
    .eq('slot_key', slotKey)
    .eq('status', 'pending');

  if (error) throw error;
  if (!data || data.length === 0) return null;

  const sorted = data.sort((a, b) => {
    if (a.priority !== b.priority) return a.priority - b.priority;
    return new Date(a.created_at) - new Date(b.created_at);
  });

  const idx = sorted.findIndex(entry => entry.id === entryId);
  return idx === -1 ? null : idx + 1;
}

async function runWaitlistMaintenance(extraSlots = []) {
  const slots = new Set((extraSlots || []).filter(Boolean));
  const expiredHoldSlots = await cleanupExpiredHolds();
  expiredHoldSlots.forEach(slot => slots.add(slot));
  const expiredOfferSlots = await cleanupExpiredWaitlistOffers();
  expiredOfferSlots.forEach(slot => slots.add(slot));

  for (const slot of slots) {
    await tryPromoteWaitlistForSlot(slot);
  }
}

// Get current user's bookings (protected)
router.get('/my', authenticateToken, async (req, res) => {
  try {
    const { status } = req.query;
    const userEmail = req.user.email;

    let query = supabase
      .from('bookings')
      .select(`
        *,
        workspaces (
          id,
          name,
          type,
          working_hubs (
            name,
            city
          )
        )
      `)
      .eq('user_email', userEmail)
      .order('created_at', { ascending: false });

    if (status) query = query.eq('status', status);

    const { data, error } = await query;
    if (error) throw error;
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get all bookings (admin usage)
router.get('/', async (req, res) => {
  try {
    const { status, workspace_id } = req.query;

    let query = supabase
      .from('bookings')
      .select(`
        *,
        workspaces (
          id,
          name,
          type,
          working_hubs (
            name,
            city
          )
        )
      `)
      .order('created_at', { ascending: false });

    if (status) query = query.eq('status', status);
    if (workspace_id) query = query.eq('workspace_id', workspace_id);

    const { data, error } = await query;

    if (error) throw error;
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Real-time availability check (bookings + active holds)
router.post('/availability', authenticateToken, async (req, res) => {
  try {
    const { workspace_id, start_time, end_time } = req.body;

    const err = validate(req.body, {
      workspace_id: [rules.required, rules.positiveInt],
      start_time: [rules.required, rules.isoDate],
      end_time: [rules.required, rules.isoDate, rules.after('start_time')]
    });
    if (err) return res.status(400).json({ success: false, error: err });

    await runWaitlistMaintenance();

    const { data: bookingConflict, error: bookingErr } = await supabase
      .from('bookings')
      .select('id, start_time, end_time, status')
      .eq('workspace_id', workspace_id)
      .in('status', ACTIVE_BOOKING_STATUSES)
      .lt('start_time', end_time)
      .gt('end_time', start_time)
      .limit(1);

    if (bookingErr) throw bookingErr;

    const { data: holdConflict, error: holdErr } = await supabase
      .from('booking_holds')
      .select('id, start_time, end_time, user_email, expires_at')
      .eq('workspace_id', workspace_id)
      .eq('is_active', true)
      .gt('expires_at', new Date().toISOString())
      .neq('user_email', req.user.email)
      .lt('start_time', end_time)
      .gt('end_time', start_time)
      .limit(1);

    if (holdErr) throw holdErr;

    const hasBookingConflict = Array.isArray(bookingConflict) && bookingConflict.length > 0;
    const hasHoldConflict = Array.isArray(holdConflict) && holdConflict.length > 0;

    return res.json({
      success: true,
      data: {
        available: !hasBookingConflict && !hasHoldConflict,
        has_booking_conflict: hasBookingConflict,
        has_hold_conflict: hasHoldConflict,
        conflict: hasBookingConflict ? 'booking' : (hasHoldConflict ? 'hold' : null)
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Create a temporary slot hold to prevent race conditions before payment
router.post('/holds', authenticateToken, async (req, res) => {
  try {
    const { workspace_id, start_time, end_time, ttl_seconds } = req.body;

    const err = validate(req.body, {
      workspace_id: [rules.required, rules.positiveInt],
      start_time: [rules.required, rules.isoDate, rules.futureDate, rules.maxFutureDays(90)],
      end_time: [rules.required, rules.isoDate, rules.after('start_time'), rules.maxDuration(720)]
    });
    if (err) return res.status(400).json({ success: false, error: err });

    await runWaitlistMaintenance();

    const slot = canonicalizeSlot(workspace_id, start_time, end_time);
    if (!slot) {
      return res.status(400).json({ success: false, error: 'Invalid slot date-time values' });
    }

    const { workspaceId, startIso, endIso, slotKey } = slot;

    // Reuse active hold for same user/slot if it already exists.
    // Query overlap first, then match canonically to avoid DB text-format differences.
    const { data: activeUserHolds, error: existingErr } = await supabase
      .from('booking_holds')
      .select('hold_token, expires_at, workspace_id, start_time, end_time')
      .eq('workspace_id', workspaceId)
      .eq('user_email', req.user.email)
      .eq('is_active', true)
      .gt('expires_at', new Date().toISOString())
      .lt('start_time', endIso)
      .gt('end_time', startIso)
      .order('created_at', { ascending: false })
      .limit(5);

    if (existingErr) throw existingErr;

    const existingHold = (activeUserHolds || []).find((row) => {
      const rowSlot = canonicalizeSlot(row.workspace_id, row.start_time, row.end_time);
      return rowSlot && rowSlot.slotKey === slotKey;
    });

    if (existingHold) {
      return res.json({
        success: true,
        data: {
          hold_token: existingHold.hold_token,
          expires_at: existingHold.expires_at,
          reused: true
        }
      });
    }

    const { data: bookingConflict, error: bookingErr } = await supabase
      .from('bookings')
      .select('id')
      .eq('workspace_id', workspaceId)
      .in('status', ACTIVE_BOOKING_STATUSES)
      .lt('start_time', endIso)
      .gt('end_time', startIso)
      .limit(1);

    if (bookingErr) throw bookingErr;
    if (bookingConflict && bookingConflict.length > 0) {
      return res.status(409).json({
        success: false,
        error: 'This slot is no longer available. Please choose another time.'
      });
    }

    const safeTtl = Math.max(60, Math.min(Number(ttl_seconds) || DEFAULT_HOLD_TTL_SECONDS, 20 * 60));
    const expiresAt = new Date(Date.now() + safeTtl * 1000).toISOString();
    const holdToken = crypto.randomUUID();

    const { data: hold, error: holdErr } = await supabase
      .from('booking_holds')
      .insert([{
        hold_token: holdToken,
        workspace_id: workspaceId,
        user_email: req.user.email,
        start_time: startIso,
        end_time: endIso,
        slot_key: slotKey,
        expires_at: expiresAt,
        is_active: true,
        status: 'active'
      }])
      .select('hold_token, expires_at')
      .single();

    if (holdErr) {
      if (holdErr.code === '23505' || holdErr.code === '23P01') {
        return res.status(409).json({
          success: false,
          error: 'This slot is currently held by another user. Try again in a moment.'
        });
      }
      throw holdErr;
    }

    res.json({ success: true, data: hold });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Release a hold explicitly (optional, e.g. user abandons checkout)
router.delete('/holds/:holdToken', authenticateToken, async (req, res) => {
  try {
    const { holdToken } = req.params;

    const { data: hold, error: holdErr } = await supabase
      .from('booking_holds')
      .select('id, slot_key')
      .eq('hold_token', holdToken)
      .eq('user_email', req.user.email)
      .eq('is_active', true)
      .maybeSingle();

    if (holdErr) throw holdErr;

    if (!hold) {
      return res.status(404).json({ success: false, error: 'Hold not found or already inactive' });
    }

    const { error: releaseErr } = await supabase
      .from('booking_holds')
      .update({ is_active: false, status: 'released' })
      .eq('id', hold.id)
      .eq('is_active', true);

    if (releaseErr) throw releaseErr;

    await runWaitlistMaintenance([hold.slot_key]);

    res.json({ success: true, message: 'Hold released successfully' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Join waitlist for a fully booked slot
router.post('/waitlist', authenticateToken, async (req, res) => {
  try {
    const { workspace_id, start_time, end_time, notes } = req.body;

    const err = validate(req.body, {
      workspace_id: [rules.required, rules.positiveInt],
      start_time: [rules.required, rules.isoDate, rules.futureDate, rules.maxFutureDays(90)],
      end_time: [rules.required, rules.isoDate, rules.after('start_time'), rules.maxDuration(720)]
    });
    if (err) return res.status(400).json({ success: false, error: err });

    await runWaitlistMaintenance();

    const slotKey = buildSlotKey(workspace_id, start_time, end_time);

    const { data: bookingConflict, error: bookingErr } = await supabase
      .from('bookings')
      .select('id')
      .eq('workspace_id', workspace_id)
      .in('status', ACTIVE_BOOKING_STATUSES)
      .lt('start_time', end_time)
      .gt('end_time', start_time)
      .limit(1);

    if (bookingErr) throw bookingErr;

    const { data: holdConflict, error: holdErr } = await supabase
      .from('booking_holds')
      .select('id')
      .eq('workspace_id', workspace_id)
      .eq('is_active', true)
      .gt('expires_at', new Date().toISOString())
      .neq('user_email', req.user.email)
      .lt('start_time', end_time)
      .gt('end_time', start_time)
      .limit(1);

    if (holdErr) throw holdErr;

    const isBlocked = (bookingConflict && bookingConflict.length > 0) || (holdConflict && holdConflict.length > 0);
    if (!isBlocked) {
      return res.status(400).json({
        success: false,
        error: 'This slot is currently available. Please try booking directly instead of joining the waitlist.'
      });
    }

    const { data: existingEntry, error: existingErr } = await supabase
      .from('booking_waitlist')
      .select('*')
      .eq('slot_key', slotKey)
      .eq('user_email', req.user.email)
      .in('status', WAITLIST_ACTIVE_STATUSES)
      .maybeSingle();

    if (existingErr && existingErr.code !== 'PGRST116') throw existingErr;

    if (existingEntry) {
      const queuePosition = existingEntry.status === 'pending'
        ? await calculateQueuePosition(slotKey, existingEntry.id)
        : null;

      return res.json({
        success: true,
        data: {
          ...existingEntry,
          queue_position: queuePosition,
          reused: true
        }
      });
    }

    const sanitizedNotes = typeof notes === 'string' ? notes.trim().slice(0, 500) : null;

    const { data: waitlistEntry, error: insertErr } = await supabase
      .from('booking_waitlist')
      .insert([{
        workspace_id,
        slot_key: slotKey,
        start_time,
        end_time,
        user_email: req.user.email,
        notes: sanitizedNotes
      }])
      .select('*')
      .single();

    if (insertErr) {
      if (insertErr.code === '23505') {
        return res.status(409).json({ success: false, error: 'You are already on the waitlist for this slot.' });
      }
      throw insertErr;
    }

    const queuePosition = await calculateQueuePosition(slotKey, waitlistEntry.id);

    res.json({ success: true, data: { ...waitlistEntry, queue_position: queuePosition || 1 } });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get the current user's waitlist entries
router.get('/waitlist/my', authenticateToken, async (req, res) => {
  try {
    await runWaitlistMaintenance();

    const { data, error } = await supabase
      .from('booking_waitlist')
      .select('*')
      .eq('user_email', req.user.email)
      .order('created_at', { ascending: false });

    if (error) throw error;

    const decorated = await Promise.all((data || []).map(async entry => {
      if (entry.status === 'pending') {
        const queue = await calculateQueuePosition(entry.slot_key, entry.id);
        return { ...entry, queue_position: queue };
      }
      return { ...entry, queue_position: null };
    }));

    res.json({ success: true, data: decorated });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Remove a waitlist entry (user-driven)
router.delete('/waitlist/:id', authenticateToken, async (req, res) => {
  try {
    const entryId = req.params.id;

    const isAdmin = req.user && req.user.email === ADMIN_EMAIL;

    const { data: entry, error: fetchErr } = await supabase
      .from('booking_waitlist')
      .select('*')
      .eq('id', entryId)
      .maybeSingle();

    if (fetchErr) throw fetchErr;
    if (!entry) {
      return res.status(404).json({ success: false, error: 'Waitlist entry not found' });
    }

    if (!isAdmin && entry.user_email !== req.user.email) {
      return res.status(403).json({ success: false, error: 'Not authorized to remove this waitlist entry' });
    }

    if (entry.status === 'claimed') {
      return res.status(400).json({ success: false, error: 'This waitlist entry has already been claimed.' });
    }

    if (entry.offer_hold_token) {
      await supabase
        .from('booking_holds')
        .update({ is_active: false, status: 'released' })
        .eq('hold_token', entry.offer_hold_token)
        .eq('is_active', true);
    }

    const { data: updated, error: updateErr } = await supabase
      .from('booking_waitlist')
      .update({
        status: 'cancelled',
        offer_hold_token: null,
        offer_expires_at: null
      })
      .eq('id', entryId)
      .select()
      .maybeSingle();

    if (updateErr) throw updateErr;

    await runWaitlistMaintenance([entry.slot_key]);

    res.json({ success: true, data: updated });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Admin: list waitlist entries with workspace context
router.get('/waitlist', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { status, workspace_id, only_active } = req.query;

    let query = supabase
      .from('booking_waitlist')
      .select(`
        *,
        workspaces (
          id,
          name,
          working_hubs (
            name,
            city
          )
        )
      `)
      .order('priority', { ascending: true })
      .order('created_at', { ascending: true });

    if (workspace_id) query = query.eq('workspace_id', workspace_id);
    if (status) query = query.eq('status', status);
    else if (only_active === 'true') query = query.in('status', WAITLIST_ACTIVE_STATUSES);

    const { data, error } = await query;
    if (error) throw error;

    const decorated = (data || []).map((entry, idx) => ({
      ...entry,
      queue_position: idx + 1
    }));

    res.json({ success: true, data: decorated });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Admin: adjust waitlist priority (move up/down)
router.post('/waitlist/:id/reorder', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const entryId = req.params.id;
    const { direction, priority } = req.body || {};

    const { data: entry, error: fetchErr } = await supabase
      .from('booking_waitlist')
      .select('*')
      .eq('id', entryId)
      .maybeSingle();

    if (fetchErr) throw fetchErr;
    if (!entry) {
      return res.status(404).json({ success: false, error: 'Waitlist entry not found' });
    }

    let newPriority;
    if (priority !== undefined && priority !== null && priority !== '') {
      const parsed = Number(priority);
      if (!Number.isFinite(parsed)) {
        return res.status(400).json({ success: false, error: 'priority must be a number' });
      }
      newPriority = parsed;
    } else if (direction === 'up') {
      newPriority = entry.priority - 1;
    } else if (direction === 'down') {
      newPriority = entry.priority + 1;
    } else {
      return res.status(400).json({ success: false, error: 'Provide direction or priority' });
    }

    const { data: updated, error: updateErr } = await supabase
      .from('booking_waitlist')
      .update({ priority: newPriority })
      .eq('id', entryId)
      .select()
      .maybeSingle();

    if (updateErr) throw updateErr;

    await runWaitlistMaintenance([entry.slot_key]);

    res.json({ success: true, data: updated });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Admin: force-offer a waitlist entry if the slot is available
router.post('/waitlist/:id/promote', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const entryId = req.params.id;

    const { data: entry, error: fetchErr } = await supabase
      .from('booking_waitlist')
      .select('*')
      .eq('id', entryId)
      .maybeSingle();

    if (fetchErr) throw fetchErr;
    if (!entry) {
      return res.status(404).json({ success: false, error: 'Waitlist entry not found' });
    }

    if (entry.status !== 'pending') {
      return res.status(400).json({ success: false, error: 'Only pending waitlist entries can be promoted' });
    }

    const promoted = await tryPromoteWaitlistForSlot(entry.slot_key, entry);
    if (!promoted) {
      return res.status(409).json({
        success: false,
        error: 'Slot is not free yet or another offer is already active for this timeslot.'
      });
    }

    const { data: updated, error: reloadErr } = await supabase
      .from('booking_waitlist')
      .select('*')
      .eq('id', entryId)
      .maybeSingle();

    if (reloadErr) throw reloadErr;

    res.json({ success: true, data: updated });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get booking by ID
router.get('/:id', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('bookings')
      .select(`
        *,
        workspaces (
          id,
          name,
          type,
          capacity,
          base_price,
          amenities,
          working_hubs (
            name,
            address,
            city,
            state,
            country
          )
        ),
        booking_resources (
          id,
          quantity,
          resources (
            id,
            name,
            description,
            price_per_slot
          )
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

// Create booking (auth required)
router.post('/', authenticateToken, async (req, res) => {
  try {
    // Pull user identity from JWT token (trust token, not body)
    const tokenUser = req.user;
    const {
      workspace_id,
      start_time,
      end_time,
      hold_token,
      total_price,
      booking_type,
      status,
      resources // Array of { resource_id, quantity }
    } = req.body;

    // Override user data with token data for security
    const user_name  = tokenUser.name;
    const user_email = tokenUser.email;

    // Server-side validation
    const err = validate(req.body, {
      workspace_id:  [rules.required, rules.positiveInt],
      start_time:    [rules.required, rules.isoDate, rules.futureDate, rules.maxFutureDays(90)],
      end_time:      [rules.required, rules.isoDate, rules.after('start_time'), rules.maxDuration(720)],
      booking_type:  [rules.oneOf(['hourly', 'daily', 'monthly'])],
      hold_token:    [rules.required],
    });
    if (err) return res.status(400).json({ success: false, error: err });

    await runWaitlistMaintenance();

    const slot = canonicalizeSlot(workspace_id, start_time, end_time);
    if (!slot) {
      return res.status(400).json({ success: false, error: 'Invalid slot date-time values' });
    }

    const { workspaceId, startIso, endIso, slotKey } = slot;

    const { data: hold, error: holdErr } = await supabase
      .from('booking_holds')
      .select('id, hold_token, expires_at, workspace_id, start_time, end_time, slot_key, user_email')
      .eq('hold_token', hold_token)
      .eq('user_email', req.user.email)
      .eq('is_active', true)
      .maybeSingle();

    if (holdErr) throw holdErr;
    if (!hold) {
      return res.status(409).json({ success: false, error: 'Booking hold is missing or expired. Please retry.' });
    }

    const holdSlot = canonicalizeSlot(hold.workspace_id, hold.start_time, hold.end_time);

    if (
      hold.workspace_id !== workspaceId ||
      !holdSlot ||
      holdSlot.slotKey !== slotKey ||
      new Date(hold.expires_at) <= new Date()
    ) {
      return res.status(409).json({ success: false, error: 'Booking hold is no longer valid for this slot.' });
    }

    // Validate resources array items if provided
    if (resources && !Array.isArray(resources)) {
      return res.status(400).json({ success: false, error: 'resources must be an array' });
    }
    if (Array.isArray(resources)) {
      for (const r of resources) {
        if (!Number.isInteger(Number(r.resource_id)) || Number(r.resource_id) < 1)
          return res.status(400).json({ success: false, error: 'Each resource must have a valid resource_id' });
        if (!Number.isInteger(Number(r.quantity)) || Number(r.quantity) < 1 || Number(r.quantity) > 99)
          return res.status(400).json({ success: false, error: 'Resource quantity must be between 1 and 99' });
      }
    }

    // Ignore any client-supplied total_price above a sanity ceiling (backend recalculates anyway)
    const sanitisedPrice = (total_price !== undefined && Number.isFinite(Number(total_price)) && Number(total_price) > 0)
      ? Number(total_price) : undefined;

    // Get workspace details to validate it exists
    const { data: workspace, error: workspaceError } = await supabase
      .from('workspaces')
      .select('*')
      .eq('id', workspaceId)
      .single();

    if (workspaceError || !workspace) {
      return res.status(404).json({
        success: false,
        error: 'Workspace not found'
      });
    }

    // Use provided total_price or calculate if not provided
    let finalPrice = sanitisedPrice;

    if (!finalPrice) {
      // Calculate dynamic price (pass end_time as date string, not duration in hours)
      const dynamicPrice = await calculateDynamicPrice(
        workspaceId,
        workspace.base_price,
        startIso,
        endIso,
        booking_type
      );

      // Calculate resource costs
      let resourceCost = 0;
      if (resources && resources.length > 0) {
        for (const res of resources) {
          const { data: resourceData } = await supabase
            .from('resources')
            .select('price_per_slot')
            .eq('id', res.resource_id)
            .single();

          if (resourceData) {
            resourceCost += resourceData.price_per_slot * res.quantity;
          }
        }
      }

      finalPrice = dynamicPrice + resourceCost;
    }

    // Create booking with IST timestamp
    const now = new Date();
    const istOffset = 5.5 * 60 * 60 * 1000; // IST is UTC + 5:30
    const istTime = new Date(now.getTime() + istOffset).toISOString();

    // Generate transaction ID with timestamp (YYYYMMDD-HHMMSS)
    const istDate = new Date(now.getTime() + istOffset);
    const dateStr = istDate.toISOString().slice(0, 19).replace(/[-:T]/g, '').slice(0, 14); // YYYYMMDDHHMMSS
    const transactionId = `TXN-${dateStr}`;

    console.log('\n=== NEW BOOKING TRANSACTION ===');
    console.log('UTC Time:', now.toISOString());
    console.log('IST Time (Stored):', istTime);
    console.log('Transaction ID:', transactionId);
    console.log('User:', user_name);
    console.log('Workspace ID:', workspace_id);
    console.log('Start Time:', start_time);
    console.log('End Time:', end_time);
    console.log('Total Price:', finalPrice);
    console.log('===============================\n');

    const normalizedStatus = status || 'confirmed';
    const paymentStatus = normalizedStatus === 'pending' ? 'pending' : 'paid';

    const bookingInsert = {
      workspace_id: workspaceId,
      slot_key: slotKey,
      user_name,
      user_email,
      start_time: startIso,
      end_time: endIso,
      total_price: finalPrice,
      booking_type: booking_type || 'hourly',
      status: normalizedStatus,
      payment_status: paymentStatus,
      created_at: istTime,
      transaction_id: transactionId
    };

    let { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .insert([bookingInsert])
      .select()
      .single();

    if (bookingError && isMissingPaymentStatusColumnError(bookingError)) {
      const legacyInsert = { ...bookingInsert };
      delete legacyInsert.payment_status;

      const retryResult = await supabase
        .from('bookings')
        .insert([legacyInsert])
        .select()
        .single();

      booking = retryResult.data;
      bookingError = retryResult.error;
    }

    if (bookingError) {
      if (bookingError.code === '23505' || bookingError.code === '23P01') {
        return res.status(409).json({
          success: false,
          error: 'This time slot was just booked by someone else. Please choose another slot.'
        });
      }
      throw bookingError;
    }

    console.log('✅ Booking Created Successfully!');
    console.log('Booking ID:', booking.id);
    console.log('Created At (from DB):', booking.created_at);
    console.log('-----------------------------------\n');

    // Add booking resources
    if (resources && resources.length > 0) {
      const bookingResources = resources.map(res => ({
        booking_id: booking.id,
        resource_id: res.resource_id,
        quantity: res.quantity
      }));

      const { error: resourcesError } = await supabase
        .from('booking_resources')
        .insert(bookingResources);

      if (resourcesError) throw resourcesError;
    }

    await supabase
      .from('booking_holds')
      .update({ is_active: false, status: 'consumed', consumed_at: new Date().toISOString() })
      .eq('hold_token', hold_token)
      .eq('is_active', true);

    const { error: waitlistClaimErr } = await supabase
      .from('booking_waitlist')
      .update({
        status: 'claimed',
        claimed_booking_id: booking.id,
        offer_hold_token: null,
        offer_expires_at: null
      })
      .eq('offer_hold_token', hold_token)
      .eq('status', 'offered');

    if (waitlistClaimErr) throw waitlistClaimErr;

    console.log('📤 RESPONSE TO FRONTEND:');
    console.log(JSON.stringify({ success: true, data: booking }, null, 2));
    console.log('===================================\n');

    // Do not block API success on outbound email failures.
    setImmediate(() => {
      sendBookingConfirmationEmail(booking.id)
        .catch((mailErr) => console.error('Booking confirmation email failed:', mailErr.message));
    });

    res.json({ success: true, data: booking });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update booking status (auth required – only the booking owner can cancel)
router.patch('/:id/status', authenticateToken, async (req, res) => {
  try {
    const { status } = req.body;
    const bookingId = req.params.id;

    // Verify the booking belongs to the requesting user
    const { data: existing, error: fetchErr } = await supabase
      .from('bookings')
      .select('id, user_email, status, slot_key, workspace_id, start_time, end_time')
      .eq('id', bookingId)
      .single();

    if (fetchErr || !existing) {
      return res.status(404).json({ success: false, error: 'Booking not found' });
    }

    if (existing.user_email !== req.user.email) {
      return res.status(403).json({ success: false, error: 'Not authorized to modify this booking' });
    }

    // Only allow cancellation of active bookings
    if (status === 'cancelled' && !['confirmed', 'checked_in'].includes(existing.status)) {
      return res.status(400).json({ success: false, error: 'Only confirmed or checked-in bookings can be cancelled' });
    }

    const { data, error } = await supabase
      .from('bookings')
      .update({ status })
      .eq('id', bookingId)
      .select();

    if (error) throw error;
    if (status === 'cancelled' && ACTIVE_BOOKING_STATUSES.includes(existing.status)) {
      const freedSlotKey = existing.slot_key || buildSlotKey(existing.workspace_id, existing.start_time, existing.end_time);
      await runWaitlistMaintenance([freedSlotKey]);
    }
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update booking (generic)
router.patch('/:id', async (req, res) => {
  try {
    const updates = req.body;

    // Remove fields that shouldn't be updated directly
    delete updates.id;
    delete updates.created_at;
    const cancelling = updates.status === 'cancelled';
    let existing = null;

    if (cancelling) {
      const { data: current, error: currentErr } = await supabase
        .from('bookings')
        .select('id, status, slot_key, workspace_id, start_time, end_time')
        .eq('id', req.params.id)
        .single();

      if (currentErr || !current) {
        return res.status(404).json({ success: false, error: 'Booking not found' });
      }
      existing = current;
    }

    const { data, error } = await supabase
      .from('bookings')
      .update(updates)
      .eq('id', req.params.id)
      .select();

    if (error) throw error;

    if (cancelling && existing && ACTIVE_BOOKING_STATUSES.includes(existing.status)) {
      const freedSlotKey = existing.slot_key || buildSlotKey(existing.workspace_id, existing.start_time, existing.end_time);
      await runWaitlistMaintenance([freedSlotKey]);
    }

    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Cancel booking
router.delete('/:id', async (req, res) => {
  try {
    const { data: existing, error: fetchErr } = await supabase
      .from('bookings')
      .select('id, status, slot_key, workspace_id, start_time, end_time')
      .eq('id', req.params.id)
      .single();

    if (fetchErr || !existing) {
      return res.status(404).json({ success: false, error: 'Booking not found' });
    }

    const { data, error } = await supabase
      .from('bookings')
      .update({ status: 'cancelled' })
      .eq('id', req.params.id)
      .select();

    if (error) throw error;

    if (ACTIVE_BOOKING_STATUSES.includes(existing.status)) {
      const freedSlotKey = existing.slot_key || buildSlotKey(existing.workspace_id, existing.start_time, existing.end_time);
      await runWaitlistMaintenance([freedSlotKey]);
    }

    res.json({ success: true, message: 'Booking cancelled successfully', data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get booking statistics (Admin)
router.get('/stats/overview', async (req, res) => {
  try {
    const { data: allBookings, error } = await supabase
      .from('bookings')
      .select('*');

    if (error) throw error;

    const totalBookings = allBookings.length;
    const confirmedBookings = allBookings.filter(b => b.status === 'confirmed').length;
    const cancelledBookings = allBookings.filter(b => b.status === 'cancelled').length;
    const checkedInBookings = allBookings.filter(b => b.status === 'checked_in').length;
    const totalRevenue = allBookings
      .filter(b => b.status !== 'cancelled')
      .reduce((sum, b) => sum + (b.total_price || 0), 0);

    res.json({
      success: true,
      data: {
        total_bookings: totalBookings,
        confirmed: confirmedBookings,
        cancelled: cancelledBookings,
        checked_in: checkedInBookings,
        total_revenue: totalRevenue
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get complete booking details for ticket page
router.get('/ticket/:id', async (req, res) => {
  try {
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select(`
        *,
        workspaces (
          id,
          name,
          type,
          capacity,
          base_price,
          amenities,
          hub_id
        )
      `)
      .eq('id', req.params.id)
      .single();

    if (bookingError) throw bookingError;

    // Get hub details
    const { data: hub, error: hubError } = await supabase
      .from('working_hubs')
      .select('*')
      .eq('id', booking.workspaces.hub_id)
      .single();

    if (hubError) throw hubError;

    // Get booking resources
    const { data: bookingResources, error: resourcesError } = await supabase
      .from('booking_resources')
      .select(`
        quantity,
        resources (
          id,
          name,
          description,
          price_per_slot
        )
      `)
      .eq('booking_id', req.params.id);

    const resources = bookingResources?.map(br => ({
      ...br.resources,
      quantity: br.quantity
    })) || [];

    // Get QR code image
    const { data: qrData, error: qrError } = await supabase
      .from('qr_codes')
      .select('qr_value')
      .eq('booking_id', req.params.id)
      .single();

    let qrImage = null;
    if (qrData && !qrError) {
      const { generateQRCode } = require('../utils/qrGenerator');
      // Generate QR with URL to ticket page
      const ticketUrl = `http://localhost:8080/ticket.html?qr=${qrData.qr_value}`;
      qrImage = await generateQRCode(ticketUrl);
    }

    res.json({
      success: true,
      data: {
        booking,
        workspace: booking.workspaces,
        hub,
        resources,
        qr_image: qrImage
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
