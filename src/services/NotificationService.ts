import { Student, Teacher, ClassRoom } from '../types';
import { formatCurrency } from '../utils';
import { toast } from 'sonner';

export const NotificationService = {
  /**
   * Envoie une notification push via le backend.
   */
  async _triggerPushNotification(fetchWithAuth: any, to: string, pushTitle: string, pushBody: string) {
    try {
      await fetchWithAuth('/api/notifications/send-push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to, pushTitle, pushBody })
      });
      return true;
    } catch (e) {
      console.warn("Push failed:", e);
      return false;
    }
  },

  /**
   * Simulation WhatsApp locale (car l'API serveur est supprimée)
   */
  async _triggerWhatsApp(fetchWithAuth: any, phone: string, message: string) {
    console.log(`[LOCAL WHATSAPP SIMULATION] to ${phone}: ${message}`);
    // In a real app, this would open a WhatsApp link or call a gateway API
    return true;
  },

  /**
   * Notifie un utilisateur de ses identifiants de connexion.
   */
  async sendCredentials(fetchWithAuth: any, user: Student | Teacher, password: string, className?: string, schedule?: string) {
    let message = `Bonjour ${user.firstName},\n\nBienvenue chez DIA_SAAS !\n\nVoici vos identifiants de connexion :\nMatricule : ${user.matricule}\nMot de passe : ${password}\n\n`;
    
    if (className) {
      message += `Vous avez été affecté à la classe : ${className}\n`;
    }
    
    if (schedule) {
      message += `Jours de cours : ${schedule}\n`;
    }

    message += `\nLien de connexion : ${window.location.origin}/login`;
    
    toast.info(`Identifiants générés pour ${user.firstName} (Envoyés via WhatsApp/Push)`);
    
    // Send Push Notification
    await this._triggerPushNotification(fetchWithAuth, user.email, "Vos identifiants DIA_SAAS", "Vos accès ont été configurés. Connectez-vous dès maintenant.");

    // Send WhatsApp if phone is available
    if (user.phone) {
      const waMessage = `Bienvenue chez DIA_SAAS!\nVoici vos identifiants:\nMatricule: ${user.matricule}\nMot de passe: ${password}\nLien: ${window.location.origin}/login`;
      await this._triggerWhatsApp(fetchWithAuth, user.phone, waMessage);
    }
    
    // Send WhatsApp to parent if available
    if ('parentPhone' in user && user.parentPhone) {
      const waParentMessage = `Bonjour,\nVotre enfant ${user.firstName} a été inscrit chez DIA_SAAS.\nMatricule: ${user.matricule}\nMot de passe: ${password}`;
      await this._triggerWhatsApp(fetchWithAuth, (user as any).parentPhone as string, waParentMessage);
    }

    return true;
  },

  /**
   * Envoie un rappel de paiement à un étudiant.
   */
  async sendPaymentReminder(fetchWithAuth: any, student: Student, tuition: number) {
    const totalPaid = student.payments.reduce((acc, p) => acc + p.amount, 0);
    const balance = tuition - totalPaid;
    
    if (balance <= 0) return true;

    const message = `DIA_SAAS: Rappel de frais de scolarité pour ${student.firstName}.\nSolde restant: ${formatCurrency(balance)}. Merci de régulariser votre situation sur ${window.location.origin}/login`;

    // Send Push
    await this._triggerPushNotification(fetchWithAuth, student.email, "Rappel de Scolarité", `Solde restant: ${formatCurrency(balance)}. Merci de régulariser votre situation.`);

    // Send WhatsApp if phone is available
    if (student.phone) {
      await this._triggerWhatsApp(fetchWithAuth, student.phone, message);
    }

    // Send WhatsApp to parent if available
    if ((student as any).parentPhone) {
      const waParentMessage = `DIA_SAAS: Rappel de frais de scolarité pour votre enfant ${student.firstName}.\nSolde restant: ${formatCurrency(balance)}.`;
      await this._triggerWhatsApp(fetchWithAuth, (student as any).parentPhone as string, waParentMessage);
    }

    return true;
  },

  /**
   * Notifie d'un reçu de paiement.
   */
  async sendPaymentReceiptNotification(fetchWithAuth: any, student: Student, payment: any, totalPaid: number, balance: number) {
    const waMessage = `DIA_SAAS: Reçu de paiement confirmé pour ${student.firstName}.\nMontant: ${formatCurrency(payment.amount)}\nTotal réglé: ${formatCurrency(totalPaid)}\nSolde: ${formatCurrency(balance)}`;
    
    // Send Push
    await this._triggerPushNotification(fetchWithAuth, student.email, "Paiement Confirmé", `Reçu de ${formatCurrency(payment.amount)} Bien reçu.`);

    // Send WhatsApp if phone is available
    if (student.phone) {
      await this._triggerWhatsApp(fetchWithAuth, student.phone, waMessage);
    }

    // Send WhatsApp to parent if available
    if ('parentPhone' in student && (student as any).parentPhone) {
      const waParentMessage = `DIA_SAAS: Paiement de scolarité reçu pour ${student.firstName}.\nMontant: ${formatCurrency(payment.amount)}\nSolde restant: ${formatCurrency(balance)}`;
      await this._triggerWhatsApp(fetchWithAuth, (student as any).parentPhone as string, waParentMessage);
    }

    return true;
  },

  /**
   * Notifie d'un changement d'emploi du temps ou examen.
   */
  async sendEventUpdate(fetchWithAuth: any, user: Student | Teacher, type: 'course' | 'exam', action: 'added' | 'cancelled' | 'modified', details: { className: string, subject: string, date?: string, time?: string }) {
    const typeLabel = type === 'exam' ? 'Examen' : 'Cours';
    const actionLabel = action === 'added' ? 'Programmé' : action === 'cancelled' ? 'Annulé' : 'Modifié';
    
    const waMessage = `DIA_SAAS: ${typeLabel} ${actionLabel} - ${details.subject}.\n${details.date ? `Date: ${details.date}\n` : ''}${details.time ? `Heure: ${details.time}` : ''}`;

    // Send Push
    const pushTitle = `${typeLabel} ${actionLabel}`;
    const pushBody = `${details.subject} (${details.className})${details.date ? ` le ${details.date}` : ''}${details.time ? ` à ${details.time}` : ''}`;
    await this._triggerPushNotification(fetchWithAuth, user.email, pushTitle, pushBody);

    // Send WhatsApp if phone is available
    if (user.phone) {
      await this._triggerWhatsApp(fetchWithAuth, user.phone, waMessage);
    }

    return true;
  },

  /**
   * Notifie d'un nouveau communiqué.
   */
  async sendNotification(fetchWithAuth: any, user: Student | Teacher, subject: string, message: string, pushTitle?: string, pushBody?: string) {
    // Send Push
    if (pushTitle && pushBody) {
      await this._triggerPushNotification(fetchWithAuth, user.email, pushTitle, pushBody);
    }

    // Send WhatsApp
    if (user.phone) {
      await this._triggerWhatsApp(fetchWithAuth, user.phone, `${subject}: ${message}`);
    }

    return true;
  }
};
