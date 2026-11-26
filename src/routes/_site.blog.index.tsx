import { createFileRoute } from "@tanstack/react-router";
import { Blog } from "@/views/SimplePages";
import { PAGE_SEO, buildRouteHead } from "@/lib/seo";

export const Route = createFileRoute("/_site/blog/")({
  head: () => buildRouteHead(PAGE_SEO["/blog"]),
  component: Blog,
});
