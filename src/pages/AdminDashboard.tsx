import AdminGuard from '../components/admin/AdminGuard';
import AdminLayout from '../components/admin/AdminLayout';

export default function AdminDashboard() {
  return (
    <AdminGuard>
      <AdminLayout />
    </AdminGuard>
  );
}
