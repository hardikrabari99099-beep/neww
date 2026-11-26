// Server-only shared cache, singleflight coalescing, ETag helpers, rate limiting,
// and optional Redis (RESP2 TCP/TLS) adapter with automatic in-memory LRU/TTL fallback.
// Never throws on cache/Redis unavailability; never logs REDIS_URL credentials.

import { createHash } from "node:crypto";
import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import tls from "node:tls";

const DEFAULT_MAX_MEMORY_ITEMS = 1200;
const KEY_PREFIX = "if:v1:";
const REDIS_COOLDOWN_MS = 30_000;
const REDIS_CONNECT_TIMEOUT_MS = 1200;
const REDIS_CMD_TIMEOUT_MS = 800;

interface CacheEntry<T = unknown> {
  value: T;
  expiresAt: number;
}

class MemoryLruTtl {
  private map = new Map<string, CacheEntry>();
  private maxEntries: number;

  constructor(maxEntries = DEFAULT_MAX_MEMORY_ITEMS) {
    this.maxEntries = maxEntries;
  }

  get<T>(key: string): T | null {
    const entry = this.map.get(key);
    if (!entry) return null;
    if (entry.expiresAt > 0 && entry.expiresAt <= Date.now()) {
      this.map.delete(key);
      return null;
    }
    // Refresh LRU recency
    this.map.delete(key);
    this.map.set(key, entry);
    return entry.value as T;
  }

  set<T>(key: string, value: T, ttlMs: number): void {
    const expiresAt = ttlMs > 0 ? Date.now() + ttlMs : 0;
    if (this.map.has(key)) {
      this.map.delete(key);
    } else if (this.map.size >= this.maxEntries) {
      const oldestKey = this.map.keys().next().value;
      if (oldestKey !== undefined) this.map.delete(oldestKey);
    }
    this.map.set(key, { value, expiresAt });
  }

  del(key: string): void {
    this.map.delete(key);
  }

  delByPrefix(prefix: string): void {
    for (const k of this.map.keys()) {
      if (k.startsWith(prefix)) this.map.delete(k);
    }
  }

  incr(key: string, ttlMs: number): number {
    const existing = this.map.get(key);
    const now = Date.now();
    if (!existing || (existing.expiresAt > 0 && existing.expiresAt <= now)) {
      this.set(key, 1, ttlMs);
      return 1;
    }
    const nextVal = Number(existing.value || 0) + 1;
    existing.value = nextVal;
    return nextVal;
  }

  clear(): void {
    this.map.clear();
  }

  size(): number {
    return this.map.size;
  }
}

export interface ParsedRedisUrl {
  host: string;
  port: number;
  tls: boolean;
  username?: string;
  password?: string;
  db: number;
}

export function parseRedisUrl(rawUrl: string): ParsedRedisUrl | null {
  const trimmed = String(rawUrl || "").trim();
  if (!trimmed) return null;
  try {
    const u = new URL(trimmed);
    if (u.protocol !== "redis:" && u.protocol !== "rediss:") return null;
    const host = u.hostname;
    if (!host) return null;
    const isTls = u.protocol === "rediss:";
    const port = u.port ? Number(u.port) : 6379;
    if (!Number.isFinite(port) || port <= 0 || port > 65535) return null;
    const dbMatch = u.pathname.match(/^\/(\d+)/);
    const db = dbMatch ? Number(dbMatch[1]) : 0;
    return {
      host,
      port,
      tls: isTls,
      username: u.username ? decodeURIComponent(u.username) : undefined,
      password: u.password ? decodeURIComponent(u.password) : undefined,
      db: Number.isFinite(db) ? db : 0,
    };
  } catch {
    return null;
  }
}

