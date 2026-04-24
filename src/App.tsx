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
  const location = useLocation();
  
  return (
    <Routes location={location}>
      <Route path="/login" element={<LoginPage />} />
      
      {/* Admin Routes */}
      <Route path="/admin" element={
        <RoleGuard allowedRoles={['admin']}>
          <DashboardLayout>
            <AdminDashboard />
          </DashboardLayout>
        </RoleGuard>
      } />
      <Route path="/admin/students" element={
        <RoleGuard allowedRoles={['admin']}>
          <DashboardLayout>
            <StudentManagement />
          </DashboardLayout>
        </RoleGuard>
      } />
      <Route path="/admin/teachers" element={
        <RoleGuard allowedRoles={['admin']}>
          <DashboardLayout>
            <TeacherManagement />
          </DashboardLayout>
        </RoleGuard>
      } />
      <Route path="/admin/classes" element={
        <RoleGuard allowedRoles={['admin']}>
          <DashboardLayout>
            <ClassManagement />
          </DashboardLayout>
        </RoleGuard>
      } />
      <Route path="/admin/finances" element={
        <RoleGuard allowedRoles={['admin']}>
          <DashboardLayout>
            <FinanceManagement />
          </DashboardLayout>
        </RoleGuard>
      } />
      <Route path="/admin/library" element={
        <RoleGuard allowedRoles={['admin']}>
          <DashboardLayout>
            <LibraryManagement />
          </DashboardLayout>
        </RoleGuard>
      } />
      <Route path="/admin/levels" element={
        <RoleGuard allowedRoles={['admin']}>
          <DashboardLayout>
            <LevelManagement />
          </DashboardLayout>
        </RoleGuard>
      } />
      <Route path="/admin/communiques" element={
        <RoleGuard allowedRoles={['admin']}>
          <DashboardLayout>
            <CommuniqueManagement />
          </DashboardLayout>
        </RoleGuard>
      } />
      <Route path="/admin/admins" element={
        <RoleGuard allowedRoles={['admin']}>
          <DashboardLayout>
            <AdminManagement />
          </DashboardLayout>
        </RoleGuard>
      } />
      <Route path="/admin/evaluations" element={
        <RoleGuard allowedRoles={['admin']}>
          <DashboardLayout>
            <EvaluationManagement />
          </DashboardLayout>
        </RoleGuard>
      } />
      <Route path="/admin/profile" element={
        <RoleGuard allowedRoles={['admin']}>
          <DashboardLayout>
            <AdminProfile />
          </DashboardLayout>
        </RoleGuard>
      } />

      {/* Teacher Routes */}
      <Route path="/teacher" element={
        <RoleGuard allowedRoles={['teacher']}>
          <DashboardLayout>
            <TeacherDashboard />
          </DashboardLayout>
        </RoleGuard>
      } />
      <Route path="/teacher/planning" element={
        <RoleGuard allowedRoles={['teacher']}>
          <DashboardLayout>
            <TeacherPlanning />
          </DashboardLayout>
        </RoleGuard>
      } />
      <Route path="/teacher/students" element={
        <RoleGuard allowedRoles={['teacher']}>
          <DashboardLayout>
            <TeacherStudents />
          </DashboardLayout>
        </RoleGuard>
      } />
      <Route path="/teacher/library" element={
        <RoleGuard allowedRoles={['teacher', 'admin']}>
          <DashboardLayout>
            <LibraryManagement />
          </DashboardLayout>
        </RoleGuard>
      } />
      <Route path="/teacher/communiques" element={
        <RoleGuard allowedRoles={['teacher']}>
          <DashboardLayout>
            <CommuniqueManagement />
          </DashboardLayout>
        </RoleGuard>
      } />
      <Route path="/teacher/evaluations" element={
        <RoleGuard allowedRoles={['teacher']}>
          <DashboardLayout>
            <EvaluationManagement />
          </DashboardLayout>
        </RoleGuard>
      } />
      <Route path="/teacher/profile" element={
        <RoleGuard allowedRoles={['teacher']}>
          <DashboardLayout>
            <TeacherProfile />
          </DashboardLayout>
        </RoleGuard>
      } />

      {/* Student Routes */}
      <Route path="/student" element={
        <RoleGuard allowedRoles={['student']}>
          <DashboardLayout>
            <StudentDashboard />
          </DashboardLayout>
        </RoleGuard>
      } />
      <Route path="/student/calendar" element={
        <RoleGuard allowedRoles={['student']}>
          <DashboardLayout>
            <StudentCalendar />
          </DashboardLayout>
        </RoleGuard>
      } />
      <Route path="/student/library" element={
        <RoleGuard allowedRoles={['student', 'admin']}>
          <DashboardLayout>
            <LibraryManagement />
          </DashboardLayout>
        </RoleGuard>
      } />
      <Route path="/student/communiques" element={
        <RoleGuard allowedRoles={['student']}>
          <DashboardLayout>
            <CommuniqueManagement />
          </DashboardLayout>
        </RoleGuard>
      } />
      <Route path="/student/evaluations" element={
        <RoleGuard allowedRoles={['student']}>
          <DashboardLayout>
            <EvaluationManagement />
          </DashboardLayout>
        </RoleGuard>
      } />
      <Route path="/student/profile" element={
        <RoleGuard allowedRoles={['student']}>
          <DashboardLayout>
            <StudentProfile />
          </DashboardLayout>
        </RoleGuard>
      } />

      {/* Common Routes */}
      <Route path="/change-password" element={
        <RoleGuard allowedRoles={['admin', 'teacher', 'student']}>
          <Placeholder title="Changer le mot de passe" />
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
