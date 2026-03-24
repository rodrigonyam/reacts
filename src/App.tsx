import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AppLayout } from './components/layout/AppLayout';
import { Dashboard } from './components/dashboard/Dashboard';
import { BookingsList } from './components/bookings/BookingsList';
import { SlotManager } from './components/slots/SlotManager';
import { ReschedulePage } from './pages/ReschedulePage';
import { CalendarSyncPage } from './pages/CalendarSyncPage';
import { BookingPage } from './pages/BookingPage';

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
              </Routes>
            </AppLayout>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