export function encodeRespCommand(args: Array<string | number>): Buffer {
  const parts: Buffer[] = [Buffer.from(`*${args.length}\r\n`, "utf8")];
  for (const arg of args) {
    const buf = Buffer.from(String(arg), "utf8");
    parts.push(Buffer.from(`$${buf.length}\r\n`, "utf8"));
    parts.push(buf);
    parts.push(Buffer.from("\r\n", "utf8"));
  }
  return Buffer.concat(parts);
}

export function parseRespMessages(buffer: Buffer): {
  messages: unknown[];
  rest: Buffer;
} {
  const messages: unknown[] = [];
  let offset = 0;

  const findCrlf = (start: number): number => {
    for (let i = start; i + 1 < buffer.length; i++) {
      if (buffer[i] === 13 && buffer[i + 1] === 10) return i;
    }
    return -1;
  };

  const readOne = (
    pos: number,
  ): { value: unknown; nextOffset: number } | null => {
    if (pos >= buffer.length) return null;
    const prefix = String.fromCharCode(buffer[pos]!);
    if (prefix === "+" || prefix === "-" || prefix === ":") {
      const end = findCrlf(pos + 1);
      if (end === -1) return null;
      const line = buffer.toString("utf8", pos + 1, end);
      if (prefix === "+") return { value: line, nextOffset: end + 2 };
      if (prefix === "-")
        return { value: new Error(line), nextOffset: end + 2 };
      return { value: Number(line), nextOffset: end + 2 };
    }
    if (prefix === "$") {
      const end = findCrlf(pos + 1);
      if (end === -1) return null;
      const len = Number(buffer.toString("utf8", pos + 1, end));
      if (len === -1) return { value: null, nextOffset: end + 2 };
      if (!Number.isFinite(len) || len < 0)
        throw new Error("Invalid RESP bulk length");
      const dataStart = end + 2;
      const dataEnd = dataStart + len;
      if (dataEnd + 2 > buffer.length) return null;
      const str = buffer.toString("utf8", dataStart, dataEnd);
      return { value: str, nextOffset: dataEnd + 2 };
    }
    if (prefix === "*") {
      const end = findCrlf(pos + 1);
      if (end === -1) return null;
      const count = Number(buffer.toString("utf8", pos + 1, end));
      if (count === -1) return { value: null, nextOffset: end + 2 };
      if (!Number.isFinite(count) || count < 0)
        throw new Error("Invalid RESP array count");
      let cur = end + 2;
      const arr: unknown[] = [];
      for (let i = 0; i < count; i++) {
        const item = readOne(cur);
        if (!item) return null;
        arr.push(item.value);
        cur = item.nextOffset;
      }
      return { value: arr, nextOffset: cur };
    }
    throw new Error(`Unsupported RESP type byte: ${prefix}`);
  };

  while (offset < buffer.length) {
    const res = readOne(offset);
    if (!res) break;
    messages.push(res.value);
    offset = res.nextOffset;
  }

  return {
    messages,
    rest: offset === 0 ? buffer : buffer.subarray(offset),
  };
}

function readEnvSetting(name: string): string {
  const direct = process.env[name];
  if (direct !== undefined && String(direct).trim() !== "") {
    return String(direct).trim();
  }
  if (!process.env["VITEST"]) {
    for (const fileName of [".env", ".env.local"]) {
      try {
        const p = path.resolve(process.cwd(), fileName);
        if (!fs.existsSync(p)) continue;
        const raw = fs.readFileSync(p, "utf8");
        for (const line of raw.split(/\r?\n/)) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith("#")) continue;
          const eq = trimmed.indexOf("=");
          if (eq <= 0) continue;
          const k = trimmed.slice(0, eq).trim();
          if (k !== name) continue;
          let val = trimmed.slice(eq + 1).trim();
          if (
            (val.startsWith('"') && val.endsWith('"')) ||
            (val.startsWith("'") && val.endsWith("'"))
          ) {
            val = val.slice(1, -1);
          }
          if (val) return val;
        }
      } catch {
        // ignore unreadable env files
      }
    }
  }
  return "";
}

