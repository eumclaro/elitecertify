import { useState, type ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

interface LayoutProps {
  children: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const isAdmin = user?.role === 'ADMIN';

  const adminLinks = [
    { path: '/admin', label: 'Dashboard', icon: '📊' },
    { path: '/admin/students', label: 'Alunos', icon: '👥' },
    { path: '/admin/classes', label: 'Turmas', icon: '🏫' },
    { path: '/admin/exams', label: 'Provas', icon: '📝' },
    { path: '/admin/nps', label: 'NPS', icon: '📈' },
    { path: '/admin/reports', label: 'Relatórios', icon: '📋' },
    { path: '/admin/audit', label: 'Auditoria', icon: '🔒' },
    { path: '/admin/smtp', label: 'SMTP', icon: '📧' },
    { path: '/admin/emails', label: 'E-mails', icon: '📨' },
  ];

  const studentLinks = [
    { path: '/student/exams', label: 'Minhas Provas', icon: '📝' },
    { path: '/student/profile', label: 'Meu Perfil', icon: '👤' },
  ];

  const navLinks = isAdmin ? adminLinks : studentLinks;

  const isActive = (path: string) => {
    if (path === '/admin' || path === '/student/exams') return location.pathname === path;
    return location.pathname.startsWith(path);
  };

  return (
    <div className="layout">
      {sidebarOpen && <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />}

      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <div className="sidebar-logo">
            <img src="/logotipo-elite-training.png" alt="Elite Training" className="logo-img" />
          </div>
          <button className="sidebar-close" onClick={() => setSidebarOpen(false)}>✕</button>
        </div>

        <nav className="sidebar-nav">
          <div className="nav-section">
            <span className="nav-section-title">{isAdmin ? 'GESTÃO' : 'MINHA ÁREA'}</span>
            {navLinks.map(link => (
              <Link
                key={link.path}
                to={link.path}
                className={`nav-link ${isActive(link.path) ? 'active' : ''}`}
                onClick={() => setSidebarOpen(false)}
              >
                <span className="nav-icon">{link.icon}</span>
                {link.label}
              </Link>
            ))}
          </div>
        </nav>

        <div className="sidebar-footer">
          <div className="user-info">
            <div className="user-avatar">{user?.name?.charAt(0) || 'U'}</div>
            <div className="user-details">
              <span className="user-name">{user?.name}</span>
              <span className="user-role">{isAdmin ? 'Administrador' : 'Aluno'}</span>
            </div>
          </div>
          <button className="logout-btn" onClick={handleLogout}>Sair</button>
        </div>
      </aside>

      <main className="main-content">
        <header className="top-header">
          <button className="hamburger" onClick={() => setSidebarOpen(true)}>☰</button>
          <div className="header-right">
            <span className="header-user">Olá, {user?.name?.split(' ')[0]}</span>
          </div>
        </header>
        <div className="page-content">
          {children}
        </div>
      </main>
    </div>
  );
}
