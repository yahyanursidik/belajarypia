const authRedirectOrigin = import.meta.env.VITE_AUTH_REDIRECT_ORIGIN?.trim();

function getCurrentOrigin() {
  if (typeof window === "undefined") {
    return "";
  }

  return window.location.origin;
}

export function getAuthRedirectUrl(path: string) {
  const origin = authRedirectOrigin || getCurrentOrigin();
  const normalizedOrigin = origin.replace(/\/+$/, "");
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;

  return `${normalizedOrigin}${normalizedPath}`;
}
