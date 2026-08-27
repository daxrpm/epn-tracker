import { lazy, Suspense } from "react";
import { createBrowserRouter, Navigate } from "react-router-dom";

import { ProtectedRoute } from "@/components/ProtectedRoute";
import { RoleRoute } from "@/components/RoleRoute";
import { RouteFallback } from "@/components/RouteFallback";
import { LoginPage } from "@/features/auth/pages/LoginPage";
import { RegisterPage } from "@/features/auth/pages/RegisterPage";
import { PublicCalculatorPage } from "@/features/calculators/pages/PublicCalculatorPage";
import { NotFoundPage } from "@/features/misc/pages/NotFoundPage";
import { AppLayout } from "@/layouts/AppLayout";
import { AuthLayout } from "@/layouts/AuthLayout";

/**
 * Everything behind the sign-in wall is split out of the initial bundle.
 *
 * Most visits land on the public calculator, which needs none of the malla map, the markdown
 * renderer or the admin console; loading all of it up front was the bulk of a 893 KB entry
 * chunk. Only the two auth screens and the public calculator stay eager.
 */
const lazyPage = <T extends Record<string, React.ComponentType>>(
  loader: () => Promise<T>,
  name: keyof T,
) => lazy(async () => ({ default: (await loader())[name] }));

const DashboardPage = lazyPage(
  () => import("@/features/dashboard/pages/DashboardPage"),
  "DashboardPage",
);
const OnboardingPage = lazyPage(
  () => import("@/features/onboarding/pages/OnboardingPage"),
  "OnboardingPage",
);
const CurriculumPage = lazyPage(
  () => import("@/features/curriculum/pages/CurriculumPage"),
  "CurriculumPage",
);
const SimulationPage = lazyPage(
  () => import("@/features/simulation/pages/SimulationPage"),
  "SimulationPage",
);
const MyCoursesPage = lazyPage(
  () => import("@/features/evaluation/pages/MyCoursesPage"),
  "MyCoursesPage",
);
const GradebookPage = lazyPage(
  () => import("@/features/evaluation/pages/GradebookPage"),
  "GradebookPage",
);
const RequirementsPage = lazyPage(
  () => import("@/features/requirements/pages/RequirementsPage"),
  "RequirementsPage",
);
const RecursosPage = lazyPage(
  () => import("@/features/recursos/pages/RecursosPage"),
  "RecursosPage",
);
const CalculatorPage = lazyPage(
  () => import("@/features/calculators/pages/CalculatorPage"),
  "CalculatorPage",
);
const SettingsPage = lazyPage(
  () => import("@/features/settings/pages/SettingsPage"),
  "SettingsPage",
);
const ConsolePage = lazyPage(() => import("@/features/admin/pages/ConsolePage"), "ConsolePage");
const UsersPage = lazyPage(() => import("@/features/admin/pages/UsersPage"), "UsersPage");
const ProfessorsPage = lazyPage(
  () => import("@/features/admin/pages/ProfessorsPage"),
  "ProfessorsPage",
);
const SistemaPage = lazyPage(() => import("@/features/admin/pages/SistemaPage"), "SistemaPage");

const suspended = (element: React.ReactNode) => (
  <Suspense fallback={<RouteFallback />}>{element}</Suspense>
);

export const router = createBrowserRouter([
  {
    element: <AuthLayout />,
    children: [
      { path: "/login", element: <LoginPage /> },
      { path: "/registro", element: <RegisterPage /> },
    ],
  },
  {
    element: <ProtectedRoute />,
    children: [
      {
        path: "/app",
        element: <AppLayout />,
        children: [
          { index: true, element: <Navigate to="/app/dashboard" replace /> },
          { path: "dashboard", element: suspended(<DashboardPage />) },
          { path: "onboarding", element: suspended(<OnboardingPage />) },
          { path: "curriculum", element: suspended(<CurriculumPage />) },
          { path: "simulacion", element: suspended(<SimulationPage />) },
          { path: "notas", element: suspended(<MyCoursesPage />) },
          { path: "notas/:curriculumCourseId", element: suspended(<GradebookPage />) },
          { path: "requisitos", element: suspended(<RequirementsPage />) },
          { path: "recursos", element: suspended(<RecursosPage />) },
          { path: "calculadora", element: suspended(<CalculatorPage />) },
          { path: "ajustes", element: suspended(<SettingsPage />) },
          {
            element: <RoleRoute roles={["ADMIN", "SUPER_ADMIN"]} />,
            children: [
              { path: "admin", element: suspended(<ConsolePage />) },
              { path: "admin/profesores", element: suspended(<ProfessorsPage />) },
            ],
          },
          {
            element: <RoleRoute roles={["SUPER_ADMIN"]} />,
            children: [
              { path: "admin/usuarios", element: suspended(<UsersPage />) },
              { path: "admin/sistema", element: suspended(<SistemaPage />) },
            ],
          },
          { path: "*", element: <NotFoundPage /> },
        ],
      },
    ],
  },
  { path: "/", element: <PublicCalculatorPage /> },
  { path: "*", element: <NotFoundPage /> },
]);
