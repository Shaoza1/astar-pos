import { createRxDatabase, type RxDatabase, type RxCollection } from 'rxdb';
import { getRxStorageDexie } from 'rxdb/plugins/storage-dexie';

const queueSchema = {
  version: 0,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: { type: 'string', maxLength: 36 },
    url: { type: 'string' },
    body: { type: 'string' },
    createdAt: { type: 'string' },
    status: { type: 'string', enum: ['pending', 'sync_failed'] },
  },
  required: ['id', 'url', 'body', 'createdAt', 'status'],
} as const;

type OfflineQueueDoc = {
  id: string;
  url: string;
  body: string;
  createdAt: string;
  status: 'pending' | 'sync_failed';
};

type AstarOfflineDb = RxDatabase<{
  offline_queue: RxCollection<OfflineQueueDoc>;
}>;

let _db: AstarOfflineDb | null = null;

export async function getOfflineDb(): Promise<AstarOfflineDb> {
  if (_db) return _db;
  _db = await createRxDatabase<{ offline_queue: RxCollection<OfflineQueueDoc> }>({
    name: 'astar_offline',
    storage: getRxStorageDexie(),
    ignoreDuplicate: true,
  });
  await _db.addCollections({ offline_queue: { schema: queueSchema } });
  return _db;
}

export async function flushOfflineQueue(): Promise<void> {
  const db = await getOfflineDb();
  const pending = await db.offline_queue.find({ selector: { status: 'pending' } }).exec();
  for (const doc of pending) {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_BASE_URL as string}${doc.url}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('access_token') ?? ''}`,
        },
        body: doc.body,
      });
      if (res.ok) {
        await doc.remove();
      } else {
        await doc.patch({ status: 'sync_failed' });
      }
    } catch {
      console.error('[offline] sync failed for', doc.url);
      await doc.patch({ status: 'sync_failed' });
    }
  }
}

export async function getPendingCount(): Promise<number> {
  const db = await getOfflineDb();
  const docs = await db.offline_queue.find({ selector: { status: 'pending' } }).exec();
  return docs.length;
}
