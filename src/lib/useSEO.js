import { useEffect } from "react";
import {
  DEFAULT_OG_IMAGE_PATH,
  SITE_NAME,
  buildCanonicalUrl,
  resolveAbsoluteImageUrl,
} from "./seo";

/**
 * Client-side SEO synchronization hook — keeps document title, meta description,
 * robots, Open Graph, Twitter/X cards, canonical URL, and page JSON-LD in sync
 * after client navigation or dynamic data loads (e.g. blog articles or CMS updates).
 */
export function useSEO({
  title,
  description,
  path = "",
  image = DEFAULT_OG_IMAGE_PATH,
  type = "website",
  noindex = false,
  keywords,
  jsonLd,
} = {}) {
  const jsonLdStr = jsonLd ? JSON.stringify(jsonLd) : "";
  const keywordsStr = Array.isArray(keywords)
    ? keywords.join(", ")
    : typeof keywords === "string"
      ? keywords
      : "";

  useEffect(() => {
    const fullTitle = title
      ? title.includes(SITE_NAME)
        ? title
        : `${title} | ${SITE_NAME}`
      : `${SITE_NAME} — Prop Trading Firm India | Funded Accounts`;
    const desc =
      description ||
      "IndiFunded is an Indian prop trading firm offering Nifty and Bank Nifty funded accounts up to ₹10,00,000, Instant Funding, and 24-hour payouts.";
    const canonicalUrl = buildCanonicalUrl(path || window.location.pathname);
    const fullImage = resolveAbsoluteImageUrl(image);
    const robotsValue = noindex
      ? "noindex, nofollow"
      : "index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1";

    document.title = fullTitle;

    const setMeta = (selector, attr, value) => {
      let el = document.head.querySelector(selector);
      if (!el) {
        el = document.createElement("meta");
        const match = selector.match(/\[([^=]+)="([^"]+)"\]/);
        if (match) {
          el.setAttribute(match[1], match[2]);
        }
        document.head.appendChild(el);
      }
      el.setAttribute(attr, value);
    };

    setMeta('meta[name="description"]', "content", desc);
    setMeta('meta[name="robots"]', "content", robotsValue);
    if (keywordsStr) {
      setMeta('meta[name="keywords"]', "content", keywordsStr);
    }

    setMeta('meta[property="og:title"]', "content", fullTitle);
    setMeta('meta[property="og:description"]', "content", desc);
    setMeta('meta[property="og:url"]', "content", canonicalUrl);
    setMeta('meta[property="og:image"]', "content", fullImage);
    setMeta('meta[property="og:type"]', "content", type);
    setMeta('meta[property="og:site_name"]', "content", SITE_NAME);

    setMeta('meta[name="twitter:card"]', "content", "summary_large_image");
    setMeta('meta[name="twitter:title"]', "content", fullTitle);
    setMeta('meta[name="twitter:description"]', "content", desc);
    setMeta('meta[name="twitter:image"]', "content", fullImage);

    let canonical = document.head.querySelector('link[rel="canonical"]');
    if (noindex) {
      if (canonical) canonical.remove();
    } else {
      if (!canonical) {
        canonical = document.createElement("link");
        canonical.setAttribute("rel", "canonical");
        document.head.appendChild(canonical);
      }
      canonical.setAttribute("href", canonicalUrl);
    }

    let scriptEl = document.head.querySelector(
      'script[data-page-jsonld="true"]',
    );
    if (jsonLdStr && !noindex) {
      if (!scriptEl) {
        scriptEl = document.createElement("script");
        scriptEl.type = "application/ld+json";
        scriptEl.setAttribute("data-page-jsonld", "true");
        document.head.appendChild(scriptEl);
      }
      scriptEl.textContent = jsonLdStr;
    } else if (scriptEl) {
      scriptEl.remove();
    }
  }, [title, description, path, image, type, noindex, keywordsStr, jsonLdStr]);
}
