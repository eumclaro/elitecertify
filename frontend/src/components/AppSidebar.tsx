import { 
  LayoutDashboard, 
  Users, 
  School, 
  BookOpen, 
  BarChart3, 
  ClipboardList, 
  Lock, 
  Mail, 
  Settings, 
  UserCircle,
  LogOut,
  ChevronUp,
  Send,
  CalendarDays,
  Medal,
  ShieldCheck,
} from "lucide-react"
import { Link, useLocation, useNavigate } from "react-router-dom"
import { useAuth } from "@/contexts/AuthContext"
import { usePermission } from "@/hooks/usePermission"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
} from "@/components/ui/sidebar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

const adminLinks = [
  { path: '/admin', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/admin/students', label: 'Alunos', icon: Users },
  { path: '/admin/classes', label: 'Turmas', icon: School },
  { path: '/admin/exams', label: 'Provas', icon: BookOpen },
  { path: '/admin/nps', label: 'NPS', icon: BarChart3 },
  { path: '/admin/reports', label: 'Relatórios', icon: ClipboardList },
  { path: '/admin/audit', label: 'Auditoria', icon: Lock },
  { path: '/admin/certificate-templates', label: 'Templates de Certificado', icon: Medal },
  { path: '/admin/smtp', label: 'Settings', icon: Settings },
  { path: '/admin/emails', label: 'Templates de E-mail', icon: Mail },
  { path: '/admin/dispatches', label: 'Disparos', icon: Send },
  { path: '/admin/events', label: 'Marketing Hub', icon: CalendarDays },
  { path: '/admin/team', label: 'Equipe', icon: ShieldCheck },
];

const studentLinks = [
  { path: '/student/exams', label: 'Minhas Provas', icon: BookOpen },
  { path: '/student/profile', label: 'Meu Perfil', icon: UserCircle },
];

export function AppSidebar() {
  const { user, logout } = useAuth();
  const { hasPermission } = usePermission();
  const location = useLocation();
  const navigate = useNavigate();

  const isAdmin = user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN' || user?.role === 'VIEWER';

  const navLinks = isAdmin ? adminLinks : studentLinks;

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const isActive = (path: string) => {
    if (path === '/admin' || path === '/student/exams') return location.pathname === path;
    return location.pathname.startsWith(path);
  };

  return (
    <Sidebar 
      collapsible="icon" 
      variant="sidebar"
      className="transition-all duration-300"
    >
      <SidebarHeader className="border-b border-sidebar-border h-20 flex items-center justify-center px-2 overflow-hidden">
        <Link to={isAdmin ? "/admin" : "/student/exams"} className="flex flex-col items-center group-data-[state=expanded]:items-start justify-center h-full w-full hover:opacity-80 transition-all flex-shrink-0 group-data-[state=expanded]:px-3">
          <img 
            src="/logotipo-elite-black.png" 
            alt="Elite Logo" 
            className="w-auto h-8 group-data-[state=expanded]:h-10 transition-all duration-300 object-contain mx-auto group-data-[state=expanded]:mx-0" 
          />
          <span className="text-[10px] leading-tight text-muted-foreground uppercase tracking-widest font-bold opacity-80 mt-1.5 whitespace-nowrap group-data-[state=collapsed]:hidden transition-opacity">
            Portal {isAdmin ? 'Admin' : 'Aluno'}
          </span>
        </Link>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>          
          <SidebarGroupLabel className="group-data-[collapsible=icon]:hidden">
            {isAdmin ? 'Gestão de Certificação' : 'Área de Estudo'}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navLinks.map((link) => {
                // Permission-based visibility
                if (link.path === '/admin/team' && !hasPermission('canManageAdmins')) return null;
                if (link.path === '/admin/audit' && !hasPermission('canManageAdmins')) return null;
                if (link.path === '/admin/smtp' && !hasPermission('canManageSettings')) return null;
                if (link.path === '/admin/emails' && !hasPermission('canManageSettings')) return null;
                if (link.path === '/admin/certificate-templates' && !hasPermission('canManageSettings')) return null;
                if (link.path === '/admin/events' && !hasPermission('canManageMarketing')) return null;

                return (
                  <SidebarMenuItem key={link.path}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive(link.path)}
                      tooltip={link.label}
                    >
                      <Link to={link.path}>
                        <link.icon className="size-4" />
                        <span>{link.label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton
                  size="lg"
                  className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                >
                  <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-chart-1/10 text-chart-1">
                    <span className="text-xs font-bold">{user?.name?.charAt(0) || 'U'}</span>
                  </div>
                  <div className="grid flex-1 text-left text-sm leading-tight group-data-[collapsible=icon]:hidden">
                    <span className="truncate font-semibold">{user?.name}</span>
                    <span className="truncate text-xs text-muted-foreground">{isAdmin ? 'Administrador' : 'Aluno'}</span>
                  </div>
                  <ChevronUp className="ml-auto size-4 group-data-[collapsible=icon]:hidden" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                side="top"
                className="w-[--radix-popper-anchor-width]"
              >
                <DropdownMenuItem onClick={() => navigate(isAdmin ? '/admin/profile' : '/student/profile')}>
                  <UserCircle className="mr-2 size-4" />
                  <span>Perfil</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:text-destructive">
                  <LogOut className="mr-2 size-4" />
                  <span>Sair</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
}
