import {
  BookOpen,
  BriefcaseBusiness,
  ChevronDown,
  ChevronRight,
  Compass,
  GraduationCap,
  HeartHandshake,
  LogOut,
  Menu,
  MoreHorizontal,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  Settings,
  X,
} from "lucide-react";
import type { ComponentType, PropsWithChildren } from "react";
import { Suspense, useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuthSession } from "../app/providers/authSessionContext";
import { Button } from "../components/ui/button";
import { FullPageLoader } from "../components/ui/full-page-loader";
import { appName } from "../lib/constants";
import type { AppNavItem } from "../lib/navigation";
import { getThemeStyles } from "../lib/theme";
import { useSystemSettings } from "../lib/useSystemSettings";
import { cn } from "../lib/utils";

type ShellVariant = "public" | "learner" | "teacher" | "mentor" | "admin" | "superadmin";

type ShellLayoutProps = PropsWithChildren<{
  title: string;
  subtitle: string;
  variant: ShellVariant;
  menuItems: AppNavItem[];
}>;

type SidebarNavigationProps = {
  collapsed?: boolean;
  locationPath: string;
  locationSearch: string;
  menuItems: AppNavItem[];
  onNavigate?: () => void;
  storageKey: string;
};

const iconByVariant: Record<ShellVariant, ComponentType<{ className?: string }>> = {
  public: BookOpen,
  learner: GraduationCap,
  teacher: Compass,
  mentor: HeartHandshake,
  admin: BriefcaseBusiness,
  superadmin: Settings,
};

const homeByVariant: Record<ShellVariant, string> = {
  public: "/",
  learner: "/learner",
  teacher: "/teacher",
  mentor: "/teacher",
  admin: "/admin",
  superadmin: "/system",
};

const portalIdentityByVariant: Record<ShellVariant, {
  eyebrow: string;
  shortLabel: string;
}> = {
  public: { eyebrow: "Informasi YPIA", shortLabel: "Portal Publik" },
  learner: { eyebrow: "Ruang Tumbuh", shortLabel: "Portal Peserta" },
  teacher: { eyebrow: "Ruang Mengajar", shortLabel: "Portal Pengajar" },
  mentor: { eyebrow: "Ruang Pendampingan", shortLabel: "Portal Musyrif" },
  admin: { eyebrow: "Pusat Operasional", shortLabel: "Portal Admin" },
  superadmin: { eyebrow: "Tata Kelola Global", shortLabel: "Super Admin" },
};

const ContentFallback = () => <FullPageLoader message="Memuat antarmuka..." />;

