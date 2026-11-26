import { createFileRoute } from "@tanstack/react-router";
import { PolicyPage } from "@/views/ExtraPages";
import { PAGE_SEO, buildRouteHead } from "@/lib/seo";

export const Route = createFileRoute("/_site/refund-policy")({
  head: () => buildRouteHead(PAGE_SEO["/refund-policy"]),
  component: () => <PolicyPage kind="refund" />,
});
