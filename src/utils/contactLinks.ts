
/**
 * Utility to generate direct communication links (WhatsApp, Email, SMS)
 * without using backend APIs.
 */

export const generateWhatsAppLink = (phone: string, message: string) => {
  // Clean phone number: remove spaces and non-digits (keeping + if present)
  const cleanPhone = phone.replace(/[^\d+]/g, '');
  return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
};

export const generateMailtoLink = (email: string, subject: string, body: string) => {
  return `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
};

export const generateSMSLink = (phone: string, message: string) => {
  const cleanPhone = phone.replace(/[^\d+]/g, '');
  return `sms:${cleanPhone}?body=${encodeURIComponent(message)}`;
};

export const APP_NAME_FOR_LINKS = "DIA Centre de Formation";
