/**
 * sync-integrity.ts — Consistency verification and healing tools
 */
import { doc, getDoc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { recalculerSoldesDepuisZero } from './school-engine';
import { EventBus, EVENTS } from './eventBus';

/**
 * Fast coherence check between ledger sum and displayed balance
 */
export async function verifierCoherenceSoldes() {
  try {
    const { caisse: ledgerCaisse, banque: ledgerBanque } = await recalculerSoldesDepuisZero();
    
    const [cSnap, bSnap] = await Promise.all([
      getDoc(doc(db, 'comptes', 'caisse')),
      getDoc(doc(db, 'comptes', 'banque'))
    ]);

    const actuelCaisse = cSnap.data()?.solde_actuel ?? 0;
    const actuelBanque = bSnap.data()?.solde_actuel ?? 0;

    const diffCaisse = Math.abs(ledgerCaisse - actuelCaisse);
    const diffBanque = Math.abs(ledgerBanque - actuelBanque);

    const anomalies = (diffCaisse > 1 ? 1 : 0) + (diffBanque > 1 ? 1 : 0);

    if (anomalies > 0) {
      console.warn(`[INTEGRITY] ${anomalies} anomalies detected in balances. Auto-healing...`);
      
      // Auto-heal balances in DB
      await Promise.all([
        updateDoc(doc(db, 'comptes', 'caisse'), {
          solde_actuel: ledgerCaisse,
          derniere_maj: serverTimestamp()
        }),
        updateDoc(doc(db, 'comptes', 'banque'), {
          solde_actuel: ledgerBanque,
          derniere_maj: serverTimestamp()
        })
      ]);

      EventBus.emit(EVENTS.SOLDES_UPDATED, { caisse: ledgerCaisse, banque: ledgerBanque });
      return { anomalies, healed: true };
    }

    return { anomalies: 0, healed: false };
  } catch (error) {
    console.error("[INTEGRITY] Coherence check failed:", error);
    return { anomalies: -1, error };
  }
}
