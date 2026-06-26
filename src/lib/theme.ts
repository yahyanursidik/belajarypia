import React from "react";

export type ThemeKey = "indigo" | "emerald" | "rose" | "amber" | "slate";

export type PortalThemeConfig = {
  admin: ThemeKey;
  learner: ThemeKey;
  teacher: ThemeKey;
  public: ThemeKey;
};

// CSS Variables (HSL) map for each theme
export const THEMES: Record<ThemeKey, Record<string, string>> = {
  emerald: {
    "--primary": "160 55% 32%",
    "--primary-foreground": "40 60% 97%",
    "--ring": "160 55% 32%",
    "--accent": "155 22% 90%",
    "--accent-foreground": "160 35% 18%",
  },
  indigo: {
    "--primary": "239 60% 35%",
    "--primary-foreground": "210 40% 98%",
    "--ring": "239 60% 35%",
    "--accent": "240 4.8% 95.9%",
    "--accent-foreground": "240 5.9% 10%",
  },
  rose: {
    "--primary": "346 60% 40%",
    "--primary-foreground": "355.7 100% 97.3%",
    "--ring": "346 60% 40%",
    "--accent": "340 4.8% 95.9%",
    "--accent-foreground": "340 5.9% 10%",
  },
  amber: {
    "--primary": "35 70% 35%",
    "--primary-foreground": "48 96% 89%",
    "--ring": "35 70% 35%",
    "--accent": "40 4.8% 95.9%",
    "--accent-foreground": "40 5.9% 10%",
  },
  slate: {
    "--primary": "215 20% 30%",
    "--primary-foreground": "210 40% 98%",
    "--ring": "215 20% 30%",
    "--accent": "210 40% 96.1%",
    "--accent-foreground": "222.2 47.4% 11.2%",
  }
};

export function getThemeStyles(themeKey: ThemeKey | string | null | undefined): React.CSSProperties {
  if (!themeKey) return {};
  const theme = THEMES[themeKey as ThemeKey];
  if (!theme) return {};
  return theme as React.CSSProperties;
}

export const THEME_OPTIONS = [
  { id: "indigo", name: "Indigo / Deep Blue", color: "bg-indigo-600" },
  { id: "emerald", name: "Emerald / Hijau", color: "bg-emerald-600" },
  { id: "rose", name: "Rose / Merah Hangat", color: "bg-rose-600" },
  { id: "amber", name: "Amber / Kuning Emas", color: "bg-amber-500" },
  { id: "slate", name: "Slate / Abu Elegan", color: "bg-slate-600" },
];
