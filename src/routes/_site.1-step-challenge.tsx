import { createFileRoute } from "@tanstack/react-router";
import Challenges from "@/views/Challenges";
import {
  PAGE_SEO,
  SITE_NAME,
  buildCanonicalUrl,
  buildRouteHead,
} from "@/lib/seo";
import { DEFAULT_FUNDING_PRODUCTS } from "@/lib/funding-products";

export const Route = createFileRoute("/_site/1-step-challenge")({
  head: () => {
    const cfg = PAGE_SEO["/1-step-challenge"];
    return buildRouteHead({
      ...cfg,
      jsonLd: {
        "@context": "https://schema.org",
        "@type": "ItemList",
        name: "IndiFunded 1-Step Trading Challenges",
        url: buildCanonicalUrl("/1-step-challenge"),
        itemListElement: DEFAULT_FUNDING_PRODUCTS.one_step.tiers.map(
          (tier, idx) => ({
            "@type": "Product",
            position: idx + 1,
            name: `1-Step Trading Challenge ${tier.label}`,
            description:
              "Single-phase trading evaluation in India with a 10% profit target, no time limit, and an 80% profit split.",
            brand: { "@type": "Brand", name: SITE_NAME },
            url: buildCanonicalUrl("/1-step-challenge"),
            offers: {
              "@type": "Offer",
              price: tier.price,
              priceCurrency: "INR",
              availability: "https://schema.org/InStock",
            },
          }),
        ),
      },
    });
  },
  component: () => <Challenges initialProgram="one_step" />,
});
