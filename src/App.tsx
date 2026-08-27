
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import YadiskCallback from "./pages/YadiskCallback";
import VkCallback from "./pages/VkCallback";
import ConfirmEmailPage from "./pages/ConfirmEmailPage";
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
import DocsPage from "./pages/DocsPage";
import PublicHomePage from "./pages/PublicHomePage";
import SiteVersionBadge from "./components/SiteVersionBadge";
import AccessibilityPanel from "./components/AccessibilityPanel";
import CookieConsent from "./components/CookieConsent";
import {
  AUTH_PATHS, TEACHER_PATHS, STUDENT_PATHS, OU_PATHS,
  SJOU_TEACHER_PATHS, SJOU_CABINET_PATHS, SJOU_STUDENT_PATHS, SJOU_PARENT_PATHS,
  UDS_PATHS,
} from "@/lib/routes";

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
          {/* Вход/регистрация: /areg, /areg-reg, /areg-podtv, /areg-zabyl, /areg-parol */}
          {AUTH_PATHS.filter(p => p !== "/").map(p => <Route key={p} path={p} element={<Index />} />)}
          {/* Кабинет учителя: /lk и /lk-<раздел> */}
          {TEACHER_PATHS.map(p => <Route key={p} path={p} element={<Index />} />)}
          {/* Кабинет ученика: /lk-uch и /lk-uch-<раздел> */}
          {STUDENT_PATHS.map(p => <Route key={p} path={p} element={<Index />} />)}
          {/* Кабинет учреждения: /ou, /ou-uprav, /ou-kollektiv */}
          {OU_PATHS.map(p => <Route key={p} path={p} element={<Index />} />)}
          <Route path="/yadisk-callback" element={<YadiskCallback />} />
          <Route path="/vk-callback" element={<VkCallback />} />
          <Route path="/confirm-email" element={<ConfirmEmailPage />} />
          <Route path="/oferta" element={<OfertaPage />} />
          <Route path="/privacy" element={<PrivacyPage />} />
          <Route path="/knowledge-base" element={<KnowledgeBasePage />} />
          <Route path="/materials" element={<MaterialsPage />} />
          <Route path="/docs" element={<DocsPage />} />
          <Route path="/home" element={<PublicHomePage />} />
          <Route path="/sjou" element={<SjouPage />} />
          <Route path="/sjou-operator" element={<SjouOperatorPage />} />
          {/* СЖОУ — кабинет ОО: /sjou-cabinet и /sjou-cabinet-<раздел> */}
          {SJOU_CABINET_PATHS.map(p => <Route key={p} path={p} element={<SjouCabinetPage />} />)}
          {/* СЖОУ — кабинет учителя: /sjou-teacher и /sjou-teacher-<раздел> */}
          {SJOU_TEACHER_PATHS.map(p => <Route key={p} path={p} element={<SjouTeacherPage />} />)}
          {/* СЖОУ — дневник ученика: /sjou-student и /sjou-student-<раздел> */}
          {SJOU_STUDENT_PATHS.map(p => <Route key={p} path={p} element={<SjouStudentPage />} />)}
          {/* СЖОУ — кабинет родителя: /sjou-parent и /sjou-parent-<раздел> */}
          {SJOU_PARENT_PATHS.map(p => <Route key={p} path={p} element={<SjouParentPage />} />)}
          {/* УДС: /piot-colldent19 и /piot-colldent19-<раздел> (скрытый базовый путь) */}
          {UDS_PATHS.map(p => <Route key={p} path={p} element={<UdsPage />} />)}
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
        <SiteVersionBadge />
        <AccessibilityPanel />
        <CookieConsent />
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;