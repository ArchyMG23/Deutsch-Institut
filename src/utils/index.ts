import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number) {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'XAF',
  }).format(amount);
}

export function generateMatricule(role: 'admin' | 'teacher' | 'student') {
  const prefix = role.charAt(0).toUpperCase();
  const year = new Date().getFullYear().toString().slice(-2);
  const random = Math.floor(1000 + Math.random() * 9000);
  return `${prefix}${year}${random}`;
}

export function getDeviceInfo() {
  const ua = navigator.userAgent;
  let device = "Ordinateur";
  
  if (/android/i.test(ua)) device = "Android";
  else if (/iPhone|iPad|iPod/i.test(ua)) device = "iOS Device";
  else if (/Windows/i.test(ua)) device = "Windows PC";
  else if (/Macintosh/i.test(ua)) device = "Mac";
  else if (/Linux/i.test(ua)) device = "Linux";

  // Browser detection
  let browser = "Navigateur";
  if (/chrome|crios/i.test(ua) && !/edge/i.test(ua)) browser = "Chrome";
  else if (/firefox|fxios/i.test(ua)) browser = "Firefox";
  else if (/safari/i.test(ua) && !/chrome|crios/i.test(ua)) browser = "Safari";
  else if (/edge/i.test(ua)) browser = "Edge";

  return `${device} (${browser})`;
}
