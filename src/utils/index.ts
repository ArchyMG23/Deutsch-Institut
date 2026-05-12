import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number) {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'XAF',
    minimumFractionDigits: 0
  }).format(amount);
}

export function toDateSafe(valeur: any): Date | null {
  if (!valeur) return null;
  // Case Firestore Timestamp (object with .toDate())
  if (typeof valeur?.toDate === 'function') {
    return valeur.toDate();
  }
  // Case Firestore Timestamp serialized (object with .seconds)
  if (valeur?.seconds !== undefined) {
    return new Date(valeur.seconds * 1000);
  }
  // Case string ISO or number
  const d = new Date(valeur);
  return isNaN(d.getTime()) ? null : d;
}

export function formatDateAffichage(valeur: any): string {
  const d = toDateSafe(valeur);
  if (!d) return '—';
  return d.toLocaleDateString('fr-FR', {
    day: '2-digit', month: '2-digit', year: 'numeric'
  });
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
