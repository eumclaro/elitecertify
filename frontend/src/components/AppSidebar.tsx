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
  Search,
  Send,
  CalendarDays,
  Medal,
} from "lucide-react"
import { Link, useLocation, useNavigate } from "react-router-dom"
import { useAuth } from "@/contexts/AuthContext"
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
];

const studentLinks = [
  { path: '/student/exams', label: 'Minhas Provas', icon: BookOpen },
  { path: '/student/profile', label: 'Meu Perfil', icon: UserCircle },
];

export function AppSidebar() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const isAdmin = user?.role === 'ADMIN';

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
    <Sidebar collapsible="icon" variant="sidebar">
      <SidebarHeader className="border-b border-sidebar-border h-16 flex items-center px-4">
        <Link to={isAdmin ? "/admin" : "/student/exams"} className="flex items-center gap-3 hover:opacity-80 transition-opacity">
          <div className="flex aspect-square size-9 items-center justify-center overflow-hidden rounded-lg">
            <img 
              src="/logotipo-elite-training.png" 
              alt="Elite Training Logo" 
              className="size-full object-contain" 
            />
          </div>
          <div className="flex flex-col gap-0.5 leading-none group-data-[collapsible=icon]:hidden">
            <span className="font-bold text-[15px] tracking-tight">ELT CERT</span>
            <span className="text-[9px] text-muted-foreground uppercase tracking-widest font-bold opacity-80">Portal {isAdmin ? 'Admin' : 'Aluno'}</span>
          </div>
        </Link>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <div className="px-2 py-4 group-data-[collapsible=icon]:hidden">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Buscar..."
                className="w-full bg-muted/50 rounded-md py-2 pl-9 pr-4 text-sm outline-none focus:ring-1 focus:ring-ring transition-all"
              />
            </div>
          </div>
          
          <SidebarGroupLabel className="group-data-[collapsible=icon]:hidden">
            {isAdmin ? 'Gestão de Certificação' : 'Área de Estudo'}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navLinks.map((link) => (
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
              ))}
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
