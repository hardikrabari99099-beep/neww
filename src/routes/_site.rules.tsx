import { createFileRoute } from "@tanstack/react-router";
import { Rules } from "@/views/SimplePages";
import { PAGE_SEO, buildRouteHead } from "@/lib/seo";

export const Route = createFileRoute("/_site/rules")({
  head: () => buildRouteHead(PAGE_SEO["/rules"]),
  component: Rules,
});
