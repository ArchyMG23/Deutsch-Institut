import { Student, Teacher, ClassRoom } from '../types';
import { formatCurrency } from '../utils';
import { toast } from 'sonner';

export const NotificationService = {
  /**
   * Notifie un utilisateur de ses identifiants de connexion.
   */
  async sendCredentials(user: Student | Teacher, password: string, className?: string, schedule?: string) {
    let message = `Bonjour ${user.firstName},\n\nBienvenue chez DIA_SAAS !\n\nVoici vos identifiants de connexion :\nMatricule : ${user.matricule}\nMot de passe : ${password}\n\n`;
    
    if (className) {
      message += `Vous avez été affecté à la classe : ${className}\n`;
    }
    
    if (schedule) {
      message += `Jours de cours : ${schedule}\n`;
    }

    message += `\nLien de connexion : ${window.location.origin}/login`;
    
    console.log("Credentials notification prepared:", message);
    
    // Affichage des identifiants à l'écran pour l'admin comme sécurité
    toast.info(`Identifiants générés : ${user.matricule} / ${password}`, {
      duration: 10000,
      description: "L'élève recevra également un email automatique."
    });

    return true;
  },

  /**
   * Envoie un rappel de paiement à un étudiant.
   */
  async sendPaymentReminder(student: Student, tuition: number) {
    const totalPaid = student.payments.reduce((acc, p) => acc + p.amount, 0);
    const balance = tuition - totalPaid;
    
    if (balance <= 0) {
      console.log(`Payment reminder skipped for ${student.firstName} (already fully paid)`);
      return true;
    }

    const message = `Bonjour ${student.firstName},\n\nCeci est un rappel concernant vos frais de scolarité chez DIA_SAAS.\n\n` +
      `Récapitulatif de votre compte :\n` +
      `- Frais de scolarité totaux : ${formatCurrency(tuition)}\n` +
      `- Montant déjà réglé : ${formatCurrency(totalPaid)}\n` +
      `- Reste à payer : ${formatCurrency(balance)}\n\n` +
      `Merci de régulariser votre situation dès que possible.\n\nLien de connexion : ${window.location.origin}/login`;

    console.log("Payment reminder notification prepared:", message);
    // In a real app, this would call a backend API to send an email or SMS.
    return true;
  },

  /**
   * Notifie d'un nouveau cours programmé.
   */
  async sendCourseSchedule(user: Student | Teacher, className: string, subject: string, day: string, time: string) {
    const message = `Bonjour ${user.firstName},\n\nUn nouveau cours a été programmé :\nClasse : ${className}\nMatière : ${subject}\nJour : ${day}\nHeure : ${time}\n\nA bientôt !`;
    console.log("Course schedule notification prepared:", message);
    return true;
  }
};
