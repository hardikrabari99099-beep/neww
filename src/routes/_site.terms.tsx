import { createFileRoute } from "@tanstack/react-router";
import { PolicyPage } from "@/views/ExtraPages";
import { PAGE_SEO, buildRouteHead } from "@/lib/seo";

export const Route = createFileRoute("/_site/terms")({
  head: () => buildRouteHead(PAGE_SEO["/terms"]),
  component: () => <PolicyPage kind="terms" />,
});
