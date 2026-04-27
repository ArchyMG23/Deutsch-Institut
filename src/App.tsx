import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { DataProvider } from './context/DataContext';
import { ThemeProvider } from './context/ThemeContext';
import { RoleGuard } from './components/RoleGuard';
import { DashboardLayout } from './components/DashboardLayout';
import LoginPage from './pages/LoginPage';
import { Toaster } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';
import CookieConsent from './components/CookieConsent';

// Lazy load pages for better performance
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'));
const StudentManagement = lazy(() => import('./pages/StudentManagement'));
const TeacherManagement = lazy(() => import('./pages/TeacherManagement'));
const ClassManagement = lazy(() => import('./pages/ClassManagement'));
const FinanceManagement = lazy(() => import('./pages/FinanceManagement'));
const LibraryManagement = lazy(() => import('./pages/LibraryManagement'));
const LevelManagement = lazy(() => import('./pages/LevelManagement'));
const CommuniqueManagement = lazy(() => import('./pages/CommuniqueManagement'));
const AdminManagement = lazy(() => import('./pages/AdminManagement'));
const AdminProfile = lazy(() => import('./pages/AdminProfile'));
const EvaluationManagement = lazy(() => import('./pages/EvaluationManagement'));
const StudentDashboard = lazy(() => import('./pages/StudentDashboard'));
const StudentCalendar = lazy(() => import('./pages/StudentCalendar'));
const StudentProfile = lazy(() => import('./pages/StudentProfile'));
const TeacherDashboard = lazy(() => import('./pages/TeacherDashboard'));
const TeacherPlanning = lazy(() => import('./pages/TeacherPlanning'));
const TeacherStudents = lazy(() => import('./pages/TeacherStudents'));
const TeacherProfile = lazy(() => import('./pages/TeacherProfile'));

// Placeholder components for other pages
const Placeholder = ({ title }: { title: string }) => (
  <div className="flex items-center justify-center h-full">
    <div className="text-center">
      <h2 className="text-2xl font-bold mb-2">{title}</h2>
      <p className="text-neutral-500">Cette page est en cours de développement.</p>
    </div>
  </div>
);

const PageWrapper = ({ children }: { children: React.ReactNode }) => (
  <motion.div
    initial={{ opacity: 0, y: 5 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -5 }}
    transition={{ duration: 0.15, ease: "easeOut" }}
    className="h-full"
  >
    {children}
  </motion.div>
);

function AnimatedRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      
      {/* Admin Routes */}
      <Route path="/admin" element={
        <RoleGuard allowedRoles={['admin']}>
          <DashboardLayout>
            <PageWrapper><AdminDashboard /></PageWrapper>
          </DashboardLayout>
        </RoleGuard>
      } />
      <Route path="/admin/students" element={
        <RoleGuard allowedRoles={['admin']}>
          <DashboardLayout>
            <PageWrapper><StudentManagement /></PageWrapper>
          </DashboardLayout>
        </RoleGuard>
      } />
      <Route path="/admin/teachers" element={
        <RoleGuard allowedRoles={['admin']}>
          <DashboardLayout>
            <PageWrapper><TeacherManagement /></PageWrapper>
          </DashboardLayout>
        </RoleGuard>
      } />
      <Route path="/admin/classes" element={
        <RoleGuard allowedRoles={['admin']}>
          <DashboardLayout>
            <PageWrapper><ClassManagement /></PageWrapper>
          </DashboardLayout>
        </RoleGuard>
      } />
      <Route path="/admin/finances" element={
        <RoleGuard allowedRoles={['admin']}>
          <DashboardLayout>
            <PageWrapper><FinanceManagement /></PageWrapper>
          </DashboardLayout>
        </RoleGuard>
      } />
      <Route path="/admin/library" element={
        <RoleGuard allowedRoles={['admin']}>
          <DashboardLayout>
            <PageWrapper><LibraryManagement /></PageWrapper>
          </DashboardLayout>
        </RoleGuard>
      } />
      <Route path="/admin/levels" element={
        <RoleGuard allowedRoles={['admin']}>
          <DashboardLayout>
            <PageWrapper><LevelManagement /></PageWrapper>
          </DashboardLayout>
        </RoleGuard>
      } />
      <Route path="/admin/communiques" element={
        <RoleGuard allowedRoles={['admin']}>
          <DashboardLayout>
            <PageWrapper><CommuniqueManagement /></PageWrapper>
          </DashboardLayout>
        </RoleGuard>
      } />
      <Route path="/admin/admins" element={
        <RoleGuard allowedRoles={['admin']}>
          <DashboardLayout>
            <PageWrapper><AdminManagement /></PageWrapper>
          </DashboardLayout>
        </RoleGuard>
      } />
      <Route path="/admin/evaluations" element={
        <RoleGuard allowedRoles={['admin']}>
          <DashboardLayout>
            <PageWrapper><EvaluationManagement /></PageWrapper>
          </DashboardLayout>
        </RoleGuard>
      } />
      <Route path="/admin/profile" element={
        <RoleGuard allowedRoles={['admin']}>
          <DashboardLayout>
            <PageWrapper><AdminProfile /></PageWrapper>
          </DashboardLayout>
        </RoleGuard>
      } />

      {/* Teacher Routes */}
      <Route path="/teacher" element={
        <RoleGuard allowedRoles={['teacher']}>
          <DashboardLayout>
            <PageWrapper><TeacherDashboard /></PageWrapper>
          </DashboardLayout>
        </RoleGuard>
      } />
      <Route path="/teacher/planning" element={
        <RoleGuard allowedRoles={['teacher']}>
          <DashboardLayout>
            <PageWrapper><TeacherPlanning /></PageWrapper>
          </DashboardLayout>
        </RoleGuard>
      } />
      <Route path="/teacher/students" element={
        <RoleGuard allowedRoles={['teacher']}>
          <DashboardLayout>
            <PageWrapper><TeacherStudents /></PageWrapper>
          </DashboardLayout>
        </RoleGuard>
      } />
      <Route path="/teacher/library" element={
        <RoleGuard allowedRoles={['teacher', 'admin']}>
          <DashboardLayout>
            <PageWrapper><LibraryManagement /></PageWrapper>
          </DashboardLayout>
        </RoleGuard>
      } />
      <Route path="/teacher/communiques" element={
        <RoleGuard allowedRoles={['teacher']}>
          <DashboardLayout>
            <PageWrapper><CommuniqueManagement /></PageWrapper>
          </DashboardLayout>
        </RoleGuard>
      } />
      <Route path="/teacher/evaluations" element={
        <RoleGuard allowedRoles={['teacher']}>
          <DashboardLayout>
            <PageWrapper><EvaluationManagement /></PageWrapper>
          </DashboardLayout>
        </RoleGuard>
      } />
      <Route path="/teacher/profile" element={
        <RoleGuard allowedRoles={['teacher']}>
          <DashboardLayout>
            <PageWrapper><TeacherProfile /></PageWrapper>
          </DashboardLayout>
        </RoleGuard>
      } />

      {/* Student Routes */}
      <Route path="/student" element={
        <RoleGuard allowedRoles={['student']}>
          <DashboardLayout>
            <PageWrapper><StudentDashboard /></PageWrapper>
          </DashboardLayout>
        </RoleGuard>
      } />
      <Route path="/student/calendar" element={
        <RoleGuard allowedRoles={['student']}>
          <DashboardLayout>
            <PageWrapper><StudentCalendar /></PageWrapper>
          </DashboardLayout>
        </RoleGuard>
      } />
      <Route path="/student/library" element={
        <RoleGuard allowedRoles={['student', 'admin']}>
          <DashboardLayout>
            <PageWrapper><LibraryManagement /></PageWrapper>
          </DashboardLayout>
        </RoleGuard>
      } />
      <Route path="/student/communiques" element={
        <RoleGuard allowedRoles={['student']}>
          <DashboardLayout>
            <PageWrapper><CommuniqueManagement /></PageWrapper>
          </DashboardLayout>
        </RoleGuard>
      } />
      <Route path="/student/evaluations" element={
        <RoleGuard allowedRoles={['student']}>
          <DashboardLayout>
            <PageWrapper><EvaluationManagement /></PageWrapper>
          </DashboardLayout>
        </RoleGuard>
      } />
      <Route path="/student/profile" element={
        <RoleGuard allowedRoles={['student']}>
          <DashboardLayout>
            <PageWrapper><StudentProfile /></PageWrapper>
          </DashboardLayout>
        </RoleGuard>
      } />

      {/* Common Routes */}
      <Route path="/change-password" element={
        <RoleGuard allowedRoles={['admin', 'teacher', 'student']}>
          <PageWrapper><Placeholder title="Changer le mot de passe" /></PageWrapper>
        </RoleGuard>
      } />
        
        <Route path="/unauthorized" element={
          <div className="flex items-center justify-center min-h-screen p-4">
            <div className="text-center">
              <h1 className="text-6xl font-bold text-dia-red mb-4">403</h1>
              <h2 className="text-2xl font-bold mb-4">Accès Non Autorisé</h2>
              <p className="text-neutral-500 mb-8">Vous n'avez pas les permissions nécessaires pour accéder à cette page.</p>
              <button onClick={() => window.history.back()} className="btn-primary">Retour</button>
            </div>
          </div>
        } />

        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <DataProvider>
          <Toaster position="top-right" richColors visibleToasts={3} expand={true} duration={3000} closeButton />
          <Router>
            <CookieConsent />
            <Suspense fallback={
              <div className="flex items-center justify-center min-h-screen">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-dia-red"></div>
              </div>
            }>
              <AnimatedRoutes />
            </Suspense>
          </Router>
        </DataProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
