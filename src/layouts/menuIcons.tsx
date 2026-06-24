import { BookOpen, LayoutDashboard, LogIn, Settings, User, Users } from "lucide-react";

export const menuIcon = {
  dashboard: LayoutDashboard,
  login: LogIn,
  book: BookOpen,
  team: Users,
  user: User,
  settings: Settings,
} as const;
