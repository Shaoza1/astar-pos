import { useNavigate } from 'react-router-dom';

import { useAuth } from '@/store/auth.context';

const links = [
  { label: 'Variance Report', desc: 'Stock counts vs expected', path: '/admin/variance' },
  { label: 'Sales Report', desc: 'Revenue, transactions, top items', path: '/admin/sales' },
  { label: 'Deliveries', desc: 'Record and verify deliveries', path: '/admin/deliveries' },
  { label: 'Inventory', desc: 'Stock levels and adjustments', path: '/admin/inventory' },
  { label: 'Menu', desc: 'Items, prices, recipes', path: '/admin/menu' },
  { label: 'Staff', desc: 'Manage staff and PINs', path: '/admin/staff' },
  { label: 'Shifts', desc: 'Open, close, and review shifts', path: '/admin/shifts' },
];

export default function AdminDashboardPage() {
  const navigate = useNavigate();
  const { currentStaff, logout } = useAuth();

  return (
    <div className="min-h-screen bg-[var(--color-surface)] p-4">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-[var(--color-primary)]">Admin</h1>
          <p className="text-sm text-gray-500">{currentStaff?.fullName}</p>
        </div>
        <button onClick={logout} className="text-sm text-gray-500 underline">
          Sign out
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        {links.map((link) => (
          <button
            key={link.path}
            onClick={() => navigate(link.path)}
            className="bg-white rounded-2xl p-5 text-left shadow-sm border border-gray-100 hover:border-[var(--color-primary)] active:scale-95 transition-all"
          >
            <p className="font-semibold text-[var(--color-primary)] mb-1">{link.label}</p>
            <p className="text-xs text-gray-500">{link.desc}</p>
          </button>
        ))}
      </div>
    </div>
  );
}
