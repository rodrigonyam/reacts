import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AppLayout } from './components/layout/AppLayout';
import { Dashboard } from './components/dashboard/Dashboard';
import { BookingsList } from './components/bookings/BookingsList';
import { SlotManager } from './components/slots/SlotManager';

function App() {
  return (
    <BrowserRouter>
      <Toaster
        position="top-right"
        toastOptions={{ duration: 4000, style: { fontSize: '0.875rem' } }}
      />
      <AppLayout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/bookings" element={<BookingsList />} />
          <Route path="/slots" element={<SlotManager />} />
        </Routes>
      </AppLayout>
    </BrowserRouter>
  );
}

export default App;
