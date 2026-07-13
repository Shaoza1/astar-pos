import { useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import type { OrderDto, OrderItemDto } from '@astar-pos/shared';

import api from '@/services/api';

function elapsed(createdAt: string): string {
  const m = Math.floor((Date.now() - new Date(createdAt).getTime()) / 60_000);
  return m < 1 ? 'just now' : `${m}m ago`;
}

function statusColour(status: OrderItemDto['status']): string {
  if (status === 'served') return 'bg-[var(--color-success)] text-white';
  if (status === 'ready') return 'bg-blue-500 text-white';
  return 'bg-[var(--color-accent)] text-white';
}

export default function KitchenDisplayPage() {
  const [orders, setOrders] = useState<OrderDto[]>([]);
  const socketRef = useRef<Socket | null>(null);

  async function loadOrders() {
    try {
      const { data } = await api.get<{ sessions: { orders: OrderDto[] }[] }>(
        '/orders/sessions/active'
      );
      const allOrders = data.sessions.flatMap((s) => s.orders);
      const open = allOrders.filter((o) => o.status !== 'served' && o.status !== 'cancelled');
      setOrders(
        open.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
      );
    } catch {
      // best-effort
    }
  }

  useEffect(() => {
    void loadOrders();

    const socket = io(import.meta.env.VITE_WS_URL as string, {
      path: '/socket.io',
      transports: ['websocket'],
    });
    socketRef.current = socket;

    socket.on('order:new', (order: OrderDto) => {
      setOrders((prev) =>
        [...prev, order].sort(
          (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        )
      );
    });

    socket.on('order:updated', (order: OrderDto) => {
      setOrders((prev) => prev.map((o) => (o.id === order.id ? order : o)));
    });

    socket.on('order:item_served', (item: OrderItemDto) => {
      setOrders((prev) =>
        prev.map((o) => ({
          ...o,
          items: o.items.map((i) => (i.id === item.id ? item : i)),
        }))
      );
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Kitchen Display</h1>
        <span className="text-sm text-gray-400">{orders.length} active orders</span>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {orders.map((order) => (
          <div key={order.id} className="bg-gray-800 rounded-2xl p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="font-bold text-lg">Order #{order.id.slice(-4)}</span>
              <span className="text-xs text-gray-400">{elapsed(order.createdAt)}</span>
            </div>
            <div className="space-y-2">
              {order.items
                .filter((i) => !i.isVoided)
                .map((item) => (
                  <div key={item.id} className="flex items-center justify-between">
                    <div>
                      <span className="text-sm font-medium">
                        {item.quantity}× {item.menuItemName}
                      </span>
                    </div>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full ${statusColour(item.status)}`}
                    >
                      {item.status}
                    </span>
                  </div>
                ))}
            </div>
            {order.notes && (
              <p className="mt-3 text-xs text-[var(--color-accent)] border-t border-gray-700 pt-2">
                Note: {order.notes}
              </p>
            )}
          </div>
        ))}
        {orders.length === 0 && (
          <div className="col-span-full text-center text-gray-500 py-20 text-lg">
            No active orders
          </div>
        )}
      </div>
    </div>
  );
}
