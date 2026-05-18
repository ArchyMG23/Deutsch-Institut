import { collection, getDocs, getDoc, query, where, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';

/**
 * Calculer le total versé réel depuis la sous-collection /scolarites/{id}/versements
 * avec fallback sur la collection globale 'finances' pour assurer la cohérence.
 */
export async function getTotalVerseReel(eleve_id: string): Promise<number> {
  let total = 0;
  const ids_vus = new Set<string>();

  try {
    // 1. Lire la sous-collection Scolarité
    const snap = await getDocs(
      collection(db, 'scolarites', eleve_id, 'versements')
    );
    snap.forEach(doc => {
      const data = doc.data();
      const montant = Number(data.montant || data.amount || 0);
      if (!isNaN(montant) && montant > 0) {
        total += montant;
        if (data.id) ids_vus.add(data.id);
        else ids_vus.add(doc.id);
      }
    });

    // 2. Lire la sous-collection Vorbereitung (si existante)
    // On l'ajoute au total car pour certains élèves, c'est leur seule "scolarité"
    const snapV = await getDocs(
      collection(db, 'vorbereitung', eleve_id, 'versements')
    );
    snapV.forEach(doc => {
      const data = doc.data();
      const montant = Number(data.montant || data.amount || 0);
      if (!isNaN(montant) && montant > 0) {
        total += montant;
        if (data.id) ids_vus.add(data.id);
        else ids_vus.add(doc.id);
      }
    });

    // 3. Vérifier dans le grand livre (finances) s'il manque des choses
    const qFin = query(
      collection(db, 'finances'),
      where('studentId', '==', eleve_id),
      where('status', '==', 'active'),
      where('type', '==', 'income')
    );
    const qFinAlt = query(
      collection(db, 'finances'),
      where('eleve_id', '==', eleve_id),
      where('status', '==', 'active'),
      where('type', '==', 'income')
    );

    const [fSnap, fSnapAlt] = await Promise.all([getDocs(qFin), getDocs(qFinAlt)]);
    
    [...fSnap.docs, ...fSnapAlt.docs].forEach(doc => {
      if (ids_vus.has(doc.id)) return;
      
      const data = doc.data();
      const cat = (data.category || data.categorie || '').toLowerCase();
      // On ajoute ce qui concerne la scolarité ou le Vorbereitung
      if (cat.includes('scolarit') || cat.includes('tranche') || cat.includes('versement') || cat.includes('vorbereitung')) {
        const montant = Number(data.amount || data.montant || 0);
        if (!isNaN(montant) && montant > 0) {
          total += montant;
          ids_vus.add(doc.id);
        }
      }
    });

  } catch (e) {
    console.error(`[getTotalVerseReel] Erreur pour ${eleve_id}:`, e);
  }
  return total;
}

/**
 * Lire le montant dû paramétré pour un niveau ou pour un élève spécifique
 */
export async function getMontantDuParNiveau(nom_niveau: string, eleve_id?: string): Promise<number> {
  // 1. Priorité absolue : Montant déjà enregistré dans le document scolarité de l'élève (prix personnalisé)
  if (eleve_id) {
    try {
      const sSnap = await getDoc(doc(db, 'scolarites', eleve_id));
      if (sSnap.exists()) {
        const data = sSnap.data();
        const customDu = Number(data.montant_total_du);
        if (!isNaN(customDu) && data.montant_total_du !== undefined) return customDu;
      }

      // 2. Si c'est un Vorbereitung, chercher dans sa fiche Vorbereitung
      if (nom_niveau?.toLowerCase().includes('vorbereitung')) {
        const vSnap = await getDoc(doc(db, 'vorbereitung', eleve_id));
        if (vSnap.exists()) {
          const vData = vSnap.data();
          const vDu = Number(vData.montant_total_du || vData.frais_vorbereitung_defaut || 0);
          if (!isNaN(vDu)) return vDu;
        }
      }
    } catch (err) {
      console.warn("[getMontantDuParNiveau] Erreur lookup élève:", err);
    }
  }

  if (!nom_niveau || nom_niveau === 'none' || nom_niveau === 'Non affecté') return 0;

  try {
    // 2. Recherche dans 'levels' (recommandé) ou 'niveaux' (legacy)
    const collections = ['levels', 'niveaux'];
    for (const collName of collections) {
      const snap = await getDocs(
        query(
          collection(db, collName),
          where('nom', '==', nom_niveau)
        )
      );
      if (!snap.empty) {
        const data = snap.docs[0].data();
        return Number(data.frais_scolarite || data.tuition || 0);
      }
      
      // Essai avec le champ 'name' au lieu de 'nom'
      const snapName = await getDocs(
        query(
          collection(db, collName),
          where('name', '==', nom_niveau)
        )
      );
      if (!snapName.empty) {
        const data = snapName.docs[0].data();
        return Number(data.tuition || data.frais_scolarite || 0);
      }
    }
  } catch (e) {
    console.error('[getMontantDuParNiveau]', e);
  }
  return 0;
}

/**
 * Script de correction globale des montants_du et versements
 */
export async function corrigerMontantsDu() {
  console.log('🔄 Début de la correction des montants dus et versements...');
  try {
    const elevesSnap = await getDocs(collection(db, 'students'));
    console.log(`Traitement de ${elevesSnap.size} étudiants...`);

    for (const eleveDoc of elevesSnap.docs) {
      const eleve = eleveDoc.data();
      const eleve_id = eleveDoc.id;

      // 1. Recalculer le total versé réel ( Ledger + Sub-collection )
      const verse = await getTotalVerseReel(eleve_id);

      // 2. Déterminer le montant dû
      const niveau_nom = eleve.levelId || eleve.niveau_actuel || '';
      // On passe l'eleve_id pour prioriser le prix personnalisé déjà en base
      let montant_du = await getMontantDuParNiveau(niveau_nom, eleve_id);

      const reste = Math.max(0, montant_du - verse);
      const surplus = verse > montant_du && montant_du > 0 ? verse - montant_du : 0;

      let statut = 'en_attente';
      if (surplus > 0) statut = 'surplus';
      else if (montant_du > 0 && reste === 0) statut = 'solde';
      else if (verse > 0) statut = 'en_cours';

      // 3. Mettre à jour Firestore (Scolarites document central)
      await setDoc(
        doc(db, 'scolarites', eleve_id),
        {
          eleve_id,
          matricule: eleve.matricule || '',
          nom_eleve: `${eleve.firstName} ${eleve.lastName}`,
          montant_total_du: montant_du,
          total_verse: verse,
          reste,
          surplus: surplus > 0,
          montant_surplus: surplus,
          statut,
          derniere_maj: serverTimestamp()
        },
        { merge: true }
      );

      console.log(`[Correction] ${eleve.firstName} ${eleve.lastName}: du=${montant_du}, versé=${verse}, statut=${statut}`);
    }
    console.log('✅ Correction terminée avec succès');
    return true;
  } catch (err) {
    console.error('❌ Erreur lors de la correction:', err);
    throw err;
  }
}
