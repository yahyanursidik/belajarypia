import { useEffect, useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuthSession } from "../../app/providers/authSessionContext";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getDashboardPathForRole, type RoleCode } from "../../lib/auth";
import { appName } from "../../lib/constants";
import { useSystemSettings } from "../../lib/useSystemSettings";
import { getThemeStyles } from "../../lib/theme";
import { GraduationCap, Loader2, Users, BookOpen } from "lucide-react";

export type PortalType = "admin" | "teacher" | "learner";

type LoginPageProps = {
  portal: PortalType;
};

const portalConfig = {
  admin: {
    title: "Portal Admin & Staf",
    subtitle: "Sistem Manajemen Terpadu YPIA",
    Icon: Users,
    gradient: "from-[#0a1f1a] to-[#0d2a22]",
    iconBg: "bg-white/10",
    themeColor: "bg-[#0a1f1a]",
    allowedRoles: ["super_admin", "admin", "finance", "helpdesk", "content_reviewer"] as RoleCode[],
  },
  teacher: {
    title: "Portal Pengajar",
    subtitle: "Manajemen Kelas dan Pembelajaran",
    Icon: BookOpen,
    gradient: "from-[#0d2a22] to-[#122e25]",
    iconBg: "bg-white/10",
    themeColor: "bg-[#0d2a22]",
    allowedRoles: ["teacher", "mentor"] as RoleCode[],
  },
  learner: {
    title: "Portal Siswa",
    subtitle: "Akses Program dan Materi Belajar",
    Icon: GraduationCap,
    gradient: "from-[#0a1f1a] to-[#143d31]",
    iconBg: "bg-white/15",
    themeColor: "bg-[#0a1f1a]",
    allowedRoles: ["participant", "guardian"] as RoleCode[],
  },
};

