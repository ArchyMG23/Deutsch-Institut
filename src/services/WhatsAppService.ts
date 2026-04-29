/**
 * Service théorique pour l'intégration WhatsApp (Twilio/WABA).
 * Dans une implémentation réelle, cela appellerait une Cloud Function ou un backend sécurisé.
 */
export const WhatsAppService = {
  SENDER_NUMBER: '654491319',

  async sendWelcomeMessage(to: string, matricule: string, id: string, mdp: string) {
    console.log(`[WhatsApp] Envoi de DIA_SAAS (${this.SENDER_NUMBER}) à ${to}...`);
    console.log(`Message: Bienvenue chez DIA! Votre matricule est ${matricule}, ID: ${id}, MDP temporaire: ${mdp}`);
    
    // Simulation d'appel API via le backend
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({ success: true, from: this.SENDER_NUMBER, messageId: 'wa_' + Math.random().toString(36).substring(2, 11) });
      }, 1000);
    });
  },

  async sendGenericMessage(to: string, message: string) {
    console.log(`[WhatsApp] Envoi par ${this.SENDER_NUMBER} à ${to}: ${message}`);
    return { success: true };
  }
};