type PendingCmd = {
  resolve: (val: unknown) => void;
  reject: (err: Error) => void;
  timer: ReturnType<typeof setTimeout>;
};

class RespRedisClient {
  private url: string;
  private parsed: ParsedRedisUrl;
  private socket: net.Socket | tls.TLSSocket | null = null;
  private connecting: Promise<boolean> | null = null;
  private queue: PendingCmd[] = [];
  private recvBuf: Buffer<ArrayBufferLike> = Buffer.alloc(0);
  private failedUntil = 0;

  constructor(url: string, parsed: ParsedRedisUrl) {
    this.url = url;
    this.parsed = parsed;
  }

  matchesUrl(url: string): boolean {
    return this.url === url;
  }

  isAvailable(): boolean {
    return Date.now() >= this.failedUntil;
  }

  private openRawSocket(): Promise<net.Socket | tls.TLSSocket> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        sock.destroy();
        reject(new Error("Redis connect timeout"));
      }, REDIS_CONNECT_TIMEOUT_MS);
      timer.unref?.();

      const onError = (err: Error) => {
        clearTimeout(timer);
        reject(err);
      };

      const sock = this.parsed.tls
        ? tls.connect({
            host: this.parsed.host,
            port: this.parsed.port,
            servername: this.parsed.host,
          })
        : net.createConnection({
            host: this.parsed.host,
            port: this.parsed.port,
          });

      const readyEvent = this.parsed.tls ? "secureConnect" : "connect";
      sock.once("error", onError);
      sock.once(readyEvent, () => {
        clearTimeout(timer);
        sock.off("error", onError);
        sock.setNoDelay(true);
        sock.unref?.();
        resolve(sock);
      });
    });
  }

  private attachSocket(sock: net.Socket | tls.TLSSocket): void {
    this.socket = sock;
    this.recvBuf = Buffer.alloc(0);

    sock.on("data", (chunk: Buffer) => {
      this.recvBuf = Buffer.concat([this.recvBuf, chunk]);
      try {
        const { messages, rest } = parseRespMessages(this.recvBuf);
        this.recvBuf = rest;
        for (const msg of messages) {
          const item = this.queue.shift();
          if (!item) continue;
          clearTimeout(item.timer);
          if (msg instanceof Error) item.reject(msg);
          else item.resolve(msg);
        }
      } catch (err) {
        this.resetSocket(err instanceof Error ? err : new Error("RESP parse"));
      }
    });

    const onClose = () => this.resetSocket(new Error("Redis socket closed"));
    sock.on("error", onClose);
    sock.on("close", onClose);
  }

  private resetSocket(err?: Error): void {
    if (this.socket) {
      try {
        this.socket.destroy();
      } catch {
        // ignore
      }
      this.socket = null;
    }
    this.recvBuf = Buffer.alloc(0);
    while (this.queue.length > 0) {
      const pending = this.queue.shift();
      if (!pending) break;
      clearTimeout(pending.timer);
      pending.reject(err || new Error("Redis disconnected"));
    }
  }

  private async ensureConnected(): Promise<boolean> {
    if (!this.isAvailable()) return false;
    if (this.socket && !this.socket.destroyed) return true;
    if (this.connecting) return this.connecting;

    this.connecting = (async () => {
      try {
        const sock = await this.openRawSocket();
        this.attachSocket(sock);
        if (this.parsed.password) {
          const authArgs = this.parsed.username
            ? ["AUTH", this.parsed.username, this.parsed.password]
            : ["AUTH", this.parsed.password];
          await this.sendRaw(authArgs);
        }
        if (this.parsed.db > 0) {
          await this.sendRaw(["SELECT", this.parsed.db]);
        }
        return true;
      } catch {
        this.failedUntil = Date.now() + REDIS_COOLDOWN_MS;
        this.resetSocket(new Error("Redis connect failed"));
        return false;
      } finally {
        this.connecting = null;
      }
    })();

    return this.connecting;
  }

  private sendRaw(args: Array<string | number>): Promise<unknown> {
    return new Promise((resolve, reject) => {
      if (!this.socket || this.socket.destroyed) {
        reject(new Error("Redis socket unavailable"));
        return;
      }
      const timer = setTimeout(() => {
        const idx = this.queue.indexOf(entry);
        if (idx !== -1) this.queue.splice(idx, 1);
        this.failedUntil = Date.now() + REDIS_COOLDOWN_MS;
        this.resetSocket(new Error("Redis command timeout"));
        reject(new Error("Redis command timeout"));
      }, REDIS_CMD_TIMEOUT_MS);
      timer.unref?.();

      const entry: PendingCmd = { resolve, reject, timer };
      this.queue.push(entry);
      try {
        this.socket.write(encodeRespCommand(args));
      } catch (err) {
        clearTimeout(timer);
        const idx = this.queue.indexOf(entry);
        if (idx !== -1) this.queue.splice(idx, 1);
        reject(err instanceof Error ? err : new Error("Redis write error"));
      }
    });
  }

  async command(args: Array<string | number>): Promise<unknown | null> {
    if (!(await this.ensureConnected())) return null;
    try {
      return await this.sendRaw(args);
    } catch {
      this.failedUntil = Date.now() + REDIS_COOLDOWN_MS;
      return null;
    }
  }

  close(): void {
    this.resetSocket(new Error("Redis client closed"));
  }
}

