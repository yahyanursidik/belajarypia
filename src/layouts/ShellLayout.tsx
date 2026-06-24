import { BookOpen, GraduationCap, Settings, User, Users, Bell, LogOut } from "lucide-react";
import type { ComponentType, PropsWithChildren } from "react";
import { Suspense } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuthSession } from "../app/providers/authSessionContext";
import { Button } from "../components/ui/button";
import { appName } from "../lib/constants";
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

const ContentFallback = () => (
  <div className="flex h-[50vh] w-full items-center justify-center text-muted-foreground">
    <div className="flex flex-col items-center gap-3">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-r-transparent"></div>
      <p className="text-sm">Memuat halaman...</p>
    </div>
  </div>
);

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
  const BrandIcon = iconByVariant[variant];
  const displayName = profile?.full_name ?? profile?.email ?? "Pengguna";
  
  // Get initials for avatar
  const initials = displayName
    .split(' ')
    .map(n => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <div className={`app-shell app-shell-${variant}`}>
      <aside className="app-shell__sider">
        <Link to="/" className="app-shell__brand" aria-label={appName}>
          <span className="app-shell__brand-icon">
            <BrandIcon className="h-6 w-6 text-white" />
          </span>
          <span className="min-w-0">
            <span className="app-shell__brand-title">{appName}</span>
            <span className="app-shell__brand-subtitle">
              Yayasan Pendidikan Islam Asy-Syukriyyah
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
      <div className="app-shell__main">
        <header className="app-shell__header">
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
              <div className="flex items-center gap-3">
                <div className="hidden md:block text-right">
                  <p className="text-sm font-semibold">{displayName}</p>
                  <p className="text-xs text-muted-foreground capitalize">{primaryRole.replace('_', ' ')}</p>
                </div>
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold border border-primary/20">
                  {initials}
                </div>
              </div>
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
        <main className="app-shell__content">
          <Suspense fallback={<ContentFallback />}>
            {children}
          </Suspense>
        </main>
      </div>
    </div>
  );
}
