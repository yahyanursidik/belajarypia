import { AnnouncementHighlights } from "../shared/AnnouncementInboxPage";
import { useAuthSession } from "../../app/providers/authSessionContext";
import { MentorDashboardPage } from "./MentorDashboardPage";
import { TeacherDashboardPage } from "./TeacherDashboardPage";

export function TeacherPortalHomePage() {
  const { primaryRole } = useAuthSession();
  return (
    <div className="page-stack">
      {primaryRole === "mentor" ? (
        <MentorDashboardPage />
      ) : (
        <TeacherDashboardPage />
      )}
      <AnnouncementHighlights />
    </div>
  );
}
