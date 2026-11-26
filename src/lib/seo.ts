export const SITE_URL = "https://indifunded.com";
export const SITE_NAME = "IndiFunded";
export const LEGAL_NAME = "IndiFunded Private Limited";
export const DEFAULT_OG_IMAGE_PATH =
  "/assets/aistudio/Teal_Gradient_F_Emblem_03195f4a.png";
export const DEFAULT_OG_IMAGE = `${SITE_URL}${DEFAULT_OG_IMAGE_PATH}`;
export const TWITTER_HANDLE = "@indifunded";

export const VERIFIED_SOCIAL_URLS = [
  "https://www.instagram.com/indifunded",
  "https://youtube.com/@indifunded",
  "https://x.com/indifunded",
  "https://www.facebook.com/share/17bwvWUub7/",
];

export interface BreadcrumbItem {
  name: string;
  path: string;
}

export interface PageSeoConfig {
  path: string;
  title: string;
  description: string;
  keywords?: string[];
  ogType?: "website" | "article";
  image?: string;
  imageAlt?: string;
  noindex?: boolean;
  breadcrumbs?: BreadcrumbItem[];
  jsonLd?: Record<string, unknown> | Array<Record<string, unknown>>;
}

export function normalizeCanonicalPath(path = "/"): string {
  if (!path || path === "/") return "/";
  const clean = path.split("?")[0]?.split("#")[0] || "/";
  const prefixed = clean.startsWith("/") ? clean : `/${clean}`;
  return prefixed.length > 1 ? prefixed.replace(/\/+$/, "") : "/";
}

export function buildCanonicalUrl(path = "/"): string {
  const normalized = normalizeCanonicalPath(path);
  return normalized === "/" ? `${SITE_URL}/` : `${SITE_URL}${normalized}`;
}

export function resolveAbsoluteImageUrl(image?: string): string {
  if (!image) return DEFAULT_OG_IMAGE;
  if (image.startsWith("https://") || image.startsWith("http://")) {
    return image;
  }
  const normalized = image.startsWith("/") ? image : `/${image}`;
  return `${SITE_URL}${normalized}`;
}

export function buildOrganizationJsonLd(): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": `${SITE_URL}/#organization`,
    name: SITE_NAME,
    legalName: LEGAL_NAME,
    url: `${SITE_URL}/`,
    logo: {
      "@type": "ImageObject",
      url: DEFAULT_OG_IMAGE,
    },
    sameAs: VERIFIED_SOCIAL_URLS,
    contactPoint: [
      {
        "@type": "ContactPoint",
        contactType: "customer support",
        email: "support@indifunded.com",
        areaServed: "IN",
        availableLanguage: ["English", "Hindi"],
      },
    ],
  };
}

export function buildWebSiteJsonLd(): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${SITE_URL}/#website`,
    name: SITE_NAME,
    alternateName: LEGAL_NAME,
    url: `${SITE_URL}/`,
    inLanguage: "en-IN",
    publisher: {
      "@id": `${SITE_URL}/#organization`,
    },
  };
}

export function buildBreadcrumbJsonLd(
  items: BreadcrumbItem[],
): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, idx) => ({
      "@type": "ListItem",
      position: idx + 1,
      name: item.name,
      item: buildCanonicalUrl(item.path),
    })),
  };
}

export function buildWebPageJsonLd(config: {
  path: string;
  title: string;
  description: string;
}): Record<string, unknown> {
  const canonicalUrl = buildCanonicalUrl(config.path);
  return {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "@id": `${canonicalUrl}#webpage`,
    url: canonicalUrl,
    name: config.title,
    description: config.description,
    inLanguage: "en-IN",
    isPartOf: {
      "@id": `${SITE_URL}/#website`,
    },
    about: {
      "@id": `${SITE_URL}/#organization`,
    },
  };
}

