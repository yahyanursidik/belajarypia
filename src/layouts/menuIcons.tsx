import {
  BookOpen,
  FileCheck,
  LayoutDashboard,
  LogIn,
  MessageCircleQuestion,
  ShieldCheck,
  SlidersHorizontal,
  User,
  Users,
  Wallet,
} from "lucide-react";

export const menuIcon = {
  dashboard: LayoutDashboard,
  login: LogIn,
  book: BookOpen,
  team: Users,
  user: User,
  settings: SlidersHorizontal,
  finance: Wallet,
  helpdesk: MessageCircleQuestion,
  contentReview: FileCheck,
  audit: ShieldCheck,
} as const;