const GLOBAL_CACHE_KEY = "__indifundedCacheState";
const cacheGlobal: {
  mem: MemoryLruTtl;
  inflight: Map<string, Promise<unknown>>;
  redisClient: RespRedisClient | null;
  subListeners: Set<(msg: string) => void>;
  subSocket: net.Socket | tls.TLSSocket | null;
  subRetryTimer: ReturnType<typeof setTimeout> | null;
  lastSubUrl: string;
} =
  ((globalThis as Record<string, unknown>)[GLOBAL_CACHE_KEY] as never) ||
  ((globalThis as Record<string, unknown>)[GLOBAL_CACHE_KEY] = {
    mem: new MemoryLruTtl(DEFAULT_MAX_MEMORY_ITEMS),
    inflight: new Map(),
    redisClient: null,
    subListeners: new Set(),
    subSocket: null,
    subRetryTimer: null,
    lastSubUrl: "",
  });

function getRedisClient(): RespRedisClient | null {
  const url = readEnvSetting("REDIS_URL");
  if (!url) {
    if (cacheGlobal.redisClient) {
      cacheGlobal.redisClient.close();
      cacheGlobal.redisClient = null;
    }
    return null;
  }
  if (cacheGlobal.redisClient?.matchesUrl(url)) {
    return cacheGlobal.redisClient;
  }
  const parsed = parseRedisUrl(url);
  if (!parsed) return null;
  cacheGlobal.redisClient?.close();
  cacheGlobal.redisClient = new RespRedisClient(url, parsed);
  return cacheGlobal.redisClient;
}

export function isRedisConfigured(): boolean {
  const url = readEnvSetting("REDIS_URL");
  return Boolean(parseRedisUrl(url));
}

export async function cacheGet<T = unknown>(key: string): Promise<T | null> {
  const fullKey = `${KEY_PREFIX}${key}`;
  const memHit = cacheGlobal.mem.get<T>(fullKey);
  if (memHit !== null && memHit !== undefined) {
    return memHit;
  }
  const redis = getRedisClient();
  if (!redis) return null;
  const raw = await redis.command(["GET", fullKey]);
  if (typeof raw !== "string" || !raw) return null;
  try {
    const parsed = JSON.parse(raw) as { v: T; exp?: number };
    if (parsed && "v" in parsed) {
      const remTtl =
        parsed.exp && parsed.exp > Date.now()
          ? Math.min(parsed.exp - Date.now(), 60_000)
          : 15_000;
      cacheGlobal.mem.set(fullKey, parsed.v, remTtl);
      return parsed.v;
    }
  } catch {
    // ignore malformed cache entry
  }
  return null;
}

