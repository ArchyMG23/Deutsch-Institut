import { Student, Teacher, ClassRoom } from '../types';

export const NotificationService = {
  /**
   * Génère un lien WhatsApp direct.
   */
  getWhatsAppLink(phone: string, message: string) {
    // Nettoyer le numéro (garder uniquement les chiffres)
    const cleanPhone = phone.replace(/\D/g, '');
    // Encoder le message pour l'URL
    const encodedMessage = encodeURIComponent(message);
    return `https://wa.me/${cleanPhone}?text=${encodedMessage}`;
  },

  /**
   * Ouvre WhatsApp avec le message pré-rempli.
   */
  async sendWhatsApp(phone: string, message: string) {
    const link = this.getWhatsAppLink(phone, message);
    window.open(link, '_blank');
    return true;
  },

  /**
   * Notifie un utilisateur de ses identifiants de connexion.
   */
  async sendCredentials(user: Student | Teacher, password: string, className?: string, schedule?: string) {
    let message = `Bonjour ${user.firstName},\n\nBienvenue chez Deutsch Institut !\n\nVoici vos identifiants de connexion :\nMatricule : ${user.matricule}\nMot de passe : ${password}\n\n`;
    
    if (className) {
      message += `Vous avez été affecté à la classe : ${className}\n`;
    }
    
    if (schedule) {
      message += `Jours de cours : ${schedule}\n`;
    }

    message += `\nLien de connexion : ${window.location.origin}/login`;
    
    return this.sendWhatsApp(user.phone || user.whatsapp, message);
  },

  /**
   * Notifie d'un nouveau cours programmé.
   */
  async sendCourseSchedule(user: Student | Teacher, className: string, subject: string, day: string, time: string) {
    const message = `Bonjour ${user.firstName},\n\nUn nouveau cours a été programmé :\nClasse : ${className}\nMatière : ${subject}\nJour : ${day}\nHeure : ${time}\n\nA bientôt !`;
    return this.sendWhatsApp(user.phone || user.whatsapp, message);
  }
};
