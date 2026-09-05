import { BrowserRouter, Routes, Route } from 'react-router-dom'

import LoginPage from './pages/LoginPage'
import SignupPage from './pages/SignupPage'
import ForgotPasswordPage from './pages/ForgotPasswordPage'
import UpdatePasswordPage from './pages/UpdatePasswordPage'
import AuthCallbackPage from './pages/AuthCallbackPage'

import DashboardLayout from './pages/dashboard/DashboardLayout'
import AdminGate from './pages/dashboard/AdminGate'
import OverviewPage from './pages/dashboard/OverviewPage'
import CeoPage from './pages/dashboard/CeoPage'
import AcademicLeadPage from './pages/dashboard/AcademicLeadPage'
import StatusPage from './pages/dashboard/StatusPage'
import SalesPage from './pages/dashboard/SalesPage'
import SalesIntimationPage from './pages/dashboard/SalesIntimationPage'
import SalesBatchDetailPage from './pages/dashboard/SalesBatchDetailPage'
import BatchesPage from './pages/dashboard/BatchesPage'
import PastBatchesPage from './pages/dashboard/PastBatchesPage'
import CreateBatchPage from './pages/dashboard/CreateBatchPage'
import VerificationQueuePage from './pages/dashboard/VerificationQueuePage'
import Student360Page from './pages/dashboard/Student360Page'
import StudentDetailPage from './pages/dashboard/StudentDetailPage'
import LmsAccessPolicyPage from './pages/dashboard/LmsAccessPolicyPage'
import ReportsPage from './pages/dashboard/ReportsPage'
import ProfilePage from './pages/dashboard/ProfilePage'
import BatchDetailPage from './pages/dashboard/BatchDetailPage'
import BatchEditPage from './pages/dashboard/BatchEditPage'
import SchoolsPage from './pages/dashboard/admin/SchoolsPage'
import UsersPage from './pages/dashboard/admin/UsersPage'
import UserHistoryPage from './pages/dashboard/admin/UserHistoryPage'
import ApproveUsersPage from './pages/dashboard/admin/ApproveUsersPage'
import LogsPage from './pages/dashboard/admin/LogsPage'

// Route table is a direct page-for-page mirror of the original Next.js app/ directory
// (`src/app/**/page.tsx` → one <Route> each, dynamic `[id]` segments → `:id`). Dashboard
// auth-gating happens inside DashboardLayout/AdminGate themselves (client-side localStorage
// check, matching the original) rather than as a separate ProtectedRoute wrapper here.
function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/update-password" element={<UpdatePasswordPage />} />
        <Route path="/auth/callback" element={<AuthCallbackPage />} />

        <Route path="/dashboard" element={<DashboardLayout />}>
          <Route index element={<OverviewPage />} />
          <Route path="ceo" element={<CeoPage />} />
          <Route path="academic-lead" element={<AcademicLeadPage />} />
          <Route path="status" element={<StatusPage />} />
          <Route path="sales" element={<SalesPage />} />
          <Route path="sales/intimation" element={<SalesIntimationPage />} />
          <Route path="sales/batch/:id" element={<SalesBatchDetailPage />} />
          <Route path="batches" element={<BatchesPage />} />
          <Route path="past-batches" element={<PastBatchesPage />} />
          <Route path="create-batch" element={<CreateBatchPage />} />
          <Route path="verification-queue" element={<VerificationQueuePage />} />
          <Route path="student-360" element={<Student360Page />} />
          <Route path="student/:id" element={<StudentDetailPage />} />
          <Route path="lms-access-policy" element={<LmsAccessPolicyPage />} />
          <Route path="reports" element={<ReportsPage />} />
          <Route path="profile" element={<ProfilePage />} />
          <Route path="batch/:id" element={<BatchDetailPage />} />
          <Route path="batch/:id/edit" element={<BatchEditPage />} />

          {/* Outside AdminGate (which also covers Users/Approve Users/Logs) — Academic Lead
              needs Schools & Courses too (to add a course while creating a batch) but not
              those other admin pages. SchoolsPage guards itself, matching AdminGate's pattern. */}
          <Route path="admin/schools" element={<SchoolsPage />} />

          <Route path="admin" element={<AdminGate />}>
            <Route path="users" element={<UsersPage />} />
            <Route path="users/:id/history" element={<UserHistoryPage />} />
            <Route path="approve-users" element={<ApproveUsersPage />} />
            <Route path="logs" element={<LogsPage />} />
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App
