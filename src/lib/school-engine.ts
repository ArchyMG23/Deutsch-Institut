// school-engine.ts — Moteur de calcul central (NE PAS MODIFIER AILLEURS)
import { db } from '../firebase';
import {
  collection, doc, getDoc, getDocs, writeBatch, increment,
  serverTimestamp, onSnapshot, runTransaction, query, where,
  DocumentData, QuerySnapshot, Transaction
} from 'firebase/firestore';

// ─────────────────────────────────────────────
// SECTION A — TYPES ET CONSTANTES
// ─────────────────────────────────────────────

export const COMPTES = { CAISSE: 'caisse', BANQUE: 'banque' } as const;
export const STATUTS = {
  SOLDE:       'soldé',
  EN_COURS:    'en_cours',
  EN_ATTENTE:  'en_attente',
  SURPLUS:     'surplus',
  PAYE:        'payé'
} as const;

export const TYPES_TX = {
  INSCRIPTION:    'inscription',
  SCOLARITE:      'scolarite',
  VORBEREITUNG:   'vorbereitung',
  VACANCES:       'cours_vacances',
  DIVERSE:        'diverse',
  VIREMENT_CB:    'virement_caisse_banque',
  SORTIE:         'sortie',
  INCOME:         'income' // Standard in current DB
} as const;

// ─────────────────────────────────────────────
// SECTION B — UTILITAIRES DE DATE ET MONTANT
// ─────────────────────────────────────────────

export function toDateSafe(v: any): Date | null {
  if (!v) return null;
  if (typeof v?.toDate === 'function') return v.toDate();
  if (v?.seconds !== undefined) return new Date(v.seconds * 1000);
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
}

export function formatDate(v: any, opts: Intl.DateTimeFormatOptions = {}): string {
  const d = toDateSafe(v);
  if (!d) return '—';
  return d.toLocaleDateString('fr-FR', {
    day: '2-digit', month: '2-digit', year: 'numeric', ...opts
  });
}

export function formatMontant(n: any): string {
  const num = typeof n === 'string' ? parseFloat(n) : (n ?? 0);
  if (isNaN(num)) return '0 FCFA';
  return new Intl.NumberFormat('fr-FR', {
    maximumFractionDigits: 0
  }).format(num) + ' FCFA';
}

export function montantEnLettres(n: number): string {
  const unites = ['','un','deux','trois','quatre','cinq','six',
    'sept','huit','neuf','dix','onze','douze','treize','quatorze',
    'quinze','seize','dix-sept','dix-huit','dix-neuf'];
  const dizaines = ['','','vingt','trente','quarante','cinquante',
    'soixante','soixante','quatre-vingt','quatre-vingt'];
    
  function centaines(n: number): string {
    if (n < 20) return unites[n];
    const d = Math.floor(n / 10), u = n % 10;
    if (d === 7 || d === 9) return dizaines[d] + '-' + unites[10+u];
    return dizaines[d] + (u ? '-' + unites[u] : (d === 8 ? 's' : ''));
  }
  
  function bloc(n: number): string {
    if (n < 100) return centaines(n);
    const c = Math.floor(n / 100), r = n % 100;
    return (c > 1 ? unites[c] + ' cent' : 'cent') +
           (r ? ' ' + centaines(r) : (c > 1 ? 's' : ''));
  }
  
  if (n === 0) return 'zéro franc CFA';
  const millions = Math.floor(n / 1e6);
  const milliers = Math.floor((n % 1e6) / 1000);
  const reste    = n % 1000;
  let res = '';
  if (millions) res += bloc(millions) + ' million' +
    (millions > 1 ? 's' : '') + ' ';
  if (milliers) res += (milliers === 1 ? 'mille' :
    bloc(milliers) + ' mille') + ' ';
  if (reste)    res += bloc(reste);
  return res.trim() + ' francs CFA';
}

// ─────────────────────────────────────────────
// SECTION C — CALCUL DES SOLDES (AUTORITATIF)
// ─────────────────────────────────────────────

