import type { ComponentType } from "react";
import { menuIcon } from "../layouts/menuIcons";
import type { RoleCode } from "./auth";

export type AppNavItem = {
  href: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
};

export function getNavigationForRole(role: RoleCode | null): AppNavItem[] {
  switch (role) {
    case "super_admin":
      return [
        { href: "/system", label: "Pusat Kendali", icon: menuIcon.dashboard },
        { href: "/system/pengguna", label: "Akses & Pengguna", icon: menuIcon.user },
        { href: "/system/pendaftaran", label: "Pendaftaran", icon: menuIcon.team },
        { href: "/system/peserta", label: "Data Peserta", icon: menuIcon.user },
        { href: "/system/program", label: "Program", icon: menuIcon.book },
        { href: "/system/keuangan", label: "Keuangan", icon: menuIcon.finance },
        { href: "/system/helpdesk", label: "Helpdesk", icon: menuIcon.helpdesk },
        { href: "/system/konten", label: "Review Konten", icon: menuIcon.contentReview },
        { href: "/system/audit", label: "Audit Sistem", icon: menuIcon.audit },
        { href: "/system/pengaturan", label: "Pengaturan Global", icon: menuIcon.settings },
      ];
    case "admin":
      return [
        { href: "/admin", label: "Dashboard", icon: menuIcon.dashboard },
        { href: "/admin/pendaftaran", label: "Pendaftaran", icon: menuIcon.team },
        { href: "/admin/peserta", label: "Data Peserta", icon: menuIcon.user },
        { href: "/admin/program", label: "Program", icon: menuIcon.book },
      ];
    case "finance":
      return [
        { href: "/admin", label: "Dashboard", icon: menuIcon.dashboard },
        { href: "/admin/keuangan", label: "Keuangan", icon: menuIcon.finance },
      ];
    case "helpdesk":
      return [
        { href: "/admin", label: "Dashboard", icon: menuIcon.dashboard },
        { href: "/admin/helpdesk", label: "Helpdesk", icon: menuIcon.team },
      ];
    case "content_reviewer":
      return [
        { href: "/admin", label: "Dashboard", icon: menuIcon.dashboard },
        { href: "/admin/konten", label: "Review Konten", icon: menuIcon.book },
      ];
    case "teacher":
      return [
        { href: "/teacher", label: "Dashboard", icon: menuIcon.dashboard },
        { href: "/teacher/kelas", label: "Kelas Saya", icon: menuIcon.book },
        { href: "/teacher/konten", label: "Konten Materi", icon: menuIcon.book },
        { href: "/teacher/review", label: "Tugas & Review", icon: menuIcon.user },
      ];
    case "mentor":
      return [
        { href: "/teacher", label: "Dashboard", icon: menuIcon.dashboard },
        { href: "/teacher/halaqah", label: "Halaqah", icon: menuIcon.team },
        { href: "/teacher/konten", label: "Konten Materi", icon: menuIcon.book },
        { href: "/teacher/quran", label: "Setoran Qur'an", icon: menuIcon.book },
      ];
    case "guardian":
      return [
        { href: "/learner", label: "Dashboard", icon: menuIcon.dashboard },
        { href: "/learner/anak-saya", label: "Anak Saya", icon: menuIcon.user },
        { href: "/learner/bantuan", label: "Bantuan", icon: menuIcon.team },
      ];
    case "participant":
      return [
        { href: "/learner", label: "Dashboard", icon: menuIcon.dashboard },
        { href: "/learner/program-saya", label: "Program Saya", icon: menuIcon.book },
        { href: "/learner/bantuan", label: "Bantuan", icon: menuIcon.team },
      ];
    default:
      return [
        { href: "/", label: "Beranda", icon: menuIcon.dashboard },
        { href: "/program", label: "Program", icon: menuIcon.book },
        { href: "/auth/login", label: "Login", icon: menuIcon.login },
      ];
  }
}
