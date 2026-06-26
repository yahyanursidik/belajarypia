import { lazy, Suspense } from "react";
import { Navigate, Route, Routes, Outlet } from "react-router-dom";
import { FullPageLoader } from "../components/ui/full-page-loader";
import { DashboardRedirect, ProtectedRoute } from "./ProtectedRoute";

const AdminLayout = lazy(() =>
  import("../layouts/AdminLayout").then((module) => ({ default: module.AdminLayout })),
);
const LearnerLayout = lazy(() =>
  import("../layouts/LearnerLayout").then((module) => ({ default: module.LearnerLayout })),
);
const PublicLayout = lazy(() =>
  import("../layouts/PublicLayout").then((module) => ({ default: module.PublicLayout })),
);
const SuperAdminLayout = lazy(() =>
  import("../layouts/SuperAdminLayout").then((module) => ({
    default: module.SuperAdminLayout,
  })),
);
const TeacherLayout = lazy(() =>
  import("../layouts/TeacherLayout").then((module) => ({ default: module.TeacherLayout })),
);
const LoginPage = lazy(() =>
  import("./auth/LoginPage").then((module) => ({ default: module.LoginPage })),
);
const NoRolePage = lazy(() =>
  import("./auth/NoRolePage").then((module) => ({ default: module.NoRolePage })),
);
const AdminDashboardPage = lazy(() =>
  import("./admin/AdminDashboardPage").then((module) => ({
    default: module.AdminDashboardPage,
  })),
);
const AdminPlaceholderPage = lazy(() =>
  import("./admin/AdminPlaceholderPage").then((module) => ({
    default: module.AdminPlaceholderPage,
  })),
);
const AdminApplicantListPage = lazy(() =>
  import("./admin/AdminApplicantListPage").then((module) => ({
    default: module.AdminApplicantListPage,
  })),
);
const AdminProgramListPage = lazy(() =>
  import("./admin/AdminProgramListPage").then((module) => ({
    default: module.AdminProgramListPage,
  })),
);
const AdminParticipantListPage = lazy(() =>
  import("./admin/AdminParticipantListPage").then((module) => ({
    default: module.AdminParticipantListPage,
  })),
);
const AdminParticipantDetailPage = lazy(() =>
  import("./admin/AdminParticipantDetailPage").then((module) => ({
    default: module.AdminParticipantDetailPage,
  })),
);
const AdminTranscriptPage = lazy(() =>
  import("./admin/AdminTranscriptPage").then((module) => ({
    default: module.AdminTranscriptPage,
  })),
);
const ProgramBuilderPage = lazy(() =>
  import("./admin/ProgramBuilderPage").then((module) => ({
    default: module.ProgramBuilderPage,
  })),
);
const AdminProgramReportPage = lazy(() =>
  import("./admin/AdminProgramReportPage").then((module) => ({
    default: module.AdminProgramReportPage,
  })),
);
const AdminFinancePage = lazy(() =>
  import("./admin/AdminFinancePage").then((module) => ({
    default: module.AdminFinancePage,
  })),
);
const LearnerDashboardPage = lazy(() =>
  import("./learner/LearnerDashboardPage").then((module) => ({
    default: module.LearnerDashboardPage,
  })),
);
const LearnerTranscriptPage = lazy(() =>
  import("./learner/LearnerTranscriptPage").then((module) => ({
    default: module.LearnerTranscriptPage,
  })),
);
const LearnerProgramLessonsPage = lazy(() =>
  import("./learner/LearnerProgramLessonsPage").then((module) => ({
    default: module.LearnerProgramLessonsPage,
  })),
);
const LearnerPlaceholderPage = lazy(() =>
  import("./learner/LearnerPlaceholderPage").then((module) => ({
    default: module.LearnerPlaceholderPage,
  })),
);
const AdmissionPortalPage = lazy(() =>
  import("./public/AdmissionPortalPage").then((module) => ({
    default: module.AdmissionPortalPage,
  })),
);
const ProgramDetailPage = lazy(() =>
  import("./public/ProgramDetailPage").then((module) => ({
    default: module.ProgramDetailPage,
  })),
);
const AdmissionStatusPage = lazy(() =>
  import("./public/AdmissionStatusPage").then((module) => ({
    default: module.AdmissionStatusPage,
  })),
);
const SuperAdminDashboardPage = lazy(() =>
  import("./superadmin/SuperAdminDashboardPage").then((module) => ({
    default: module.SuperAdminDashboardPage,
  })),
);
const SuperAdminPlaceholderPage = lazy(() =>
  import("./superadmin/SuperAdminPlaceholderPage").then((module) => ({
    default: module.SuperAdminPlaceholderPage,
  })),
);
const GlobalSettingsPage = lazy(() =>
  import("./superadmin/GlobalSettingsPage").then((module) => ({
    default: module.GlobalSettingsPage,
  })),
);
const SystemAuditPage = lazy(() =>
  import("./superadmin/SystemAuditPage").then((module) => ({
    default: module.SystemAuditPage,
  })),
);
const TeacherDashboardPage = lazy(() =>
  import("./teacher/TeacherDashboardPage").then((module) => ({
    default: module.TeacherDashboardPage,
  })),
);
const TeacherPlaceholderPage = lazy(() =>
  import("./teacher/TeacherPlaceholderPage").then((module) => ({
    default: module.TeacherPlaceholderPage,
  })),
);

