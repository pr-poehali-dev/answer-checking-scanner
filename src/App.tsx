
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import YadiskCallback from "./pages/YadiskCallback";
import OfertaPage from "./pages/OfertaPage";
import PrivacyPage from "./pages/PrivacyPage";
import SjouPage from "./pages/SjouPage";
import SjouOperatorPage from "./pages/SjouOperatorPage";
import SjouCabinetPage from "./pages/SjouCabinetPage";
import SjouTeacherPage from "./pages/SjouTeacherPage";
import SjouStudentPage from "./pages/SjouStudentPage";
import SjouParentPage from "./pages/SjouParentPage";
import UdsPage from "./pages/UdsPage";
import KnowledgeBasePage from "./pages/KnowledgeBasePage";
import MaterialsPage from "./pages/MaterialsPage";
import PublicHomePage from "./pages/PublicHomePage";
import SiteVersionBadge from "./components/SiteVersionBadge";
import AccessibilityPanel from "./components/AccessibilityPanel";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <a href="#main-content" className="skip-to-content">
          Перейти к основному содержимому
        </a>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/yadisk-callback" element={<YadiskCallback />} />
          <Route path="/oferta" element={<OfertaPage />} />
          <Route path="/privacy" element={<PrivacyPage />} />
          <Route path="/knowledge-base" element={<KnowledgeBasePage />} />
          <Route path="/materials" element={<MaterialsPage />} />
          <Route path="/home" element={<PublicHomePage />} />
          <Route path="/sjou" element={<SjouPage />} />
          <Route path="/sjou-operator" element={<SjouOperatorPage />} />
          <Route path="/sjou-cabinet" element={<SjouCabinetPage />} />
          <Route path="/sjou-teacher" element={<SjouTeacherPage />} />
          <Route path="/sjou-student" element={<SjouStudentPage />} />
          <Route path="/sjou-parent" element={<SjouParentPage />} />
          <Route path="/piot-colldent19" element={<UdsPage />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
        <SiteVersionBadge />
        <AccessibilityPanel />
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;