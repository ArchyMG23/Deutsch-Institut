import { Student, Teacher, ClassRoom } from '../types';
import { formatCurrency } from '../utils';
import { toast } from 'sonner';

export const NotificationService = {
  /**
   * Envoie une requête au backend pour envoyer un email et éventuellement une notification push.
   */
  async _triggerEmail(fetchWithAuth: any, to: string, subject: string, text: string, html?: string, pushTitle?: string, pushBody?: string) {
    try {
      const res = await fetchWithAuth('/api/notifications/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to, subject, text, html, pushTitle, pushBody })
      });
      return res.ok;
    } catch (err) {
      console.error("NotificationService: Error triggering email:", err);
      return false;
    }
  },

  /**
   * Notifie un utilisateur de ses identifiants de connexion.
   * Note: This is now handled automatically by the backend during student/teacher creation,
   * but this method remains for manual resends.
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
    
    const subject = "Bienvenue chez DIA_SAAS - Vos identifiants";
    const html = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
        <h2 style="color: #E31E24;">Bienvenue chez DIA_SAAS !</h2>
        <p>Bonjour <strong>${user.firstName}</strong>,</p>
        <p>Votre compte a été configuré. Voici vos identifiants :</p>
        <div style="background: #f9f9f9; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 5px 0;"><strong>Matricule :</strong> ${user.matricule}</p>
          <p style="margin: 5px 0;"><strong>Mot de passe :</strong> ${password}</p>
        </div>
        ${className ? `<p>Classe : <strong>${className}</strong></p>` : ''}
        ${schedule ? `<p>Horaires : <strong>${schedule}</strong></p>` : ''}
        <p><a href="${window.location.origin}/login" style="color: #E31E24; font-weight: bold;">Se connecter au portail</a></p>
      </div>
    `;

    toast.info(`Identifiants générés : ${user.matricule} / ${password}`);
    return await this._triggerEmail(fetchWithAuth, user.email, subject, message, html);
  },

  /**
   * Envoie un rappel de paiement à un étudiant.
   */
  async sendPaymentReminder(fetchWithAuth: any, student: Student, tuition: number) {
    const totalPaid = student.payments.reduce((acc, p) => acc + p.amount, 0);
    const balance = tuition - totalPaid;
    
    if (balance <= 0) return true;

    const subject = "Rappel de Scolarité - DIA_SAAS";
    const message = `Bonjour ${student.firstName},\n\nCeci est un rappel concernant vos frais de scolarité.\n\n` +
      `- Frais totaux : ${formatCurrency(tuition)}\n` +
      `- Montant réglé : ${formatCurrency(totalPaid)}\n` +
      `- Reste à payer : ${formatCurrency(balance)}\n\n` +
      `Merci de régulariser votre situation.\n\nLien : ${window.location.origin}/login`;

    const html = `
      <div style="font-family: sans-serif; max-width: 600px; padding: 20px; border: 1px solid #eee; border-radius: 12px;">
        <h3 style="color: #E31E24;">Rappel de Frais de Scolarité</h3>
        <p>Bonjour ${student.firstName},</p>
        <p>Nous vous informons qu'un solde reste à régulariser concernant votre scolarité :</p>
        <ul style="list-style: none; padding: 0;">
          <li>💰 <strong>Total :</strong> ${formatCurrency(tuition)}</li>
          <li>✅ <strong>Payé :</strong> ${formatCurrency(totalPaid)}</li>
          <li style="color: #E31E24; font-size: 1.1em; margin-top: 10px;">📉 <strong>Reste à payer : ${formatCurrency(balance)}</strong></li>
        </ul>
        <p>Veuillez passer à la comptabilité dès que possible.</p>
        <p><a href="${window.location.origin}/login" style="color: #E31E24; font-weight: bold;">Voir mon compte</a></p>
      </div>
    `;

    const pushTitle = "Rappel de Scolarité";
    const pushBody = `Solde restant: ${formatCurrency(balance)}. Merci de régulariser votre situation.`;

    return await this._triggerEmail(fetchWithAuth, student.email, subject, message, html, pushTitle, pushBody);
  },

  /**
   * Notifie d'un changement d'emploi du temps ou examen.
   */
  async sendEventUpdate(fetchWithAuth: any, user: Student | Teacher, type: 'course' | 'exam', action: 'added' | 'cancelled' | 'modified', details: { className: string, subject: string, date?: string, time?: string }) {
    const typeLabel = type === 'exam' ? 'Examen' : 'Cours';
    const actionLabel = action === 'added' ? 'Programmé' : action === 'cancelled' ? 'Annulé' : 'Modifié';
    
    const subject = `[DIA_SAAS] ${typeLabel} ${actionLabel} - ${details.subject}`;
    
    const message = `Bonjour ${user.firstName},\n\nLe ${typeLabel.toLowerCase()} de ${details.subject} pour la classe ${details.className} a été ${actionLabel.toLowerCase()}.\n` +
      (details.date ? `Date : ${details.date}\n` : '') +
      (details.time ? `Heure : ${details.time}\n` : '') +
      `Consultez votre calendrier sur le portail.\n\nLien : ${window.location.origin}/login`;

    const statusColor = action === 'cancelled' ? '#ff0000' : action === 'added' ? '#00cc00' : '#ffa500';

    const html = `
      <div style="font-family: sans-serif; max-width: 600px; border: 1px solid #eee; border-radius: 12px; overflow: hidden;">
        <div style="background: ${statusColor}; color: white; padding: 15px; font-weight: bold; text-align: center;">
          ${typeLabel} ${actionLabel}
        </div>
        <div style="padding: 20px;">
          <p>Bonjour ${user.firstName},</p>
          <p>Le ${typeLabel.toLowerCase()} suivant a subi une mise à jour :</p>
          <p>📚 <strong>Matière :</strong> ${details.subject}</p>
          <p>🏫 <strong>Classe :</strong> ${details.className}</p>
          ${details.date ? `<p>📅 <strong>Date :</strong> ${details.date}</p>` : ''}
          ${details.time ? `<p>⏰ <strong>Heure :</strong> ${details.time}</p>` : ''}
          <p style="margin-top: 20px;"><a href="${window.location.origin}/login" style="color: #E31E24; font-weight: bold;">Consulter mon portail</a></p>
        </div>
      </div>
    `;

    const pushTitle = `${typeLabel} ${actionLabel}`;
    const pushBody = `${details.subject} (${details.className})${details.date ? ` le ${details.date}` : ''}${details.time ? ` à ${details.time}` : ''}`;

    return await this._triggerEmail(fetchWithAuth, user.email, subject, message, html, pushTitle, pushBody);
  }
};
