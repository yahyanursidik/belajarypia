import { BookOpen, GraduationCap, Settings, User, Users, Bell, LogOut } from "lucide-react";
import type { ComponentType, PropsWithChildren } from "react";
import { Suspense, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuthSession } from "../app/providers/authSessionContext";
import { Button } from "../components/ui/button";
import { FullPageLoader } from "../components/ui/full-page-loader";
import { appName } from "../lib/constants";
import { getThemeStyles } from "../lib/theme";
import { useSystemSettings } from "../lib/useSystemSettings";
import { cn } from "../lib/utils";

type ShellLayoutProps = PropsWithChildren<{
  title: string;
  subtitle: string;
  variant: "public" | "learner" | "teacher" | "admin" | "superadmin";
  menuItems: Array<{
    href: string;
    label: string;
    icon: ComponentType<{ className?: string }>;
  }>;
}>;

const iconByVariant = {
  public: BookOpen,
  learner: GraduationCap,
  teacher: User,
  admin: Users,
  superadmin: Settings,
} as const;

const ContentFallback = () => <FullPageLoader message="Memuat antarmuka..." />;

export function ShellLayout({
  children,
  title,
  subtitle,
  variant,
  menuItems,
}: ShellLayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { profile, primaryRole, signOut } = useAuthSession();
  const { settings } = useSystemSettings();
  const BrandIcon = iconByVariant[variant];
  const displayName = profile?.full_name ?? profile?.email ?? "Pengguna";
  
  // Get initials for avatar
  const initials = displayName
    .split(' ')
    .map(n => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const themeKey = settings?.portal_themes?.[variant === "superadmin" ? "admin" : variant];
  const themeStyles = getThemeStyles(themeKey);

  useEffect(() => {
    if (Object.keys(themeStyles).length === 0) return;
    const root = document.documentElement;
    Object.entries(themeStyles).forEach(([key, value]) => {
      root.style.setProperty(key, value as string);
    });
    
    return () => {
      Object.keys(themeStyles).forEach((key) => {
        root.style.removeProperty(key);
      });
    };
  }, [themeStyles]);

  return (
    <div className={`app-shell app-shell-${variant}`}>
      <aside className={cn("app-shell__sider print:hidden", variant === "learner" && "!hidden md:!flex")}>
        <Link to="/" className="app-shell__brand" aria-label={appName}>
          <span className="app-shell__brand-icon">
            <BrandIcon className="h-6 w-6 text-white" />
          </span>
          <span className="min-w-0">
            <span className="app-shell__brand-title">{settings?.institution_name || appName}</span>
            <span className="app-shell__brand-subtitle">
              {settings?.institution_profile || "Yayasan Pendidikan Ihsanul Adab (YPIA)"}
            </span>
          </span>
        </Link>
        <nav className="app-shell__menu" aria-label="Navigasi utama">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              item.href === "/"
                ? location.pathname === item.href
                : location.pathname.startsWith(item.href);

            return (
              <Link
                key={item.href}
                to={item.href}
                className={cn("app-shell__menu-item", isActive && "is-active")}
              >
                <Icon className="h-4 w-4 opacity-80" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </aside>
      <div className="app-shell__main print:w-full print:m-0 print:p-0">
        <header className={cn("app-shell__header print:hidden", variant === "learner" && "!hidden md:!flex")}>
          <div>
            <h1 className="app-shell__title">{title}</h1>
            <p className="app-shell__subtitle">{subtitle}</p>
          </div>
          {primaryRole ? (
            <div className="app-shell__account">
              <Button variant="ghost" className="h-10 w-10 rounded-full p-0 text-muted-foreground hover:text-foreground">
                <Bell className="h-5 w-5" />
              </Button>
              <div className="h-8 w-[1px] bg-border mx-2"></div>
              <Link 
                to={variant === 'superadmin' ? '/system/profil' : variant === 'admin' ? '/admin/profil' : variant === 'teacher' ? '/teacher/konten' : '/learner'}
                className="flex items-center gap-3 hover:bg-slate-100/80 p-1 pr-3 -ml-1 rounded-full transition-all cursor-pointer"
                title="Pengaturan Profil Saya"
              >
                <div className="hidden md:block text-right">
                  <p className="text-sm font-semibold">{displayName}</p>
                  <p className="text-xs text-muted-foreground capitalize">{primaryRole.replace('_', ' ')}</p>
                </div>
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold border border-primary/20 shadow-sm">
                  {initials}
                </div>
              </Link>
              <Button
                variant="outline"
                size="sm"
                className="ml-2 rounded-full border-border hover:bg-destructive hover:text-destructive-foreground hover:border-destructive transition-colors"
                onClick={async () => {
                  await signOut();
                  let loginPath = "/learner/login";
                  if (variant === "admin" || variant === "superadmin") loginPath = "/admin/login";
                  else if (variant === "teacher") loginPath = "/teacher/login";
                  navigate(loginPath, { replace: true });
                }}
                title="Keluar"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          ) : null}
        </header>
        <main className="app-shell__content print:p-0 print:m-0 print:block">
          <Suspense fallback={<ContentFallback />}>
            {children}
          </Suspense>
        </main>
        
        <footer className="mt-auto py-6 text-center text-sm text-slate-500 border-t border-slate-200 print:hidden w-full bg-slate-50/50">
          <p>
            Disusun dan dikembangkan oleh{' '}
            <a href="https://yahyanursidik.my.id/" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline font-semibold transition-colors">
              Yahya Nursidik
            </a>
          </p>
        </footer>
      </div>
      
      {/* Mobile Bottom Navigation (Learner Only) */}
      {variant === 'learner' && (
        <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 z-50 flex items-center justify-around pb-safe h-16 shadow-[0_-4px_20px_-10px_rgba(0,0,0,0.1)]">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              item.href === "/"
                ? location.pathname === item.href
                : location.pathname.startsWith(item.href);

            return (
              <Link
                key={item.href}
                to={item.href}
                className={cn(
                  "flex flex-col items-center justify-center w-full h-full gap-0.5 transition-colors",
                  isActive ? "text-primary" : "text-slate-400 hover:text-slate-800"
                )}
              >
                <div className={cn(
                  "p-1 rounded-full transition-all flex items-center justify-center", 
                  isActive ? "bg-primary/10 text-primary" : "text-slate-400"
                )}>
                  <Icon className="h-5 w-5" />
                </div>
                <span className={cn(
                  "text-[11px] leading-tight", 
                  isActive ? "text-primary font-bold" : "text-slate-500 font-medium"
                )}>
                  {item.label.replace(' Saya', '')}
                </span>
              </Link>
            );
          })}
        </nav>
      )}
    </div>
  );
}
