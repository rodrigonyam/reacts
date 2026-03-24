import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AppLayout } from './components/layout/AppLayout';
import { Dashboard } from './components/dashboard/Dashboard';
import { BookingsList } from './components/bookings/BookingsList';
import { SlotManager } from './components/slots/SlotManager';
import { ReschedulePage } from './pages/ReschedulePage';

function App() {
  return (
    <BrowserRouter>
      <Toaster
        position="top-right"
        toastOptions={{ duration: 4000, style: { fontSize: '0.875rem' } }}
      />
      <Routes>
        {/* Public standalone page — no app shell */}
        <Route path="/reschedule/:token" element={<ReschedulePage />} />

        {/* Main app with sidebar layout */}
        <Route
          path="/*"
          element={
            <AppLayout>
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/bookings" element={<BookingsList />} />
                <Route path="/slots" element={<SlotManager />} />
              </Routes>
            </AppLayout>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
