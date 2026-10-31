import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import './index.css';
import { AuthProvider, ToastProvider, useAuth } from './lib/hooks';
import AppShell, { PortalShell } from './components/AppShell';
import Landing from './pages/Landing';
import { Login, Signup, ForgotPassword, ResetPassword } from './pages/auth/Auth';
import Dashboard from './pages/app/Dashboard';
import Customers, { CustomerDetail } from './pages/app/Customers';
import Catalog from './pages/app/Catalog';
import Quotations from './pages/app/Quotations';
import Subscriptions from './pages/app/Subscriptions';
import SubscriptionDetail from './pages/app/SubscriptionDetail';
import SubscriptionForm from './pages/app/SubscriptionForm';
import Invoices from './pages/app/Invoices';
import InvoiceDetail from './pages/app/InvoiceDetail';
import BillingRun from './pages/app/BillingRun';
import Payments from './pages/app/Payments';
import UsersPage from './pages/app/Users';
import SettingsPage from './pages/app/Settings';
import { PortalHome, PortalInvoices } from './pages/portal/Portal';

const home = (user) => (user?.role === 'CUSTOMER' ? '/portal' : '/app');

function Guard({ roles, children }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to={home(user)} replace />;
  return children;
}

function PublicOnly({ children }) {
  const { user } = useAuth();
  return user ? <Navigate to={home(user)} replace /> : children;
}

function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<PublicOnly><Login /></PublicOnly>} />
      <Route path="/signup" element={<PublicOnly><Signup /></PublicOnly>} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password/:token" element={<ResetPassword />} />

      <Route path="/app" element={<Guard roles={['ADMIN', 'STAFF']}><AppShell /></Guard>}>
        <Route index element={<Dashboard />} />
        <Route path="customers" element={<Customers />} />
        <Route path="customers/:id" element={<CustomerDetail />} />
        <Route path="catalog" element={<Catalog />} />
        <Route path="quotations" element={<Quotations />} />
        <Route path="subscriptions" element={<Subscriptions />} />
        <Route path="subscriptions/new" element={<SubscriptionForm />} />
        <Route path="subscriptions/:id" element={<SubscriptionDetail />} />
        <Route path="subscriptions/:id/edit" element={<SubscriptionForm />} />
        <Route path="billing" element={<BillingRun />} />
        <Route path="invoices" element={<Invoices />} />
        <Route path="invoices/:id" element={<InvoiceDetail />} />
        <Route path="payments" element={<Payments />} />
        <Route path="users" element={<Guard roles={['ADMIN']}><UsersPage /></Guard>} />
        <Route path="settings" element={<Guard roles={['ADMIN']}><SettingsPage /></Guard>} />
      </Route>

      <Route path="/portal" element={<Guard roles={['CUSTOMER']}><PortalShell /></Guard>}>
        <Route index element={<PortalHome />} />
        <Route path="invoices" element={<PortalInvoices />} />
        <Route path="invoices/:id" element={<InvoiceDetail portal />} />
        <Route path="subscriptions/:id" element={<SubscriptionDetail portal />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <ToastProvider>
        <AuthProvider>
          <App />
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
