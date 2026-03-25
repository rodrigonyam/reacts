import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AppLayout } from './components/layout/AppLayout';
import { Dashboard } from './components/dashboard/Dashboard';
import { BookingsList } from './components/bookings/BookingsList';
import { SlotManager } from './components/slots/SlotManager';
import { ReschedulePage } from './pages/ReschedulePage';
import { CalendarSyncPage } from './pages/CalendarSyncPage';
import { BookingPage } from './pages/BookingPage';
import { RemindersPage } from './pages/RemindersPage';
import { TimeZonePage } from './pages/TimeZonePage';
import { BookingPoliciesPage } from './pages/BookingPoliciesPage';
import { ClientsPage } from './pages/ClientsPage';
import { GroupSchedulingPage } from './pages/GroupSchedulingPage';
import { StaffManagementPage } from './pages/StaffManagementPage';
import { PaymentGatewayPage } from './pages/PaymentGatewayPage';
import { WaiverFormsPage } from './pages/WaiverFormsPage';
import { BrandingPage } from './pages/BrandingPage';
import { ReviewsPage } from './pages/ReviewsPage';
import { IntegrationsPage } from './pages/IntegrationsPage';

function App() {
  return (
    <BrowserRouter>
      <Toaster
        position="top-right"
        toastOptions={{ duration: 4000, style: { fontSize: '0.875rem' } }}
      />
      <Routes>
        {/* Public standalone pages — no app shell */}
        <Route path="/reschedule/:token" element={<ReschedulePage />} />
        <Route path="/book" element={<BookingPage />} />
        <Route path="/book/:serviceId" element={<BookingPage />} />

        {/* Main app with sidebar layout */}
        <Route
          path="/*"
          element={
            <AppLayout>
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/bookings" element={<BookingsList />} />
                <Route path="/slots" element={<SlotManager />} />
                <Route path="/calendar-sync" element={<CalendarSyncPage />} />
                <Route path="/reminders" element={<RemindersPage />} />
                <Route path="/timezone" element={<TimeZonePage />} />
                <Route path="/policies" element={<BookingPoliciesPage />} />
                <Route path="/clients" element={<ClientsPage />} />
                <Route path="/groups" element={<GroupSchedulingPage />} />
                <Route path="/staff" element={<StaffManagementPage />} />
                <Route path="/payment-settings" element={<PaymentGatewayPage />} />
                <Route path="/waivers" element={<WaiverFormsPage />} />
                <Route path="/branding" element={<BrandingPage />} />
                <Route path="/reviews" element={<ReviewsPage />} />
                <Route path="/integrations" element={<IntegrationsPage />} />
              </Routes>
            </AppLayout>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
