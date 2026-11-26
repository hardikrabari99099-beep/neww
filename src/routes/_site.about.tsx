import { createFileRoute } from "@tanstack/react-router";
import { About } from "@/views/SimplePages";
import { PAGE_SEO, buildOrganizationJsonLd, buildRouteHead } from "@/lib/seo";

export const Route = createFileRoute("/_site/about")({
  head: () =>
    buildRouteHead({
      ...PAGE_SEO["/about"],
      jsonLd: buildOrganizationJsonLd(),
    }),
  component: About,
});
