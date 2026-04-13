const { supabase } = require('../config/supabase');
const { generateQRCode } = require('../utils/qrGenerator');
const { getEmailJsConfig, isEmailJsEnabled, sendEmailViaEmailJs } = require('./emailjs');

const EVENT_TYPES = {
  CONFIRMATION: 'booking_confirmation',
  DEADLINE: 'deadline_reminder',
  THANK_YOU: 'completion_thank_you'
};

const DEADLINE_REMINDER_MINUTES = Number(process.env.BOOKING_DEADLINE_REMINDER_MINUTES || 30);
const EMAIL_JOB_INTERVAL_MS = Number(process.env.BOOKING_EMAIL_JOB_INTERVAL_MS || 5 * 60 * 1000);

let jobRunning = false;

function isMissingEmailEventsTableError(error) {
  const message = String(error?.message || '').toLowerCase();
  return error?.code === '42P01' || message.includes('booking_email_events');
}

async function hasEventAlreadySent(bookingId, eventType) {
  const { data, error } = await supabase
    .from('booking_email_events')
    .select('id')
    .eq('booking_id', bookingId)
    .eq('event_type', eventType)
    .maybeSingle();

  if (error) {
    if (isMissingEmailEventsTableError(error)) return false;
    throw error;
  }

  return Boolean(data);
}

async function markEventSent(bookingId, eventType) {
  const { error } = await supabase
    .from('booking_email_events')
    .upsert([
      {
        booking_id: bookingId,
        event_type: eventType,
        sent_at: new Date().toISOString()
      }
    ], { onConflict: 'booking_id,event_type' });

  if (error && !isMissingEmailEventsTableError(error)) {
    throw error;
  }
}

