/**
 * sync-listeners.ts — Centralized real-time Firestore listeners
 */
import { collection, doc, query, where, orderBy, onSnapshot, limit, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { EventBus, EVENTS } from './eventBus';
import { toDateSafe } from './school-engine';

const _listeners = new Map<string, () => void>();

function register(key: string, unsub: () => void) {
  if (_listeners.has(key)) {
    _listeners.get(key)!();
  }
  _listeners.set(key, unsub);
}

export function unregisterAll() {
  _listeners.forEach(unsub => unsub());
  _listeners.clear();
}

/**
 * Global account balances listener
 * Updates window.APP_SOLDES and emits EVENTS.SOLDES_UPDATED
 */
export function listenSoldes() {
  const syncSoldes = (id: string, snap: any) => {
    if (!snap.exists()) return;
    const val = snap.data().solde_actuel ?? 0;
    
    const win = window as any;
    if (!win.APP_SOLDES) win.APP_SOLDES = { caisse: 0, banque: 0 };
    
    if (id === 'caisse') win.APP_SOLDES.caisse = val;
    if (id === 'banque') win.APP_SOLDES.banque = val;
    
    // Dispatch technical event for components not using higher-level data
    document.dispatchEvent(new CustomEvent('soldes:updated', { detail: win.APP_SOLDES }));
    EventBus.emit(EVENTS.SOLDES_UPDATED, win.APP_SOLDES);
  };

  register('solde_caisse', onSnapshot(doc(db, 'comptes', 'caisse'), snap => syncSoldes('caisse', snap), err => console.error("Balance caisse sync error:", err)));
  register('solde_banque', onSnapshot(doc(db, 'comptes', 'banque'), snap => syncSoldes('banque', snap), err => console.error("Balance banque sync error:", err)));
}

/**
 * Recent transactions listener (Dashboard)
 */
export function listenTransactionsRecentes(onUpdate: (txs: any[]) => void) {
  const q = query(
    collection(db, 'transactions'),
    where('supprimé', '==', false),
    orderBy('timestamp_creation', 'desc'),
    limit(15)
  );

  register('tx_recentes', onSnapshot(q, snap => {
    const txs = snap.docs.map(d => {
      const data = d.data();
      return {
        id: d.id,
        libelle: data.libelle || data.notes || 'Transaction',
        montant: Number(data.montant) || 0,
        date: toDateSafe(data.date_versement || data.timestamp_creation),
        type: data.type,
        compte: data.compte_destination || data.compte_source || 'caisse',
        eleve_id: data.eleve_id || null
      };
    });
    onUpdate(txs);
  }, err => console.error("Recent transactions sync error:", err)));
}

/**
 * Real-time Student list with basic financial flags
 */
export function listenListeEleves(onUpdate: (eleves: any[]) => void) {
  const q = query(collection(db, 'eleves'), orderBy('lastName', 'asc'));

  register('liste_eleves', onSnapshot(q, snap => {
    const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    onUpdate(list);
  }, err => console.error("Student list sync error:", err)));
}
