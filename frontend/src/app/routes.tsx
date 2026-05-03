import { Navigate, Route, Routes } from "react-router-dom";
import { AppShellLayout } from "@/widgets/app-shell/AppShellLayout";
import { AnalyzePage } from "@/pages/analyze/AnalyzePage";
import { DashboardPage } from "@/pages/dashboard/DashboardPage";
import { NotFoundPage } from "@/pages/not-found/NotFoundPage";
import { StoreExplorerPage } from "@/pages/store/StoreExplorerPage";

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<AppShellLayout />}>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/analyze" element={<AnalyzePage />} />
        <Route path="/store" element={<StoreExplorerPage />} />
        <Route path="/404" element={<NotFoundPage />} />
        <Route path="*" element={<Navigate to="/404" replace />} />
      </Route>
    </Routes>
  );
}