function readStoredList(key: string) {
  try {
    const stored = JSON.parse(localStorage.getItem(key) ?? "[]");
    return Array.isArray(stored) ? stored.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function isHrefActive(pathname: string, search: string, href: string, includeNested = true) {
  const [targetPath, targetQuery = ""] = href.split("?");
  const isPortalRoot = Object.values(homeByVariant).includes(targetPath);
  const pathMatches = targetPath === "/"
    ? pathname === targetPath
    : pathname === targetPath || (includeNested && !isPortalRoot && pathname.startsWith(`${targetPath}/`));

  if (!pathMatches) return false;
  if (!targetQuery) return true;

  const currentParams = new URLSearchParams(search);
  const targetParams = new URLSearchParams(targetQuery);
  return Array.from(targetParams.entries()).every(([key, value]) => currentParams.get(key) === value);
}

function isNavigationItemActive(pathname: string, search: string, item: AppNavItem) {
  if (isHrefActive(pathname, search, item.href)) return true;

  return item.activePathPrefixes?.some((prefix) =>
    pathname === prefix || pathname.startsWith(`${prefix}/`),
  ) ?? false;
}

function SidebarNavigation({
  collapsed = false,
  locationPath,
  locationSearch,
  menuItems,
  onNavigate,
  storageKey,
}: SidebarNavigationProps) {
  const [query, setQuery] = useState("");
  const [closedGroups, setClosedGroups] = useState<Set<string>>(
    () => new Set(readStoredList(`${storageKey}-closed-groups`)),
  );
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  const activeItem = useMemo(
    () => menuItems
      .filter((item) => isNavigationItemActive(locationPath, locationSearch, item))
      .sort((first, second) => second.href.split("?")[0].length - first.href.split("?")[0].length)[0],
    [locationPath, locationSearch, menuItems],
  );

  useEffect(() => {
    localStorage.setItem(`${storageKey}-closed-groups`, JSON.stringify(Array.from(closedGroups)));
  }, [closedGroups, storageKey]);

  useEffect(() => {
    if (!activeItem) return;
    setClosedGroups((current) => {
      if (!current.has(activeItem.group)) return current;
      const next = new Set(current);
      next.delete(activeItem.group);
      return next;
    });
  }, [activeItem]);

  const filteredItems = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return menuItems;

    return menuItems.flatMap((item) => {
      const itemText = [item.label, item.description, item.group, ...(item.keywords ?? [])]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      const matchingChildren = item.children?.filter((child) =>
        [child.label, child.description].filter(Boolean).join(" ").toLowerCase().includes(normalizedQuery),
      );

      if (itemText.includes(normalizedQuery)) return [item];
      if (matchingChildren?.length) return [{ ...item, children: matchingChildren }];
      return [];
    });
  }, [menuItems, query]);

  const groupedItems = useMemo(() => {
    const groups = new Map<string, AppNavItem[]>();
    filteredItems.forEach((item) => groups.set(item.group, [...(groups.get(item.group) ?? []), item]));
    return Array.from(groups.entries());
  }, [filteredItems]);

  const toggleGroup = (group: string) => {
    setClosedGroups((current) => {
      const next = new Set(current);
      if (next.has(group)) next.delete(group);
      else next.add(group);
      return next;
    });
  };

  const toggleItem = (href: string) => {
    setExpandedItems((current) => {
      const next = new Set(current);
      if (next.has(href)) next.delete(href);
      else next.add(href);
      return next;
    });
  };

  return (
    <div className="app-shell__navigation-body">
      {!collapsed && menuItems.length > 6 ? (
        <label className="app-shell__menu-search">
          <Search className="h-4 w-4" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Cari menu..."
            aria-label="Cari menu navigasi"
          />
          {query ? (
            <button type="button" onClick={() => setQuery("")} aria-label="Hapus pencarian">
              <X className="h-3.5 w-3.5" />
            </button>
          ) : null}
        </label>
      ) : null}

      <nav className="app-shell__menu" aria-label="Navigasi utama">
        {groupedItems.map(([group, items]) => {
          const hasActiveItem = items.some((item) => isNavigationItemActive(locationPath, locationSearch, item));
          const isGroupOpen = Boolean(query) || !closedGroups.has(group);

          return (
            <section key={group} className={cn("app-shell__menu-group", hasActiveItem && "has-active-item")}>
              {!collapsed ? (
                <button
                  type="button"
                  className="app-shell__menu-group-button"
                  onClick={() => toggleGroup(group)}
                  aria-expanded={isGroupOpen}
                >
                  <span>{group}</span>
                  {isGroupOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                </button>
              ) : null}

              {(collapsed || isGroupOpen) ? (
                <div className="app-shell__menu-group-items">
                  {items.map((item) => {
                    const Icon = item.icon;
                    const isActive = isNavigationItemActive(locationPath, locationSearch, item);
                    const hasChildren = Boolean(item.children?.length);
                    const showChildren = !collapsed && hasChildren && (Boolean(query) || isActive || expandedItems.has(item.href));

                    return (
                      <div key={item.href} className="app-shell__menu-entry">
                        <div className="app-shell__menu-row">
                          <Link
                            to={item.href}
                            title={collapsed ? `${item.label}${item.description ? ` - ${item.description}` : ""}` : undefined}
                            className={cn("app-shell__menu-item", isActive && "is-active")}
                            onClick={onNavigate}
                          >
                            <Icon className="app-shell__menu-icon h-4 w-4" />
                            <span className="app-shell__menu-copy">
                              <span className="app-shell__menu-label">{item.label}</span>
                              {item.description ? <span className="app-shell__menu-description">{item.description}</span> : null}
                            </span>
                          </Link>
                          {!collapsed && hasChildren ? (
                            <button
                              type="button"
                              className="app-shell__submenu-toggle"
                              onClick={() => toggleItem(item.href)}
                              aria-label={`${showChildren ? "Tutup" : "Buka"} submenu ${item.label}`}
                              aria-expanded={showChildren}
                            >
                              {showChildren ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                            </button>
                          ) : null}
                        </div>

                        {showChildren ? (
                          <div className="app-shell__submenu">
                            {item.children?.map((child) => {
                              const isChildActive = isHrefActive(locationPath, locationSearch, child.href, false);
                              return (
                                <Link
                                  key={child.href}
                                  to={child.href}
                                  className={cn("app-shell__submenu-item", isChildActive && "is-active")}
                                  onClick={onNavigate}
                                >
                                  <span className="app-shell__submenu-dot" />
                                  <span className="min-w-0">
                                    <span className="app-shell__submenu-label">{child.label}</span>
                                    {child.description ? <span className="app-shell__submenu-description">{child.description}</span> : null}
                                  </span>
                                </Link>
                              );
                            })}
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              ) : null}
            </section>
          );
        })}
      </nav>

      {!collapsed && query && filteredItems.length === 0 ? (
        <div className="app-shell__menu-empty">
          <Search className="h-5 w-5" />
          <span>Menu tidak ditemukan</span>
        </div>
      ) : null}
    </div>
  );
}

export function ShellLayout({ children, title, subtitle, variant, menuItems }: ShellLayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { profile, primaryRole, signOut } = useAuthSession();
  const { settings } = useSystemSettings();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(
    () => localStorage.getItem(`ypia-sidebar-collapsed-${variant}`) === "true",
  );
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const BrandIcon = iconByVariant[variant];
  const portalIdentity = portalIdentityByVariant[variant];
  const displayName = profile?.full_name ?? profile?.email ?? "Pengguna";

  const initials = displayName
    .split(" ")
    .map((name) => name[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const themePortal = variant === "superadmin" ? "admin" : variant;
  const themeKey = themePortal === "mentor"
    ? settings?.portal_themes?.mentor ?? "rose"
    : settings?.portal_themes?.[themePortal];
  const themeStyles = getThemeStyles(themeKey);
  const sidebarTitle = settings?.app_sidebar_title || "YPIA";
  const sidebarSubtitle = settings?.app_sidebar_subtitle || "Portal Pembelajaran";
  const mobilePrimaryItems = useMemo(() => {
    const prioritizedItems = menuItems
      .filter((item) => item.mobilePriority !== undefined)
      .sort((first, second) => (first.mobilePriority ?? 99) - (second.mobilePriority ?? 99));
    const candidates = prioritizedItems.length ? prioritizedItems : menuItems;
    return candidates.length > 5 ? candidates.slice(0, 4) : candidates.slice(0, 5);
  }, [menuItems]);
  const mobileOverflowItems = useMemo(
    () => menuItems.filter((item) => !mobilePrimaryItems.includes(item)),
    [menuItems, mobilePrimaryItems],
  );
  const hasMobileOverflow = mobileOverflowItems.length > 0;
  const isMobileOverflowActive = mobileOverflowItems.some((item) =>
    isNavigationItemActive(location.pathname, location.search, item),
  );

  const getMobileNavLabel = (label: string) => label
    .replace("Program & Kelas", "Kelas")
    .replace("Cek Pendaftaran", "Status")
    .replace("Tugas & Review", "Review")
    .replace("Program Saya", "Program")
    .replace("Profil Saya", "Profil")
    .replace("Keuangan & Akuntansi", "Keuangan");

  useEffect(() => {
    if (Object.keys(themeStyles).length === 0) return;
    const root = document.documentElement;
    Object.entries(themeStyles).forEach(([key, value]) => root.style.setProperty(key, value as string));
    return () => Object.keys(themeStyles).forEach((key) => root.style.removeProperty(key));
  }, [themeStyles]);

  useEffect(() => {
    localStorage.setItem(`ypia-sidebar-collapsed-${variant}`, String(sidebarCollapsed));
  }, [sidebarCollapsed, variant]);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname, location.search]);

  useEffect(() => {
    if (!mobileMenuOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [mobileMenuOpen]);

  return (
    <div className={cn(`app-shell app-shell-${variant}`, sidebarCollapsed && "app-shell--sider-collapsed")}>
      <aside className="app-shell__sider print:hidden">
          <div className="app-shell__sidebar-top">
            <Link to={homeByVariant[variant]} className="app-shell__brand" aria-label={appName} title={sidebarTitle}>
              <span className="app-shell__brand-icon"><BrandIcon className="h-6 w-6 text-white" /></span>
              <span className="app-shell__brand-copy min-w-0">
                <span className="app-shell__brand-title">{sidebarTitle}</span>
                <span className="app-shell__brand-subtitle">{sidebarSubtitle}</span>
              </span>
            </Link>
            <Button
              type="button"
              variant="ghost"
              className="app-shell__collapse-button"
              onClick={() => setSidebarCollapsed((current) => !current)}
              aria-label={sidebarCollapsed ? "Perluas sidebar" : "Ciutkan sidebar"}
              title={sidebarCollapsed ? "Perluas sidebar" : "Ciutkan sidebar"}
            >
              {sidebarCollapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
              {!sidebarCollapsed ? <span>Ciutkan sidebar</span> : null}
            </Button>
          </div>

          <SidebarNavigation
            collapsed={sidebarCollapsed}
            locationPath={location.pathname}
            locationSearch={location.search}
            menuItems={menuItems}
            storageKey={`ypia-nav-${variant}`}
          />
      </aside>

      <div className="app-shell__main print:w-full print:m-0 print:p-0">
        <header className="app-shell__header print:hidden">
          <div className="app-shell__header-main">
            <Button
              type="button"
              variant="outline"
              className="app-shell__mobile-menu-button"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Buka menu navigasi"
              title="Buka menu"
            >
              <Menu className="h-5 w-5" />
            </Button>
            <div className="app-shell__portal-mark" aria-hidden="true">
              <BrandIcon className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <span className="app-shell__eyebrow">{portalIdentity.eyebrow}</span>
              <h1 className="app-shell__title">{title}</h1>
              <p className="app-shell__subtitle">{subtitle}</p>
            </div>
          </div>

          {primaryRole ? (
            <div className="app-shell__account">
              <span className="app-shell__portal-chip">{portalIdentity.shortLabel}</span>
              <Link
                to={variant === "superadmin" ? "/system/profil" : variant === "admin" ? "/admin/profil" : variant === "teacher" || variant === "mentor" ? "/teacher/profil" : "/learner/profil"}
                className="app-shell__profile-link"
                title="Pengaturan profil saya"
              >
                <div className="app-shell__profile-copy">
                  <p>{displayName}</p>
                  <span>{primaryRole.replaceAll("_", " ")}</span>
                </div>
                <div className="app-shell__avatar">{initials}</div>
              </Link>
              <Button
                variant="outline"
                size="sm"
                className="app-shell__logout-button"
                onClick={async () => {
                  await signOut();
                  let loginPath = "/learner/login";
                  if (variant === "admin" || variant === "superadmin") loginPath = "/admin/login";
                  else if (variant === "teacher") loginPath = "/teacher/login";
                  else if (variant === "mentor") loginPath = "/musyrif/login";
                  navigate(loginPath, { replace: true });
                }}
                aria-label="Keluar"
                title="Keluar"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          ) : null}
        </header>

        <main id="main-content" className="app-shell__content print:p-0 print:m-0 print:block">
          <Suspense fallback={<ContentFallback />}>{children}</Suspense>
        </main>

        <footer className="app-shell__footer print:hidden">
          <p>
            Disusun dan dikembangkan oleh{" "}
            <a href="https://yahyanursidik.my.id/" target="_blank" rel="noopener noreferrer">Yahya Nursidik</a>
          </p>
        </footer>
      </div>

      <div className={cn("app-shell__mobile-drawer", mobileMenuOpen && "is-open")} aria-hidden={!mobileMenuOpen}>
          <button className="app-shell__mobile-backdrop" type="button" onClick={() => setMobileMenuOpen(false)} aria-label="Tutup menu" />
          <aside className="app-shell__mobile-panel" role="dialog" aria-modal="true" aria-label="Menu navigasi">
            <div className="app-shell__mobile-panel-header">
              <Link to={homeByVariant[variant]} className="app-shell__mobile-brand" onClick={() => setMobileMenuOpen(false)}>
                <span className="app-shell__brand-icon"><BrandIcon className="h-5 w-5 text-white" /></span>
                <span className="min-w-0">
                  <strong>{sidebarTitle}</strong>
                  <small>{sidebarSubtitle}</small>
                </span>
              </Link>
              <Button type="button" variant="ghost" className="app-shell__mobile-close" onClick={() => setMobileMenuOpen(false)} aria-label="Tutup menu">
                <X className="h-5 w-5" />
              </Button>
            </div>
            <SidebarNavigation
              locationPath={location.pathname}
              locationSearch={location.search}
              menuItems={menuItems}
              onNavigate={() => setMobileMenuOpen(false)}
              storageKey={`ypia-nav-mobile-${variant}`}
            />
            {primaryRole ? (
              <div className="app-shell__mobile-account">
                <div className="app-shell__avatar">{initials}</div>
                <span className="min-w-0"><strong>{displayName}</strong><small>{primaryRole.replaceAll("_", " ")}</small></span>
              </div>
            ) : null}
          </aside>
      </div>

      {(variant === "learner" || variant === "teacher" || variant === "mentor") ? (
        <nav className="app-shell__bottom-nav" aria-label="Navigasi cepat">
          {mobilePrimaryItems.map((item) => {
            const Icon = item.icon;
            const isActive = isNavigationItemActive(location.pathname, location.search, item);
            return (
              <Link
                key={item.href}
                to={item.href}
                className={cn("app-shell__bottom-item", isActive && "is-active")}
                aria-current={isActive ? "page" : undefined}
              >
                <span className="app-shell__bottom-icon"><Icon className="h-5 w-5" /></span>
                <span>{getMobileNavLabel(item.label)}</span>
              </Link>
            );
          })}
          {hasMobileOverflow ? (
            <button
              type="button"
              className={cn("app-shell__bottom-item", isMobileOverflowActive && "is-active")}
              onClick={() => setMobileMenuOpen(true)}
              aria-expanded={mobileMenuOpen}
            >
              <span className="app-shell__bottom-icon"><MoreHorizontal className="h-5 w-5" /></span>
              <span>Lainnya</span>
            </button>
          ) : null}
        </nav>
      ) : null}
    </div>
  );
}
