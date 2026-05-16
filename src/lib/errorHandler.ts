// errorHandler.ts — Gestion centralisée des erreurs
import { db } from '../firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

export function showToast(message: string, type: 'success' | 'error' | 'warning' | 'info' = 'info', duration = 4000) {
  const colors = {
    success: '#22c55e', error: '#ef4444',
    warning: '#f59e0b', info:  '#3b82f6'
  };
  const icons = {
    success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️'
  };
  const toast = document.createElement('div');
  toast.className = 'app-toast';
  toast.innerHTML = `${icons[type]} ${message}`;
  toast.style.cssText = `
    position:fixed; bottom:24px; right:24px; z-index:9999;
    background:${colors[type]}; color:#fff; padding:12px 20px;
    border-radius:12px; font-size:14px; max-width:380px;
    box-shadow:0 10px 40px rgba(0,0,0,0.2);
    animation: toast-slide-in 0.3s cubic-bezier(0.16, 1, 0.3, 1);
    pointer-events:auto;
    font-family: system-ui, -apple-system, sans-serif;
    font-weight: 600;
  `;
  document.body.appendChild(toast);
  
  // Minimal animation styles
  if (!document.getElementById('app-toast-styles')) {
    const style = document.createElement('style');
    style.id = 'app-toast-styles';
    style.textContent = `
      @keyframes toast-slide-in {
        from { transform: translateX(100%) translateY(20px); opacity: 0; }
        to { transform: translateX(0) translateY(0); opacity: 1; }
      }
    `;
    document.head.appendChild(style);
  }

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(20px)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

export function handleError(context: string, error: any, opts: { messageUtilisateur?: string, critique?: boolean } = {}) {
  const message = error?.message || String(error);
  console.error(`[${context}]`, error);

  // Ne jamais laisser une erreur silencieuse
  showToast(opts.messageUtilisateur || `Erreur dans ${context} : ${message}`, 'error');

  // Logger dans Firestore pour audit (erreurs critiques)
  if (opts.critique) {
    addDoc(collection(db, 'error_log'), {
      context, 
      message, 
      timestamp: serverTimestamp(),
      userEmail: (window as any).CURRENT_USER_EMAIL || 'inconnu',
      stack: error?.stack || null
    }).catch(e => console.error("Failed to log error to firestore", e));
  }
}
