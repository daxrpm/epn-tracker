import { createBrowserRouter, Navigate } from "react-router-dom";

import { ProtectedRoute } from "@/components/ProtectedRoute";
import { LoginPage } from "@/features/auth/pages/LoginPage";
import { RegisterPage } from "@/features/auth/pages/RegisterPage";
import { CalculatorPage } from "@/features/calculators/pages/CalculatorPage";
import { CurriculumPage } from "@/features/curriculum/pages/CurriculumPage";
import { DashboardPage } from "@/features/dashboard/pages/DashboardPage";
import { OnboardingPage } from "@/features/onboarding/pages/OnboardingPage";
import { RequirementsPage } from "@/features/requirements/pages/RequirementsPage";
import { AppLayout } from "@/layouts/AppLayout";
import { AuthLayout } from "@/layouts/AuthLayout";

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
          { path: "dashboard", element: <DashboardPage /> },
          { path: "onboarding", element: <OnboardingPage /> },
          { path: "curriculum", element: <CurriculumPage /> },
          { path: "requisitos", element: <RequirementsPage /> },
          { path: "calculadora", element: <CalculatorPage /> },
        ],
      },
    ],
  },
  { path: "/", element: <Navigate to="/app/dashboard" replace /> },
  { path: "*", element: <Navigate to="/app/dashboard" replace /> },
]);
