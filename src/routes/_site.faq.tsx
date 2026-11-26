import { createFileRoute } from "@tanstack/react-router";
import { FAQ } from "@/views/SimplePages";
import { PAGE_SEO, buildFaqPageJsonLd, buildRouteHead } from "@/lib/seo";
import { DEFAULT_SETTINGS } from "@/lib/default-settings";

export const Route = createFileRoute("/_site/faq")({
  head: () => {
    const allFaqs = (DEFAULT_SETTINGS.faq_groups || []).flatMap(
      (g) => g.items || [],
    );
    return buildRouteHead({
      ...PAGE_SEO["/faq"],
      jsonLd: buildFaqPageJsonLd(allFaqs),
    });
  },
  component: FAQ,
});
