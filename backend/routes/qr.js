const express = require('express');
const router = express.Router();
const { supabase } = require('../config/supabase');
const { generateQRCode } = require('../utils/qrGenerator');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

function parseBookingIdFromBookingCode(value) {
  const m = String(value || '').trim().match(/^BOOKING-(\d+)(?:-[\w.-]+)?$/i);
  if (!m) return null;
  const id = Number(m[1]);
  return Number.isFinite(id) ? id : null;
}

function buildBookingQrValue(bookingId) {
  return `BOOKING-${bookingId}`;
}

async function fetchBookingCoreById(bookingId, { maybeSingle = true } = {}) {
  const query = supabase
    .from('bookings')
    .select('id, status')
    .eq('id', bookingId);

  return maybeSingle ? query.maybeSingle() : query.single();
}

function canIssueQrForBooking(booking) {
  if (!booking) return false;
  const status = String(booking.status || '').toLowerCase();
  return status === 'confirmed' || status === 'checked_in';
}

function extractScanPayload(rawValue) {
  const text = typeof rawValue === 'string' ? rawValue.trim() : '';
  if (!text) return { qrValue: null, bookingId: null };

  try {
    const url = new URL(text);
    const qrParam = url.searchParams.get('qr');
    if (qrParam && qrParam.trim()) {
      const clean = qrParam.trim();
      return { qrValue: clean, bookingId: parseBookingIdFromBookingCode(clean) };
    }

    const idParam = url.searchParams.get('id') || url.searchParams.get('booking_id');
    if (idParam && /^\d+$/.test(idParam)) {
      return { qrValue: null, bookingId: Number(idParam) };
    }
  } catch (_) {
    // Not a URL; continue with raw text parsing.
  }

  if (/^BOOKING-\d+(?:-[\w.-]+)?$/i.test(text)) {
    return { qrValue: text, bookingId: parseBookingIdFromBookingCode(text) };
  }

  if (/^\d+$/.test(text)) {
    return { qrValue: null, bookingId: Number(text) };
  }

  return { qrValue: text, bookingId: null };
}

async function createOrFetchQrCodeForBooking({ bookingId, preferredQrValue }) {
  if (!bookingId) return null;

  const qrValue = preferredQrValue || buildBookingQrValue(bookingId);

  const { data: inserted, error: insertError } = await supabase
    .from('qr_codes')
    .insert([{ booking_id: bookingId, qr_value: qrValue }])
    .select('*')
    .maybeSingle();

  if (!insertError && inserted) return inserted;

  // Handle duplicate keys or existing rows by fetching latest QR for booking.
  const { data: existingByBooking, error: existingError } = await supabase
    .from('qr_codes')
    .select('*')
    .eq('booking_id', bookingId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existingError) throw existingError;
  if (existingByBooking) return existingByBooking;

  // Last fallback: exact qr_value lookup in case booking_id is not unique there.
  const { data: existingByValue, error: valueError } = await supabase
    .from('qr_codes')
    .select('*')
    .eq('qr_value', qrValue)
    .maybeSingle();

  if (valueError) throw valueError;
  return existingByValue || null;
}

