import { useAuthSession } from "../../app/providers/authSessionContext";
import { MentorDashboardPage } from "./MentorDashboardPage";
import { TeacherDashboardPage } from "./TeacherDashboardPage";

export function TeacherPortalHomePage() {
  const { primaryRole } = useAuthSession();
  return primaryRole === "mentor" ? <MentorDashboardPage /> : <TeacherDashboardPage />;
}