export function LoginPage({ portal }: LoginPageProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { isLoading, session, primaryRole, signIn, signOut } = useAuthSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { settings } = useSystemSettings();
  const dashboardPath = getDashboardPathForRole(primaryRole);
  
  const config = portalConfig[portal];
  const Icon = config.Icon;

  const themeKey = settings?.portal_themes?.[portal];
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

  useEffect(() => {
    // If already logged in and it's valid for this portal, redirect to dashboard.
    // If logged in but NOT valid for this portal, we might want to log them out or redirect them.
    // For now, if they are logged in, we just push them to their valid dashboard.
    if (!isLoading && session) {
      navigate(dashboardPath, { replace: true });
    }
  }, [dashboardPath, isLoading, navigate, session]);

  if (!isLoading && session) {
    return <Navigate to={dashboardPath} replace />;
  }

  return (
    <div className="min-h-screen w-full flex flex-col lg:flex-row bg-background">
      {/* Left Column: Brand & Visuals */}
      <div className="hidden lg:flex flex-col flex-1 bg-primary text-primary-foreground p-12 lg:p-24 justify-between relative overflow-hidden">
        {/* Abstract background shapes */}
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
          <div className="absolute top-[-10%] left-[-10%] w-96 h-96 rounded-full bg-white/5 blur-3xl" />
          <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] rounded-full bg-white/10 blur-3xl" />
        </div>

        {/* Geometric Islamic pattern overlay */}
        <div className="absolute inset-0 pointer-events-none opacity-[0.03]" style={{
          backgroundImage: `
            repeating-linear-gradient(0deg, transparent, transparent 48px, rgba(255,255,255,0.5) 48px, rgba(255,255,255,0.5) 49px),
            repeating-linear-gradient(90deg, transparent, transparent 48px, rgba(255,255,255,0.5) 48px, rgba(255,255,255,0.5) 49px),
            repeating-linear-gradient(45deg, transparent, transparent 67px, rgba(255,255,255,0.3) 67px, rgba(255,255,255,0.3) 68px),
            repeating-linear-gradient(-45deg, transparent, transparent 67px, rgba(255,255,255,0.3) 67px, rgba(255,255,255,0.3) 68px)
          `
        }} />

        {/* Gold accent line at top */}
        <div className="absolute top-0 left-0 right-0 h-1" style={{
          background: 'linear-gradient(90deg, transparent, hsl(42 70% 55% / 0.7), transparent)'
        }} />

        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-12">
            <div className={`w-12 h-12 rounded-xl ${config.iconBg} flex items-center justify-center backdrop-blur-sm border border-white/20`}>
              <Icon className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-white">{config.title}</h1>
              <p className="text-white/80 text-sm font-medium">{settings?.institution_name || appName}</p>
            </div>
          </div>

          <div className="space-y-6 max-w-lg mt-16">
            <h2 className="text-4xl font-bold leading-tight text-white">
              {config.subtitle}
            </h2>
            <p className="text-lg text-white/80 leading-relaxed">
              Silakan login untuk mengakses fitur dan layanan sesuai dengan peran Anda di {settings?.institution_profile || "Yayasan Pendidikan Ihsanul Adab (YPIA)"}.
            </p>
          </div>
        </div>

        <div className="relative z-10 mt-auto pt-12">
          <p className="text-sm text-white/60">
            &copy; {new Date().getFullYear()} {settings?.institution_profile || "Yayasan Pendidikan Ihsanul Adab (YPIA)"}.
          </p>
        </div>
      </div>

      {/* Right Column: Login Form */}
      <div className="flex-1 flex flex-col justify-center items-center p-6 lg:p-12 relative">
        <div className="w-full max-w-md space-y-8">
          
          <div className="text-center lg:text-left space-y-2 mb-8">
            <div className="lg:hidden flex items-center justify-center gap-3 mb-6">
              <div className={`w-10 h-10 rounded-lg ${config.themeColor} flex items-center justify-center`}>
                <Icon className="w-6 h-6 text-white" />
              </div>
              <span className="text-xl font-bold text-foreground">{config.title}</span>
            </div>
            
            <h2 className="text-3xl font-bold tracking-tight text-foreground">Selamat Datang</h2>
            <p className="text-muted-foreground">
              Masukkan kredensial Anda untuk mengakses {config.title.toLowerCase()}.
            </p>
          </div>

          {errorMessage && (
            <Alert className="border-red-500/50 text-red-600 bg-red-50 animate-in fade-in slide-in-from-top-2">
              <AlertTitle>Gagal Masuk</AlertTitle>
              <AlertDescription className="text-red-600/80">{errorMessage}</AlertDescription>
            </Alert>
          )}

          <form
            className="space-y-6"
            onSubmit={async (event) => {
              event.preventDefault();
              setErrorMessage(null);
              setIsSubmitting(true);

              try {
                const nextState = await signIn(email, password);
                const userRoles = nextState.roles.map(r => r.code);
                
                // VALIDASI PORTAL: Cek apakah user punya role yang diizinkan untuk portal ini
                const hasAccessToPortal = config.allowedRoles.some(role => userRoles.includes(role));
                
                if (!hasAccessToPortal) {
                  await signOut();
                  throw new Error(`Akun Anda tidak memiliki akses ke ${config.title}. Silakan gunakan portal yang sesuai dengan peran Anda.`);
                }

                const from = location.state as { from?: string } | null;
                navigate(from?.from ?? getDashboardPathForRole(nextState.primaryRole), {
                  replace: true,
                });
              } catch (error) {
                setErrorMessage(
                  error instanceof Error
                    ? error.message
                    : "Login gagal. Periksa email dan kata sandi.",
                );
              } finally {
                setIsSubmitting(false);
              }
            }}
          >
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70" htmlFor="email">
                  Email
                </label>
                <Input
                  id="email"
                  autoComplete="email"
                  disabled={isSubmitting}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="nama@email.com"
                  required
                  type="email"
                  value={email}
                  className="h-12 bg-muted/50 border-muted-foreground/20 focus:bg-background transition-colors"
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70" htmlFor="password">
                    Kata Sandi
                  </label>
                </div>
                <Input
                  id="password"
                  autoComplete="current-password"
                  disabled={isSubmitting}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="••••••••"
                  required
                  type="password"
                  value={password}
                  className="h-12 bg-muted/50 border-muted-foreground/20 focus:bg-background transition-colors"
                />
              </div>
            </div>

            <Button 
              disabled={isSubmitting} 
              type="submit" 
              className="w-full h-12 text-base font-medium transition-all"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Memverifikasi...
                </>
              ) : (
                "Masuk"
              )}
            </Button>
            
            <div className="text-center text-sm text-muted-foreground mt-4">
              <p>Pastikan Anda berada di portal yang tepat.</p>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
