import { act, render } from "@testing-library/react";
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { api } from "@/lib/api";
import { __resetActivityForTests } from "@/lib/activity";
import { emitLiveTick, useLiveCandles } from "@/lib/useLiveMarket";
import {
  __resetCacheForTests,
  cacheCoalesce,
  cacheGet,
  cacheSet,
  checkRateLimit,
  computeWeakEtag,
  encodeRespCommand,
  isNotModified,
  parseRespMessages,
  parseRedisUrl,
} from "@/server/cache-store";
import { handleApi } from "@/server/api-handler";
import {
  evaluateAccountRisk,
  evaluateAccountsBatch,
} from "@/server/risk-engine";
import { getIstDateKey } from "@/lib/funding-products";

function LiveCandlesSpy({
  symbol,
  tf,
  onState,
}: {
  symbol: string;
  tf: string;
  onState: (s: { candles: unknown[]; quote: unknown }) => void;
}) {
  const res = useLiveCandles(symbol, tf, { pollMs: 5000, enabled: true });
  onState({ candles: res.candles, quote: res.quote });
  return React.createElement(
    "div",
    { "data-testid": "candles-count" },
    res.candles.length,
  );
}

describe("Production Performance & Egress Optimizations", () => {
  afterEach(() => {
    __resetCacheForTests();
    __resetActivityForTests();
    delete process.env["REDIS_URL"];
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe("cache-store (LRU, Singleflight, RESP2 & ETag)", () => {
    it("supports TTL expiration, LRU storage, and singleflight coalescing", async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-11-25T10:00:00.000Z"));

      await cacheSet("k1", { ok: true }, 1000);
      expect(await cacheGet("k1")).toEqual({ ok: true });

      vi.advanceTimersByTime(1200);
      expect(await cacheGet("k1")).toBeNull();
      vi.useRealTimers();

      let loads = 0;
      const results = await Promise.all(
        Array.from({ length: 6 }, () =>
          cacheCoalesce("sf:key", 5000, async () => {
            loads += 1;
            await new Promise((r) => setTimeout(r, 10));
            return { seq: loads };
          }),
        ),
      );
      expect(loads).toBe(1);
      expect(results.every((r) => r.seq === 1)).toBe(true);
    });

    it("falls back seamlessly to memory when REDIS_URL points to an unreachable host", async () => {
      process.env["REDIS_URL"] = "redis://user:pass@127.0.0.1:65499/0";
      const parsed = parseRedisUrl(process.env["REDIS_URL"]);
      expect(parsed?.host).toBe("127.0.0.1");
      expect(parsed?.port).toBe(65499);

      await expect(
        cacheSet("fallback:k", "value-1", 5000),
      ).resolves.toBeUndefined();
      expect(await cacheGet("fallback:k")).toBe("value-1");
    });

    it("encodes and parses RESP2 wire messages accurately", () => {
      const wire = encodeRespCommand([
        "SET",
        "if:v1:test",
        '{"a":1}',
        "EX",
        30,
      ]);
      expect(wire.toString("utf8")).toContain("*5\r\n$3\r\nSET\r\n");

      const sample = Buffer.from(
        "+OK\r\n:42\r\n$5\r\nhello\r\n$-1\r\n*2\r\n$3\r\nfoo\r\n$3\r\nbar\r\n",
        "utf8",
      );
      const { messages, rest } = parseRespMessages(sample);
      expect(rest.length).toBe(0);
      expect(messages).toEqual(["OK", 42, "hello", null, ["foo", "bar"]]);
    });

    it("computes weak ETags, checks If-None-Match, and enforces rate limits", async () => {
      const etag = computeWeakEtag({ hello: "world" });
      expect(etag.startsWith('W/"')).toBe(true);
      const reqMatch = new Request("https://indifunded.com/api/settings", {
        headers: { "if-none-match": etag },
      });
      const reqMiss = new Request("https://indifunded.com/api/settings", {
        headers: { "if-none-match": 'W/"other"' },
      });
      expect(isNotModified(reqMatch, etag)).toBe(true);
      expect(isNotModified(reqMiss, etag)).toBe(false);

      const b = `rl_test_${Date.now()}`;
      expect((await checkRateLimit(b, 2, 60_000)).allowed).toBe(true);
      expect((await checkRateLimit(b, 2, 60_000)).allowed).toBe(true);
      const blocked = await checkRateLimit(b, 2, 60_000);
      expect(blocked.allowed).toBe(false);
      expect(blocked.retryAfterSec).toBeGreaterThanOrEqual(1);
    });
  });

  describe("API caching, ETags, auth cache & SSE streaming", () => {
    it("serves ETag + Cache-Control + 304 Not Modified on public endpoints", async () => {
      const res1 = await handleApi(
        new Request("http://localhost:3000/api/plans"),
        "plans",
      );
      expect(res1.status).toBe(200);
      expect(res1.headers.get("cache-control")).toContain("public, max-age=");
      const etag = res1.headers.get("etag");
      expect(etag).toBeTruthy();

      const res304 = await handleApi(
        new Request("http://localhost:3000/api/plans", {
          headers: { "if-none-match": etag! },
        }),
        "plans",
      );
      expect(res304.status).toBe(304);
      expect(await res304.text()).toBe("");
    });

    it("keeps private /me/* uncacheable and authenticates/invalidates tokens via hash cache", async () => {
      const loginRes = await handleApi(
        new Request("http://localhost:3000/api/auth/local-login", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            email: "rahul.chouhan@example.in",
            password: "RAHUL@1234",
          }),
        }),
        "auth/local-login",
      );
      expect(loginRes.status).toBe(200);
      const { token } = (await loginRes.json()) as { token: string };
      expect(token).toMatch(/^ift\./);

      const dash1 = await handleApi(
        new Request("http://localhost:3000/api/me/dashboard", {
          headers: { authorization: `Bearer ${token}` },
        }),
        "me/dashboard",
      );
      expect(dash1.status).toBe(200);
      expect(dash1.headers.get("cache-control")).toContain("no-store");

      const state1 = await handleApi(
        new Request("http://localhost:3000/api/me/trading-state", {
          headers: { authorization: `Bearer ${token}` },
        }),
        "me/trading-state",
      );
      expect(state1.status).toBe(200);
      expect(state1.headers.get("cache-control")).toContain("no-store");

      const logoutRes = await handleApi(
        new Request("http://localhost:3000/api/auth/logout", {
          method: "POST",
          headers: { authorization: `Bearer ${token}` },
        }),
        "auth/logout",
      );
      expect(logoutRes.status).toBe(200);
    });

    it("streams initial SSE market quotes packet and tears down cleanly on abort", async () => {
      const ac = new AbortController();
      const res = await handleApi(
        new Request("http://localhost:3000/api/market/stream?symbols=NIFTY", {
          signal: ac.signal,
        }),
        "market/stream",
      );
      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toContain("text/event-stream");
      const reader = res.body!.getReader();
      const chunk = await reader.read();
      const text = new TextDecoder().decode(chunk.value);
      expect(text).toMatch(/event: (quotes|snapshot)/);
      expect(text).toContain("data:");
      expect(text).toContain("NIFTY");
      ac.abort();
      await reader.cancel();
    });
  });

  describe("Risk engine readOnlyPoll fast-path & scoped queries", () => {
    it("skips DB queries and writes on flat recently-updated accounts during readOnlyPoll", async () => {
      const allSpy = vi.fn(async () => []);
      const querySpy = vi.fn(async () => []);
      const putSpy = vi.fn(async (_col: string, doc: unknown) => doc);
      const mockDb = {
        all: allSpy,
        query: querySpy,
        get: vi.fn(async () => null),
        put: putSpy,
      };

      const flatAccount = {
        id: "acct-flat-1",
        user_id: "u1",
        status: "Active",
        account_type: "Challenge",
        starting_capital: 200000,
        balance: 200000,
        used_margin: 0,
        current_trading_day: getIstDateKey(new Date()),
        updated_at: new Date().toISOString(),
      };

      const res = await evaluateAccountRisk({
        db: mockDb,
        account: flatAccount,
        quoteMap: {},
        positions: [],
        readOnlyPoll: true,
      });

      expect(res.cached).toBe(true);
      expect(allSpy).not.toHaveBeenCalled();
      expect(querySpy).not.toHaveBeenCalled();
      expect(putSpy).not.toHaveBeenCalled();
    });

    it("uses batch db.query instead of full-table db.all scans in evaluateAccountsBatch", async () => {
      const allSpy = vi.fn(async () => []);
      const querySpy = vi.fn(async () => []);
      const mockDb = {
        all: allSpy,
        query: querySpy,
        get: vi.fn(async () => null),
        put: vi.fn(async (_c: string, doc: unknown) => doc),
      };

      const accounts = [
        {
          id: "acct-b1",
          user_id: "u1",
          status: "Active",
          starting_capital: 100000,
          balance: 100000,
          used_margin: 0,
          current_trading_day: getIstDateKey(new Date()),
          updated_at: new Date().toISOString(),
        },
      ];

      await evaluateAccountsBatch({
        db: mockDb,
        accounts,
        readOnlyPoll: true,
      });

      expect(allSpy).not.toHaveBeenCalled();
      expect(querySpy).toHaveBeenCalledTimes(1);
    });
  });

  describe("Client incremental ticks & non-polling candle refresh", () => {
    it("does not poll /market/candles every 5s once real history is loaded", async () => {
      vi.useFakeTimers();
      const sym = `NOPOLL_${Date.now()}`;
      const bars = Array.from({ length: 8 }, (_, idx) => ({
        time: 1731650000 + idx * 300,
        open: 24000 + idx,
        high: 24010 + idx,
        low: 23990 + idx,
        close: 24005 + idx,
        volume: 1200,
      }));
      const getSpy = vi
        .spyOn(api, "get")
        .mockImplementation(async (url: string) => {
          if (url === "/market/candles") {
            return {
              data: {
                isBaseline: false,
                marketStatus: "CLOSED",
                candles: bars,
                quote: {
                  symbol: sym,
                  ltp: 24012,
                  prevClose: 24000,
                  changePct: 0.05,
                },
              },
            } as never;
          }
          return { data: {} } as never;
        });

      let latestState: { candles: unknown[]; quote: unknown } = {
        candles: [],
        quote: null,
      };
      render(
        React.createElement(LiveCandlesSpy, {
          symbol: sym,
          tf: "5m",
          onState: (s) => {
            latestState = s;
          },
        }),
      );

      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(latestState.candles.length).toBe(8);
      const callsBefore = getSpy.mock.calls.filter(
        ([u]) => u === "/market/candles",
      ).length;
      expect(callsBefore).toBe(1);

      // Push incremental tick and advance 25s (5x the old 5s full-history polling interval)
      await act(async () => {
        emitLiveTick(sym, {
          symbol: sym,
          ltp: 24020,
          prevClose: 24000,
          tickLive: false,
        });
        vi.advanceTimersByTime(25_000);
        await Promise.resolve();
      });

      const callsForSym5m = getSpy.mock.calls.filter(
        ([u, cfg]) =>
          u === "/market/candles" &&
          (cfg as { params?: { symbol?: string; tf?: string } })?.params
            ?.symbol === sym &&
          (cfg as { params?: { symbol?: string; tf?: string } })?.params?.tf ===
            "5m",
      );
      expect(callsForSym5m.length).toBe(1);
    });
  });
});
