import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { BlogDetail } from "@/views/SimplePages";
import { DEFAULT_BLOGS } from "@/lib/default-blogs";
import { buildBlogPostingJsonLd, buildRouteHead } from "@/lib/seo";

const fetchBlogPostBySlug = createServerFn({ method: "GET" })
  .inputValidator((slug: string) => String(slug || "").trim())
  .handler(async ({ data: slug }) => {
    try {
      const { handleApi } = await import("@/server/api-handler");
      const res = await handleApi(
        new Request(
          `https://indifunded.com/api/blogs/${encodeURIComponent(slug)}`,
        ),
        `blogs/${encodeURIComponent(slug)}`,
      );
      if (res.ok) {
        const post = await res.json();
        if (post && post.slug) return post;
      }
    } catch {
      // fall back to seeded educational defaults
    }
    return DEFAULT_BLOGS.find((b) => b.slug === slug) || null;
  });

export const Route = createFileRoute("/_site/blog/$slug")({
  loader: ({ params }) => fetchBlogPostBySlug({ data: params.slug }),
  head: ({ loaderData, params }) => {
    const post =
      loaderData || DEFAULT_BLOGS.find((b) => b.slug === params.slug) || null;
    if (!post) {
      return buildRouteHead({
        path: `/blog/${params.slug}`,
        title: "Article Not Found | IndiFunded Blog",
        description: "The requested IndiFunded article could not be found.",
        noindex: true,
      });
    }
    const title = post.title.includes("IndiFunded")
      ? post.title
      : `${post.title} | IndiFunded`;
    const description =
      post.excerpt ||
      "Educational prop trading article from IndiFunded covering Indian markets, risk management, and funded accounts.";
    return buildRouteHead({
      path: `/blog/${post.slug}`,
      title,
      description,
      ogType: "article",
      image: post.cover_image || undefined,
      imageAlt: post.title,
      breadcrumbs: [
        { name: "Home", path: "/" },
        { name: "Blog", path: "/blog" },
        { name: post.title, path: `/blog/${post.slug}` },
      ],
      jsonLd: buildBlogPostingJsonLd({
        slug: post.slug,
        title: post.title,
        description,
        image: post.cover_image,
        author: post.author,
        publishedAt: post.created_at,
        updatedAt: post.updated_at || post.created_at,
      }),
    });
  },
  component: BlogDetail,
});
