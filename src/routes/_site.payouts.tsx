import { createFileRoute } from "@tanstack/react-router";
import { Payouts } from "@/views/SimplePages";
import { PAGE_SEO, buildRouteHead } from "@/lib/seo";

export const Route = createFileRoute("/_site/payouts")({
  head: () => buildRouteHead(PAGE_SEO["/payouts"]),
  component: Payouts,
});
