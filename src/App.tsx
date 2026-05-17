import { Navigate, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { RequireAuth } from './components/RequireAuth';
import { LoginPage } from './pages/LoginPage';
import { AdminPage } from './pages/AdminPage';
import { ScanPage } from './pages/ScanPage';
import { CustomerCouponPage } from './pages/CustomerCouponPage';
import { ReportsPage } from './pages/ReportsPage';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/c/:token" element={<CustomerCouponPage />} />
      <Route
        path="/*"
        element={
          <Layout>
            <Routes>
              <Route path="/" element={<Navigate to="/scan" replace />} />
              <Route path="/scan" element={<RequireAuth roles={['owner', 'admin', 'staff']}><ScanPage /></RequireAuth>} />
              <Route path="/admin" element={<RequireAuth roles={['owner', 'admin']}><AdminPage /></RequireAuth>} />
              <Route path="/reports" element={<RequireAuth roles={['owner', 'admin']}><ReportsPage /></RequireAuth>} />
              <Route path="*" element={<Navigate to="/scan" replace />} />
            </Routes>
          </Layout>
        }
      />
    </Routes>
  );
}