export async function recalculerSoldesDepuisZero() {
  let caisse = 0, banque = 0;
  const [txSnap, sortiesSnap] = await Promise.all([
    getDocs(collection(db, 'transactions')),
    getDocs(collection(db, 'sorties'))
  ]);

  txSnap.forEach(doc => {
    const tx = doc.data();
    if (tx.supprimé) return;
    const montant = Number(tx.montant) || 0;
    
    // Standardizing types based on observations from server.ts and requested engine
    if (tx.type === TYPES_TX.VIREMENT_CB || tx.type === 'virement_cb') {
      caisse -= montant; 
      banque += montant; 
      return;
    }
    
    if (tx.type === TYPES_TX.SORTIE || tx.type === 'sortie') return; // handles via sorties collection
    
    if (tx.compte_destination === COMPTES.CAISSE || tx.accountType === 'caisse') caisse += montant;
    if (tx.compte_destination === COMPTES.BANQUE || tx.accountType === 'banque') banque += montant;
  });

  sortiesSnap.forEach(doc => {
    const s = doc.data();
    if (s.supprimé) return;
    const montant = Number(s.montant) || 0;
    if (s.source_compte === COMPTES.CAISSE || s.accountType === 'caisse') caisse -= montant;
    if (s.source_compte === COMPTES.BANQUE || s.accountType === 'banque') banque -= montant;
  });

  return { caisse, banque };
}

export async function synchroniserSoldes() {
  const { caisse, banque } = await recalculerSoldesDepuisZero();
  const batch = writeBatch(db);
  batch.set(doc(db, 'comptes', 'caisse'), {
    solde_actuel: caisse, derniere_maj: serverTimestamp()
  });
  batch.set(doc(db, 'comptes', 'banque'), {
    solde_actuel: banque, derniere_maj: serverTimestamp()
  });
  await batch.commit();
  return { caisse, banque };
}

export async function ajusterSolde(compte: 'caisse' | 'banque', delta: number, batchExterne: any = null) {
  const ref = doc(db, 'comptes', compte);
  if (batchExterne && typeof batchExterne.update === 'function') {
    batchExterne.update(ref, {
      solde_actuel: increment(delta),
      derniere_maj: serverTimestamp()
    });
  } else {
    await runTransaction(db, async t => {
      const snap = await t.get(ref);
      const actuel = snap.data()?.solde_actuel ?? 0;
      if (delta < 0 && actuel + delta < 0) {
        throw new Error(`Solde ${compte} insuffisant`);
      }
      t.update(ref, {
        solde_actuel: increment(delta),
        derniere_maj: serverTimestamp()
      });
    });
  }
}

// ─────────────────────────────────────────────
// SECTION D — CALCUL SCOLARITÉ PAR ÉLÈVE
// ─────────────────────────────────────────────

export async function recalculerScolariteEleve(eleve_id: string) {
  // Try looking in subcollection 'versements' under 'scolarites'
  const versSnap = await getDocs(
    collection(db, 'scolarites', eleve_id, 'versements')
  );
  let total_verse = 0;
  versSnap.forEach(d => {
    total_verse += Number(d.data().montant) || 0;
  });

  const scolariteRef = doc(db, 'scolarites', eleve_id);
  const scolariteDoc = await getDoc(scolariteRef);
  const data = scolariteDoc.data();
  const montant_total_du = data?.montant_total_du ?? 0;

  const reste   = Math.max(0, montant_total_du - total_verse);
  const surplus = total_verse > montant_total_du
                    ? total_verse - montant_total_du : 0;
  
  // Custom Status logic based on user request
  const statut  = surplus > 0 ? STATUTS.SURPLUS
                : reste === 0 ? STATUTS.SOLDE
                : total_verse > 0 ? STATUTS.EN_COURS
                : STATUTS.EN_ATTENTE;

  const updateData = {
    total_verse, reste, surplus: surplus > 0,
    montant_surplus: surplus, statut,
    derniere_maj: serverTimestamp()
  };
  
  await runTransaction(db, async (t) => {
     t.set(scolariteRef, updateData, { merge: true });
  });

  return { total_verse, reste, surplus, statut };
}

// ─────────────────────────────────────────────
// SECTION E — LISTENER GLOBAL TEMPS RÉEL
// ─────────────────────────────────────────────

let _soldesInitialises = false;
export function initListenerSoldesGlobal() {
  if (_soldesInitialises) return;
  _soldesInitialises = true;

  const broadcaster = () => {
    document.dispatchEvent(new CustomEvent('soldes:updated', {
      detail: { ...(window as any).APP_SOLDES }
    }));
  };

  (window as any).APP_SOLDES = { caisse: 0, banque: 0 };

  onSnapshot(doc(db, 'comptes', 'caisse'), snap => {
    (window as any).APP_SOLDES.caisse = snap.data()?.solde_actuel ?? 0;
    broadcaster();
  });
  onSnapshot(doc(db, 'comptes', 'banque'), snap => {
    (window as any).APP_SOLDES.banque = snap.data()?.solde_actuel ?? 0;
    broadcaster();
  });
}
