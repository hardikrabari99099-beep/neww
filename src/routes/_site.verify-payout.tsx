import { createFileRoute } from "@tanstack/react-router";
import { VerifyPayout } from "@/views/ExtraPages";
import { PAGE_SEO, buildRouteHead } from "@/lib/seo";

export const Route = createFileRoute("/_site/verify-payout")({
  head: () => buildRouteHead(PAGE_SEO["/verify-payout"]),
  component: VerifyPayout,
});
