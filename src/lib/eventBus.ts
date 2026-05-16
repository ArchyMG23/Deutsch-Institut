// eventBus.ts — Canal de communication inter-modules

export const EVENTS = {
  // Finance
  TRANSACTION_AJOUTEE:    'tx:added',
  TRANSACTION_MODIFIEE:   'tx:updated',
  TRANSACTION_SUPPRIMEE:  'tx:deleted',
  SOLDES_UPDATED:         'soldes:updated',
  SCOLARITE_UPDATED:      'scolarite:updated',
  // Élèves
  ELEVE_AJOUTE:           'eleve:added',
  ELEVE_MODIFIE:          'eleve:updated',
  ELEVE_SUPPRIME:         'eleve:deleted',
  // Enseignants
  SEANCE_AJOUTEE:         'seance:added',
  SEANCE_PAYEE:           'seance:paid',
  RAPPORT_SOUMIS:         'rapport:submitted',
};

export const EventBus = {
  emit(event: string, detail: any = {}) {
    document.dispatchEvent(
      new CustomEvent(event, { detail, bubbles: true })
    );
  },
  on(event: string, handler: (detail: any) => void) {
    const wrapper = (e: any) => handler(e.detail);
    document.addEventListener(event, wrapper);
    return () => document.removeEventListener(event, wrapper);
  },
  off(event: string, handler: (detail: any) => void) {
    // This is tricky with wrappers, usually on() returns an unsubscribe function
    // For standard off(), we'd need to keep track of wrappers.
    // In React, we mostly use the unsubscribe function returned by on().
  }
};
