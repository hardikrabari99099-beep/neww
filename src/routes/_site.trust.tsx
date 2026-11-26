import { createFileRoute } from "@tanstack/react-router";
import { TrustCenter } from "@/views/ExtraPages";
import { PAGE_SEO, buildOrganizationJsonLd, buildRouteHead } from "@/lib/seo";

export const Route = createFileRoute("/_site/trust")({
  head: () =>
    buildRouteHead({
      ...PAGE_SEO["/trust"],
      jsonLd: buildOrganizationJsonLd(),
    }),
  component: TrustCenter,
});
