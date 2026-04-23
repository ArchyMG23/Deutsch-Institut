import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    fallbackLng: 'fr',
    supportedLngs: ['fr', 'de', 'en'],
    interpolation: {
      escapeValue: false,
    },
    resources: {
      fr: {
        translation: {
          common: {
            submit: "Valider",
            cancel: "Annuler",
            save: "Enregistrer",
            loading: "Chargement...",
            error: "Une erreur est survenue",
            logout: "Se déconnecter",
            search: "Rechercher...",
            actions: "Actions",
            edit: "Modifier",
            delete: "Supprimer",
            status: "Statut",
            active: "Actif",
            inactive: "Inactif",
            view_all: "Voir tout",
            back: "Retour"
          },
          login: {
            title: "DIA_SAAS",
            subtitle: "Système de Gestion Académique Allemand",
            welcome: "Bienvenue",
            login_btn: "Se connecter",
            matricule: "Matricule / Code Admin",
            password: "Mot de passe",
            placeholder_matricule: "Ex: ADMIN ou S261234",
            placeholder_password: "••••••••",
            help: "Besoin d'aide ?",
            support: "Support Technique",
            german_std: "Deutscher Standard"
          },
          sidebar: {
            dashboard: "Tableau de Bord",
            students: "Étudiants",
            teachers: "Enseignants",
            classes: "Classes",
            evaluations: "Évaluations",
            finances: "Finances",
            profile: "Mon Profil",
            administration: "Administration",
            library: "Bibliothèque",
            communiques: "Communiqués",
            manage_admins: "Gérer Admins"
          },
          dashboard: {
            total_students: "Total Étudiants",
            active_teachers: "Enseignants Actifs",
            revenue: "Revenus (FCFA)",
            average_performance: "Moyenne Générale",
            recent_activities: "Activités Récentes",
            quick_stats: "Statistiques Rapides"
          }
        }
      },
      de: {
        translation: {
          common: {
            submit: "Bestätigen",
            cancel: "Abbrechen",
            save: "Speichern",
            loading: "Laden...",
            error: "Ein Fehler ist aufgetreten",
            logout: "Abmelden",
            search: "Suche...",
            actions: "Aktionen",
            edit: "Bearbeiten",
            delete: "Löschen",
            status: "Status",
            active: "Aktiv",
            inactive: "Inaktiv",
            view_all: "Alle ansehen",
            back: "Zurück"
          },
          login: {
            title: "DIA_SAAS",
            subtitle: "Deutsches Akademisches Managementsystem",
            welcome: "Willkommen",
            login_btn: "Anmelden",
            matricule: "Matrikelnummer / Admin-Code",
            password: "Passwort",
            placeholder_matricule: "Z.B.: ADMIN oder S261234",
            placeholder_password: "••••••••",
            help: "Brauchen Sie Hilfe?",
            support: "Technischer Support",
            german_std: "Deutscher Standard"
          },
          sidebar: {
            dashboard: "Dashboard",
            students: "Studenten",
            teachers: "Lehrer",
            classes: "Klassen",
            evaluations: "Bewertungen",
            finances: "Finanzen",
            profile: "Mein Profil",
            administration: "Verwaltung",
            library: "Bibliothek",
            communiques: "Mitteilungen",
            manage_admins: "Admins verwalten"
          },
          dashboard: {
            total_students: "Gesamtzahl Studenten",
            active_teachers: "Aktive Lehrer",
            revenue: "Einnahmen (FCFA)",
            average_performance: "Gesamtdurchschnitt",
            recent_activities: "Aktuelle Aktivitäten",
            quick_stats: "Schnellstatistik"
          }
        }
      },
      en: {
        translation: {
          common: {
            submit: "Submit",
            cancel: "Cancel",
            save: "Save",
            loading: "Loading...",
            error: "An error occurred",
            logout: "Logout",
            search: "Search...",
            actions: "Actions",
            edit: "Edit",
            delete: "Delete",
            status: "Status",
            active: "Active",
            inactive: "Inactive",
            view_all: "View all",
            back: "Back"
          },
          login: {
            title: "DIA_SAAS",
            subtitle: "German Academic Management System",
            welcome: "Welcome",
            login_btn: "Login",
            matricule: "Matricule / Admin Code",
            password: "Password",
            placeholder_matricule: "Ex: ADMIN or S261234",
            placeholder_password: "••••••••",
            help: "Need help?",
            support: "Technical Support",
            german_std: "German Standard"
          },
          sidebar: {
            dashboard: "Dashboard",
            students: "Students",
            teachers: "Teachers",
            classes: "Classes",
            evaluations: "Evaluations",
            finances: "Finances",
            profile: "My Profile",
            administration: "Administration",
            library: "Library",
            communiques: "Messages",
            manage_admins: "Manage Admins"
          },
          dashboard: {
            total_students: "Total Students",
            active_teachers: "Active Teachers",
            revenue: "Revenue (FCFA)",
            average_performance: "General Average",
            recent_activities: "Recent Activities",
            quick_stats: "Quick Stats"
          }
        }
      }
    }
  });

export default i18n;
