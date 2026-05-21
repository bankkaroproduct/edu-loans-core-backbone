// build trigger 2026-04-27
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
import AdminSendToLender from "./pages/admin/AdminSendToLender";

import AdminEditRequests from "./pages/admin/AdminEditRequests";
import AdminMasterData from "./pages/admin/AdminMasterData";
import AdminPremiereLists from "./pages/admin/AdminPremiereLists";
import AdminPartners from "./pages/admin/AdminPartners";
import AdminLenders from "./pages/admin/AdminLenders";
import AdminReports from "./pages/admin/AdminReports";
import BreDashboard from "./pages/admin/bre/BreDashboard";
import BreLenderRulesList from "./pages/admin/bre/BreLenderRulesList";
import BreLenderRuleEditor from "./pages/admin/bre/BreLenderRuleEditor";
import BreScoringConfigEditor from "./pages/admin/bre/BreScoringConfigEditor";
import BreLenderScorecardDetail from "./pages/admin/bre/BreLenderScorecardDetail";
import BreVersionHistory from "./pages/admin/bre/BreVersionHistory";
import BreAuditLog from "./pages/admin/bre/BreAuditLog";
import BreSimulate from "./pages/admin/bre/BreSimulate";
import { BreAccessGate } from "./components/bre/BreAccessGate";
import { SectionGate, SuperAdminGate } from "./components/admin/SectionGate";
import AdminUsers from "./pages/admin/AdminUsers";
import AdminAddLead from "./pages/admin/AdminAddLead";
import AdminBulkUpload from "./pages/admin/AdminBulkUpload";
import AdminCommunications from "./pages/admin/AdminCommunications";
import AdminCommunicationLogs from "./pages/admin/AdminCommunicationLogs";
import AdminCommunicationTemplates from "./pages/admin/AdminCommunicationTemplates";
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
            <Route path="/admin" element={<AdminRoute><SectionGate section="dashboard"><AdminDashboard /></SectionGate></AdminRoute>} />
            <Route path="/admin/leads" element={<AdminRoute><SectionGate section="lead_queue"><AdminLeads /></SectionGate></AdminRoute>} />
            <Route path="/admin/leads/new" element={<AdminRoute><SectionGate section="add_lead"><AdminAddLead /></SectionGate></AdminRoute>} />
            <Route path="/admin/leads/bulk" element={<AdminRoute><SectionGate section="bulk_upload"><AdminBulkUpload /></SectionGate></AdminRoute>} />
            <Route path="/admin/leads/:id" element={<AdminRoute><SectionGate section="lead_queue"><AdminLeadDetail /></SectionGate></AdminRoute>} />
            <Route path="/admin/leads/:id/documents" element={<AdminRoute><SectionGate section="lead_queue"><LeadDocuments /></SectionGate></AdminRoute>} />
            <Route path="/admin/leads/:id/send-to-lender" element={<AdminRoute><SectionGate section="lead_queue"><AdminSendToLender /></SectionGate></AdminRoute>} />
            <Route path="/admin/edit-requests" element={<AdminRoute><SectionGate section="lead_queue"><AdminEditRequests /></SectionGate></AdminRoute>} />
            <Route path="/admin/requests" element={<AdminRoute><SectionGate section="lead_queue"><AdminEditRequests /></SectionGate></AdminRoute>} />
            <Route path="/admin/master-data" element={<AdminRoute><SectionGate section="master_data"><AdminMasterData /></SectionGate></AdminRoute>} />
            <Route path="/admin/premiere-lists" element={<AdminRoute><SectionGate section="premiere_lists"><AdminPremiereLists /></SectionGate></AdminRoute>} />
            <Route path="/admin/partners" element={<AdminRoute><SectionGate section="partners"><AdminPartners /></SectionGate></AdminRoute>} />
            <Route path="/admin/lenders" element={<AdminRoute><SectionGate section="lenders"><AdminLenders /></SectionGate></AdminRoute>} />
            <Route path="/admin/reports" element={<AdminRoute><SectionGate section="reports"><AdminReports /></SectionGate></AdminRoute>} />
            <Route path="/admin/communications" element={<AdminRoute><SectionGate section="communications"><AdminCommunications /></SectionGate></AdminRoute>} />
            <Route path="/admin/communications/logs" element={<AdminRoute><SectionGate section="communications"><AdminCommunicationLogs /></SectionGate></AdminRoute>} />
            <Route path="/admin/communications/templates" element={<AdminRoute><SectionGate section="communications"><AdminCommunicationTemplates /></SectionGate></AdminRoute>} />
            <Route path="/admin/users" element={<AdminRoute><SuperAdminGate><AdminUsers /></SuperAdminGate></AdminRoute>} />
            {/* BRE Engine — Admin only, additionally gated by bre_permission */}
            <Route path="/admin/bre" element={<AdminRoute><SectionGate section="bre"><BreAccessGate><BreDashboard /></BreAccessGate></SectionGate></AdminRoute>} />
            <Route path="/admin/bre/scoring" element={<AdminRoute><SectionGate section="bre"><BreAccessGate><BreScoringConfigEditor /></BreAccessGate></SectionGate></AdminRoute>} />
            <Route path="/admin/bre/scoring/lenders/:lenderId" element={<AdminRoute><SectionGate section="bre"><BreAccessGate><BreLenderScorecardDetail /></BreAccessGate></SectionGate></AdminRoute>} />
            <Route path="/admin/bre/lenders" element={<AdminRoute><SectionGate section="bre"><BreAccessGate><BreLenderRulesList /></BreAccessGate></SectionGate></AdminRoute>} />
            <Route path="/admin/bre/lenders/:lenderId" element={<AdminRoute><SectionGate section="bre"><BreAccessGate><BreLenderRuleEditor /></BreAccessGate></SectionGate></AdminRoute>} />
            <Route path="/admin/bre/versions" element={<AdminRoute><SectionGate section="bre"><BreAccessGate><BreVersionHistory /></BreAccessGate></SectionGate></AdminRoute>} />
            <Route path="/admin/bre/audit" element={<AdminRoute><SectionGate section="bre"><BreAccessGate><BreAuditLog /></BreAccessGate></SectionGate></AdminRoute>} />
            <Route path="/admin/bre/simulate" element={<AdminRoute><SectionGate section="bre"><BreAccessGate><BreSimulate /></BreAccessGate></SectionGate></AdminRoute>} />
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