async function findQrCodeForScan({ qrValue, bookingId }) {
  if (qrValue) {
    const { data, error } = await supabase
      .from('qr_codes')
      .select('*')
      .eq('qr_value', qrValue)
      .maybeSingle();

    if (error) throw error;
    if (data) return data;
  }

  if (bookingId) {
    const { data, error } = await supabase
      .from('qr_codes')
      .select('*')
      .eq('booking_id', bookingId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    if (data) return data;
  }

  return null;
}

// Generate QR code for booking
router.post('/generate/:booking_id', async (req, res) => {
  try {
    const bookingId = Number(req.params.booking_id);

    if (!Number.isFinite(bookingId) || bookingId <= 0) {
      return res.status(400).json({ success: false, error: 'Invalid booking id' });
    }

    // Check if booking exists
    const { data: booking, error: bookingError } = await fetchBookingCoreById(bookingId, { maybeSingle: true });

    if (bookingError) throw bookingError;
    if (!booking) {
      return res.status(404).json({ success: false, error: 'Booking not found' });
    }

    if (!canIssueQrForBooking(booking)) {
      return res.status(409).json({
        success: false,
        error: 'QR can only be issued for paid confirmed bookings'
      });
    }

    // Create or fetch a deterministic QR value containing booking ID.
    const qrCode = await createOrFetchQrCodeForBooking({
      bookingId,
      preferredQrValue: buildBookingQrValue(bookingId)
    });

    if (!qrCode) {
      return res.status(500).json({ success: false, error: 'Failed to create QR code' });
    }

    // Generate QR code image with qr_value (scanner-friendly)
    const ticketUrl = `http://localhost:8080/ticket.html?qr=${encodeURIComponent(qrCode.qr_value)}`;
    const qrCodeImage = await generateQRCode(qrCode.qr_value);

    res.json({
      success: true,
      data: {
        qr_code: qrCode,
        qr_image: qrCodeImage,
        ticket_url: ticketUrl
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get QR code for booking
router.get('/booking/:booking_id', async (req, res) => {
  try {
    const bookingId = Number(req.params.booking_id);
    if (!Number.isFinite(bookingId) || bookingId <= 0) {
      return res.status(400).json({ success: false, error: 'Invalid booking id' });
    }

    const { data: booking, error: bookingError } = await fetchBookingCoreById(bookingId, { maybeSingle: true });

    if (bookingError) throw bookingError;
    if (!booking) {
      return res.status(404).json({ success: false, error: 'Booking not found' });
    }

    let qrCode = null;

    const { data, error } = await supabase
      .from('qr_codes')
      .select('*')
      .eq('booking_id', bookingId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;

    qrCode = data;

    if (!qrCode && canIssueQrForBooking(booking)) {
      qrCode = await createOrFetchQrCodeForBooking({
        bookingId,
        preferredQrValue: buildBookingQrValue(bookingId)
      });
    }

    if (!qrCode) {
      return res.status(404).json({ success: false, error: 'QR code not found for this booking' });
    }

    // Generate QR code image
    const qrCodeImage = await generateQRCode(qrCode.qr_value);

    res.json({
      success: true,
      data: {
        qr_code: qrCode,
        qr_image: qrCodeImage
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Scan QR code (admin check-in)
router.post('/scan', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { qr_value } = req.body;
    if (!qr_value || typeof qr_value !== 'string' || !qr_value.trim()) {
      return res.status(400).json({ success: false, error: 'qr_value is required' });
    }

    const payload = extractScanPayload(qr_value);

    // Find QR code from raw value or booking id embedded in URL.
    let qrCode = await findQrCodeForScan(payload);

    // If QR value doesn't exist in DB but booking id can be derived, create/link it now.
    if (!qrCode && payload.bookingId) {
      const { data: bookingRef, error: bookingRefErr } = await fetchBookingCoreById(payload.bookingId, { maybeSingle: true });

      if (bookingRefErr) throw bookingRefErr;
      if (bookingRef && canIssueQrForBooking(bookingRef)) {
        qrCode = await createOrFetchQrCodeForBooking({
          bookingId: payload.bookingId,
          preferredQrValue: payload.qrValue || buildBookingQrValue(payload.bookingId)
        });
      }
    }

    if (!qrCode) {
      return res.status(404).json({ success: false, error: 'QR code is invalid or not found' });
    }

    const { data: currentBooking, error: currentBookingError } = await fetchBookingCoreById(qrCode.booking_id, { maybeSingle: false });

    if (currentBookingError) throw currentBookingError;

    if (!currentBooking) {
      return res.status(404).json({ success: false, error: 'Booking not found for this QR code' });
    }

    if (currentBooking.status === 'cancelled') {
      return res.status(400).json({ success: false, error: 'This booking is cancelled and cannot be checked in' });
    }

    if (currentBooking.status === 'completed') {
      return res.status(400).json({ success: false, error: 'This booking is already completed' });
    }

    if (currentBooking.status === 'pending') {
      return res.status(400).json({ success: false, error: 'Booking is not confirmed yet' });
    }

    const alreadyScanned = Boolean(qrCode.scanned_at);
    const scannedAt = qrCode.scanned_at || new Date().toISOString();

    // Mark QR as scanned if first-time scan.
    if (!alreadyScanned) {
      const { error: updateQrError } = await supabase
        .from('qr_codes')
        .update({ scanned_at: scannedAt })
        .eq('id', qrCode.id);

      if (updateQrError) throw updateQrError;
    }

    // Ensure booking is in checked_in state once QR matches.
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .update({ status: 'checked_in' })
      .eq('id', qrCode.booking_id)
      .select(`
        *,
        workspaces (
          name,
          type,
          working_hubs (
            name,
            address
          )
        )
      `)
      .single();

    if (bookingError) throw bookingError;

    res.json({
      success: true,
      message: alreadyScanned ? 'Guest already marked as entered' : 'Check-in successful',
      data: {
        booking,
        scanned_at: scannedAt,
        qr_value: qrCode.qr_value,
        already_scanned: alreadyScanned
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get all QR codes (Admin)
router.get('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('qr_codes')
      .select(`
        *,
        bookings (
          id,
          user_name,
          start_time,
          end_time,
          status,
          workspaces (
            name,
            type
          )
        )
      `)
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get complete ticket details via QR code
router.get('/ticket', async (req, res) => {
  try {
    const { qr } = req.query;

    if (!qr) {
      return res.status(400).json({ success: false, error: 'QR value required' });
    }

    // Find booking by QR value
    const { data: qrCode, error: qrError } = await supabase
      .from('qr_codes')
      .select('booking_id')
      .eq('qr_value', qr)
      .single();

    if (qrError) throw qrError;

    // Get complete booking details
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
      .eq('id', qrCode.booking_id)
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
      .eq('booking_id', qrCode.booking_id);

    const resources = bookingResources?.map(br => ({
      ...br.resources,
      quantity: br.quantity
    })) || [];

    // Generate QR image
    const ticketUrl = `http://localhost:8080/ticket.html?qr=${qr}`;
    const qrImage = await generateQRCode(ticketUrl);

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
