declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

export function getGaMeasurementId(): string {
  const raw =
    (import.meta as { env?: Record<string, string | undefined> }).env?.[
      "VITE_GA_MEASUREMENT_ID"
    ] || "";
  const trimmed = raw.trim();
  return /^G-[A-Z0-9]+$/i.test(trimmed) ? trimmed : "";
}

export function getGscVerificationToken(): string {
  const raw =
    (import.meta as { env?: Record<string, string | undefined> }).env?.[
      "VITE_GSC_VERIFICATION"
    ] || "";
  return raw.trim();
}

let gaInitialized = false;

export function initAnalytics(): boolean {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return false;
  }
  const measurementId = getGaMeasurementId();
  if (!measurementId) return false;
  if (gaInitialized) return true;
  gaInitialized = true;

  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag(...args: unknown[]) {
    window.dataLayer?.push(args);
  };
  window.gtag("js", new Date());
  window.gtag("config", measurementId, { send_page_view: false });

  const existingScript = document.querySelector(
    `script[data-ga-id="${measurementId}"]`,
  );
  if (!existingScript) {
    const script = document.createElement("script");
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`;
    script.setAttribute("data-ga-id", measurementId);
    document.head.appendChild(script);
  }
  return true;
}

export function trackPageView(path: string, title?: string): void {
  if (typeof window === "undefined" || typeof window.gtag !== "function") {
    return;
  }
  const measurementId = getGaMeasurementId();
  if (!measurementId) return;
  window.gtag("event", "page_view", {
    page_path: path,
    page_title: title || document.title,
  });
}

export function trackEvent(
  eventName: string,
  params?: Record<string, string | number | boolean>,
): void {
  if (typeof window === "undefined" || typeof window.gtag !== "function") {
    return;
  }
  const measurementId = getGaMeasurementId();
  if (!measurementId) return;
  window.gtag("event", eventName, params || {});
}
