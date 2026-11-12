import { DurableObject } from 'cloudflare:workers';

type ChatEnv = {
  CHAT_ROOM: DurableObjectNamespace<ChatRoom>;
  CO_POST_ROOM: DurableObjectNamespace<CoPostRoom>;
  COMMUNITY_CHAT_SECRET: string;
  VELHUB_ORIGIN: string;
  STORAGE_LIMIT_BYTES: string;
};

type ChatMessage = {
  id: string;
  stigmaId: string | null;
  authorName: string;
  authorAvatarUrl: string | null;
  body: string;
  createdAt: string;
};

type MessageRow = {
  id: string;
  stigma_id: string | null;
  author_name: string;
  author_avatar_url: string | null;
  body: string;
  created_at: string;
  size: number;
};

const RETENTION_MILLISECONDS = 30 * 24 * 60 * 60 * 1000;
const DAILY_MILLISECONDS = 24 * 60 * 60 * 1000;
const RETRY_MILLISECONDS = 60 * 60 * 1000;
const HIGH_WATER_RATIO = 0.9;
const LOW_WATER_RATIO = 0.1;
const ARCHIVE_BATCH_SIZE = 200;
const MAX_PAGE_SIZE = 100;
const ROW_OVERHEAD_BYTES = 128;
const textEncoder = new TextEncoder();

function jsonResponse(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } });
}

function getByteLength(value: string | null) {
  return value ? textEncoder.encode(value).byteLength : 0;
}

function getMessageSize(message: ChatMessage) {
  return (
    ROW_OVERHEAD_BYTES +
    getByteLength(message.id) +
    getByteLength(message.stigmaId) +
    getByteLength(message.authorName) +
    getByteLength(message.authorAvatarUrl) +
    getByteLength(message.body) +
    getByteLength(message.createdAt)
  );
}

function toMessage(row: MessageRow): ChatMessage {
  return {
    id: row.id,
    stigmaId: row.stigma_id,
    authorName: row.author_name,
    authorAvatarUrl: row.author_avatar_url,
    body: row.body,
    createdAt: row.created_at,
  };
}

function isChatMessage(value: unknown): value is ChatMessage {
  if (!value || typeof value !== 'object') return false;

  const message = value as Record<string, unknown>;

  return (
    typeof message.id === 'string' &&
    (typeof message.stigmaId === 'string' || message.stigmaId === null) &&
    typeof message.authorName === 'string' &&
    (typeof message.authorAvatarUrl === 'string' || message.authorAvatarUrl === null) &&
    typeof message.body === 'string' &&
    typeof message.createdAt === 'string'
  );
}

function decodeBase64Url(value: string) {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);

  return Uint8Array.from(atob(padded), (character) => character.charCodeAt(0));
}

async function verifyToken(token: string, secret: string, siteId: string) {
  const [payload, signature] = token.split('.');

  if (!payload || !signature) return false;

  const key = await crypto.subtle.importKey(
    'raw',
    textEncoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify'],
  );
  const isValid = await crypto.subtle.verify('HMAC', key, decodeBase64Url(signature), textEncoder.encode(payload));

  if (!isValid) return false;

  try {
    const claims = JSON.parse(new TextDecoder().decode(decodeBase64Url(payload))) as {
      siteId?: unknown;
      exp?: unknown;
    };

    return claims.siteId === siteId && typeof claims.exp === 'number' && claims.exp * 1000 > Date.now();
  } catch {
    return false;
  }
}

function isInternalRequest(request: Request, secret: string) {
  const received = textEncoder.encode(request.headers.get('Authorization') ?? '');
  const expected = textEncoder.encode(`Bearer ${secret}`);

  return received.byteLength === expected.byteLength && crypto.subtle.timingSafeEqual(received, expected);
}

export class ChatRoom extends DurableObject<ChatEnv> {
  private sql: SqlStorage;

