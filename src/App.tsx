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
import { SubscriptionManagement } from "./pages/Settings/SubscriptionManagement";
import { Subscriptions } from "./pages/Subscriptions/Subscriptions";
import { IntakeForm } from "./pages/Intake/IntakeForm";
import { RequestList } from "./pages/Requests/RequestList";
import { RequestDetail } from "./pages/Requests/RequestDetail";
import { USDTPurchases } from "./pages/Finance/USDTPurchases";
import { Inventory } from "./pages/Inventory/Inventory";
import { ProfitReports } from "./pages/Reports/ProfitReports";
import { AuthProvider } from "./contexts/AuthContext";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { LoginPage } from "./pages/Login/LoginPage";
import { LocalizationProvider } from "./contexts/LocalizationContext";

function App() {
  useEffect(() => {
    // Run data migrations
    storage.migrateData();
  }, []);

  return (
    <ToastProvider>
      <LocalizationProvider>
        <AuthProvider>
          <Router basename="/subscription-tracker/">
            <Routes>
              {/* Public Routes */}
              <Route path="/login" element={<LoginPage />} />
              <Route path="/intake" element={<IntakeForm />} />

              {/* Admin Routes */}
              <Route
                element={
                  <ProtectedRoute>
                    <Layout />
                  </ProtectedRoute>
                }
              >
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
              <Route path="/finance/usdt" element={<USDTPurchases />} />
              <Route path="/inventory" element={<Inventory />} />
              <Route path="/reports/profit" element={<ProfitReports />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/settings/products" element={<SubscriptionManagement />} />
              </Route>
            </Routes>
          </Router>
        </AuthProvider>
      </LocalizationProvider>
    </ToastProvider>
  );
}

export default App;
