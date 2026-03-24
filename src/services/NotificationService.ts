import { Student, Teacher, ClassRoom } from '../types';

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
    // In a real app, this would call a backend API to send an email.
    // The backend already sends an email on creation.
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
