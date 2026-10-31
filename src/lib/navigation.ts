import type { ComponentType } from "react";
import { menuIcon } from "../layouts/menuIcons";
import type { RoleCode } from "./auth";

export type AppNavItem = {
  href: string;
  label: string;
  description?: string;
  group: string;
  icon: ComponentType<{ className?: string }>;
  keywords?: string[];
  mobilePriority?: number;
  activePathPrefixes?: string[];
  children?: AppNavChild[];
};

export type AppNavChild = {
  href: string;
  label: string;
  description?: string;
};

export function getNavigationForRole(role: RoleCode | null): AppNavItem[] {
  switch (role) {
    case "super_admin":
      return [
        { href: "/system", label: "Pusat Kendali", description: "Ringkasan kondisi LMS", group: "Ikhtisar", icon: menuIcon.dashboard, keywords: ["dashboard", "ringkasan"], mobilePriority: 1 },
        {
          href: "/system/pendaftaran", label: "Admisi & Pendaftaran", description: "Pendaftar, verifikasi, form, dan undangan", group: "Akademik", icon: menuIcon.admission, keywords: ["calon peserta", "form", "undangan", "whatsapp"], mobilePriority: 2,
          children: [
            { href: "/system/pendaftaran?tab=overview", label: "Ringkasan Admisi", description: "Kinerja dan alur pendaftaran" },
            { href: "/system/pendaftaran?tab=review", label: "Verifikasi Pendaftar", description: "Review berkas dan keputusan" },
            { href: "/system/pendaftaran?tab=settings", label: "Form & Undangan", description: "Periode, form, dan grup WA" },
          ],
        },
        { href: "/system/peserta", label: "Peserta", group: "Akademik", icon: menuIcon.user, keywords: ["direktori", "akun", "transkrip", "impor"], mobilePriority: 3 },
        { href: "/system/program", label: "Program & Kurikulum", description: "Program, kelas, materi, dan evaluasi", group: "Akademik", icon: menuIcon.book, keywords: ["silabus", "kurikulum", "kelas", "bank soal"] },
        { href: "/system/penilaian", label: "Penilaian Ujian", description: "Koreksi esai dan umpan balik peserta", group: "Akademik", icon: menuIcon.review, keywords: ["esai", "nilai", "ujian", "koreksi"] },
        {
          href: "/system/sertifikat", label: "Syahadah & Sertifikat", description: "Kelayakan dan penerbitan", group: "Akademik", icon: menuIcon.certificate, keywords: ["ijazah", "kelulusan"],
          children: [
            { href: "/system/sertifikat", label: "Template Syahadah" },
            { href: "/system/sertifikat/kelayakan", label: "Cek Kelayakan" },
            { href: "/system/sertifikat/antrean", label: "Antrean Penerbitan" },
          ],
        },
        {
          href: "/system/pengumuman", label: "Pengumuman", activePathPrefixes: ["/system/informasi"], description: "Publikasi dan komunikasi massal", group: "Operasional", icon: menuIcon.announcement, keywords: ["komunikasi", "broadcast", "notifikasi"],
          children: [
            { href: "/system/pengumuman", label: "Semua Pengumuman" },
            { href: "/system/pengumuman?status=draft", label: "Draf" },
            { href: "/system/pengumuman?status=scheduled", label: "Terjadwal" },
            { href: "/system/informasi", label: "Untuk Saya" },
            { href: "/system/pengumuman?tab=compose", label: "Buat Pengumuman" },
          ],
        },
        {
          href: "/system/keuangan", label: "Keuangan & Akuntansi", description: "Transaksi, donasi, wakaf, dan jurnal", group: "Operasional", icon: menuIcon.finance, keywords: ["infaq", "donatur", "pembayaran", "jurnal"], mobilePriority: 4,
          children: [
            { href: "/system/keuangan", label: "Ringkasan Keuangan" },
            { href: "/system/keuangan?tab=invoices", label: "Tagihan Kelas" },
            { href: "/system/keuangan?tab=transactions", label: "Transaksi" },
            { href: "/system/keuangan?tab=channels", label: "Rekening & QR" },
            { href: "/system/keuangan?tab=recurring", label: "Donatur Rutin" },
            { href: "/system/keuangan?tab=accounting", label: "Akuntansi" },
          ],
        },
        { href: "/system/helpdesk", label: "Helpdesk", description: "Tiket dan tindak lanjut layanan", group: "Operasional", icon: menuIcon.helpdesk, keywords: ["bantuan", "tiket", "keluhan"] },
        { href: "/system/konten", label: "Review Konten", description: "Moderasi materi pembelajaran", group: "Tata Kelola", icon: menuIcon.contentReview, keywords: ["moderasi", "materi", "review"] },
        { href: "/system/pengguna", label: "Akses & Pengguna", description: "Akun, peran, dan hak akses", group: "Tata Kelola", icon: menuIcon.userSettings, keywords: ["role", "akun", "staf", "pengajar"] },
        { href: "/system/audit", label: "Audit Sistem", description: "Jejak aktivitas dan keamanan", group: "Tata Kelola", icon: menuIcon.audit, keywords: ["log", "aktivitas", "keamanan"] },
        {
          href: "/system/pengaturan", label: "Pengaturan Global", description: "Identitas, tampilan, warna, dan konfigurasi terkait", group: "Tata Kelola", icon: menuIcon.settings, keywords: ["konfigurasi", "branding", "tema"],
          children: [
            { href: "/system/pengaturan", label: "Ikhtisar Pengaturan" },
            { href: "/system/pengaturan?tab=identity", label: "Identitas & Kontak" },
            { href: "/system/pengaturan?tab=branding", label: "Tampilan & Logo" },
            { href: "/system/pengaturan?tab=themes", label: "Warna Portal" },
            { href: "/system/pengaturan?tab=connections", label: "Pengaturan Terkait" },
          ],
        },
      ];
    case "admin":
      return [
        { href: "/admin", label: "Dashboard", group: "Utama", icon: menuIcon.dashboard, mobilePriority: 1 },
        { href: "/admin/pendaftaran", label: "Pendaftaran", group: "Akademik", icon: menuIcon.admission, keywords: ["admisi", "verifikasi", "form", "undangan"], mobilePriority: 2 },
        { href: "/admin/peserta", label: "Peserta", group: "Akademik", icon: menuIcon.user, keywords: ["direktori", "transkrip", "impor"], mobilePriority: 3 },
        { href: "/admin/program", label: "Program", group: "Akademik", icon: menuIcon.book, keywords: ["kurikulum", "kelas", "materi", "bank soal"], mobilePriority: 4 },
        { href: "/admin/penilaian", label: "Penilaian", group: "Akademik", icon: menuIcon.review },
        { href: "/admin/sertifikat", label: "Sertifikat", group: "Akademik", icon: menuIcon.certificate, activePathPrefixes: ["/admin/sertifikat"] },
        { href: "/admin/keuangan", label: "Keuangan", group: "Operasional", icon: menuIcon.finance },
        { href: "/admin/pengumuman", label: "Pengumuman", activePathPrefixes: ["/admin/informasi"], group: "Operasional", icon: menuIcon.announcement },
        { href: "/admin/helpdesk", label: "Bantuan", group: "Operasional", icon: menuIcon.helpdesk },
        { href: "/admin/konten", label: "Review Konten", group: "Operasional", icon: menuIcon.contentReview },
      ];
    case "finance":
      return [
        { href: "/admin/informasi", label: "Pengumuman", group: "Informasi", icon: menuIcon.announcement },
        { href: "/admin", label: "Dashboard", description: "Ringkasan operasional", group: "Ikhtisar", icon: menuIcon.dashboard, mobilePriority: 1 },
        {
          href: "/admin/keuangan", label: "Keuangan & Akuntansi", description: "Transaksi, donasi, wakaf, dan jurnal", group: "Keuangan", icon: menuIcon.finance, mobilePriority: 2,
          children: [
            { href: "/admin/keuangan", label: "Ringkasan Keuangan" },
            { href: "/admin/keuangan?tab=invoices", label: "Tagihan Kelas" },
            { href: "/admin/keuangan?tab=transactions", label: "Transaksi" },
            { href: "/admin/keuangan?tab=channels", label: "Rekening & QR" },
            { href: "/admin/keuangan?tab=recurring", label: "Donatur Rutin" },
            { href: "/admin/keuangan?tab=accounting", label: "Akuntansi" },
          ],
        },
        { href: "/admin/helpdesk", label: "Bantuan pembayaran", group: "Layanan", icon: menuIcon.helpdesk },
      ];
    case "helpdesk":
      return [
        { href: "/admin/informasi", label: "Pengumuman", group: "Informasi", icon: menuIcon.announcement },
        { href: "/admin", label: "Dashboard", description: "Ringkasan operasional", group: "Ikhtisar", icon: menuIcon.dashboard, mobilePriority: 1 },
        { href: "/admin/helpdesk", label: "Helpdesk", description: "Tiket dan tindak lanjut", group: "Layanan", icon: menuIcon.helpdesk, mobilePriority: 2 },
      ];
    case "content_reviewer":
      return [
        { href: "/admin/informasi", label: "Pengumuman", group: "Informasi", icon: menuIcon.announcement },
        { href: "/admin", label: "Dashboard", description: "Ringkasan operasional", group: "Ikhtisar", icon: menuIcon.dashboard, mobilePriority: 1 },
        { href: "/admin/konten", label: "Review Konten", description: "Moderasi materi pembelajaran", group: "Konten", icon: menuIcon.contentReview, mobilePriority: 2 },
      ];
    case "teacher":
      return [
        { href: "/teacher", label: "Dashboard", description: "Agenda dan ringkasan mengajar", group: "Ikhtisar", icon: menuIcon.dashboard, mobilePriority: 1 },
        { href: "/teacher/kelas", label: "Program & Kelas", description: "Kelas dan peserta yang diampu", group: "Pembelajaran", icon: menuIcon.book, keywords: ["kelas", "peserta", "program"], mobilePriority: 2 },
        { href: "/teacher/silabus", label: "Silabus Pengajaran", description: "Tujuan, capaian, dan rencana belajar", group: "Pembelajaran", icon: menuIcon.document, keywords: ["rps", "kurikulum", "tujuan", "capaian"], mobilePriority: 4 },
        { href: "/teacher/konten", label: "Konten Materi", description: "Materi, dokumen, dan evaluasi", group: "Pembelajaran", icon: menuIcon.library, mobilePriority: 4 },
        { href: "/teacher/review", label: "Tugas & Review", description: "Koreksi esai, nilai, dan umpan balik", group: "Pembelajaran", icon: menuIcon.review, mobilePriority: 3 },
        { href: "/teacher/pengumuman", label: "Pengumuman", group: "Informasi", icon: menuIcon.announcement },
        { href: "/teacher/bantuan", label: "Bantuan", group: "Layanan", icon: menuIcon.helpdesk },
        { href: "/teacher/profil", label: "Profil Saya", description: "Identitas dan akun pengajar", group: "Akun", icon: menuIcon.user, mobilePriority: 5 },
      ];
    case "mentor":
      return [
        { href: "/teacher", label: "Dashboard Musyrif", description: "Amanah dan fokus pendampingan", group: "Ikhtisar", icon: menuIcon.dashboard, keywords: ["ringkasan", "amanah"], mobilePriority: 1 },
        { href: "/teacher/halaqah", label: "Halaqah & Binaan", description: "Kelompok, peserta, dan progres", group: "Pendampingan", icon: menuIcon.team, keywords: ["santri", "peserta", "progres"], mobilePriority: 2 },
        { href: "/teacher/silabus", label: "Silabus Pendampingan", description: "Tujuan, capaian, dan rencana belajar", group: "Pendampingan", icon: menuIcon.document, keywords: ["kurikulum", "target", "rencana"], mobilePriority: 4 },
        { href: "/teacher/konten", label: "Konten Materi", description: "Materi dan evaluasi program", group: "Pembelajaran", icon: menuIcon.library },
        { href: "/teacher/review", label: "Review Pembelajaran", description: "Progres, nilai, dan tindak lanjut", group: "Pembelajaran", icon: menuIcon.review },
        { href: "/teacher/quran", label: "Setoran Qur'an", description: "Penilaian, catatan, dan target", group: "Pendampingan", icon: menuIcon.book, keywords: ["hafalan", "murajaah", "tilawah"], mobilePriority: 3 },
        { href: "/teacher/pengumuman", label: "Pengumuman", group: "Informasi", icon: menuIcon.announcement },
        { href: "/teacher/bantuan", label: "Bantuan", group: "Layanan", icon: menuIcon.helpdesk },
        { href: "/teacher/profil", label: "Profil Saya", description: "Identitas dan akun mentor", group: "Akun", icon: menuIcon.user, mobilePriority: 4 },
      ];
    case "guardian":
      return [
        { href: "/learner", label: "Dashboard", description: "Ringkasan aktivitas", group: "Ikhtisar", icon: menuIcon.dashboard, mobilePriority: 1 },
        { href: "/learner/anak-saya", label: "Anak Saya", description: "Progres belajar dan administrasi", group: "Pendampingan", icon: menuIcon.user, mobilePriority: 2 },
        { href: "/learner/pengumuman", label: "Pengumuman", group: "Informasi", icon: menuIcon.announcement },
        { href: "/learner/bantuan", label: "Bantuan", description: "Panduan dan layanan", group: "Layanan", icon: menuIcon.helpdesk, mobilePriority: 3 },
      ];
    case "participant":
      return [
        { href: "/learner", label: "Beranda", group: "Belajar", icon: menuIcon.dashboard, mobilePriority: 1 },
        { href: "/learner/program-saya", label: "Program", group: "Belajar", icon: menuIcon.book, mobilePriority: 2, activePathPrefixes: ["/learner/program", "/learner/lesson", "/learner/transkrip"] },
        { href: "/learner/keuangan", label: "Pembayaran", group: "Akun", icon: menuIcon.finance, mobilePriority: 3 },
        { href: "/learner/profil", label: "Akun", group: "Akun", icon: menuIcon.user, mobilePriority: 4 },
        { href: "/learner/cek-status", label: "Pendaftaran", group: "Akun", icon: menuIcon.admission, activePathPrefixes: ["/learner/pendaftaran"] },
        { href: "/learner/pengumuman", label: "Pengumuman", group: "Informasi", icon: menuIcon.announcement },
        { href: "/learner/bantuan", label: "Bantuan", group: "Akun", icon: menuIcon.helpdesk },
      ];
    default:
      return [
        { href: "/", label: "Beranda", group: "Utama", icon: menuIcon.dashboard, mobilePriority: 1 },
        { href: "/program", label: "Program", group: "Utama", icon: menuIcon.book, mobilePriority: 2 },
        { href: "/auth/login", label: "Login", group: "Akun", icon: menuIcon.login, mobilePriority: 3 },
      ];
  }
}
