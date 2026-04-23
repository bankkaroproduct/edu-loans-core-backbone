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
import AdminLogin from "./pages/admin/AdminLogin";
import AdminLeads from "./pages/admin/AdminLeads";
import AdminLeadDetail from "./pages/admin/AdminLeadDetail";

import AdminEditRequests from "./pages/admin/AdminEditRequests";
import AdminMasterData from "./pages/admin/AdminMasterData";
import AdminPartners from "./pages/admin/AdminPartners";
import AdminLenders from "./pages/admin/AdminLenders";
import AdminReports from "./pages/admin/AdminReports";
import BreDashboard from "./pages/admin/bre/BreDashboard";
import BreLenderRulesList from "./pages/admin/bre/BreLenderRulesList";
import BreLenderRuleEditor from "./pages/admin/bre/BreLenderRuleEditor";
import BreScoringConfigEditor from "./pages/admin/bre/BreScoringConfigEditor";
import BreVersionHistory from "./pages/admin/bre/BreVersionHistory";
import BreAuditLog from "./pages/admin/bre/BreAuditLog";
import BreSimulate from "./pages/admin/bre/BreSimulate";
import { BreAccessGate } from "./components/bre/BreAccessGate";
import AdminAddLead from "./pages/admin/AdminAddLead";
import AdminBulkUpload from "./pages/admin/AdminBulkUpload";
import AdminCommunications from "./pages/admin/AdminCommunications";
import AdminCommunicationLogs from "./pages/admin/AdminCommunicationLogs";
import Login from "./pages/Login";
import Leads from "./pages/Leads";
import AddLead from "./pages/AddLead";
import QuickLead from "./pages/QuickLead";
import LeadDetail from "./pages/LeadDetail";
import LeadDocuments from "./pages/LeadDocuments";
import BulkUpload from "./pages/BulkUpload";
import Payouts from "./pages/Payouts";
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
            {/* Admin Console — separate portal */}
            <Route path="/admin/login" element={<AdminLogin />} />
            <Route path="/admin" element={<AdminRoute><AdminDashboard /></AdminRoute>} />
            <Route path="/admin/leads" element={<AdminRoute><AdminLeads /></AdminRoute>} />
            <Route path="/admin/leads/new" element={<AdminRoute><AdminAddLead /></AdminRoute>} />
            <Route path="/admin/leads/bulk" element={<AdminRoute><AdminBulkUpload /></AdminRoute>} />
            <Route path="/admin/leads/:id" element={<AdminRoute><AdminLeadDetail /></AdminRoute>} />
            <Route path="/admin/leads/:id/documents" element={<AdminRoute><LeadDocuments /></AdminRoute>} />
            <Route path="/admin/edit-requests" element={<AdminRoute><AdminEditRequests /></AdminRoute>} />
            <Route path="/admin/requests" element={<AdminRoute><AdminEditRequests /></AdminRoute>} />
            <Route path="/admin/master-data" element={<AdminRoute><AdminMasterData /></AdminRoute>} />
            <Route path="/admin/partners" element={<AdminRoute><AdminPartners /></AdminRoute>} />
            <Route path="/admin/lenders" element={<AdminRoute><AdminLenders /></AdminRoute>} />
            <Route path="/admin/reports" element={<AdminRoute><AdminReports /></AdminRoute>} />
            <Route path="/admin/communications" element={<AdminRoute><AdminCommunications /></AdminRoute>} />
            <Route path="/admin/communications/logs" element={<AdminRoute><AdminCommunicationLogs /></AdminRoute>} />
            {/* BRE Engine — Admin only, additionally gated by bre_permission */}
            <Route path="/admin/bre" element={<AdminRoute><BreAccessGate><BreDashboard /></BreAccessGate></AdminRoute>} />
            <Route path="/admin/bre/scoring" element={<AdminRoute><BreAccessGate><BreScoringConfigEditor /></BreAccessGate></AdminRoute>} />
            <Route path="/admin/bre/lenders" element={<AdminRoute><BreAccessGate><BreLenderRulesList /></BreAccessGate></AdminRoute>} />
            <Route path="/admin/bre/lenders/:lenderId" element={<AdminRoute><BreAccessGate><BreLenderRuleEditor /></BreAccessGate></AdminRoute>} />
            <Route path="/admin/bre/versions" element={<AdminRoute><BreAccessGate><BreVersionHistory /></BreAccessGate></AdminRoute>} />
            <Route path="/admin/bre/audit" element={<AdminRoute><BreAccessGate><BreAuditLog /></BreAccessGate></AdminRoute>} />
            <Route path="/admin/bre/simulate" element={<AdminRoute><BreAccessGate><BreSimulate /></BreAccessGate></AdminRoute>} />
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
