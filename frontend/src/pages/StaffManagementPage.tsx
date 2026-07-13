import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import type { CreateStaffDto, StaffDto, StaffRole } from '@astar-pos/shared';

import api from '@/services/api';

const ROLES: StaffRole[] = ['owner', 'manager', 'waiter', 'barman', 'kitchen'];

function roleBadge(role: StaffRole) {
  const colours: Record<StaffRole, string> = {
    owner: 'bg-purple-100 text-purple-700',
    manager: 'bg-blue-100 text-blue-700',
    waiter: 'bg-green-100 text-green-700',
    barman: 'bg-amber-100 text-amber-700',
    kitchen: 'bg-red-100 text-red-700',
  };
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${colours[role]}`}>
      {role}
    </span>
  );
}

export default function StaffManagementPage() {
  const [staff, setStaff] = useState<StaffDto[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState<CreateStaffDto>({ fullName: '', role: 'waiter', pin: '' });
  const [tempPin, setTempPin] = useState<{ name: string; pin: string } | null>(null);

  async function load() {
    const { data } = await api.get<StaffDto[]>('/staff');
    setStaff(data);
  }

  useEffect(() => {
    void load();
  }, []);

  async function addStaff() {
    try {
      await api.post('/staff', form);
      toast.success(`${form.fullName} added`);
      setShowAdd(false);
      setForm({ fullName: '', role: 'waiter', pin: '' });
      await load();
    } catch {
      toast.error('Failed to add staff');
    }
  }

  async function deactivate(member: StaffDto) {
    try {
      await api.patch(`/staff/${member.id}`, { isActive: false });
      toast.success(`${member.fullName} deactivated`);
      await load();
    } catch {
      toast.error('Failed to deactivate');
    }
  }

  async function resetPin(member: StaffDto) {
    const newPin = Math.floor(1000 + Math.random() * 9000).toString();
    try {
      await api.post('/staff/change-pin', {
        staffId: member.id,
        currentPin: '0000', // admin override — backend should support this
        newPin,
      });
      setTempPin({ name: member.fullName, pin: newPin });
    } catch {
      toast.error('Failed to reset PIN');
    }
  }

  return (
    <div className="min-h-screen bg-[var(--color-surface)] p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-[var(--color-primary)]">Staff</h1>
        <button
          onClick={() => setShowAdd(true)}
          className="px-4 py-2 rounded-xl bg-[var(--color-primary)] text-white text-sm font-semibold"
        >
          + Add Staff
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              {['Name', 'Role', 'Status', ''].map((h) => (
                <th
                  key={h}
                  className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {staff.map((member) => (
              <tr key={member.id} className="border-b border-gray-50 hover:bg-gray-50">
                <td className="px-4 py-3 font-medium">{member.fullName}</td>
                <td className="px-4 py-3">{roleBadge(member.role)}</td>
                <td className="px-4 py-3">
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full ${member.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}
                  >
                    {member.isActive ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-3">
                    <button
                      onClick={() => void resetPin(member)}
                      className="text-xs text-[var(--color-primary)] underline"
                    >
                      Reset PIN
                    </button>
                    {member.isActive && (
                      <button
                        onClick={() => void deactivate(member)}
                        className="text-xs text-[var(--color-danger)] underline"
                      >
                        Deactivate
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add staff modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-xs shadow-2xl">
            <h2 className="text-lg font-bold mb-4">Add Staff Member</h2>
            <div className="space-y-3 mb-4">
              <input
                type="text"
                value={form.fullName}
                onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))}
                className="w-full border rounded-lg px-3 py-2"
                placeholder="Full name"
              />
              <select
                value={form.role}
                onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as StaffRole }))}
                className="w-full border rounded-lg px-3 py-2"
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
              <input
                type="password"
                value={form.pin}
                onChange={(e) => setForm((f) => ({ ...f, pin: e.target.value }))}
                className="w-full border rounded-lg px-3 py-2"
                placeholder="Initial PIN (4-6 digits)"
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowAdd(false)}
                className="flex-1 h-12 rounded-xl border border-gray-300 text-gray-700 font-medium"
              >
                Cancel
              </button>
              <button
                onClick={() => void addStaff()}
                disabled={!form.fullName || !form.pin}
                className="flex-1 h-12 rounded-xl bg-[var(--color-primary)] text-white font-semibold disabled:opacity-40"
              >
                Add
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Temp PIN display */}
      {tempPin && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-xs shadow-2xl text-center">
            <h2 className="text-lg font-bold mb-2">Temporary PIN</h2>
            <p className="text-sm text-gray-600 mb-4">{tempPin.name}</p>
            <p className="text-4xl font-mono font-bold text-[var(--color-primary)] tracking-widest mb-4">
              {tempPin.pin}
            </p>
            <p className="text-xs text-gray-400 mb-4">
              Show this once — it will not be displayed again.
            </p>
            <button
              onClick={() => setTempPin(null)}
              className="w-full h-12 rounded-xl bg-[var(--color-primary)] text-white font-semibold"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