  constructor(ctx: DurableObjectState, env: ChatEnv) {
    super(ctx, env);
    this.sql = ctx.storage.sql;
    this.sql.exec(`
      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        stigma_id TEXT,
        author_name TEXT NOT NULL,
        author_avatar_url TEXT,
        body TEXT NOT NULL,
        created_at TEXT NOT NULL,
        size INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS messages_created_at_idx ON messages (created_at);
      CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    `);
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping', 'pong'));
  }

  private getMeta(key: string) {
    const row = this.sql.exec<{ value: string }>('SELECT value FROM meta WHERE key = ?', key).toArray()[0];

    return row?.value ?? null;
  }

  private setMeta(key: string, value: string) {
    this.sql.exec(
      'INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
      key,
      value,
    );
  }

  private getUsedBytes() {
    return Number(this.getMeta('used_bytes') ?? '0');
  }

  private addUsedBytes(delta: number) {
    this.setMeta('used_bytes', String(Math.max(0, this.getUsedBytes() + delta)));
  }

  private getStorageLimit() {
    const limit = Number(this.env.STORAGE_LIMIT_BYTES);

    return Number.isFinite(limit) && limit > 0 ? limit : 1024 * 1024 * 1024;
  }

  private broadcast(payload: unknown) {
    const data = JSON.stringify(payload);

    for (const socket of this.ctx.getWebSockets()) {
      try {
        socket.send(data);
      } catch {
        socket.close(1011, 'send failed');
      }
    }
  }

  private async ensureAlarm() {
    if ((await this.ctx.storage.getAlarm()) === null) {
      await this.ctx.storage.setAlarm(Date.now() + DAILY_MILLISECONDS);
    }
  }

  async fetch(request: Request) {
    const url = new URL(request.url);
    const siteId = request.headers.get('X-Site-Id');

    if (siteId && !this.getMeta('site_id')) {
      this.setMeta('site_id', siteId);
    }

    if (url.pathname.endsWith('/init') && request.method === 'POST') {
      this.setMeta('opened', '1');
      await this.ensureAlarm();

      return jsonResponse({ ok: true });
    }

    const authorMatch = url.pathname.match(/\/authors\/([0-9a-fA-F-]{36})\/messages$/);

    if (authorMatch && request.method === 'DELETE') {
      const rows = this.sql
        .exec<{ id: string; size: number }>('SELECT id, size FROM messages WHERE stigma_id = ?', authorMatch[1])
        .toArray();

      for (const row of rows) {
        this.sql.exec('DELETE FROM messages WHERE id = ?', row.id);
        this.addUsedBytes(-row.size);
        this.broadcast({ type: 'delete', id: row.id });
      }

      return jsonResponse({ ok: true, deletedCount: rows.length });
    }

    if (this.getMeta('opened') !== '1') {
      this.setMeta('opened', '1');
      await this.ensureAlarm();
    }

    if (url.pathname.endsWith('/ws')) {
      const pair = new WebSocketPair();
      this.ctx.acceptWebSocket(pair[1]);

      return new Response(null, { status: 101, webSocket: pair[0] });
    }

    const messageMatch = url.pathname.match(/\/messages\/([0-9a-fA-F-]{36})$/);

    if (messageMatch && request.method === 'GET') {
      const row = this.sql.exec<MessageRow>('SELECT * FROM messages WHERE id = ?', messageMatch[1]).toArray()[0];

      return jsonResponse({ message: row ? toMessage(row) : null });
    }

    if (messageMatch && request.method === 'DELETE') {
      const messageId = messageMatch[1];
      const row = this.sql.exec<{ size: number }>('SELECT size FROM messages WHERE id = ?', messageId).toArray()[0];

      if (row) {
        this.sql.exec('DELETE FROM messages WHERE id = ?', messageId);
        this.addUsedBytes(-row.size);
      }

      this.broadcast({ type: 'delete', id: messageId });

      return jsonResponse({ ok: true });
    }

    if (url.pathname.endsWith('/messages') && request.method === 'GET') {
      const limit = Math.min(Math.max(Number(url.searchParams.get('limit')) || 50, 1), MAX_PAGE_SIZE);
      const before = url.searchParams.get('before');
      const retentionDate = new Date(Date.now() - RETENTION_MILLISECONDS).toISOString();
      const rows = before
        ? this.sql
            .exec<MessageRow>(
              'SELECT * FROM messages WHERE created_at < ? AND created_at >= ? ORDER BY created_at DESC LIMIT ?',
              before,
              retentionDate,
              limit,
            )
            .toArray()
        : this.sql
            .exec<MessageRow>(
              'SELECT * FROM messages WHERE created_at >= ? ORDER BY created_at DESC LIMIT ?',
              retentionDate,
              limit,
            )
            .toArray();

      return jsonResponse({ messages: rows.map(toMessage) });
    }

    if (url.pathname.endsWith('/messages') && request.method === 'POST') {
      const requestBody = (await request.json().catch(() => null)) as { message?: unknown } | null;
      const message = requestBody?.message;

      if (!isChatMessage(message)) {
        return jsonResponse({ error: 'invalid message' }, 400);
      }

      const size = getMessageSize(message);

      this.sql.exec(
        'INSERT OR IGNORE INTO messages (id, stigma_id, author_name, author_avatar_url, body, created_at, size) VALUES (?, ?, ?, ?, ?, ?, ?)',
        message.id,
        message.stigmaId,
        message.authorName,
        message.authorAvatarUrl,
        message.body,
        message.createdAt,
        size,
      );
      this.addUsedBytes(size);
      this.broadcast({ type: 'message', message });

      if (this.getUsedBytes() > this.getStorageLimit() * HIGH_WATER_RATIO) {
        await this.ctx.storage.setAlarm(Date.now());
      } else {
        await this.ensureAlarm();
      }

      return jsonResponse({ ok: true });
    }

    return jsonResponse({ error: 'not found' }, 404);
  }

