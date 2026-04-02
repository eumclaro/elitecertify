import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'sonner';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import CreatePassword from './pages/CreatePassword';
import Dashboard from './pages/admin/Dashboard';
import Students from './pages/admin/Students';
import Exams from './pages/admin/Exams';
import ExamQuestions from './pages/admin/ExamQuestions';
import ExamReleases from './pages/admin/ExamReleases';
import Classes from './pages/admin/Classes';
import NpsSurveys from './pages/admin/NpsSurveys';
import Reports from './pages/admin/Reports';
import AuditLogs from './pages/admin/AuditLogs';
import SmtpSettings from './pages/admin/SmtpSettings';
import EmailManagement from './pages/admin/EmailManagement';
import Dispatches from './pages/admin/Dispatches';
import StudentExams from './pages/student/StudentExams';
import TakeExam from './pages/student/TakeExam';
import ExamResult from './pages/student/ExamResult';
import StudentDetail from './pages/admin/StudentDetail';
import StudentEventDetail from './pages/student/StudentEventDetail';
import Events from './pages/admin/Events';
import CertificateTemplates from './pages/admin/CertificateTemplates';
import StudentProfile from './pages/student/StudentProfile';
import StudentNps from './pages/student/StudentNps';
import ValidateCertificate from './pages/ValidateCertificate';
import TeamManagement from './pages/admin/TeamManagement';
import Profile from './pages/admin/Profile';
import ProtectedRoute from './components/ProtectedRoute';

function AppRoutes() {
  const { user, loading } = useAuth();
  if (loading) return <div className="page-loading"><div className="spinner"></div></div>;

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to={user.role === 'STUDENT' ? '/student/exams' : '/admin'} replace /> : <Login />} />
      <Route path="/forgot-password" element={user ? <Navigate to={user.role === 'STUDENT' ? '/student/exams' : '/admin'} replace /> : <ForgotPassword />} />
      <Route path="/reset-password" element={user ? <Navigate to={user.role === 'STUDENT' ? '/student/exams' : '/admin'} replace /> : <ResetPassword />} />
      <Route path="/criar-senha" element={user ? <Navigate to={user.role === 'STUDENT' ? '/student/exams' : '/admin'} replace /> : <CreatePassword />} />

      {/* Admin Routes */}
      <Route path="/admin" element={<ProtectedRoute><Layout><Dashboard /></Layout></ProtectedRoute>} />
      <Route path="/admin/profile" element={<ProtectedRoute><Layout><Profile /></Layout></ProtectedRoute>} />
      <Route path="/admin/team" element={<ProtectedRoute requiredPermission="canManageAdmins"><Layout><TeamManagement /></Layout></ProtectedRoute>} />
      
      <Route path="/admin/students" element={<ProtectedRoute><Layout><Students /></Layout></ProtectedRoute>} />
      <Route path="/admin/students/:id" element={<ProtectedRoute><Layout><StudentDetail /></Layout></ProtectedRoute>} />
      <Route path="/admin/classes" element={<ProtectedRoute><Layout><Classes /></Layout></ProtectedRoute>} />
      <Route path="/admin/exams" element={<ProtectedRoute><Layout><Exams /></Layout></ProtectedRoute>} />
      <Route path="/admin/exams/:examId/questions" element={<ProtectedRoute><Layout><ExamQuestions /></Layout></ProtectedRoute>} />
      <Route path="/admin/exams/:examId/releases" element={<ProtectedRoute><Layout><ExamReleases /></Layout></ProtectedRoute>} />
      <Route path="/admin/nps" element={<ProtectedRoute><Layout><NpsSurveys /></Layout></ProtectedRoute>} />
      <Route path="/admin/reports" element={<ProtectedRoute><Layout><Reports /></Layout></ProtectedRoute>} />
      <Route path="/admin/audit" element={<ProtectedRoute requiredPermission="canManageAdmins"><Layout><AuditLogs /></Layout></ProtectedRoute>} />
      <Route path="/admin/smtp" element={<ProtectedRoute requiredPermission="canManageSettings"><Layout><SmtpSettings /></Layout></ProtectedRoute>} />
      <Route path="/admin/emails" element={<ProtectedRoute requiredPermission="canManageSettings"><Layout><EmailManagement /></Layout></ProtectedRoute>} />
      <Route path="/admin/dispatches" element={<ProtectedRoute><Layout><Dispatches /></Layout></ProtectedRoute>} />
      <Route path="/admin/events" element={<ProtectedRoute requiredPermission="canManageMarketing"><Layout><Events /></Layout></ProtectedRoute>} />
      <Route path="/admin/certificate-templates" element={<ProtectedRoute requiredPermission="canManageSettings"><Layout><CertificateTemplates /></Layout></ProtectedRoute>} />

      {/* Student Routes */}
      <Route path="/student/exams" element={<ProtectedRoute><Layout><StudentExams /></Layout></ProtectedRoute>} />
      <Route path="/student/exam/:attemptId" element={<ProtectedRoute><TakeExam /></ProtectedRoute>} />
      <Route path="/student/result/:attemptId" element={<ProtectedRoute><Layout><ExamResult /></Layout></ProtectedRoute>} />
      <Route path="/student/profile" element={<ProtectedRoute><Layout><StudentProfile /></Layout></ProtectedRoute>} />
      <Route path="/student/nps/:id" element={<ProtectedRoute><StudentNps /></ProtectedRoute>} />
      <Route path="/student/event/:id" element={<ProtectedRoute><Layout><StudentEventDetail /></Layout></ProtectedRoute>} />
      <Route path="/validar/:code" element={<ValidateCertificate />} />

      {/* Default redirect */}
      <Route path="*" element={<Navigate to={user ? (user.role === 'STUDENT' ? '/student/exams' : '/admin') : '/login'} replace />} />
    </Routes>
  );
}

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient();

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <AppRoutes />
          <Toaster richColors closeButton position="top-right" />
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
