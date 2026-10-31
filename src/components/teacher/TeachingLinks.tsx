import { NavLink } from "react-router-dom";
import {
  BookOpen,
  CalendarDays,
  Users,
  ClipboardCheck,
  BarChart3,
  UserRound,
} from "lucide-react";
export function TeachingLinks() {
  return (
    <nav className="teaching-links" aria-label="Alur pengajaran">
      {[
        { to: "/teacher/agenda", label: "Agenda", Icon: CalendarDays },
        { to: "/teacher/kelas", label: "Kelas", Icon: Users },
        { to: "/teacher/konten", label: "Materi", Icon: BookOpen },
        { to: "/teacher/progres", label: "Progres peserta", Icon: BarChart3 },
        { to: "/teacher/tugas", label: "Pengumpulan tugas", Icon: ClipboardCheck },
        { to: "/teacher/review", label: "Penilaian", Icon: ClipboardCheck },
        { to: "/teacher/profil", label: "Profil saya", Icon: UserRound },
      ].map(({ to, label, Icon }) => (
        <NavLink key={to} to={to}>
          <Icon size={17} />
          {label}
        </NavLink>
      ))}
    </nav>
  );
}