function toPrettyDateTime(value) {
  try {
    return new Date(value).toLocaleString('en-IN', {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  } catch (_) {
    return String(value || 'N/A');
  }
}

function normalizeBookingQrValue(rawValue, bookingId) {
  const parsedBookingId = Number(bookingId);
  if (rawValue && /^BOOKING-\d+/i.test(String(rawValue))) {
    const match = String(rawValue).match(/^BOOKING-(\d+)/i);
    if (match && Number(match[1]) === parsedBookingId) {
      return `BOOKING-${parsedBookingId}`;
    }
  }
  return `BOOKING-${parsedBookingId}`;
}

async function ensureBookingQrCode(bookingId) {
  const { data: existing, error: existingError } = await supabase
    .from('qr_codes')
    .select('*')
    .eq('booking_id', bookingId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existingError) throw existingError;
  if (existing) {
    return existing;
  }

  const qrValue = `BOOKING-${bookingId}`;
  const { data: inserted, error: insertError } = await supabase
    .from('qr_codes')
    .insert([{ booking_id: bookingId, qr_value: qrValue }])
    .select('*')
    .maybeSingle();

  if (!insertError && inserted) {
    return inserted;
  }

  const { data: fallback, error: fallbackError } = await supabase
    .from('qr_codes')
    .select('*')
    .eq('booking_id', bookingId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (fallbackError) throw fallbackError;
  if (!fallback) throw insertError || new Error('Unable to ensure QR code for booking');
  return fallback;
}

async function fetchBookingForEmail(bookingId) {
  const { data, error } = await supabase
    .from('bookings')
    .select(`
      id,
      user_name,
      user_email,
      start_time,
      end_time,
      total_price,
      status,
      booking_type,
      created_at,
      workspaces (
        name,
        working_hubs (
          name,
          city
        )
      )
    `)
    .eq('id', bookingId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

async function sendBookingConfirmationEmail(bookingId) {
  if (!isEmailJsEnabled()) return;

  const cfg = getEmailJsConfig();
  if (!cfg.templateBookingConfirmation) return;

  const alreadySent = await hasEventAlreadySent(bookingId, EVENT_TYPES.CONFIRMATION);
  if (alreadySent) return;

  const booking = await fetchBookingForEmail(bookingId);
  if (!booking || !booking.user_email) return;

  const qrCode = await ensureBookingQrCode(booking.id);
  const normalizedQrValue = normalizeBookingQrValue(qrCode.qr_value, booking.id);
  const qrImage = await generateQRCode(normalizedQrValue);

  await sendEmailViaEmailJs({
    templateId: cfg.templateBookingConfirmation,
    templateParams: {
      to_email: booking.user_email,
      to_name: booking.user_name || 'Guest',
      booking_id: booking.id,
      workspace_name: booking.workspaces?.name || 'Workspace',
      hub_name: booking.workspaces?.working_hubs?.name || 'Hub',
      hub_city: booking.workspaces?.working_hubs?.city || '',
      start_time: toPrettyDateTime(booking.start_time),
      end_time: toPrettyDateTime(booking.end_time),
      total_price: Number(booking.total_price || 0).toFixed(2),
      qr_value: normalizedQrValue,
      qr_image: qrImage,
      ticket_url: `http://localhost:8080/booking-detail.html?booking_id=${booking.id}`
    }
  });

  await markEventSent(booking.id, EVENT_TYPES.CONFIRMATION);
}

async function sendDeadlineReminderEmails() {
  if (!isEmailJsEnabled()) return;

  const cfg = getEmailJsConfig();
  if (!cfg.templateDeadlineReminder) return;

  const now = new Date();
  const upper = new Date(now.getTime() + DEADLINE_REMINDER_MINUTES * 60 * 1000);

  const { data: candidates, error } = await supabase
    .from('bookings')
    .select(`
      id,
      user_name,
      user_email,
      end_time,
      status,
      workspaces (
        name,
        working_hubs (
          name,
          city
        )
      )
    `)
    .in('status', ['confirmed', 'checked_in'])
    .gt('end_time', now.toISOString())
    .lte('end_time', upper.toISOString())
    .order('end_time', { ascending: true })
    .limit(100);

  if (error) throw error;

  for (const booking of candidates || []) {
    if (!booking.user_email) continue;
    const alreadySent = await hasEventAlreadySent(booking.id, EVENT_TYPES.DEADLINE);
    if (alreadySent) continue;

    await sendEmailViaEmailJs({
      templateId: cfg.templateDeadlineReminder,
      templateParams: {
        to_email: booking.user_email,
        to_name: booking.user_name || 'Guest',
        booking_id: booking.id,
        workspace_name: booking.workspaces?.name || 'Workspace',
        hub_name: booking.workspaces?.working_hubs?.name || 'Hub',
        end_time: toPrettyDateTime(booking.end_time),
        reminder_minutes: DEADLINE_REMINDER_MINUTES,
        manage_booking_url: `http://localhost:8080/booking-detail.html?booking_id=${booking.id}`
      }
    });

    await markEventSent(booking.id, EVENT_TYPES.DEADLINE);
  }
}

async function sendCompletionThankYouEmails() {
  if (!isEmailJsEnabled()) return;

  const cfg = getEmailJsConfig();
  if (!cfg.templateThankYou) return;

  const { data: completedBookings, error } = await supabase
    .from('bookings')
    .select(`
      id,
      user_name,
      user_email,
      total_price,
      end_time,
      status,
      workspaces (
        name,
        working_hubs (
          name,
          city
        )
      )
    `)
    .eq('status', 'completed')
    .order('updated_at', { ascending: false })
    .limit(100);

  if (error) throw error;

  for (const booking of completedBookings || []) {
    if (!booking.user_email) continue;
    const alreadySent = await hasEventAlreadySent(booking.id, EVENT_TYPES.THANK_YOU);
    if (alreadySent) continue;

    await sendEmailViaEmailJs({
      templateId: cfg.templateThankYou,
      templateParams: {
        to_email: booking.user_email,
        to_name: booking.user_name || 'Guest',
        booking_id: booking.id,
        workspace_name: booking.workspaces?.name || 'Workspace',
        hub_name: booking.workspaces?.working_hubs?.name || 'Hub',
        end_time: toPrettyDateTime(booking.end_time),
        total_price: Number(booking.total_price || 0).toFixed(2)
      }
    });

    await markEventSent(booking.id, EVENT_TYPES.THANK_YOU);
  }
}

async function runBookingEmailJobs() {
  if (jobRunning) return;
  jobRunning = true;

  try {
    await sendDeadlineReminderEmails();
    await sendCompletionThankYouEmails();
  } catch (error) {
    console.error('Booking email job failed:', error.message);
  } finally {
    jobRunning = false;
  }
}

function startBookingEmailJobs() {
  if (!isEmailJsEnabled()) {
    console.log('EmailJS is not configured. Booking email jobs are disabled.');
    return;
  }

  console.log(`Booking email jobs enabled. Interval: ${Math.round(EMAIL_JOB_INTERVAL_MS / 1000)}s`);

  runBookingEmailJobs().catch((err) => {
    console.error('Initial booking email job failed:', err.message);
  });

  setInterval(() => {
    runBookingEmailJobs().catch((err) => {
      console.error('Scheduled booking email job failed:', err.message);
    });
  }, EMAIL_JOB_INTERVAL_MS);
}

module.exports = {
  sendBookingConfirmationEmail,
  startBookingEmailJobs,
  runBookingEmailJobs
};
