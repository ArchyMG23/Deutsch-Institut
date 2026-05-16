/**
 * sync-operations.ts — Unified business operations with atomic writes and ledger entries
 */
import { writeBatch, doc, collection, serverTimestamp, getDocs, query, where, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { EventBus, EVENTS } from './eventBus';
import { recalculerScolariteEleve, ajusterSolde } from './school-engine';
import { showToast, handleError } from './errorHandler';

/**
 * Generate a unique receipt number based on timestamp and random
 */
async function genererNumeroRecu() {
  const now = new Date();
  const dateStr = `${now.getFullYear()}${(now.getMonth() + 1).toString().padStart(2, '0')}${now.getDate().toString().padStart(2, '0')}`;
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `REC-${dateStr}-${random}`;
}

/**
 * Operation: Add a tuition payment (Versement Scolarité)
 */
export async function ajouterVersementScolarite(params: {
  eleve_id: string;
  niveau_id: string;
  montant: number;
  type_versement?: string;
  date_versement: string;
  mode_paiement: string;
  compte_destination: 'caisse' | 'banque';
  notes: string;
  saisi_par: string;
}) {
  const {
    eleve_id, niveau_id, montant, type_versement = 'scolarite',
    date_versement, mode_paiement, compte_destination,
    notes, saisi_par
  } = params;

  const batch = writeBatch(db);

  try {
    const scolariteRef = doc(db, 'scolarites', eleve_id);
    const transId = doc(collection(db, 'transactions')).id;
    const recu_numero = await genererNumeroRecu();

    // 1. Create the payment record in the subcollection
    const versRef = doc(collection(scolariteRef, 'versements'), transId);
    batch.set(versRef, {
      montant: Number(montant),
      id: transId,
      niveau_id,
      type_versement,
      date: serverTimestamp(),
      date_versement: date_versement || new Date().toISOString(),
      mode_paiement,
      compte_destination,
      notes: notes || '',
      recu_numero,
      saisi_par,
      timestamp: serverTimestamp()
    });

    // 2. Create the Ledger Entry (Transactions)
    const transRef = doc(db, 'transactions', transId);
    batch.set(transRef, {
      id: transId,
      type: 'scolarite',
      eleve_id,
      niveau_id,
      libelle: `Scolarité - ${niveau_id} - ${recu_numero}`,
      montant: Number(montant),
      date_versement: date_versement || new Date().toISOString(),
      mode_paiement,
      compte_destination,
      notes: notes || '',
      recu_numero,
      saisi_par,
      timestamp_creation: serverTimestamp(),
      modifié: false,
      supprimé: false,
      versement_ref: versRef.path
    });

    // 3. Create Flattened Finance entry for archive searchability
    const financeRef = doc(db, 'finances', transId);
    batch.set(financeRef, {
      id: transId,
      studentId: eleve_id,
      amount: Number(montant),
      date: date_versement || new Date().toISOString(),
      type: 'income',
      category: 'Scolarité',
      method: mode_paiement,
      accountType: compte_destination,
      notes: notes || '',
      receiptId: recu_numero,
      status: 'active',
      createdAt: new Date().toISOString()
    });

    // 4. Atomic Balance Update
    await ajusterSolde(compte_destination, Number(montant), batch);

    // Commit All
    await batch.commit();

    // 5. Post-commit: Recalculate aggregates for this student
    const stats = await recalculerScolariteEleve(eleve_id);

    // 6. Emit Events
    EventBus.emit(EVENTS.TRANSACTION_AJOUTEE, { type: 'scolarite', eleve_id, montant, compte_destination });
    EventBus.emit(EVENTS.SCOLARITE_UPDATED, { eleve_id, stats });

    showToast('Versement enregistré avec succès', 'success');
    return { success: true, recu_numero, stats };

  } catch (error) {
    handleError('ajouterVersementScolarite', error);
    return { success: false, error };
  }
}

/**
 * Operation: Register a new student avec inscription
 */
export async function inscrireNouvelEleve(studentData: any, financialData: any) {
  // This usually requires Auth (User creation), so it's best handled by the API.
  // But we ensure the API follows the pattern above.
  // We can call the API and then emit events here.
}
