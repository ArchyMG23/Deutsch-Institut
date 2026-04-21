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
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2 bg-white dark:bg-neutral-900 rounded-lg shadow-md"
      >
        {isOpen ? <X size={24} /> : <Menu size={24} />}
      </button>

      <aside className={cn(
        "fixed inset-y-0 left-0 z-40 w-64 bg-white border-r border-neutral-100 transform transition-transform duration-300 ease-in-out lg:translate-x-0",
        isOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="flex flex-col h-full">
          <div className="p-6">
            <div className="flex items-center gap-3 mb-10">
              <div className="relative w-12 h-12">
                {!logoError ? (
                  <img 
                    src="/logo.png" 
                    alt="DIA Logo" 
                    className="w-12 h-12 rounded-xl shadow-lg shadow-dia-red/10 object-contain bg-white" 
                    referrerPolicy="no-referrer"
                    onError={() => setLogoError(true)}
                    onLoad={(e) => {
                      if ((e.target as HTMLImageElement).naturalWidth === 0) {
                        setLogoError(true);
                      }
                    }}
                  />
                ) : (
                  <div className="w-12 h-12 rounded-xl bg-dia-red flex items-center justify-center text-white font-bold text-xl shadow-lg">
                    D
                  </div>
                )}
              </div>
              <div>
                <h1 className="font-bold text-neutral-900 leading-tight">DIA_SAAS</h1>
                <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">Deutsch Institut</p>
              </div>
            </div>

            <nav className="space-y-1">
              {links.map((link) => (
                <NavLink
                  key={link.to}
                  to={link.to}
                  onClick={() => setIsOpen(false)}
                  className={({ isActive }) => cn(
                    "flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium",
                    isActive 
                      ? "bg-dia-red/5 text-dia-red" 
                      : "text-neutral-500 hover:bg-neutral-50 hover:text-neutral-900"
                  )}
                >
                  <link.icon size={20} />
                  <span>{link.label}</span>
                </NavLink>
              ))}
            </nav>
          </div>

          <div className="mt-auto p-6 border-t border-neutral-50">
            <div className="flex items-center gap-3 mb-6 p-2 rounded-2xl bg-neutral-50">
              <div className="w-10 h-10 rounded-xl bg-white border border-neutral-200 flex items-center justify-center text-sm font-bold text-neutral-700 shadow-sm">
                {profile?.firstName?.[0]}{profile?.lastName?.[0]}
              </div>
              <div className="overflow-hidden">
                <p className="text-sm font-bold text-neutral-900 truncate">{profile?.firstName} {profile?.lastName}</p>
                <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider truncate">{profile?.matricule}</p>
              </div>
            </div>
            <button 
              onClick={logout}
              className="flex items-center gap-3 w-full px-4 py-3 text-neutral-500 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all font-medium"
            >
              <LogOut size={20} />
              <span>Déconnexion</span>
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
