import { createFileRoute } from "@tanstack/react-router";
import { PolicyPage } from "@/views/ExtraPages";
import { PAGE_SEO, buildRouteHead } from "@/lib/seo";

export const Route = createFileRoute("/_site/risk-disclosure")({
  head: () => buildRouteHead(PAGE_SEO["/risk-disclosure"]),
  component: () => <PolicyPage kind="risk" />,
});