export async function cacheSet<T = unknown>(
  key: string,
  value: T,
  ttlMs: number,
): Promise<void> {
  const fullKey = `${KEY_PREFIX}${key}`;
  const safeTtlMs = Math.max(500, Math.round(ttlMs || 15_000));
  cacheGlobal.mem.set(fullKey, value, safeTtlMs);
  const redis = getRedisClient();
  if (!redis) return;
  try {
    const ttlSec = Math.max(1, Math.ceil(safeTtlMs / 1000));
    const envelope = JSON.stringify({
      v: value,
      exp: Date.now() + safeTtlMs,
    });
    await redis.command(["SET", fullKey, envelope, "EX", ttlSec]);
  } catch {
    // memory cache already holds value
  }
}

export async function cacheDel(key: string): Promise<void> {
  const fullKey = `${KEY_PREFIX}${key}`;
  cacheGlobal.mem.del(fullKey);
  const redis = getRedisClient();
  if (!redis) return;
  await redis.command(["DEL", fullKey]).catch(() => null);
}

export function cacheDelByPrefix(prefix: string): void {
  cacheGlobal.mem.delByPrefix(`${KEY_PREFIX}${prefix}`);
}

export async function cacheCoalesce<T>(
  key: string,
  ttlMs: number,
  loader: () => Promise<T>,
  shouldCache: (val: T) => boolean = (v) => v !== null && v !== undefined,
): Promise<T> {
  const existing = await cacheGet<T>(key);
  if (existing !== null && existing !== undefined) return existing;

  const pending = cacheGlobal.inflight.get(key) as Promise<T> | undefined;
  if (pending) return pending;

  const task = (async () => {
    try {
      const result = await loader();
      if (shouldCache(result)) {
        await cacheSet(key, result, ttlMs);
      }
      return result;
    } finally {
      cacheGlobal.inflight.delete(key);
    }
  })();

  cacheGlobal.inflight.set(key, task);
  return task;
}

export async function checkRateLimit(
  bucketKey: string,
  maxRequests: number,
  windowMs: number,
): Promise<{
  allowed: boolean;
  count: number;
  remaining: number;
  retryAfterSec: number;
}> {
  const safeMax = Math.max(1, Math.floor(maxRequests));
  const safeWinMs = Math.max(1000, Math.floor(windowMs));
  const slot = Math.floor(Date.now() / safeWinMs);
  const memKey = `${KEY_PREFIX}rl:${bucketKey}:${slot}`;
  const redis = getRedisClient();

  let count = 0;
  if (redis && redis.isAvailable()) {
    const res = await redis.command(["INCR", memKey]);
    if (typeof res === "number" && res > 0) {
      count = res;
      if (res === 1) {
        await redis
          .command(["EXPIRE", memKey, Math.max(1, Math.ceil(safeWinMs / 1000))])
          .catch(() => null);
      }
    }
  }
  if (!count) {
    count = cacheGlobal.mem.incr(memKey, safeWinMs);
  }
  const allowed = count <= safeMax;
  const remaining = Math.max(0, safeMax - count);
  const msLeft = (slot + 1) * safeWinMs - Date.now();
  const retryAfterSec = Math.max(1, Math.ceil(msLeft / 1000));
  return { allowed, count, remaining, retryAfterSec };
}

export function getClientIp(request: Request): string {
  const xff = request.headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  const realIp = request.headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;
  return "local";
}

export function computeWeakEtag(payload: unknown): string {
  const raw =
    typeof payload === "string" ? payload : JSON.stringify(payload ?? null);
  const hash = createHash("sha1").update(raw).digest("base64url").slice(0, 16);
  return `W/"${hash}"`;
}

