import type { AppNavItem } from "./navigation";

const portalRoots = ["/", "/admin", "/system", "/teacher", "/learner"];

export function isHrefActive(pathname: string, search: string, href: string, includeNested = true) {
  const [targetPath, targetQuery = ""] = href.split("?");
  const isPortalRoot = portalRoots.includes(targetPath);
  const pathMatches = targetPath === "/"
    ? pathname === targetPath
    : pathname === targetPath || (includeNested && !isPortalRoot && pathname.startsWith(`${targetPath}/`));

  if (!pathMatches) return false;
  if (!targetQuery) return true;

  const currentParams = new URLSearchParams(search);
  const targetParams = new URLSearchParams(targetQuery);
  return Array.from(targetParams.entries()).every(([key, value]) => currentParams.get(key) === value);
}

export function isNavigationItemActive(pathname: string, search: string, item: AppNavItem) {
  if (isHrefActive(pathname, search, item.href)) return true;

  return item.activePathPrefixes?.some((prefix) =>
    pathname === prefix || pathname.startsWith(`${prefix}/`),
  ) ?? false;
}
