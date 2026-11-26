import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";

type ServerEntry = {
  fetch: (
    request: Request,
    env: unknown,
    ctx: unknown,
  ) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(
  response: Response,
): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!isH3SwallowedErrorBody(body)) return response;

  console.error(
    consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`),
  );
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function isH3SwallowedErrorBody(body: string): boolean {
  try {
    const payload = JSON.parse(body) as {
      unhandled?: unknown;
      message?: unknown;
    };
    return payload.unhandled === true && payload.message === "HTTPError";
  } catch {
    return false;
  }
}

export function maybeCanonicalRedirect(request: Request): Response | null {
  if (request.method !== "GET" && request.method !== "HEAD") return null;
  const url = new URL(request.url);
  const host = url.hostname.toLowerCase();
  const isProdHost = host === "indifunded.com" || host === "www.indifunded.com";
  if (!isProdHost) return null;

  const pathname = url.pathname;
  if (
    pathname.startsWith("/api/") ||
    pathname.startsWith("/_build/") ||
    pathname.startsWith("/assets/") ||
    pathname === "/sitemap.xml" ||
    pathname === "/robots.txt"
  ) {
    return null;
  }

  // Render and other reverse proxies may terminate TLS before the Node app.
  // In that case request.url can be http even though the visitor used HTTPS.
  // Trust the proxy's forwarded protocol first to avoid an HTTPS redirect loop.
  const forwardedProto = (
    request.headers.get("x-forwarded-proto") ||
    request.headers.get("forwarded")?.match(/proto=(https?)/i)?.[1] ||
    ""
  )
    .split(",")[0]
    .trim()
    .replace(/:$/, "")
    .toLowerCase();
  const externalProtocol =
    forwardedProto === "https" || forwardedProto === "http"
      ? forwardedProto
      : url.protocol.replace(":", "").toLowerCase();

  let changed = false;
  if (host === "www.indifunded.com") {
    url.hostname = "indifunded.com";
    changed = true;
  }

  if (externalProtocol === "http") {
    url.protocol = "https:";
    changed = true;
  } else if (externalProtocol === "https" && url.protocol !== "https:") {
    // Normalize the redirect target to the visitor-facing scheme without
    // issuing a redirect solely because the proxy-to-app hop uses HTTP.
    url.protocol = "https:";
  }

  if (pathname.length > 1 && pathname.endsWith("/")) {
    url.pathname = pathname.replace(/\\/+$/, "");
    changed = true;
  }

  if (!changed) return null;
  return new Response(null, {
    status: 301,
    headers: { Location: url.toString() },
  });
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    try {
      const redirect = maybeCanonicalRedirect(request);
      if (redirect) return redirect;
      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      return await normalizeCatastrophicSsrResponse(response);
    } catch (error) {
      console.error(error);
      return new Response(renderErrorPage(), {
        status: 500,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }
  },
};
