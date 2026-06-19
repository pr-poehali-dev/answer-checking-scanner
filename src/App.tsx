
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

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/yadisk-callback" element={<YadiskCallback />} />
          <Route path="/oferta" element={<OfertaPage />} />
          <Route path="/privacy" element={<PrivacyPage />} />
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
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;