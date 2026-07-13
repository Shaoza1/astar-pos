import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useNavigate, useParams } from 'react-router-dom';
import type { MenuGroupDto, MenuItemDto, OrderItemDto, TableSessionDto } from '@astar-pos/shared';

import { PaymentModal } from '@/components/PaymentModal';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import api from '@/services/api';
import { useAuth } from '@/store/auth.context';
import { getOfflineDb } from '@/store/offline.store';

interface CartItem {
  menuItemId: string;
  name: string;
  price: number;
  quantity: number;
}

export default function TableOrderPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const [session, setSession] = useState<TableSessionDto | null>(null);
  const [groups, setGroups] = useState<MenuGroupDto[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItemDto[]>([]);
  const [activeGroup, setActiveGroup] = useState<string>('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [voidModal, setVoidModal] = useState<OrderItemDto | null>(null);
  const [voidReason, setVoidReason] = useState('');
  const [showPayment, setShowPayment] = useState(false);
  const { currentStaff, role } = useAuth();
  const navigate = useNavigate();
  const { isOnline } = useOnlineStatus();

  const load = useCallback(async () => {
    if (!sessionId) return;
    const [{ data: sess }, { data: grps }, { data: items }] = await Promise.all([
      api.get<TableSessionDto>(`/orders/sessions/${sessionId}`),
      api.get<MenuGroupDto[]>('/menu/groups'),
      api.get<MenuItemDto[]>('/menu/items'),
    ]);
    setSession(sess);
    setGroups(grps);
    setMenuItems(items);
    if (grps.length > 0) setActiveGroup(grps[0].id);
  }, [sessionId]);

  useEffect(() => {
    void load();
  }, [load]);

  function addToCart(item: MenuItemDto) {
    setCart((prev) => {
      const existing = prev.find((c) => c.menuItemId === item.id);
      if (existing) {
        return prev.map((c) => (c.menuItemId === item.id ? { ...c, quantity: c.quantity + 1 } : c));
      }
      return [...prev, { menuItemId: item.id, name: item.name, price: item.price, quantity: 1 }];
    });
  }

  function removeFromCart(menuItemId: string) {
    setCart((prev) =>
      prev
        .map((c) => (c.menuItemId === menuItemId ? { ...c, quantity: c.quantity - 1 } : c))
        .filter((c) => c.quantity > 0)
    );
  }

  async function sendToKitchen() {
    if (!sessionId || !currentStaff || cart.length === 0) return;
    const body = {
      tableSessionId: sessionId,
      takenBy: currentStaff.id,
      items: cart.map((c) => ({ menuItemId: c.menuItemId, quantity: c.quantity })),
    };
    if (!isOnline) {
      const db = await getOfflineDb();
      await db.offline_queue.insert({
        id: crypto.randomUUID(),
        url: '/orders',
        body: JSON.stringify(body),
        createdAt: new Date().toISOString(),
        status: 'pending',
      });
      toast('Order queued — will sync when online', { icon: '📶' });
      setCart([]);
      return;
    }
    try {
      await api.post('/orders', body);
      toast.success('Sent to kitchen');
      setCart([]);
      await load();
    } catch {
      toast.error('Failed to send order');
    }
  }

  async function markServed(itemId: string) {
    if (!currentStaff) return;
    try {
      await api.patch(`/orders/items/${itemId}/served`, { servedBy: currentStaff.id });
      await load();
    } catch {
      toast.error('Failed to mark served');
    }
  }

  async function voidItem() {
    if (!voidModal || !currentStaff || !voidReason.trim()) return;
    try {
      await api.patch(`/orders/items/${voidModal.id}/void`, {
        reason: voidReason,
        voidedBy: currentStaff.id,
      });
      toast.success('Item voided');
      setVoidModal(null);
      setVoidReason('');
      await load();
    } catch {
      toast.error('Failed to void item');
    }
  }

  const allItems = session?.orders.flatMap((o) => o.items) ?? [];
  const activeItems = allItems.filter((i) => !i.isVoided);
  const cartTotal = cart.reduce((s, c) => s + c.price * c.quantity, 0);
  const sessionTotal = (session?.totalAmount ?? 0) + cartTotal;
  const visibleMenu = menuItems.filter((m) => m.groupId === activeGroup && m.isActive);

  return (
    <div className="min-h-screen bg-[var(--color-surface)] flex flex-col">
      {/* Top bar */}
      <div className="bg-[var(--color-primary)] text-white px-4 py-3 flex items-center justify-between">
        <button onClick={() => navigate('/pos')} className="text-sm opacity-75 hover:opacity-100">
          ← Tables
        </button>
        <span className="font-bold">Table {session?.tableNumber}</span>
        <span className="text-lg font-bold">R{sessionTotal.toFixed(2)}</span>
      </div>

      {!isOnline && (
        <div className="bg-[var(--color-accent)] text-white text-center text-xs py-1">
          Offline — orders will sync when reconnected
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        {/* Left: order items */}
        <div className="w-2/5 border-r border-gray-200 flex flex-col">
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {/* Cart (unsent) */}
            {cart.map((c) => (
              <div
                key={c.menuItemId}
                className="flex items-center justify-between bg-blue-50 rounded-lg px-3 py-2"
              >
                <div>
                  <p className="text-sm font-medium">{c.name}</p>
                  <p className="text-xs text-gray-500">
                    R{c.price.toFixed(2)} × {c.quantity}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => removeFromCart(c.menuItemId)}
                    className="w-7 h-7 rounded-full bg-gray-200 text-sm font-bold"
                  >
                    −
                  </button>
                  <span className="w-5 text-center text-sm font-semibold">{c.quantity}</span>
                  <button
                    onClick={() =>
                      addToCart({ id: c.menuItemId, name: c.name, price: c.price } as MenuItemDto)
                    }
                    className="w-7 h-7 rounded-full bg-gray-200 text-sm font-bold"
                  >
                    +
                  </button>
                </div>
              </div>
            ))}
            {/* Sent items */}
            {activeItems.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between bg-white rounded-lg px-3 py-2 border border-gray-100"
              >
                <div>
                  <p className="text-sm font-medium">{item.menuItemName}</p>
                  <p className="text-xs text-gray-500">
                    R{item.unitPrice.toFixed(2)} × {item.quantity}
                  </p>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full ${
                      item.status === 'served'
                        ? 'bg-green-100 text-green-700'
                        : item.status === 'ready'
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-yellow-100 text-yellow-700'
                    }`}
                  >
                    {item.status}
                  </span>
                </div>
                <div className="flex flex-col gap-1">
                  {item.status !== 'served' && (
                    <button
                      onClick={() => void markServed(item.id)}
                      className="text-xs bg-[var(--color-success)] text-white px-2 py-1 rounded-lg"
                    >
                      Served
                    </button>
                  )}
                  {(role === 'owner' || role === 'manager') && item.status !== 'served' && (
                    <button
                      onClick={() => setVoidModal(item)}
                      className="text-xs bg-[var(--color-danger)] text-white px-2 py-1 rounded-lg"
                    >
                      Void
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Action buttons */}
          <div className="p-3 border-t border-gray-200 space-y-2">
            <button
              onClick={() => void sendToKitchen()}
              disabled={cart.length === 0}
              className="w-full h-12 rounded-xl bg-[var(--color-primary)] text-white font-semibold disabled:opacity-40"
            >
              Send to Kitchen ({cart.length})
            </button>
            <button
              onClick={() => setShowPayment(true)}
              disabled={activeItems.length === 0 && cart.length === 0}
              className="w-full h-12 rounded-xl bg-[var(--color-accent)] text-white font-semibold disabled:opacity-40"
            >
              Pay — R{sessionTotal.toFixed(2)}
            </button>
          </div>
        </div>

        {/* Right: menu browser */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Group tabs */}
          <div className="flex overflow-x-auto border-b border-gray-200 bg-white">
            {groups.map((g) => (
              <button
                key={g.id}
                onClick={() => setActiveGroup(g.id)}
                className={`px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                  activeGroup === g.id
                    ? 'border-[var(--color-primary)] text-[var(--color-primary)]'
                    : 'border-transparent text-gray-500'
                }`}
              >
                {g.name}
              </button>
            ))}
          </div>

          {/* Menu items */}
          <div className="flex-1 overflow-y-auto p-3 grid grid-cols-2 gap-3">
            {visibleMenu.map((item) => (
              <button
                key={item.id}
                onClick={() => addToCart(item)}
                className="bg-white rounded-xl p-3 text-left shadow-sm border border-gray-100 active:scale-95 transition-all hover:border-[var(--color-primary)]"
              >
                <p className="font-semibold text-sm text-gray-800">{item.name}</p>
                {item.description && (
                  <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{item.description}</p>
                )}
                <p className="text-[var(--color-primary)] font-bold mt-1">
                  R{item.price.toFixed(2)}
                </p>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Void modal */}
      {voidModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-xs shadow-2xl">
            <h2 className="text-lg font-bold mb-1">Void Item</h2>
            <p className="text-sm text-gray-600 mb-3">{voidModal.menuItemName}</p>
            <textarea
              value={voidReason}
              onChange={(e) => setVoidReason(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm mb-4 h-20 resize-none"
              placeholder="Reason for void (required)"
            />
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setVoidModal(null);
                  setVoidReason('');
                }}
                className="flex-1 h-12 rounded-xl border border-gray-300 text-gray-700 font-medium"
              >
                Cancel
              </button>
              <button
                onClick={() => void voidItem()}
                disabled={!voidReason.trim()}
                className="flex-1 h-12 rounded-xl bg-[var(--color-danger)] text-white font-semibold disabled:opacity-40"
              >
                Void
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Payment modal */}
      {showPayment && session && currentStaff && (
        <PaymentModal
          sessionId={session.id}
          total={sessionTotal}
          processedBy={currentStaff.id}
          onSuccess={() => navigate('/pos')}
          onClose={() => setShowPayment(false)}
        />
      )}
    </div>
  );
}