export function buildBlogPostingJsonLd(article: {
  slug: string;
  title: string;
  description: string;
  image?: string;
  author?: string;
  publishedAt?: string;
  updatedAt?: string;
}): Record<string, unknown> {
  const url = buildCanonicalUrl(`/blog/${article.slug}`);
  return {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": url,
    },
    headline: article.title,
    description: article.description,
    image: [resolveAbsoluteImageUrl(article.image)],
    author: {
      "@type": "Organization",
      name: article.author || SITE_NAME,
      url: `${SITE_URL}/`,
    },
    publisher: {
      "@type": "Organization",
      name: SITE_NAME,
      legalName: LEGAL_NAME,
      logo: {
        "@type": "ImageObject",
        url: DEFAULT_OG_IMAGE,
      },
    },
    datePublished: article.publishedAt || undefined,
    dateModified: article.updatedAt || article.publishedAt || undefined,
    inLanguage: "en-IN",
  };
}

export function buildFaqPageJsonLd(
  items: Array<{ q: string; a: string }>,
): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.a,
      },
    })),
  };
}

export const PAGE_SEO: Record<string, PageSeoConfig> = {
  "/": {
    path: "/",
    title: "IndiFunded — Prop Trading Firm India | Funded Accounts",
    description:
      "IndiFunded is an Indian prop trading firm offering Nifty and Bank Nifty funded accounts up to ₹10,00,000, Instant Funding, and 24-hour payouts.",
    keywords: [
      "Prop Trading Firm India",
      "Funded Trading Account India",
      "Best Prop Trading Firm in India",
      "Indian Prop Trading Firm",
      "Nifty Funded Account",
      "Stock Market Prop Trading India",
    ],
    breadcrumbs: [{ name: "Home", path: "/" }],
  },
  "/challenges": {
    path: "/challenges",
    title: "Funded Trading Challenge India | IndiFunded Plans",
    description:
      "Compare IndiFunded trading challenges, Instant Funding, and 1-Step accounts from ₹50,000 to ₹10,00,000 with transparent drawdown rules and UPI checkout.",
    keywords: [
      "Funded Trading Challenge India",
      "Trading Evaluation Program",
      "Nifty Funded Account",
      "Funded Trading Account India",
      "Bank Nifty Trading Challenge",
    ],
    breadcrumbs: [
      { name: "Home", path: "/" },
      { name: "Challenges", path: "/challenges" },
    ],
  },
  "/instant-funding": {
    path: "/instant-funding",
    title: "Instant Funding India | Zero-Evaluation Funded Account",
    description:
      "Get Instant Funding in India with IndiFunded. Skip evaluation phases, trade Nifty and Bank Nifty from day one, and earn up to 90% profit split.",
    keywords: [
      "Instant Funding India",
      "Funded Trading Account India",
      "Nifty Funded Account",
      "Prop Trading Firm India",
    ],
    breadcrumbs: [
      { name: "Home", path: "/" },
      { name: "Challenges", path: "/challenges" },
      { name: "Instant Funding", path: "/instant-funding" },
    ],
  },
  "/1-step-challenge": {
    path: "/1-step-challenge",
    title: "One Step Trading Challenge India | 10% Target — IndiFunded",
    description:
      "Pass IndiFunded's One Step Trading Challenge in India with a single 10% profit target, no time limit, 3% daily loss limit, and an 80% profit split.",
    keywords: [
      "One Step Trading Challenge",
      "Trading Evaluation Program",
      "Funded Trading Challenge India",
      "Nifty Options Trading Challenge",
    ],
    breadcrumbs: [
      { name: "Home", path: "/" },
      { name: "Challenges", path: "/challenges" },
      { name: "1-Step Challenge", path: "/1-step-challenge" },
    ],
  },
  "/how-it-works": {
    path: "/how-it-works",
    title: "How Funded Trading Works in India | IndiFunded",
    description:
      "Learn how IndiFunded works in clear steps: pick a funding track, trade NSE indices within risk limits, qualify, and withdraw profits via UPI or IMPS.",
    keywords: [
      "How Funded Trading Works",
      "Funded Trader India",
      "Trading Evaluation Program",
      "Prop Trading Firm India",
    ],
    breadcrumbs: [
      { name: "Home", path: "/" },
      { name: "How It Works", path: "/how-it-works" },
    ],
  },
  "/rules": {
    path: "/rules",
    title: "Funded Trading Account Rules | IndiFunded Policies",
    description:
      "Review IndiFunded challenge rules, 5% daily and 20% max drawdown guardrails, point calculation, trading days, and 70%–90% profit-sharing policies.",
    keywords: [
      "Funded Trading Account Rules",
      "Nifty Options Trading Challenge",
      "Bank Nifty Trading Challenge",
      "Two Step Trading Challenge",
    ],
    breadcrumbs: [
      { name: "Home", path: "/" },
      { name: "Rules", path: "/rules" },
    ],
  },
  "/payouts": {
    path: "/payouts",
    title: "Prop Trading Payout India | Withdraw Profits — IndiFunded",
    description:
      "Submit and verify funded trader payouts in India on IndiFunded. Withdraw profit shares via UPI or bank transfer with transparent 24-hour processing.",
    keywords: [
      "Prop Trading Payout India",
      "Prop Firm Payout India",
      "Funded Trader India",
      "IndiFunded Payouts",
    ],
    breadcrumbs: [
      { name: "Home", path: "/" },
      { name: "Payouts", path: "/payouts" },
    ],
  },
  "/payout-request": {
    path: "/payout-request",
    title: "Request Funded Trader Payout | IndiFunded Withdrawals",
    description:
      "Submit a payout request for your funded IndiFunded trading account via UPI, IMPS, or NEFT with clear verification and 24-hour turnaround.",
    keywords: [
      "Prop Firm Payout India",
      "Prop Trading Payout India",
      "IndiFunded Payout Request",
    ],
    breadcrumbs: [
      { name: "Home", path: "/" },
      { name: "Payouts", path: "/payouts" },
      { name: "Request Payout", path: "/payout-request" },
    ],
  },
  "/verify-payout": {
    path: "/verify-payout",
    title: "Verify Funded Payout Certificate | IndiFunded",
    description:
      "Verify any IndiFunded payout certificate or credential using its unique verification code, payout ID, or trader name.",
    keywords: [
      "Verify Prop Firm Payout",
      "IndiFunded Payout Proof",
      "Prop Trading Payout India",
    ],
    breadcrumbs: [
      { name: "Home", path: "/" },
      { name: "Verify Payout", path: "/verify-payout" },
    ],
  },
  "/leaderboard": {
    path: "/leaderboard",
    title: "Top Funded Traders Leaderboard India | IndiFunded",
    description:
      "See top-performing funded traders on IndiFunded ranked by verified payouts and consistent risk management across Indian market programs.",
    keywords: [
      "Funded Trader India",
      "Indian Prop Trading Firm",
      "IndiFunded Leaderboard",
    ],
    breadcrumbs: [
      { name: "Home", path: "/" },
      { name: "Leaderboard", path: "/leaderboard" },
    ],
  },
  "/league": {
    path: "/league",
    title: "IndiFunded Trader League | Trading Competition India",
    description:
      "Join the IndiFunded Trader League to test your Indian market strategy under structured risk rules alongside disciplined traders.",
    keywords: [
      "Stock Market Prop Trading India",
      "Nifty Options Trading Challenge",
      "IndiFunded Trader League",
    ],
    breadcrumbs: [
      { name: "Home", path: "/" },
      { name: "Trader League", path: "/league" },
    ],
  },
  "/stories": {
    path: "/stories",
    title: "Funded Trader Stories & Reviews India | IndiFunded",
    description:
      "Read trader stories and verified video reviews from Indian market participants trading with IndiFunded evaluation and funded accounts.",
    keywords: [
      "IndiFunded Reviews",
      "Funded Trader India",
      "Indian Prop Trading Firm",
    ],
    breadcrumbs: [
      { name: "Home", path: "/" },
      { name: "Trader Stories", path: "/stories" },
    ],
  },
  "/about": {
    path: "/about",
    title: "About IndiFunded | Indian Prop Trading Firm",
    description:
      "Built for Indian traders. Learn how IndiFunded delivers transparent INR-denominated evaluations, clear risk limits, and trader-first support.",
    keywords: [
      "IndiFunded Private Limited",
      "Indian Prop Trading Firm",
      "Prop Trading Firm India",
    ],
    breadcrumbs: [
      { name: "Home", path: "/" },
      { name: "About Us", path: "/about" },
    ],
  },
  "/trust": {
    path: "/trust",
    title: "Trust Center & Payout Verification | IndiFunded",
    description:
      "Inspect IndiFunded company details, platform transparency metrics, and verifiable payout records in our public Trust Center.",
    keywords: [
      "IndiFunded Trust Center",
      "Prop Firm Payout India",
      "Indian Prop Trading Firm",
    ],
    breadcrumbs: [
      { name: "Home", path: "/" },
      { name: "Trust Center", path: "/trust" },
    ],
  },
  "/faq": {
    path: "/faq",
    title: "Funded Trading FAQs India | IndiFunded Help",
    description:
      "Answers to common questions on IndiFunded challenge rules, simulated vs. funded accounts, SEBI disclosures, drawdown caps, and 24-hour payouts.",
    keywords: [
      "Funded Trading FAQs India",
      "Funded Trading Account Rules",
      "Prop Trading Firm India",
    ],
    breadcrumbs: [
      { name: "Home", path: "/" },
      { name: "FAQ", path: "/faq" },
    ],
  },
  "/contact": {
    path: "/contact",
    title: "Contact IndiFunded | Trader Support India",
    description:
      "Contact the IndiFunded support desk or raise a tracked ticket for help with challenges, KYC verification, payouts, and trading rules.",
    keywords: [
      "Contact IndiFunded",
      "IndiFunded Support",
      "Prop Trading Firm India",
    ],
    breadcrumbs: [
      { name: "Home", path: "/" },
      { name: "Contact", path: "/contact" },
    ],
  },
  "/blog": {
    path: "/blog",
    title: "Prop Trading Blog India | Nifty & Risk Guides — IndiFunded",
    description:
      "Educational articles on Indian prop trading, Nifty and Bank Nifty risk management, Instant Funding, 1-Step challenges, and trader payouts.",
    keywords: [
      "Stock Market Prop Trading India",
      "Nifty Funded Account",
      "Bank Nifty Trading Challenge",
      "Trading Evaluation Program",
    ],
    breadcrumbs: [
      { name: "Home", path: "/" },
      { name: "Blog", path: "/blog" },
    ],
  },
  "/refer": {
    path: "/refer",
    title: "Refer & Earn Rewards | IndiFunded Trader Program",
    description:
      "Create your IndiFunded referral code to give fellow Indian traders 5% off challenge fees and earn rewards on qualified challenge referrals.",
    keywords: ["IndiFunded Referral", "Funded Trader India"],
    breadcrumbs: [
      { name: "Home", path: "/" },
      { name: "Refer & Earn", path: "/refer" },
    ],
  },
  "/privacy": {
    path: "/privacy",
    title: "Privacy Policy | IndiFunded",
    description:
      "Read how IndiFunded collects, uses, and protects your trader profile, KYC verification documents, and support communication data.",
    keywords: ["IndiFunded Privacy Policy"],
    breadcrumbs: [
      { name: "Home", path: "/" },
      { name: "Privacy Policy", path: "/privacy" },
    ],
  },
  "/terms": {
    path: "/terms",
    title: "Terms and Conditions | IndiFunded",
    description:
      "Review the terms and conditions governing IndiFunded simulated trading challenges, funded profit-sharing accounts, and platform usage.",
    keywords: ["IndiFunded Terms and Conditions"],
    breadcrumbs: [
      { name: "Home", path: "/" },
      { name: "Terms and Conditions", path: "/terms" },
    ],
  },
  "/refund-policy": {
    path: "/refund-policy",
    title: "Refund Policy | IndiFunded Challenge Fees",
    description:
      "Learn about IndiFunded's refund eligibility for challenge fees, duplicate payments, and how refund inquiries are reviewed by support.",
    keywords: ["IndiFunded Refund Policy"],
    breadcrumbs: [
      { name: "Home", path: "/" },
      { name: "Refund Policy", path: "/refund-policy" },
    ],
  },
  "/risk-disclosure": {
    path: "/risk-disclosure",
    title: "Risk Disclosure | IndiFunded Simulated & Funded Trading",
    description:
      "Read IndiFunded's risk disclosure covering equity and F&O market volatility and the distinction between simulated evaluations and brokerage services.",
    keywords: ["IndiFunded Risk Disclosure", "Stock Market Prop Trading India"],
    breadcrumbs: [
      { name: "Home", path: "/" },
      { name: "Risk Disclosure", path: "/risk-disclosure" },
    ],
  },
};

