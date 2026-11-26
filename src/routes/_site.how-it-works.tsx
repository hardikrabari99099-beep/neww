import { createFileRoute } from "@tanstack/react-router";
import { HowItWorksPage } from "@/views/ExtraPages";
import { PAGE_SEO, buildRouteHead } from "@/lib/seo";

export const Route = createFileRoute("/_site/how-it-works")({
  head: () => buildRouteHead(PAGE_SEO["/how-it-works"]),
  component: HowItWorksPage,
});