export function isNotModified(request: Request, etag: string): boolean {
  const header = request.headers.get("if-none-match");
  if (!header || !etag) return false;
  return header
    .split(",")
    .map((x) => x.trim())
    .some(
      (tag) =>
        tag === "*" ||
        tag === etag ||
        tag.replace(/^W\//, "") === etag.replace(/^W\//, ""),
    );
}

export function hashTokenKey(token: string): string {
  return createHash("sha256").update(token).digest("hex").slice(0, 32);
}

// Optional cross-instance Pub/Sub for public cache invalidation / SSE sync
const SYNC_CHANNEL = `${KEY_PREFIX}sync`;

export async function publishSyncInvalidation(payload: string): Promise<void> {
  const redis = getRedisClient();
  if (!redis) return;
  await redis.command(["PUBLISH", SYNC_CHANNEL, payload]).catch(() => null);
}

export function subscribeRemoteSync(
  listener: (payload: string) => void,
): () => void {
  cacheGlobal.subListeners.add(listener);
  ensureRedisSubscriber();
  return () => {
    cacheGlobal.subListeners.delete(listener);
  };
}

function ensureRedisSubscriber(): void {
  if (process.env["VITEST"]) return;
  const url = readEnvSetting("REDIS_URL");
  if (!url) return;
  const parsed = parseRedisUrl(url);
  if (!parsed) return;
  if (
    cacheGlobal.subSocket &&
    !cacheGlobal.subSocket.destroyed &&
    cacheGlobal.lastSubUrl === url
  ) {
    return;
  }
  if (cacheGlobal.subRetryTimer) return;
  cacheGlobal.lastSubUrl = url;

  const sock = parsed.tls
    ? tls.connect({
        host: parsed.host,
        port: parsed.port,
        servername: parsed.host,
      })
    : net.createConnection({ host: parsed.host, port: parsed.port });
  cacheGlobal.subSocket = sock;
  let recvBuf: Buffer<ArrayBufferLike> = Buffer.alloc(0);

  const readyEv = parsed.tls ? "secureConnect" : "connect";
  sock.once(readyEv, () => {
    sock.unref?.();
    if (parsed.password) {
      const authArgs = parsed.username
        ? ["AUTH", parsed.username, parsed.password]
        : ["AUTH", parsed.password];
      sock.write(encodeRespCommand(authArgs));
    }
    sock.write(encodeRespCommand(["SUBSCRIBE", SYNC_CHANNEL]));
  });

  sock.on("data", (chunk: Buffer) => {
    recvBuf = Buffer.concat([recvBuf, chunk]);
    try {
      const { messages, rest } = parseRespMessages(recvBuf);
      recvBuf = rest;
      for (const msg of messages) {
        if (
          Array.isArray(msg) &&
          msg.length === 3 &&
          msg[0] === "message" &&
          msg[1] === SYNC_CHANNEL &&
          typeof msg[2] === "string"
        ) {
          cacheDelByPrefix("pub:");
          for (const fn of cacheGlobal.subListeners) {
            try {
              fn(msg[2]);
            } catch {
              // ignore individual subscriber failure
            }
          }
        }
      }
    } catch {
      sock.destroy();
    }
  });

  const scheduleReconnect = () => {
    if (cacheGlobal.subSocket === sock) cacheGlobal.subSocket = null;
    if (cacheGlobal.subRetryTimer || cacheGlobal.subListeners.size === 0)
      return;
    cacheGlobal.subRetryTimer = setTimeout(() => {
      cacheGlobal.subRetryTimer = null;
      ensureRedisSubscriber();
    }, 10_000);
    cacheGlobal.subRetryTimer.unref?.();
  };

  sock.on("error", scheduleReconnect);
  sock.on("close", scheduleReconnect);
}

export function __resetCacheForTests(): void {
  cacheGlobal.mem.clear();
  cacheGlobal.inflight.clear();
  cacheGlobal.redisClient?.close();
  cacheGlobal.redisClient = null;
}
