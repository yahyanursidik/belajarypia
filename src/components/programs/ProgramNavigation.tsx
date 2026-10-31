import { Link } from "react-router-dom";
import {
  BarChart3,
  BookOpen,
  ClipboardList,
  LayoutDashboard,
  Users,
} from "lucide-react";
import {
  programGroups,
  programSectionLabels,
  programSectionPath,
  type ProgramSection,
} from "../../lib/programWorkspace";

const icons = [LayoutDashboard, BookOpen, ClipboardList, Users, BarChart3];
export function ProgramNavigation({
  basePath,
  programId,
  section,
  scheduled,
  returnTo,
  admin = true,
}: {
  basePath: string;
  programId: string;
  section: ProgramSection;
  scheduled: boolean;
  returnTo: string;
  admin?: boolean;
}) {
  const groups = programGroups
    .map((group, index) => ({
      ...group,
      icon: icons[index],
      sections: group.sections.filter(
        (item) => admin || (item !== "pendaftaran" && item !== "report"),
      ),
    }))
    .filter((group) => group.sections.length > 0);
  const activeGroup =
    groups.find((group) =>
      (group.sections as readonly string[]).includes(section),
    ) ?? groups[0];
  const sections = activeGroup.sections.filter(
    (item) => item !== "angkatan-kelas" || scheduled,
  );
  const path = (item: ProgramSection) =>
    programSectionPath(basePath, programId, item, returnTo);
  return (
    <div className="program-navigation">
      <nav className="program-primary-nav" aria-label="Navigasi program">
        {groups.map((group) => {
          const Icon = group.icon;
          const target =
            group.key === activeGroup.key
              ? section
              : group.key === "learning"
                ? "kurikulum"
                : group.sections[0];
          return (
            <Link
              key={group.key}
              to={path(target)}
              aria-current={group.key === activeGroup.key ? "page" : undefined}
            >
              <Icon size={17} aria-hidden="true" />
              {group.label}
            </Link>
          );
        })}
      </nav>
      {sections.length > 1 && (
        <nav
          className="program-secondary-nav"
          aria-label={`Bagian ${activeGroup.label.toLowerCase()}`}
        >
          {sections.map((item) => (
            <Link
              key={item}
              to={path(item)}
              aria-current={item === section ? "page" : undefined}
            >
              {programSectionLabels[item]}
            </Link>
          ))}
        </nav>
      )}
    </div>
  );
}
