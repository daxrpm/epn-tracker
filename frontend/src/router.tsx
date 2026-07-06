import { createBrowserRouter, Navigate } from "react-router-dom";

import { ProtectedRoute } from "@/components/ProtectedRoute";
import { LoginPage } from "@/features/auth/pages/LoginPage";
import { RegisterPage } from "@/features/auth/pages/RegisterPage";
import { CalculatorPage } from "@/features/calculators/pages/CalculatorPage";
import { PublicCalculatorPage } from "@/features/calculators/pages/PublicCalculatorPage";
import { CurriculumPage } from "@/features/curriculum/pages/CurriculumPage";
import { DashboardPage } from "@/features/dashboard/pages/DashboardPage";
import { GradebookPage } from "@/features/evaluation/pages/GradebookPage";
import { MyCoursesPage } from "@/features/evaluation/pages/MyCoursesPage";
import { OnboardingPage } from "@/features/onboarding/pages/OnboardingPage";
import { RecursosPage } from "@/features/recursos/pages/RecursosPage";
import { RequirementsPage } from "@/features/requirements/pages/RequirementsPage";
import { SettingsPage } from "@/features/settings/pages/SettingsPage";
import { SimulationPage } from "@/features/simulation/pages/SimulationPage";
import { ConsolePage } from "@/features/admin/pages/ConsolePage";
import { ProfessorsPage } from "@/features/admin/pages/ProfessorsPage";
import { SistemaPage } from "@/features/admin/pages/SistemaPage";
import { UsersPage } from "@/features/admin/pages/UsersPage";
import { AppLayout } from "@/layouts/AppLayout";
import { AuthLayout } from "@/layouts/AuthLayout";

export const router = createBrowserRouter([
  {
    element: <AuthLayout />,
    children: [
      { path: "/login", element: <LoginPage /> },
      {
        path: "/login/hero",
        lazy: async () => {
          const { HeroLoginPage } = await import("@/features/auth/pages/HeroLoginPage");
          return { Component: HeroLoginPage };
        },
      },
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
          { path: "dashboard", element: <DashboardPage /> },
          { path: "onboarding", element: <OnboardingPage /> },
          { path: "curriculum", element: <CurriculumPage /> },
          { path: "simulacion", element: <SimulationPage /> },
          { path: "notas", element: <MyCoursesPage /> },
          { path: "notas/:curriculumCourseId", element: <GradebookPage /> },
          { path: "requisitos", element: <RequirementsPage /> },
          { path: "recursos", element: <RecursosPage /> },
          { path: "calculadora", element: <CalculatorPage /> },
          { path: "admin", element: <ConsolePage /> },
          { path: "admin/usuarios", element: <UsersPage /> },
          { path: "admin/profesores", element: <ProfessorsPage /> },
          { path: "admin/sistema", element: <SistemaPage /> },
          { path: "ajustes", element: <SettingsPage /> },
        ],
      },
    ],
  },
  { path: "/", element: <PublicCalculatorPage /> },
  { path: "*", element: <Navigate to="/" replace /> },
]);
