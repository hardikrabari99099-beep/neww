import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  LEGAL_NAME,
  PAGE_SEO,
  PUBLIC_SITEMAP_ROUTES,
  SITE_URL,
  buildBlogPostingJsonLd,
  buildBreadcrumbJsonLd,
  buildCanonicalUrl,
  buildFaqPageJsonLd,
  buildOrganizationJsonLd,
  buildRouteHead,
  buildWebSiteJsonLd,
  normalizeCanonicalPath,
} from "@/lib/seo";
import { DEFAULT_BLOGS } from "@/lib/default-blogs";
import { generateSitemapXml } from "@/routes/sitemap[.]xml";
import { maybeCanonicalRedirect } from "@/server";

describe("IndiFunded SEO Architecture", () => {
  it("normalizes canonical paths without www or trailing slashes", () => {
    expect(normalizeCanonicalPath("/")).toBe("/");
    expect(normalizeCanonicalPath("/challenges/")).toBe("/challenges");
    expect(normalizeCanonicalPath("instant-funding?ref=ABC")).toBe(
      "/instant-funding",
    );
    expect(buildCanonicalUrl("/")).toBe(`${SITE_URL}/`);
    expect(buildCanonicalUrl("/1-step-challenge/")).toBe(
      `${SITE_URL}/1-step-challenge`,
    );
  });

  it("ensures every public route has unique title, unique description, canonical, and indexable robots", () => {
    const entries = Object.values(PAGE_SEO);
    const titles = new Set<string>();
    const descriptions = new Set<string>();

    expect(entries.length).toBe(PUBLIC_SITEMAP_ROUTES.length);

    for (const cfg of entries) {
      expect(cfg.title.length).toBeGreaterThan(15);
      expect(cfg.title.length).toBeLessThanOrEqual(70);
      expect(cfg.description.length).toBeGreaterThan(60);
      expect(cfg.description.length).toBeLessThanOrEqual(170);

      expect(titles.has(cfg.title)).toBe(false);
      expect(descriptions.has(cfg.description)).toBe(false);
      titles.add(cfg.title);
      descriptions.add(cfg.description);

      const head = buildRouteHead(cfg);
      const robots = head.meta.find((m) => m.name === "robots");
      expect(robots?.content).toContain("index, follow");
      expect(robots?.content).not.toContain("noindex");

      const canonical = head.links.find((l) => l.rel === "canonical");
      expect(canonical?.href).toBe(buildCanonicalUrl(cfg.path));
      expect(canonical?.href.startsWith("https://indifunded.com")).toBe(true);
      expect(canonical?.href).not.toContain("www.");
    }
  });

  it("emits noindex, nofollow and omits canonical & JSON-LD for private routes", () => {
    for (const p of [
      "/login",
      "/app",
      "/admin",
      "/checkout/success",
      "/verify/CERT1",
    ]) {
      const head = buildRouteHead({
        path: p,
        title: `Private ${p}`,
        description: "Private route",
        noindex: true,
      });
      const robots = head.meta.find((m) => m.name === "robots");
      expect(robots?.content).toBe("noindex, nofollow");
      expect(head.links.find((l) => l.rel === "canonical")).toBeUndefined();
      expect(head.scripts).toHaveLength(0);
    }
  });

  it("builds valid Organization, WebSite, BreadcrumbList, FAQPage, and BlogPosting JSON-LD", () => {
    const org = buildOrganizationJsonLd();
    expect(org["@type"]).toBe("Organization");
    expect(org.legalName).toBe(LEGAL_NAME);
    expect(org.legalName).toBe("IndiFunded Private Limited");
    expect(org.url).toBe("https://indifunded.com/");

    const site = buildWebSiteJsonLd();
    expect(site["@type"]).toBe("WebSite");
    expect(site.url).toBe("https://indifunded.com/");

    const crumbs = buildBreadcrumbJsonLd([
      { name: "Home", path: "/" },
      { name: "Instant Funding", path: "/instant-funding" },
    ]);
    expect(crumbs["@type"]).toBe("BreadcrumbList");

    const faq = buildFaqPageJsonLd([{ q: "Is there a daily cap?", a: "Yes." }]);
    expect(faq["@type"]).toBe("FAQPage");

    const post = buildBlogPostingJsonLd({
      slug: DEFAULT_BLOGS[3].slug,
      title: DEFAULT_BLOGS[3].title,
      description: DEFAULT_BLOGS[3].excerpt,
      image: DEFAULT_BLOGS[3].cover_image,
      author: DEFAULT_BLOGS[3].author,
      publishedAt: DEFAULT_BLOGS[3].created_at,
    });
    expect(post["@type"]).toBe("BlogPosting");
    expect(() => JSON.stringify([org, site, crumbs, faq, post])).not.toThrow();
  });

  it("generates dynamic sitemap.xml with indifunded.com URLs and excludes private/legacy URLs", async () => {
    const xml = await generateSitemapXml();
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
    expect(xml).toContain("<loc>https://indifunded.com/</loc>");
    expect(xml).toContain("<loc>https://indifunded.com/challenges</loc>");
    expect(xml).toContain("<loc>https://indifunded.com/instant-funding</loc>");
    expect(xml).toContain("<loc>https://indifunded.com/1-step-challenge</loc>");
    for (const post of DEFAULT_BLOGS) {
      expect(xml).toContain(
        `<loc>https://indifunded.com/blog/${post.slug}</loc>`,
      );
    }
    expect(xml).not.toContain("rubifunded");
    expect(xml).not.toContain("/login");
    expect(xml).not.toContain("/admin");
    expect(xml).not.toContain("/app<");
    expect(xml).not.toContain("/checkout/success");
    expect(xml).not.toContain("/verify/");
  });

  it("keeps robots.txt and site.webmanifest aligned with indifunded.com", () => {
    const rootDir = process.cwd();
    const robots = fs.readFileSync(
      path.join(rootDir, "public", "robots.txt"),
      "utf-8",
    );
    expect(robots).toContain("Allow: /");
    expect(robots).toContain("Disallow: /admin");
    expect(robots).toContain("Disallow: /app");
    expect(robots).toContain("Disallow: /login");
    expect(robots).toContain("Disallow: /api/");
    expect(robots).toContain("Sitemap: https://indifunded.com/sitemap.xml");
    expect(robots.toLowerCase()).not.toContain("rubifunded");

    const manifest = JSON.parse(
      fs.readFileSync(
        path.join(rootDir, "public", "site.webmanifest"),
        "utf-8",
      ),
    );
    expect(manifest.name).toContain("IndiFunded");
    expect(manifest.short_name).toBe("IndiFunded");
    expect(JSON.stringify(manifest).toLowerCase()).not.toContain("rubifunded");
  });

  it("performs 301 canonical redirects for www, http, and trailing slashes on production host", () => {
    const wwwRes = maybeCanonicalRedirect(
      new Request("https://www.indifunded.com/challenges/"),
    );
    expect(wwwRes?.status).toBe(301);
    expect(wwwRes?.headers.get("Location")).toBe(
      "https://indifunded.com/challenges",
    );

    const slashRes = maybeCanonicalRedirect(
      new Request("https://indifunded.com/instant-funding/"),
    );
    expect(slashRes?.status).toBe(301);
    expect(slashRes?.headers.get("Location")).toBe(
      "https://indifunded.com/instant-funding",
    );

    expect(
      maybeCanonicalRedirect(new Request("https://indifunded.com/challenges")),
    ).toBeNull();

    // Render may forward an HTTPS visitor request to the Node app over HTTP.
    // The forwarded protocol must prevent a redirect loop in that situation.
    expect(
      maybeCanonicalRedirect(
        new Request("http://indifunded.com/challenges", {
          headers: { "x-forwarded-proto": "https" },
        }),
      ),
    ).toBeNull();
    expect(
      maybeCanonicalRedirect(
        new Request("https://www.indifunded.com/api/health"),
      ),
    ).toBeNull();
    expect(
      maybeCanonicalRedirect(new Request("http://localhost:3000/challenges/")),
    ).toBeNull();
  });
});