function RouteFallback() {
  return <FullPageLoader message="Memuat halaman..." />;
}

export function AppRoutes() {
  return (
    <Suspense fallback={<RouteFallback />}>
      <Routes>
        <Route path="/" element={<Navigate to="/admin/login" replace />} />
        <Route path="/admin/login" element={<LoginPage portal="admin" />} />
        <Route path="/teacher/login" element={<LoginPage portal="teacher" />} />
        <Route path="/learner/login" element={<LoginPage portal="learner" />} />
        <Route path="/auth/login" element={<Navigate to="/learner/login" replace />} />
        <Route
          path="/auth/no-role"
          element={
            <PublicLayout>
              <NoRolePage />
            </PublicLayout>
          }
        />
        <Route path="/pendaftaran/:programId" element={<PublicLayout><AdmissionPortalPage /></PublicLayout>} />
        <Route path="/cek-status" element={<PublicLayout><AdmissionStatusPage /></PublicLayout>} />
        <Route path="/katalog/:programId" element={<PublicLayout><ProgramDetailPage /></PublicLayout>} />
        <Route path="/dashboard" element={<DashboardRedirect />} />

        {/* ADMIN ROUTES */}
        <Route
          path="/admin"
          element={
            <ProtectedRoute allowedRoles={["admin", "finance", "helpdesk", "content_reviewer"]}>
              <AdminLayout>
                <Outlet />
              </AdminLayout>
            </ProtectedRoute>
          }
        >
          <Route index element={<AdminDashboardPage />} />
          <Route
            path="pendaftaran"
            element={
              <ProtectedRoute allowedRoles={["admin"]}>
                <AdminApplicantListPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="program"
            element={
              <ProtectedRoute allowedRoles={["admin"]}>
                <AdminProgramListPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="peserta"
            element={
              <ProtectedRoute allowedRoles={["admin"]}>
                <AdminParticipantListPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="peserta/:participantId"
            element={
              <ProtectedRoute allowedRoles={["admin"]}>
                <AdminParticipantDetailPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="peserta/:participantId/transkrip/:enrollmentId"
            element={
              <ProtectedRoute allowedRoles={["admin"]}>
                <AdminTranscriptPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="program/:programId"
            element={
              <ProtectedRoute allowedRoles={["admin"]}>
                <ProgramBuilderPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="keuangan"
            element={
              <ProtectedRoute allowedRoles={["admin", "finance"]}>
                <AdminFinancePage />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<AdminPlaceholderPage />} />
        </Route>

        {/* TEACHER ROUTES */}
        <Route
          path="/teacher"
          element={
            <ProtectedRoute allowedRoles={["teacher", "mentor"]}>
              <TeacherLayout>
                <Outlet />
              </TeacherLayout>
            </ProtectedRoute>
          }
        >
          <Route index element={<TeacherDashboardPage />} />
          <Route path="konten" element={<TeacherPlaceholderPage />} />
          <Route path="*" element={<TeacherPlaceholderPage />} />
        </Route>

        {/* LEARNER ROUTES */}
        <Route
          path="/learner"
          element={
            <ProtectedRoute allowedRoles={["participant", "guardian"]}>
              <LearnerLayout>
                <Outlet />
              </LearnerLayout>
            </ProtectedRoute>
          }
        >
          <Route index element={<LearnerDashboardPage />} />
          <Route path="program-saya" element={<LearnerProgramLessonsPage />} />
          <Route path="transkrip/:enrollmentId" element={<LearnerTranscriptPage />} />
          <Route path="*" element={<LearnerPlaceholderPage />} />
        </Route>

        {/* SUPER ADMIN ROUTES */}
        <Route
          path="/system"
          element={
            <ProtectedRoute allowedRoles={["super_admin"]}>
              <SuperAdminLayout>
                <Outlet />
              </SuperAdminLayout>
            </ProtectedRoute>
          }
        >
          <Route index element={<SuperAdminDashboardPage />} />
          <Route path="pendaftaran" element={<AdminApplicantListPage />} />
          <Route path="peserta" element={<AdminParticipantListPage />} />
          <Route path="peserta/:participantId" element={<AdminParticipantDetailPage />} />
          <Route path="peserta/:participantId/transkrip/:enrollmentId" element={<AdminTranscriptPage />} />
          <Route path="program" element={<AdminProgramListPage />} />
          <Route path="program/:programId" element={<ProgramBuilderPage />} />
          <Route path="program/:programId/report" element={<AdminProgramReportPage />} />
          <Route path="katalog/:programId" element={<ProgramDetailPage />} />
          <Route path="pendaftaran/:programId" element={<AdmissionPortalPage />} />
          <Route path="cek-status" element={<AdmissionStatusPage />} />
          <Route path="audit" element={<SystemAuditPage />} />
          <Route path="keuangan" element={<AdminFinancePage />} />
          <Route path="pengaturan" element={<GlobalSettingsPage />} />
          <Route path="*" element={<SuperAdminPlaceholderPage />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
