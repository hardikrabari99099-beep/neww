import { createFileRoute } from "@tanstack/react-router";
import Challenges from "@/views/Challenges";
import {
  PAGE_SEO,
  SITE_NAME,
  buildCanonicalUrl,
  buildRouteHead,
} from "@/lib/seo";
import { DEFAULT_PLANS } from "@/lib/default-plans";

export const Route = createFileRoute("/_site/challenges")({
  head: () =>
    buildRouteHead({
      ...PAGE_SEO["/challenges"],
      jsonLd: {
        "@context": "https://schema.org",
        "@type": "ItemList",
        name: "IndiFunded Funding Programs",
        url: buildCanonicalUrl("/challenges"),
        itemListElement: DEFAULT_PLANS.map((p, i) => ({
          "@type": "Product",
          position: i + 1,
          name: `${p.name} Challenge — ${p.account_size} INR funded account`,
          description: p.description,
          brand: { "@type": "Brand", name: SITE_NAME },
          url: buildCanonicalUrl("/challenges"),
          offers: {
            "@type": "Offer",
            price: p.challenge_fee,
            priceCurrency: "INR",
            availability: "https://schema.org/InStock",
          },
        })),
      },
    }),
  component: () => <Challenges initialProgram="all" />,
});
