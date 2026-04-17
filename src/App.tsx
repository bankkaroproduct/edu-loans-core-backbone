import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";
import { PartnerContextProvider } from "@/hooks/usePartnerContext";
import { StudentAuthProvider } from "@/hooks/useStudentAuth";
import { AppLayout } from "@/components/AppLayout";
import { AdminRoute } from "@/components/AdminRoute";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import Index from "./pages/Index";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminLeads from "./pages/admin/AdminLeads";
import AdminLeadDetail from "./pages/admin/AdminLeadDetail";
import AdminPlaceholder from "./pages/admin/AdminPlaceholder";
import Login from "./pages/Login";
import Leads from "./pages/Leads";
import AddLead from "./pages/AddLead";
import QuickLead from "./pages/QuickLead";
import LeadDetail from "./pages/LeadDetail";
import LeadDocuments from "./pages/LeadDocuments";
import BulkUpload from "./pages/BulkUpload";
import Payouts from "./pages/Payouts";
import Partners from "./pages/Partners";
import Settings from "./pages/Settings";
import MasterData from "./pages/MasterData";
import NotFound from "./pages/NotFound";
import StudentLanding from "./pages/student/StudentLanding";
import StudentLogin from "./pages/student/StudentLogin";
import StudentContinue from "./pages/student/StudentContinue";
import StudentBasicDetails from "./pages/student/StudentBasicDetails";
import StudentEducationDetails from "./pages/student/StudentEducationDetails";
import StudentCoapplicantDetails from "./pages/student/StudentCoapplicantDetails";
import StudentReviewSubmit from "./pages/student/StudentReviewSubmit";
import StudentRecommendations from "./pages/student/StudentRecommendations";
import StudentDocuments from "./pages/student/StudentDocuments";
import StudentTracker from "./pages/student/StudentTracker";

const queryClient = new QueryClient();

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => (
  <AppLayout>{children}</AppLayout>
);

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
          <PartnerContextProvider>
          <StudentAuthProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            {/* Student Portal */}
            <Route path="/student" element={<StudentLanding />} />
            <Route path="/student/login" element={<StudentLogin />} />
            <Route path="/student/continue" element={<StudentContinue />} />
            <Route path="/student/apply/basic" element={<StudentBasicDetails />} />
            <Route path="/student/apply/education" element={<StudentEducationDetails />} />
            <Route path="/student/apply/coapplicant" element={<StudentCoapplicantDetails />} />
            <Route path="/student/apply/review" element={<StudentReviewSubmit />} />
            <Route path="/student/recommendations" element={<StudentRecommendations />} />
            <Route path="/student/documents" element={<StudentDocuments />} />
            <Route path="/student/tracker" element={<StudentTracker />} />
            {/* Partner Portal */}
            <Route path="/" element={<ProtectedRoute><Index /></ProtectedRoute>} />
            <Route path="/leads" element={<ProtectedRoute><Leads /></ProtectedRoute>} />
            <Route path="/leads/new" element={<ProtectedRoute><AddLead /></ProtectedRoute>} />
            <Route path="/leads/quick" element={<ProtectedRoute><QuickLead /></ProtectedRoute>} />
            <Route path="/leads/:id" element={<ProtectedRoute><LeadDetail /></ProtectedRoute>} />
            <Route path="/leads/:id/documents" element={<ProtectedRoute><LeadDocuments /></ProtectedRoute>} />
            <Route path="/bulk-upload" element={<ProtectedRoute><BulkUpload /></ProtectedRoute>} />
            <Route path="/payouts" element={<ProtectedRoute><Payouts /></ProtectedRoute>} />
            <Route path="/master-data" element={<ProtectedRoute><MasterData /></ProtectedRoute>} />
            <Route path="/partners" element={<ProtectedRoute><Partners /></ProtectedRoute>} />
            <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
            {/* Admin Console */}
            <Route path="/admin" element={<AdminRoute><AdminDashboard /></AdminRoute>} />
            <Route path="/admin/leads" element={<AdminRoute><AdminLeads /></AdminRoute>} />
            <Route path="/admin/leads/:id" element={<AdminRoute><AdminLeadDetail /></AdminRoute>} />
            <Route path="/admin/pipeline" element={<AdminRoute><AdminPlaceholder title="Pipeline" description="Drag-and-drop lifecycle management across all stages." /></AdminRoute>} />
            <Route path="/admin/underwriting" element={<AdminRoute><AdminPlaceholder title="Underwriting" description="BRE evaluation, lender matching, and credit query workflows." /></AdminRoute>} />
            <Route path="/admin/disbursements" element={<AdminRoute><AdminPlaceholder title="Disbursements" description="Sanction tracking and disbursement reconciliation." /></AdminRoute>} />
            <Route path="/admin/reports" element={<AdminRoute><AdminPlaceholder title="Reports" description="Cross-partner analytics, payouts, and operational reports." /></AdminRoute>} />
            <Route path="/admin/lenders" element={<AdminRoute><AdminPlaceholder title="Lender Management" description="Manage lender catalog, mappings, and BRE rules." /></AdminRoute>} />
            <Route path="/admin/universities" element={<AdminRoute><AdminPlaceholder title="University Management" description="Manage the universities master and lender mappings." /></AdminRoute>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
          </StudentAuthProvider>
          </PartnerContextProvider>
        </AuthProvider>
      </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
