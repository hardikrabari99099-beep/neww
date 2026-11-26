import { createFileRoute } from "@tanstack/react-router";
import { TraderStories } from "@/views/ExtraPages";
import { PAGE_SEO, buildRouteHead } from "@/lib/seo";

export const Route = createFileRoute("/_site/stories")({
  head: () => buildRouteHead(PAGE_SEO["/stories"]),
  component: TraderStories,
});
