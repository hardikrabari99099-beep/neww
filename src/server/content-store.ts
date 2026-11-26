import { and, eq } from "drizzle-orm";
import { db } from "../../db";
import { contentDocs } from "../../db/schema";

type DocRecord = Record<string, unknown> & { id: string };

interface QueryOpts {
  eq?: Record<string, string | number | boolean>;
  ilike?: Record<string, string>;
  or?: Array<{
    eq?: Record<string, string | number | boolean>;
    ilike?: Record<string, string>;
  }>;
  inJson?: Record<string, Array<string | number>>;
  neqZero?: string;
  orderByCreatedDesc?: boolean;
  limit?: number;
  offset?: number;
}

interface ContentStore {
  all: (collection: string) => Promise<DocRecord[]>;
  get: (collection: string, id: string) => Promise<DocRecord | null>;
  put: (collection: string, doc: DocRecord) => Promise<DocRecord>;
  del: (collection: string, id: string) => Promise<unknown>;
  delAll: (collection: string) => Promise<unknown>;
  findOne: (
    collection: string,
    predicate: (doc: DocRecord) => boolean,
  ) => Promise<DocRecord | null>;
  query?: (collection: string, opts?: QueryOpts) => Promise<DocRecord[]>;
  findOneBy?: (
    collection: string,
    opts?: QueryOpts,
  ) => Promise<DocRecord | null>;
}

function matchesQuery(doc: DocRecord, opts: QueryOpts = {}): boolean {
  if (opts.eq) {
    for (const [k, v] of Object.entries(opts.eq)) {
      if (doc[k] !== v && String(doc[k] ?? "") !== String(v)) return false;
    }
  }
  if (opts.ilike) {
    for (const [k, v] of Object.entries(opts.ilike)) {
      if (String(doc[k] ?? "").toLowerCase() !== String(v).toLowerCase()) {
        return false;
      }
    }
  }
  if (opts.inJson) {
    for (const [k, vals] of Object.entries(opts.inJson)) {
      if (
        !vals.some((v) => doc[k] === v || String(doc[k] ?? "") === String(v))
      ) {
        return false;
      }
    }
  }
  if (opts.neqZero && Number(doc[opts.neqZero] || 0) === 0) return false;
  if (opts.or && opts.or.length > 0) {
    const anyMatch = opts.or.some((clause) => matchesQuery(doc, clause));
    if (!anyMatch) return false;
  }
  return true;
}

export function persistentContentStore(fallback: ContentStore): ContentStore {
  const persistentCollections = new Set([
    "settings",
    "stories",
    "users",
    "local_credentials",
    "trader_accounts",
    "orders",
    "virtual_orders",
    "virtual_positions",
    "virtual_trades",
    "fund_transactions",
    "payout_requests",
    "referrals",
    "journal_entries",
    "risk_events",
    "risk_breaches",
    "user_notifications",
    "support_tickets",
    "certificates",
    "insights",
    "leads",
    "league_registrations",
    "weekly_payouts",
    "ai_revisions",
    "system_meta",
  ]);
  const persistent = (collection: string) =>
    persistentCollections.has(collection);
  const all = async (collection: string): Promise<DocRecord[]> => {
    if (!persistent(collection)) return fallback.all(collection);
    try {
      const rows = await db
        .select()
        .from(contentDocs)
        .where(eq(contentDocs.collection, collection));
      return rows.map((row) => row.data as DocRecord);
    } catch {
      return fallback.all(collection);
    }
  };
  const get = async (
    collection: string,
    id: string,
  ): Promise<DocRecord | null> => {
    if (!persistent(collection)) return fallback.get(collection, id);
    try {
      const rows = await db
        .select()
        .from(contentDocs)
        .where(
          and(
            eq(contentDocs.collection, collection),
            eq(contentDocs.id, String(id)),
          ),
        );
      return (rows[0]?.data as DocRecord | undefined) ?? null;
    } catch {
      return fallback.get(collection, id);
    }
  };
  const put = async (
    collection: string,
    doc: DocRecord,
  ): Promise<DocRecord> => {
    if (!persistent(collection)) return fallback.put(collection, doc);
    try {
      await db
        .insert(contentDocs)
        .values({ collection, id: String(doc.id), data: doc })
        .onConflictDoUpdate({
          target: [contentDocs.collection, contentDocs.id],
          set: { data: doc },
        });
      return doc;
    } catch {
      return fallback.put(collection, doc);
    }
  };
  const del = async (collection: string, id: string) => {
    if (!persistent(collection)) return fallback.del(collection, id);
    try {
      return await db
        .delete(contentDocs)
        .where(
          and(
            eq(contentDocs.collection, collection),
            eq(contentDocs.id, String(id)),
          ),
        );
    } catch {
      return fallback.del(collection, id);
    }
  };
  const delAll = async (collection: string) => {
    if (!persistent(collection)) return fallback.delAll(collection);
    try {
      return await db
        .delete(contentDocs)
        .where(eq(contentDocs.collection, collection));
    } catch {
      return fallback.delAll(collection);
    }
  };
  const findOne = async (
    collection: string,
    predicate: (doc: DocRecord) => boolean,
  ) => (await all(collection)).find(predicate) || null;
  const queryDocs = async (
    collection: string,
    opts: QueryOpts = {},
  ): Promise<DocRecord[]> => {
    let rows = (await all(collection)).filter((d) => matchesQuery(d, opts));
    if (opts.orderByCreatedDesc) {
      rows = rows.sort((a, b) =>
        String(b["created_at"] ?? "").localeCompare(
          String(a["created_at"] ?? ""),
        ),
      );
    }
    const start = Math.max(0, Number(opts.offset || 0));
    if (opts.limit && opts.limit > 0) {
      return rows.slice(start, start + opts.limit);
    }
    return start > 0 ? rows.slice(start) : rows;
  };
  const findOneBy = async (
    collection: string,
    opts: QueryOpts = {},
  ): Promise<DocRecord | null> => {
    const rows = await queryDocs(collection, { ...opts, limit: 1 });
    return rows[0] || null;
  };
  return { all, get, put, del, delAll, findOne, query: queryDocs, findOneBy };
}
