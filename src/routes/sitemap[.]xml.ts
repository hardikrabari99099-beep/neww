import { createFileRoute } from "@tanstack/react-router";
import { PUBLIC_SITEMAP_ROUTES, buildCanonicalUrl } from "@/lib/seo";
import { DEFAULT_BLOGS } from "@/lib/default-blogs";

function escapeXml(str: string): string {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function toIsoDate(value: unknown): string | null {
  if (!value || typeof value !== "string") return null;
  const dt = new Date(value);
  return Number.isNaN(dt.getTime()) ? null : dt.toISOString().slice(0, 10);
}

export async function generateSitemapXml(): Promise<string> {
  let blogPosts: Array<{
    slug?: string;
    published?: boolean;
    updated_at?: string;
    created_at?: string;
  }> = [];

  try {
    const { handleApi } = await import("@/server/api-handler");
    const res = await handleApi(
      new Request("https://indifunded.com/api/blogs"),
      "blogs",
    );
    if (res.ok) {
      const data = (await res.json()) as unknown;
      if (Array.isArray(data)) {
        blogPosts = data;
      }
    }
  } catch {
    blogPosts = [];
  }

  // Ensure seeded educational blogs are represented if store returned empty
  const seenSlugs = new Set<string>();
  const normalizedBlogs: Array<{ slug: string; lastmod: string | null }> = [];
  for (const post of [...blogPosts, ...DEFAULT_BLOGS]) {
    if (!post || post.published === false) continue;
    const slug = typeof post.slug === "string" ? post.slug.trim() : "";
    if (!slug || seenSlugs.has(slug)) continue;
    seenSlugs.add(slug);
    normalizedBlogs.push({
      slug,
      lastmod: toIsoDate(post.updated_at || post.created_at),
    });
  }

  const urls: string[] = [];

  for (const entry of PUBLIC_SITEMAP_ROUTES) {
    urls.push(
      [
        "  <url>",
        `    <loc>${escapeXml(buildCanonicalUrl(entry.path))}</loc>`,
        `    <changefreq>${entry.changefreq}</changefreq>`,
        `    <priority>${entry.priority}</priority>`,
        "  </url>",
      ].join("\n"),
    );
  }

  for (const post of normalizedBlogs) {
    const lines = [
      "  <url>",
      `    <loc>${escapeXml(buildCanonicalUrl(`/blog/${post.slug}`))}</loc>`,
    ];
    if (post.lastmod) {
      lines.push(`    <lastmod>${escapeXml(post.lastmod)}</lastmod>`);
    }
    lines.push("    <changefreq>monthly</changefreq>");
    lines.push("    <priority>0.7</priority>");
    lines.push("  </url>");
    urls.push(lines.join("\n"));
  }

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...urls,
    "</urlset>",
    "",
  ].join("\n");
}

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        const xml = await generateSitemapXml();
        return new Response(xml, {
          status: 200,
          headers: {
            "content-type": "application/xml; charset=utf-8",
            "cache-control": "public, max-age=3600",
          },
        });
      },
    },
  },
});
