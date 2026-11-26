import { createFileRoute } from "@tanstack/react-router";
import Home from "@/views/Home";
import {
  PAGE_SEO,
  buildFaqPageJsonLd,
  buildOrganizationJsonLd,
  buildRouteHead,
  buildWebSiteJsonLd,
} from "@/lib/seo";
import { DEFAULT_SETTINGS } from "@/lib/default-settings";

export const Route = createFileRoute("/_site/")({
  head: () => {
    const homeFaqs = (DEFAULT_SETTINGS.faq_groups || [])
      .flatMap((group) => group.items || [])
      .slice(0, 6);
    return buildRouteHead({
      ...PAGE_SEO["/"],
      jsonLd: [
        buildOrganizationJsonLd(),
        buildWebSiteJsonLd(),
        ...(homeFaqs.length > 0 ? [buildFaqPageJsonLd(homeFaqs)] : []),
      ],
    });
  },
  component: Home,
});