export const PUBLIC_SITEMAP_ROUTES: Array<{
  path: string;
  changefreq: "daily" | "weekly" | "monthly";
  priority: string;
}> = [
  { path: "/", changefreq: "weekly", priority: "1.0" },
  { path: "/challenges", changefreq: "weekly", priority: "0.95" },
  { path: "/instant-funding", changefreq: "weekly", priority: "0.9" },
  { path: "/1-step-challenge", changefreq: "weekly", priority: "0.9" },
  { path: "/how-it-works", changefreq: "monthly", priority: "0.85" },
  { path: "/rules", changefreq: "monthly", priority: "0.85" },
  { path: "/payouts", changefreq: "weekly", priority: "0.85" },
  { path: "/payout-request", changefreq: "monthly", priority: "0.7" },
  { path: "/verify-payout", changefreq: "weekly", priority: "0.75" },
  { path: "/leaderboard", changefreq: "daily", priority: "0.75" },
  { path: "/league", changefreq: "weekly", priority: "0.7" },
  { path: "/stories", changefreq: "weekly", priority: "0.7" },
  { path: "/blog", changefreq: "weekly", priority: "0.85" },
  { path: "/faq", changefreq: "monthly", priority: "0.8" },
  { path: "/about", changefreq: "monthly", priority: "0.75" },
  { path: "/trust", changefreq: "monthly", priority: "0.75" },
  { path: "/contact", changefreq: "monthly", priority: "0.7" },
  { path: "/refer", changefreq: "monthly", priority: "0.65" },
  { path: "/privacy", changefreq: "monthly", priority: "0.4" },
  { path: "/terms", changefreq: "monthly", priority: "0.4" },
  { path: "/refund-policy", changefreq: "monthly", priority: "0.4" },
  { path: "/risk-disclosure", changefreq: "monthly", priority: "0.4" },
];

