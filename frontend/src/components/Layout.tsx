import { type ReactNode } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { AppSidebar } from './AppSidebar';
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";

interface LayoutProps {
  children: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const { user } = useAuth();

  return (
    <SidebarProvider defaultOpen={false} style={{ '--sidebar-width-icon': '4.5rem' } as React.CSSProperties}>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center justify-between gap-2 border-b px-4 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-10 transition-all duration-200">
          <div className="flex items-center gap-2">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mr-2 h-4" />
            <div className="flex flex-col">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Elite Certify</span>
              <span className="text-sm font-semibold truncate max-w-[200px] md:max-w-none">
                Olá, {user?.name?.split(' ')[0]}
              </span>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="hidden md:flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-xs">
              {user?.name?.charAt(0)}
            </div>
          </div>
        </header>
        
        <main className="flex flex-1 flex-col gap-4 p-4 md:p-6 lg:p-8 animate-in fade-in duration-500">
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
