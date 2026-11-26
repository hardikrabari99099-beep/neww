import { createFileRoute } from "@tanstack/react-router";
import Referral from "@/views/Referral";
import { PAGE_SEO, buildRouteHead } from "@/lib/seo";

export const Route = createFileRoute("/_site/refer")({
  head: () => buildRouteHead(PAGE_SEO["/refer"]),
  component: Referral,
});
