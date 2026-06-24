import { lazy, Suspense } from "react";
import { Navigate, Route, Routes, Outlet } from "react-router-dom";
import { Card, CardContent } from "../components/ui/card";
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
const ProgramBuilderPage = lazy(() =>
  import("./admin/ProgramBuilderPage").then((module) => ({
    default: module.ProgramBuilderPage,
  })),
);
const LearnerDashboardPage = lazy(() =>
  import("./learner/LearnerDashboardPage").then((module) => ({
    default: module.LearnerDashboardPage,
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
const HomePage = lazy(() =>
  import("./public/HomePage").then((module) => ({ default: module.HomePage })),
);
const ProgramCatalogPage = lazy(() =>
  import("./public/ProgramCatalogPage").then((module) => ({
    default: module.ProgramCatalogPage,
  })),
);
const ProgramDetailPage = lazy(() =>
  import("./public/ProgramDetailPage").then((module) => ({
    default: module.ProgramDetailPage,
  })),
);
const ProgramRegistrationPage = lazy(() =>
  import("./public/ProgramRegistrationPage").then((module) => ({
    default: module.ProgramRegistrationPage,
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
  return (
    <Card className="m-6">
      <CardContent className="pt-6 text-sm text-muted-foreground">
        Memuat halaman...
      </CardContent>
    </Card>
  );
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
            path="program/:programId"
            element={
              <ProtectedRoute allowedRoles={["admin"]}>
                <ProgramBuilderPage />
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
          <Route path="program" element={<AdminProgramListPage />} />
          <Route path="program/:programId" element={<ProgramBuilderPage />} />
          <Route path="*" element={<SuperAdminPlaceholderPage />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