export function buildRouteHead(config: PageSeoConfig) {
  const canonicalUrl = buildCanonicalUrl(config.path);
  const ogImage = resolveAbsoluteImageUrl(config.image);
  const imageAlt = config.imageAlt || `${SITE_NAME} — ${config.title}`;
  const robotsValue = config.noindex
    ? "noindex, nofollow"
    : "index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1";

  const meta: Array<Record<string, string>> = [
    { title: config.title },
    { name: "description", content: config.description },
    { name: "robots", content: robotsValue },
    { property: "og:type", content: config.ogType || "website" },
    { property: "og:title", content: config.title },
    { property: "og:description", content: config.description },
    { property: "og:url", content: canonicalUrl },
    { property: "og:image", content: ogImage },
    { property: "og:image:alt", content: imageAlt },
    { property: "og:site_name", content: SITE_NAME },
    { property: "og:locale", content: "en_IN" },
    { name: "twitter:card", content: "summary_large_image" },
    { name: "twitter:site", content: TWITTER_HANDLE },
    { name: "twitter:title", content: config.title },
    { name: "twitter:description", content: config.description },
    { name: "twitter:image", content: ogImage },
  ];

  if (config.keywords && config.keywords.length > 0) {
    meta.push({ name: "keywords", content: config.keywords.join(", ") });
  }

  const links: Array<Record<string, string>> = [];
  if (!config.noindex) {
    links.push({ rel: "canonical", href: canonicalUrl });
  }

  const jsonLdBlocks: Array<Record<string, unknown>> = [];
  if (!config.noindex) {
    jsonLdBlocks.push(buildWebPageJsonLd(config));
    if (config.breadcrumbs && config.breadcrumbs.length > 0) {
      jsonLdBlocks.push(buildBreadcrumbJsonLd(config.breadcrumbs));
    }
    if (config.jsonLd) {
      if (Array.isArray(config.jsonLd)) {
        jsonLdBlocks.push(...config.jsonLd);
      } else {
        jsonLdBlocks.push(config.jsonLd);
      }
    }
  }

  const scripts = jsonLdBlocks.map((block) => ({
    type: "application/ld+json",
    children: JSON.stringify(block),
  }));

  return { meta, links, scripts };
}