  private deleteExpiredMessages() {
    const retentionDate = new Date(Date.now() - RETENTION_MILLISECONDS).toISOString();
    const expired = this.sql
      .exec<{ total: number | null }>('SELECT SUM(size) AS total FROM messages WHERE created_at < ?', retentionDate)
      .toArray()[0];

    if (expired?.total) {
      this.sql.exec('DELETE FROM messages WHERE created_at < ?', retentionDate);
      this.addUsedBytes(-expired.total);
    }
  }

  private async sendToArchive(messages: ChatMessage[]) {
    const siteId = this.getMeta('site_id');

    if (!siteId) return;

    const response = await fetch(`${this.env.VELHUB_ORIGIN.replace(/\/+$/, '')}/api/community-chat/archive`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.env.COMMUNITY_CHAT_SECRET}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ siteId, messages }),
    });

    if (!response.ok) {
      throw new Error(`archive failed: ${response.status}`);
    }
  }

  async alarm() {
    try {
      await this.runMaintenance();
      await this.ctx.storage.setAlarm(Date.now() + DAILY_MILLISECONDS);
    } catch (error) {
      console.error('community chat maintenance failed', error);
      await this.ctx.storage.setAlarm(Date.now() + RETRY_MILLISECONDS);
    }
  }

  private async runMaintenance() {
    this.deleteExpiredMessages();

    const limit = this.getStorageLimit();
    let didArchive = false;

    if (this.getUsedBytes() > limit * HIGH_WATER_RATIO) {
      while (this.getUsedBytes() > limit * LOW_WATER_RATIO) {
        const rows = this.sql
          .exec<MessageRow>('SELECT * FROM messages ORDER BY created_at ASC LIMIT ?', ARCHIVE_BATCH_SIZE)
          .toArray();

        if (rows.length === 0) {
          this.setMeta('used_bytes', '0');
          break;
        }

        await this.sendToArchive(rows.map(toMessage));

        const placeholders = rows.map(() => '?').join(', ');
        this.sql.exec(`DELETE FROM messages WHERE id IN (${placeholders})`, ...rows.map((row) => row.id));
        this.addUsedBytes(-rows.reduce((total, row) => total + row.size, 0));
        didArchive = true;
      }
    }

    if (!didArchive) {
      await this.sendToArchive([]);
    }
  }

  async webSocketMessage() {}

  async webSocketClose(socket: WebSocket, code: number) {
    try {
      socket.close(code === 1005 || code === 1006 ? 1000 : code, 'closed');
    } catch {
      return;
    }
  }
}

