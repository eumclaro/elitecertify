import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'sonner';
import { AuthProvider, useAuth } from './contexts/AuthContext'; // Refresh trigger
import Layout from './components/Layout';
import Login from './pages/Login';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
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
import StudentProfile from './pages/student/StudentProfile';
import StudentNps from './pages/student/StudentNps';

function ProtectedRoute({ children, adminOnly = false }: { children: React.ReactNode; adminOnly?: boolean }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="page-loading"><div className="spinner"></div></div>;
  if (!user) return <Navigate to="/login" replace />;
  if (adminOnly && user.role !== 'ADMIN') return <Navigate to="/student/exams" replace />;
  return <>{children}</>;
}

function AppRoutes() {
  const { user, loading } = useAuth();
  if (loading) return <div className="page-loading"><div className="spinner"></div></div>;

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to={user.role === 'ADMIN' ? '/admin' : '/student/exams'} replace /> : <Login />} />
      <Route path="/forgot-password" element={user ? <Navigate to={user.role === 'ADMIN' ? '/admin' : '/student/exams'} replace /> : <ForgotPassword />} />
      <Route path="/reset-password" element={user ? <Navigate to={user.role === 'ADMIN' ? '/admin' : '/student/exams'} replace /> : <ResetPassword />} />

      {/* Admin Routes */}
      <Route path="/admin" element={<ProtectedRoute adminOnly><Layout><Dashboard /></Layout></ProtectedRoute>} />
      <Route path="/admin/students" element={<ProtectedRoute adminOnly><Layout><Students /></Layout></ProtectedRoute>} />
      <Route path="/admin/students/:id" element={<ProtectedRoute adminOnly><Layout><StudentDetail /></Layout></ProtectedRoute>} />
      <Route path="/admin/classes" element={<ProtectedRoute adminOnly><Layout><Classes /></Layout></ProtectedRoute>} />
      <Route path="/admin/exams" element={<ProtectedRoute adminOnly><Layout><Exams /></Layout></ProtectedRoute>} />
      <Route path="/admin/exams/:examId/questions" element={<ProtectedRoute adminOnly><Layout><ExamQuestions /></Layout></ProtectedRoute>} />
      <Route path="/admin/exams/:examId/releases" element={<ProtectedRoute adminOnly><Layout><ExamReleases /></Layout></ProtectedRoute>} />
      <Route path="/admin/nps" element={<ProtectedRoute adminOnly><Layout><NpsSurveys /></Layout></ProtectedRoute>} />
      <Route path="/admin/reports" element={<ProtectedRoute adminOnly><Layout><Reports /></Layout></ProtectedRoute>} />
      <Route path="/admin/audit" element={<ProtectedRoute adminOnly><Layout><AuditLogs /></Layout></ProtectedRoute>} />
      <Route path="/admin/smtp" element={<ProtectedRoute adminOnly><Layout><SmtpSettings /></Layout></ProtectedRoute>} />
      <Route path="/admin/emails" element={<ProtectedRoute adminOnly><Layout><EmailManagement /></Layout></ProtectedRoute>} />
      <Route path="/admin/dispatches" element={<ProtectedRoute adminOnly><Layout><Dispatches /></Layout></ProtectedRoute>} />
      <Route path="/admin/events" element={<ProtectedRoute adminOnly><Layout><Events /></Layout></ProtectedRoute>} />

      {/* Student Routes */}
      <Route path="/student/exams" element={<ProtectedRoute><Layout><StudentExams /></Layout></ProtectedRoute>} />
      <Route path="/student/exam/:attemptId" element={<ProtectedRoute><TakeExam /></ProtectedRoute>} />
      <Route path="/student/result/:attemptId" element={<ProtectedRoute><Layout><ExamResult /></Layout></ProtectedRoute>} />
      <Route path="/student/profile" element={<ProtectedRoute><Layout><StudentProfile /></Layout></ProtectedRoute>} />
      <Route path="/student/nps/:id" element={<ProtectedRoute><StudentNps /></ProtectedRoute>} />
      <Route path="/student/event/:id" element={<ProtectedRoute><Layout><StudentEventDetail /></Layout></ProtectedRoute>} />

      {/* Default redirect */}
      <Route path="*" element={<Navigate to={user ? (user.role === 'ADMIN' ? '/admin' : '/student/exams') : '/login'} replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
        <Toaster richColors closeButton position="top-right" />
      </AuthProvider>
    </BrowserRouter>
  );
}
