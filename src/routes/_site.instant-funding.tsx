import { createFileRoute } from "@tanstack/react-router";
import Challenges from "@/views/Challenges";
import {
  PAGE_SEO,
  SITE_NAME,
  buildCanonicalUrl,
  buildRouteHead,
} from "@/lib/seo";
import { DEFAULT_FUNDING_PRODUCTS } from "@/lib/funding-products";

export const Route = createFileRoute("/_site/instant-funding")({
  head: () => {
    const cfg = PAGE_SEO["/instant-funding"];
    return buildRouteHead({
      ...cfg,
      jsonLd: {
        "@context": "https://schema.org",
        "@type": "ItemList",
        name: "IndiFunded Instant Funding Accounts",
        url: buildCanonicalUrl("/instant-funding"),
        itemListElement: DEFAULT_FUNDING_PRODUCTS.instant_funding.tiers.map(
          (tier, idx) => ({
            "@type": "Product",
            position: idx + 1,
            name: `Instant Funding ${tier.label} Funded Account`,
            description:
              "Immediate funded trading account in India with 3% daily loss limit, 5% trailing drawdown, and up to 90% profit split.",
            brand: { "@type": "Brand", name: SITE_NAME },
            url: buildCanonicalUrl("/instant-funding"),
            offers: {
              "@type": "Offer",
              price: tier.intraday_price,
              priceCurrency: "INR",
              availability: "https://schema.org/InStock",
            },
          }),
        ),
      },
    });
  },
  component: () => <Challenges initialProgram="instant" />,
});