export class CoPostRoom extends DurableObject<ChatEnv> {
  constructor(ctx: DurableObjectState, env: ChatEnv) {
    super(ctx, env);
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping', 'pong'));
  }

  async fetch(request: Request) {
    const url = new URL(request.url);

    if (url.pathname.endsWith('/ws')) {
      const pair = new WebSocketPair();
      this.ctx.acceptWebSocket(pair[1]);

      return new Response(null, { status: 101, webSocket: pair[0] });
    }

    if (url.pathname.endsWith('/broadcast') && request.method === 'POST') {
      const data = await request.text();

      for (const socket of this.ctx.getWebSockets()) {
        try {
          socket.send(data);
        } catch {
          socket.close(1011, 'send failed');
        }
      }

      return jsonResponse({ ok: true });
    }

    return jsonResponse({ error: 'not found' }, 404);
  }

  async webSocketMessage() {}

  async webSocketClose(socket: WebSocket, code: number) {
    try {
      socket.close(code === 1005 || code === 1006 ? 1000 : code, 'closed');
    } catch {
      return;
    }
  }
}

async function authorize(request: Request, env: ChatEnv, roomId: string, isSocket: boolean) {
  if (isSocket) {
    if (request.headers.get('Upgrade') !== 'websocket') {
      return jsonResponse({ error: 'websocket required' }, 426);
    }

    const token = new URL(request.url).searchParams.get('token') ?? '';

    if (!(await verifyToken(token, env.COMMUNITY_CHAT_SECRET, roomId))) {
      return jsonResponse({ error: 'unauthorized' }, 401);
    }

    return null;
  }

  if (!isInternalRequest(request, env.COMMUNITY_CHAT_SECRET)) {
    return jsonResponse({ error: 'unauthorized' }, 401);
  }

  return null;
}

export default {
  async fetch(request: Request, env: ChatEnv) {
    const url = new URL(request.url);
    const coPostMatch = url.pathname.match(/^\/co-posts\/([0-9a-fA-F-]{36})(\/(ws|broadcast))$/);

    if (coPostMatch) {
      const coPostId = coPostMatch[1].toLowerCase();
      const rejected = await authorize(request, env, coPostId, coPostMatch[3] === 'ws');

      if (rejected) return rejected;

      return env.CO_POST_ROOM.get(env.CO_POST_ROOM.idFromName(coPostId)).fetch(request);
    }

    const roomMatch = url.pathname.match(/^\/rooms\/([0-9a-fA-F-]{36})(\/.*)$/);

    if (!roomMatch) {
      return jsonResponse({ error: 'not found' }, 404);
    }

    const siteId = roomMatch[1].toLowerCase();
    const isSocket = roomMatch[2] === '/ws';

    if (isSocket) {
      if (request.headers.get('Upgrade') !== 'websocket') {
        return jsonResponse({ error: 'websocket required' }, 426);
      }

      const token = url.searchParams.get('token') ?? '';

      if (!(await verifyToken(token, env.COMMUNITY_CHAT_SECRET, siteId))) {
        return jsonResponse({ error: 'unauthorized' }, 401);
      }
    } else if (!isInternalRequest(request, env.COMMUNITY_CHAT_SECRET)) {
      return jsonResponse({ error: 'unauthorized' }, 401);
    }

    const room = env.CHAT_ROOM.get(env.CHAT_ROOM.idFromName(siteId));
    const headers = new Headers(request.headers);
    headers.set('X-Site-Id', siteId);

    return room.fetch(new Request(request, { headers }));
  },
};
