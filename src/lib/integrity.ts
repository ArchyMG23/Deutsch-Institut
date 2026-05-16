// integrity.ts — Vérificateur d'intégrité complet
import { db } from '../firebase';
import { collection, getDocs, doc, getDoc } from 'firebase/firestore';
import { recalculerSoldesDepuisZero, formatMontant } from './school-engine';
import { showToast } from './errorHandler';

export async function verifierIntegriteComplete() {
  const rapport: any[] = [];

  // CHECK 1 — Cohérence soldes
  try {
    const { caisse: cRecalc, banque: bRecalc } = await recalculerSoldesDepuisZero();
    
    const caisseDoc = await getDoc(doc(db, 'comptes', 'caisse'));
    const banqueDoc = await getDoc(doc(db, 'comptes', 'banque'));
    
    const caisseStored = caisseDoc.data()?.solde_actuel ?? 0;
    const banqueStored = banqueDoc.data()?.solde_actuel ?? 0;

    const deltaC = Math.abs(cRecalc - caisseStored);
    const deltaB = Math.abs(bRecalc - banqueStored);

    rapport.push({
      check: 'Cohérence solde caisse',
      statut: deltaC < 1 ? 'OK' : 'ANOMALIE',
      detail: deltaC < 1 ? null : `Écart de ${formatMontant(deltaC)} détecté`,
      action: deltaC >= 1 ? 'recalcul_caisse' : null
    });

    rapport.push({
      check: 'Cohérence solde banque',
      statut: deltaB < 1 ? 'OK' : 'ANOMALIE',
      detail: deltaB < 1 ? null : `Écart de ${formatMontant(deltaB)} détecté`,
      action: deltaB >= 1 ? 'recalcul_banque' : null
    });
  } catch (err) {
    rapport.push({
      check: 'Cohérence soldes',
      statut: 'ERREUR',
      detail: `Impossible de vérifier les soldes: ${err}`
    });
  }

  // TODO: Add more checks as requested in Part V
  // - CHECK 2 — Transactions orphelines
  // - CHECK 3 — Élèves en surplus
  // - ...

  return rapport;
}

/**
 * Vérification automatique au démarrage (silencieuse).
 * Si anomalie critique → notification admin.
 */
export async function verificationAuDemarrage() {
  try {
    const rapport = await verifierIntegriteComplete();
    const anomalies = rapport.filter(r => r.statut !== 'OK');
    if (anomalies.length > 0) {
      showToast(
        `⚠️ ${anomalies.length} anomalie(s) détectée(s). Consultez Maintenance → Rapport d'intégrité.`,
        'warning', 8000
      );
    }
  } catch(e) { 
    console.error("Integrity check failed at startup", e);
  }
}
