import { useEffect } from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { Layout } from "./components/layout/Layout";
import { storage } from "./services/storage";
import { Dashboard } from "./pages/Dashboard";
import { ToastProvider } from "./components/ui/Toast";
import { CustomerList } from "./pages/Customers/CustomerList";
import { CustomerDetail } from "./pages/Customers/CustomerDetail";
import { CustomerForm } from "./pages/Customers/CustomerForm";
import { ReminderCentre } from "./pages/Reminders/ReminderCentre";
import { RenewalHistoryPage } from "./pages/History/RenewalHistory";
import { Reports } from "./pages/Reports/Reports";
import { SettingsPage } from "./pages/Settings/Settings";
import { Subscriptions } from "./pages/Subscriptions/Subscriptions";
import { IntakeForm } from "./pages/Intake/IntakeForm";
import { RequestList } from "./pages/Requests/RequestList";
import { RequestDetail } from "./pages/Requests/RequestDetail";

function App() {
  useEffect(() => {
    // Run data migrations
    storage.migrateData();
  }, []);

  return (
    <ToastProvider>
      <Router>
        <Routes>
          {/* Public Routes */}
          <Route path="/intake" element={<IntakeForm />} />

          {/* Admin Routes */}
          <Route element={<Layout />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/customers" element={<CustomerList />} />
            <Route path="/customers/new" element={<CustomerForm />} />
            <Route path="/customers/:id" element={<CustomerDetail />} />
            <Route path="/customers/:id/edit" element={<CustomerForm />} />
            <Route path="/subscriptions" element={<Subscriptions />} />
            <Route path="/requests" element={<RequestList />} />
            <Route path="/requests/:id" element={<RequestDetail />} />
            <Route path="/reminders" element={<ReminderCentre />} />
            <Route path="/history" element={<RenewalHistoryPage />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Route>
        </Routes>
      </Router>
    </ToastProvider>
  );
}

export default App;
