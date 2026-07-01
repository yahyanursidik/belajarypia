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
const AdminProfilePage = lazy(() =>
  import("./admin/AdminProfilePage").then((module) => ({
    default: module.AdminProfilePage,
  })),
);
const AdminAnnouncementsPage = lazy(() =>
  import("./admin/AdminAnnouncementsPage").then((module) => ({
    default: module.AdminAnnouncementsPage,
  })),
);
const CertificateTemplatesPage = lazy(() =>
  import("./admin/certificates/CertificateTemplatesPage").then((module) => ({
    default: module.CertificateTemplatesPage,
  })),
);
const CertificateEligibilityPage = lazy(() =>
  import("./admin/certificates/CertificateEligibilityPage").then((module) => ({
    default: module.CertificateEligibilityPage,
  })),
);
const CertificateQueuePage = lazy(() =>
  import("./admin/certificates/CertificateQueuePage").then((module) => ({
    default: module.CertificateQueuePage,
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
const LearnerProfilePage = lazy(() =>
  import("./learner/LearnerProfilePage").then((module) => ({
    default: module.LearnerProfilePage,
  })),
);
const LearnerProgramLessonsPage = lazy(() =>
  import("./learner/LearnerProgramLessonsPage").then((module) => ({
    default: module.LearnerProgramLessonsPage,
  })),
);
const LearnerProgramDetailPage = lazy(() =>
  import("./learner/LearnerProgramDetailPage").then((module) => ({
    default: module.LearnerProgramDetailPage,
  })),
);
const LearnerLessonPage = lazy(() =>
  import("./learner/LearnerLessonPage").then((module) => ({
    default: module.LearnerLessonPage,
  })),
);
const LearnerQuizPage = lazy(() =>
  import("./learner/LearnerQuizPage").then((module) => ({
    default: module.LearnerQuizPage,
  })),
);
const LearnerPlaceholderPage = lazy(() =>
  import("./learner/LearnerPlaceholderPage").then((module) => ({
    default: module.LearnerPlaceholderPage,
  })),
);
const LearnerHelpPage = lazy(() =>
  import("./learner/LearnerHelpPage").then((module) => ({
    default: module.LearnerHelpPage,
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
const SystemHelpdeskPage = lazy(() =>
  import("./superadmin/SystemHelpdeskPage").then((module) => ({
    default: module.SystemHelpdeskPage,
  })),
);
const SystemContentReviewPage = lazy(() =>
  import("./superadmin/SystemContentReviewPage").then((module) => ({
    default: module.SystemContentReviewPage,
  })),
);
const SystemUsersPage = lazy(() =>
  import("./superadmin/SystemUsersPage").then((module) => ({
    default: module.SystemUsersPage,
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
const TeacherClassPage = lazy(() =>
  import("./teacher/TeacherClassPage").then((module) => ({
    default: module.TeacherClassPage,
  })),
);
const TeacherClassDashboardPage = lazy(() =>
  import("./teacher/TeacherClassDashboardPage").then((module) => ({
    default: module.TeacherClassDashboardPage,
  })),
);
const TeacherProfilePage = lazy(() =>
  import("./teacher/TeacherProfilePage").then((module) => ({
    default: module.TeacherProfilePage,
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
          <Route path="profil" element={<AdminProfilePage />} />
          <Route path="pengumuman" element={<AdminAnnouncementsPage />} />
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
          <Route
            path="sertifikat"
            element={
              <ProtectedRoute allowedRoles={["admin"]}>
                <CertificateTemplatesPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="sertifikat/kelayakan"
            element={
              <ProtectedRoute allowedRoles={["admin"]}>
                <CertificateEligibilityPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="sertifikat/antrean"
            element={
              <ProtectedRoute allowedRoles={["admin"]}>
                <CertificateQueuePage />
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
          <Route path="kelas" element={<TeacherClassPage />} />
          <Route path="kelas/program/:programId" element={<ProgramBuilderPage />} />
          <Route path="kelas/:classId" element={<TeacherClassDashboardPage />} />
          <Route path="konten" element={<TeacherPlaceholderPage />} />
          <Route path="profil" element={<TeacherProfilePage />} />
          <Route path="*" element={<TeacherPlaceholderPage />} />
        </Route>

        {/* LEARNER ROUTES */}
        <Route
          path="/learner"
          element={
            <ProtectedRoute allowedRoles={["participant", "guardian", "super_admin", "admin"]}>
              <LearnerLayout>
                <Outlet />
              </LearnerLayout>
            </ProtectedRoute>
          }
        >
          <Route index element={<LearnerDashboardPage />} />
          <Route path="program-saya" element={<LearnerProgramLessonsPage />} />
          <Route path="program/:programId" element={<LearnerProgramDetailPage />} />
          <Route path="lesson/:lessonId" element={<LearnerLessonPage />} />
          <Route path="lesson/:lessonId/quiz" element={<LearnerQuizPage />} />
          <Route path="transkrip/:enrollmentId" element={<LearnerTranscriptPage />} />
          <Route path="profil" element={<LearnerProfilePage />} />
          <Route path="pendaftaran/:programId" element={<AdmissionPortalPage />} />
          <Route path="cek-status" element={<AdmissionStatusPage />} />
          <Route path="bantuan" element={<LearnerHelpPage />} />
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
          <Route path="helpdesk" element={<SystemHelpdeskPage />} />
          <Route path="konten" element={<SystemContentReviewPage />} />
          <Route path="pengguna" element={<SystemUsersPage />} />
          <Route path="keuangan" element={<AdminFinancePage />} />
          <Route path="profil" element={<AdminProfilePage />} />
          <Route path="pengumuman" element={<AdminAnnouncementsPage />} />
          <Route path="pengaturan" element={<GlobalSettingsPage />} />
          <Route path="sertifikat" element={<CertificateTemplatesPage />} />
          <Route path="sertifikat/kelayakan" element={<CertificateEligibilityPage />} />
          <Route path="sertifikat/antrean" element={<CertificateQueuePage />} />
          <Route path="*" element={<SuperAdminPlaceholderPage />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
