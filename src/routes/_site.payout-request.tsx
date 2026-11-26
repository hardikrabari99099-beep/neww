import { createFileRoute } from "@tanstack/react-router";
import PayoutRequest from "@/views/PayoutRequest";
import { PAGE_SEO, buildRouteHead } from "@/lib/seo";

export const Route = createFileRoute("/_site/payout-request")({
  head: () => buildRouteHead(PAGE_SEO["/payout-request"]),
  component: PayoutRequest,
});
