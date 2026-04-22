import { Student, Teacher, ClassRoom } from '../types';
import { formatCurrency } from '../utils';
import { toast } from 'sonner';

export const NotificationService = {
  /**
   * Envoie une requête au backend pour envoyer un email et éventuellement une notification push.
   */
  async _triggerEmail(fetchWithAuth: any, to: string, subject: string, text: string, html?: string, pushTitle?: string, pushBody?: string, cc?: string) {
    try {
      const res = await fetchWithAuth('/api/notifications/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to, cc, subject, text, html, pushTitle, pushBody })
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

    let cc = undefined;
    if ('parentEmail' in user && user.parentEmail) {
      cc = user.parentEmail;
    }

    toast.info(`Identifiants générés : ${user.matricule} / ${password}`);
    return await this._triggerEmail(fetchWithAuth, user.email, subject, message, html, undefined, undefined, cc);
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
    
    let cc = undefined;
    if ((student as any).parentEmail) {
      cc = (student as any).parentEmail;
    }

    return await this._triggerEmail(fetchWithAuth, student.email, subject, message, html, pushTitle, pushBody, cc);
  },

  /**
   * Envoie un reçu de paiement par email.
   */
  async sendPaymentReceipt(fetchWithAuth: any, student: Student, payment: any, totalPaid: number, balance: number) {
    const subject = `Reçu de Paiement - ${student.firstName} ${student.lastName} - DIA_SAAS`;
    const message = `Bonjour ${student.firstName},\n\nNous confirmons la réception de votre paiement de ${formatCurrency(payment.amount)} effectué le ${new Date(payment.date).toLocaleDateString()}.\n\n` +
      `- Référence : ${payment.id || 'N/A'}\n` +
      `- Mode : ${payment.method}\n` +
      `- Total payé à ce jour : ${formatCurrency(totalPaid)}\n` +
      `- Reste à payer : ${formatCurrency(balance)}\n\n` +
      `Merci pour votre confiance.\nL'équipe DIA_SAAS`;

    const html = `
      <div style="font-family: sans-serif; max-width: 600px; padding: 20px; border: 2px solid #E31E24; border-radius: 16px;">
        <div style="text-align: center; margin-bottom: 20px;">
          <h2 style="color: #E31E24; margin-bottom: 0;">REÇU DE PAIEMENT</h2>
          <p style="text-transform: uppercase; font-size: 10px; font-weight: bold; color: #666; letter-spacing: 2px;">Deutsch Institut</p>
        </div>
        
        <div style="background: #f9f9f9; padding: 20px; border-radius: 12px; margin-bottom: 20px;">
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="color: #666; font-size: 12px; padding: 5px 0;">Étudiant</td>
              <td style="text-align: right; font-weight: bold;">${student.firstName} ${student.lastName}</td>
            </tr>
            <tr>
              <td style="color: #666; font-size: 12px; padding: 5px 0;">Matricule</td>
              <td style="text-align: right; font-mono; font-weight: bold;">${student.matricule}</td>
            </tr>
            <tr style="border-top: 1px solid #ddd;">
              <td style="color: #E31E24; font-weight: bold; padding: 15px 0; font-size: 18px;">Montant Reçu</td>
              <td style="text-align: right; color: #E31E24; font-weight: bold; font-size: 18px;">${formatCurrency(payment.amount)}</td>
            </tr>
          </table>
        </div>

        <div style="font-size: 13px; color: #444;">
          <p><strong>Détails de la transaction :</strong></p>
          <p>📅 Date : ${new Date(payment.date).toLocaleDateString()}</p>
          <p>💳 Mode : ${payment.method}</p>
          <p>💰 Total réglé : ${formatCurrency(totalPaid)}</p>
          <p style="color: #666; font-style: italic;">📉 Solde restant : ${formatCurrency(balance)}</p>
        </div>

        <div style="margin-top: 30px; border-top: 1px solid #eee; padding-top: 20px; text-align: center; color: #999; font-size: 11px;">
          Ceci est un document officiel généré par DIA_SAAS.
        </div>
      </div>
    `;

    let cc = undefined;
    if ('parentEmail' in student && student.parentEmail) {
      cc = (student as any).parentEmail;
    }

    return await this._triggerEmail(fetchWithAuth, student.email, subject, message, html, "Paiement Confirmé", `Reçu de ${formatCurrency(payment.amount)} envoyé par email.`, cc);
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

    let cc = undefined;
    if ('parentEmail' in user && user.parentEmail) {
      cc = user.parentEmail;
    }

    return await this._triggerEmail(fetchWithAuth, user.email, subject, message, html, pushTitle, pushBody, cc);
  },

  /**
   * Envoie un rapport financier par email à l'administrateur.
   */
  async sendFinanceReport(fetchWithAuth: any, adminEmail: string, period: string, stats: { income: number, expense: number, balance: number }, recordsHtml: string) {
    const subject = `Rapport Financier - ${period} - DIA_SAAS`;
    const message = `Rapport Financier pour ${period}.\n\nRevenus: ${formatCurrency(stats.income)}\nDépenses: ${formatCurrency(stats.expense)}\nSolde: ${formatCurrency(stats.balance)}\n\nConsultez les détails ci-dessous.`;
    
    const html = `
      <div style="font-family: sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 12px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #E31E24; margin-bottom: 5px;">Rapport Financier</h1>
          <p style="color: #666; font-weight: bold; text-transform: uppercase; letter-spacing: 1px;">${period}</p>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 20px; margin-bottom: 30px;">
          <div style="background: #f0fff4; padding: 15px; border-radius: 10px; border: 1px solid #c6f6d5; text-align: center;">
            <p style="font-size: 10px; color: #38a169; text-transform: uppercase; margin: 0;">Revenus</p>
            <p style="font-size: 18px; font-weight: bold; color: #2f855a; margin: 5px 0;">${formatCurrency(stats.income)}</p>
          </div>
          <div style="background: #fff5f5; padding: 15px; border-radius: 10px; border: 1px solid #fed7d7; text-align: center;">
            <p style="font-size: 10px; color: #e53e3e; text-transform: uppercase; margin: 0;">Dépenses</p>
            <p style="font-size: 18px; font-weight: bold; color: #c53030; margin: 5px 0;">${formatCurrency(stats.expense)}</p>
          </div>
          <div style="background: #ebf8ff; padding: 15px; border-radius: 10px; border: 1px solid #bee3f8; text-align: center;">
            <p style="font-size: 10px; color: #3182ce; text-transform: uppercase; margin: 0;">Solde</p>
            <p style="font-size: 18px; font-weight: bold; color: #2b6cb0; margin: 5px 0;">${formatCurrency(stats.balance)}</p>
          </div>
        </div>

        <div style="margin-top: 20px;">
          <h3 style="border-bottom: 1px solid #eee; padding-bottom: 10px;">Détails des transactions</h3>
          <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
            <thead>
              <tr style="background: #f8f9fa;">
                <th style="padding: 10px; text-align: left; border-bottom: 1px solid #dee2e6;">Date</th>
                <th style="padding: 10px; text-align: left; border-bottom: 1px solid #dee2e6;">Description</th>
                <th style="padding: 10px; text-align: left; border-bottom: 1px solid #dee2e6;">Catégorie</th>
                <th style="padding: 10px; text-align: right; border-bottom: 1px solid #dee2e6;">Montant</th>
              </tr>
            </thead>
            <tbody>
              ${recordsHtml}
            </tbody>
          </table>
        </div>

        <div style="margin-top: 40px; text-align: center; font-size: 11px; color: #999;">
          Généré le ${new Date().toLocaleString('fr-FR')} par DIA_SAAS Management System.
        </div>
      </div>
    `;

    return await this._triggerEmail(fetchWithAuth, adminEmail, subject, message, html);
  }
};
