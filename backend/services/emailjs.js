const EMAILJS_API_URL = 'https://api.emailjs.com/api/v1.0/email/send';

function getEmailJsConfig() {
  return {
    serviceId: process.env.EMAILJS_SERVICE_ID,
    publicKey: process.env.EMAILJS_PUBLIC_KEY,
    privateKey: process.env.EMAILJS_PRIVATE_KEY || null,
    templateBookingConfirmation: process.env.EMAILJS_TEMPLATE_BOOKING_CONFIRMATION,
    templateDeadlineReminder: process.env.EMAILJS_TEMPLATE_DEADLINE_REMINDER,
    templateThankYou: process.env.EMAILJS_TEMPLATE_THANK_YOU
  };
}

function isEmailJsEnabled() {
  const cfg = getEmailJsConfig();
  return Boolean(cfg.serviceId && cfg.publicKey);
}

async function sendEmailViaEmailJs({ templateId, templateParams }) {
  const cfg = getEmailJsConfig();

  if (!cfg.serviceId || !cfg.publicKey || !templateId) {
    throw new Error('EmailJS is not configured. Set service/public key/template env vars.');
  }

  const payload = {
    service_id: cfg.serviceId,
    template_id: templateId,
    user_id: cfg.publicKey,
    template_params: templateParams || {}
  };

  if (cfg.privateKey) {
    payload.accessToken = cfg.privateKey;
  }

  const response = await fetch(EMAILJS_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Unknown EmailJS error');
    if (response.status === 403 && /non-browser environments is currently disabled/i.test(errorText)) {
      throw new Error('EmailJS blocked backend API access. Enable non-browser/API access in EmailJS Dashboard -> Account -> Security.');
    }
    throw new Error(`EmailJS send failed (${response.status}): ${errorText}`);
  }

  return true;
}

module.exports = {
  getEmailJsConfig,
  isEmailJsEnabled,
  sendEmailViaEmailJs
};
