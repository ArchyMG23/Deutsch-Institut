import React from 'react';
import { NavLink } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Users, 
  GraduationCap, 
  Wallet, 
  Library, 
  Calendar,
  Layers,
  Settings,
  LogOut,
  Menu,
  X,
  User,
  Bell
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { cn } from '../utils';
import { motion, AnimatePresence } from 'motion/react';

export function Sidebar() {
  const { profile, logout } = useAuth();
  const [isOpen, setIsOpen] = React.useState(false);
  const [logoError, setLogoError] = React.useState(false);

  const adminLinks = [
    { to: '/admin', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/admin/students', icon: Users, label: 'Étudiants' },
    { to: '/admin/teachers', icon: GraduationCap, label: 'Enseignants' },
    { to: '/admin/levels', icon: Layers, label: 'Niveaux' },
    { to: '/admin/classes', icon: LayoutDashboard, label: 'Classes' },
    { to: '/admin/finances', icon: Wallet, label: 'Finances' },
    { to: '/admin/library', icon: Library, label: 'Bibliothèque' },
    { to: '/admin/communiques', icon: Bell, label: 'Communiqués' },
  ];

  const teacherLinks = [
    { to: '/teacher', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/teacher/planning', icon: Calendar, label: 'Planning' },
    { to: '/teacher/students', icon: Users, label: 'Étudiants' },
    { to: '/teacher/library', icon: Library, label: 'Bibliothèque' },
    { to: '/teacher/communiques', icon: Bell, label: 'Communiqués' },
    { to: '/teacher/profile', icon: User, label: 'Mon Profil' },
  ];

  const studentLinks = [
    { to: '/student', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/student/calendar', icon: Calendar, label: 'Calendrier' },
    { to: '/student/library', icon: Library, label: 'Bibliothèque' },
    { to: '/student/communiques', icon: Bell, label: 'Communiqués' },
    { to: '/student/profile', icon: User, label: 'Mon Profil' },
  ];

  const links = profile?.role === 'admin' ? adminLinks : 
                profile?.role === 'teacher' ? teacherLinks : 
                studentLinks;

  return (
    <>
      {/* Mobile Header Overlay */}
      <div className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-white dark:bg-neutral-900 border-b border-neutral-100 dark:border-neutral-800 z-40 flex items-center px-4">
        <button 
          onClick={() => setIsOpen(!isOpen)}
          className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition-colors text-neutral-600 dark:text-neutral-400"
        >
          {isOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
        <div className="ml-4 flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-dia-red flex items-center justify-center text-white font-bold text-sm">D</div>
          <span className="font-bold text-neutral-900 dark:text-white">DIA_SAAS</span>
        </div>
      </div>

      {/* Mobile Backdrop */}
      <AnimatePresence>
        {isOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsOpen(false)}
            className="lg:hidden fixed inset-0 bg-black/40 backdrop-blur-sm z-40"
          />
        )}
      </AnimatePresence>

      <aside className={cn(
        "fixed inset-y-0 left-0 z-50 w-64 bg-white dark:bg-neutral-900 border-r border-neutral-100 dark:border-neutral-800 transform transition-transform duration-300 ease-in-out lg:translate-x-0",
        isOpen ? "translate-x-0" : "-translate-x-full shadow-2xl lg:shadow-none"
      )}>
        <div className="flex flex-col h-full">
          <div className="p-6">
            <div className="flex items-center gap-3 mb-8">
              <div className="relative w-11 h-11 shrink-0">
                {!logoError ? (
                  <img 
                    src="/logo.png" 
                    alt="DIA Logo" 
                    className="w-11 h-11 rounded-xl shadow-lg shadow-dia-red/10 object-contain bg-white" 
                    referrerPolicy="no-referrer"
                    onError={() => setLogoError(true)}
                  />
                ) : (
                  <div className="w-11 h-11 rounded-xl bg-dia-red flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-dia-red/20">
                    D
                  </div>
                )}
              </div>
              <div className="overflow-hidden">
                <h1 className="font-bold text-neutral-900 dark:text-white leading-tight">DIA_SAAS</h1>
                <p className="text-[9px] font-bold uppercase tracking-widest text-neutral-400">Deutsch Institut</p>
              </div>
            </div>

            <nav className="space-y-1">
              {links.map((link) => (
                <NavLink
                  key={link.to}
                  to={link.to}
                  onClick={() => setIsOpen(false)}
                  className={({ isActive }) => cn(
                    "flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-bold text-sm",
                    isActive 
                      ? "bg-dia-red/5 dark:bg-dia-red/10 text-dia-red" 
                      : "text-neutral-500 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-800 hover:text-dia-red"
                  )}
                >
                  <link.icon size={18} />
                  <span>{link.label}</span>
                </NavLink>
              ))}
            </nav>
          </div>

          <div className="mt-auto p-4 border-t border-neutral-50 dark:border-neutral-800">
            <div className="flex items-center gap-3 mb-4 p-2 rounded-2xl bg-neutral-50 dark:bg-neutral-800/50">
              <div className="w-9 h-9 shrink-0 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-100 dark:border-neutral-700 flex items-center justify-center text-xs font-bold text-neutral-700 dark:text-neutral-300 shadow-sm">
                {profile?.firstName?.[0]}{profile?.lastName?.[0]}
              </div>
              <div className="overflow-hidden">
                <p className="text-xs font-bold text-neutral-900 dark:text-white truncate">{profile?.firstName} {profile?.lastName}</p>
                <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider truncate">{profile?.matricule}</p>
              </div>
            </div>
            <button 
              onClick={() => {
                setIsOpen(false);
                logout();
              }}
              className="flex items-center gap-3 w-full px-4 py-3 text-neutral-500 dark:text-neutral-400 hover:text-dia-red hover:bg-dia-red/5 rounded-xl transition-all font-bold text-sm"
            >
              <LogOut size={18} />
              <span>Déconnexion</span>
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
