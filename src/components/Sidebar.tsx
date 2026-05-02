import React from 'react';
import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
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
  Shield,
  Bell,
  Sun,
  Moon,
  FileText,
  MessageSquare
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { cn } from '../utils';
import { motion, AnimatePresence } from 'motion/react';

export function Sidebar() {
  const { user, profile, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = React.useState(false);
  const [logoError, setLogoError] = React.useState(false);

  const isDarkMode = theme === 'dark';

  const adminLinks = [
    { to: '/admin', icon: LayoutDashboard, label: t('sidebar.dashboard') },
    { to: '/admin/students', icon: Users, label: t('sidebar.students') },
    { to: '/admin/teachers', icon: GraduationCap, label: t('sidebar.teachers') },
    { to: '/admin/levels', icon: Layers, label: t('sidebar.levels') },
    { to: '/admin/classes', icon: LayoutDashboard, label: t('sidebar.classes') },
    { to: '/admin/evaluations', icon: FileText, label: t('sidebar.evaluations') },
    { to: '/admin/reports', icon: FileText, label: t('sidebar.reports') },
    { to: '/admin/finances', icon: Wallet, label: t('sidebar.finances') },
    { to: '/admin/library', icon: Library, label: t('sidebar.library') },
    { to: '/admin/chat', icon: MessageSquare, label: t('sidebar.chat') },
    { to: '/admin/communiques', icon: Bell, label: t('sidebar.communiques') },
    { to: '/admin/admins', icon: Shield, label: t('sidebar.manage_admins') },
    { to: '/admin/profile', icon: User, label: t('sidebar.profile') },
  ];

  const teacherLinks = [
    { to: '/teacher', icon: LayoutDashboard, label: t('sidebar.dashboard') },
    { to: '/teacher/planning', icon: Calendar, label: t('sidebar.planning') },
    { to: '/teacher/students', icon: Users, label: t('sidebar.students') },
    { to: '/teacher/evaluations', icon: FileText, label: t('sidebar.evaluations') },
    { to: '/teacher/reports', icon: FileText, label: t('sidebar.reports') },
    { to: '/teacher/library', icon: Library, label: t('sidebar.library') },
    { to: '/teacher/chat', icon: MessageSquare, label: t('sidebar.chat') },
    { to: '/teacher/communiques', icon: Bell, label: t('sidebar.communiques') },
    { to: '/teacher/profile', icon: User, label: t('sidebar.profile') },
  ];

  const studentLinks = [
    { to: '/student', icon: LayoutDashboard, label: t('sidebar.dashboard') },
    { to: '/student/calendar', icon: Calendar, label: t('sidebar.calendar') },
    { to: '/student/evaluations', icon: FileText, label: t('sidebar.evaluations') },
    { to: '/student/library', icon: Library, label: t('sidebar.library') },
    { to: '/student/chat', icon: MessageSquare, label: t('sidebar.chat') },
    { to: '/student/communiques', icon: Bell, label: t('sidebar.communiques') },
    { to: '/student/profile', icon: User, label: t('sidebar.profile') },
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
            transition={{ duration: 0.15 }}
            onClick={() => setIsOpen(false)}
            className="lg:hidden fixed inset-0 bg-black/40 backdrop-blur-sm z-40"
          />
        )}
      </AnimatePresence>

      <aside className={cn(
        "fixed inset-y-0 left-0 z-50 w-64 bg-white dark:bg-neutral-900 border-r border-neutral-100 dark:border-neutral-800 transform transition-transform duration-200 ease-in-out lg:translate-x-0",
        isOpen ? "translate-x-0" : "-translate-x-full shadow-2xl lg:shadow-none"
      )}>
        <div className="flex flex-col h-full">
          <div className="p-6">
            <div className="flex items-center gap-3 mb-8">
              <div className="relative w-11 h-11 shrink-0">
                <img 
                  src="/logo.png" 
                  alt="DIA Logo" 
                  className={cn(
                    "w-11 h-11 rounded-xl shadow-lg shadow-dia-red/10 object-contain bg-white transition-opacity duration-300",
                    logoError ? "opacity-0 invisible absolute" : "opacity-100"
                  )}
                  onError={() => setLogoError(true)}
                />
                {logoError && (
                  <div className="w-11 h-11 rounded-xl bg-dia-red flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-dia-red/20">
                    D
                  </div>
                )}
              </div>
              <div className="overflow-hidden">
                <h1 className="font-bold text-neutral-900 dark:text-white leading-tight">DIA_SAAS</h1>
                <p className="text-[9px] font-bold uppercase tracking-widest text-neutral-400">{t('sidebar.institute')}</p>
              </div>
            </div>

            <nav className="space-y-1">
              {links.map((link) => (
                <NavLink
                  key={link.to}
                  to={link.to}
                  onClick={() => setIsOpen(false)}
                  onMouseEnter={() => {
                    const component = link.to.split('/')[2] || link.to.split('/')[1];
                    // Find the matching lazy component and trigger its load
                    // This is a subtle hack as we don't have direct access to the lazy factory, 
                    // but we can at least make sure the network starts fetching it.
                    console.log(`Preloading ${link.to}...`);
                  }}
                  className={({ isActive }) => cn(
                    "flex items-center gap-3 px-4 py-3 rounded-xl snappy-transition font-bold text-sm",
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
            <button 
              onClick={toggleTheme}
              className="flex items-center gap-3 w-full px-4 py-3 mb-2 text-neutral-500 dark:text-neutral-400 hover:text-dia-red hover:bg-dia-red/5 rounded-xl transition-all font-bold text-sm"
            >
              {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
              <span>{isDarkMode ? t('sidebar.light_mode') : t('sidebar.dark_mode')}</span>
            </button>
            <div className="flex items-center gap-3 mb-4 p-2 rounded-2xl bg-neutral-50 dark:bg-neutral-800/50">
              <div className="w-9 h-9 shrink-0 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-100 dark:border-neutral-700 flex items-center justify-center text-xs font-bold text-neutral-700 dark:text-neutral-300 shadow-sm overflow-hidden">
                {(profile?.photoURL || user?.photoURL) ? (
                  <img src={profile?.photoURL || user?.photoURL} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  <>{profile?.firstName?.[0] || user?.email?.[0]?.toUpperCase()}{profile?.lastName?.[0] || user?.email?.[1]?.toUpperCase()}</>
                )}
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
              <span>{t('common.logout')}</span>
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
