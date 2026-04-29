import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { OperationType, handleFirestoreError } from '../services/firestoreUtils';

export async function addAuditLog(action: string, cibleId?: string, details: any = {}) {
  const user = auth.currentUser;
  if (!user) return;

  const logPath = 'audit_log';
  try {
    await addDoc(collection(db, logPath), {
      action,
      user_id: user.uid,
      user_email: user.email,
      cible_id: cibleId || null,
      timestamp: serverTimestamp(),
      details
    });
  } catch (error) {
    console.error('Failed to write audit log:', error);
    // Don't throw here to avoid blocking the main action, just log locally
  }
}
