import { createFileRoute } from "@tanstack/react-router";
import TraderLeague from "@/views/TraderLeague";
import { PAGE_SEO, buildRouteHead } from "@/lib/seo";

export const Route = createFileRoute("/_site/league")({
  head: () => buildRouteHead(PAGE_SEO["/league"]),
  component: TraderLeague,
});
