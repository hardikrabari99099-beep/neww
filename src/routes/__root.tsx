import { useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  useRouterState,
  HeadContent,
  Scripts,
  type ErrorComponentProps,
} from "@tanstack/react-router";
import type { ReactNode } from "react";

import appCss from "../styles.css?url";
import { Toaster } from "sonner";
import { AuthProvider } from "../context/AuthContext";
import { SettingsProvider } from "../context/SettingsContext";
import { ThemeProvider, useTheme } from "../context/ThemeContext";
import {
  PreloaderOverlay,
  MotionOrchestrator,
} from "../components/MotionSystem";
import { FirestoreErrorBoundary } from "../components/FirestoreErrorBoundary";
import { DEFAULT_OG_IMAGE, SITE_NAME, TWITTER_HANDLE } from "../lib/seo";
import {
  getGscVerificationToken,
  initAnalytics,
  trackPageView,
} from "../lib/analytics";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">
          Page not found
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: ErrorComponentProps) {
  console.error(error);
  const router = useRouter();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back
          home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()(
  {
    head: () => {
      const gscToken = getGscVerificationToken();
      const meta: Array<Record<string, string>> = [
        { charSet: "utf-8" },
        { name: "viewport", content: "width=device-width, initial-scale=1" },
        { name: "theme-color", content: "#0a0c10" },
        { name: "author", content: SITE_NAME },
        { property: "og:site_name", content: SITE_NAME },
        { property: "og:locale", content: "en_IN" },
        { property: "og:image", content: DEFAULT_OG_IMAGE },
        { property: "og:image:alt", content: `${SITE_NAME} emblem` },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:site", content: TWITTER_HANDLE },
        { name: "twitter:image", content: DEFAULT_OG_IMAGE },
      ];
      if (gscToken) {
        meta.push({ name: "google-site-verification", content: gscToken });
      }
      return {
        meta,
        links: [
          {
            rel: "stylesheet",
            href: appCss,
          },
          {
            rel: "icon",
            href: "/assets/aistudio/Teal_Gradient_F_Emblem_03195f4a.png",
            type: "image/png",
          },
          {
            rel: "apple-touch-icon",
            href: "/assets/aistudio/Teal_Gradient_F_Emblem_03195f4a.png",
          },
          { rel: "manifest", href: "/site.webmanifest" },
          { rel: "preconnect", href: "https://fonts.googleapis.com" },
          {
            rel: "preconnect",
            href: "https://fonts.gstatic.com",
            crossOrigin: "anonymous",
          },
          {
            rel: "stylesheet",
            href: "https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600&family=Outfit:wght@400;500;600;700;800&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap",
          },
        ],
      };
    },
    shellComponent: RootShell,
    component: RootComponent,
    notFoundComponent: NotFoundComponent,
    errorComponent: ErrorComponent,
  },
);

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en-IN" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function ThemedToaster() {
  const { resolvedTheme } = useTheme();
  return (
    <Toaster
      richColors
      theme={resolvedTheme === "light" ? "light" : "dark"}
      position="top-right"
    />
  );
}

function AnalyticsTracker() {
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });

  useEffect(() => {
    if (initAnalytics()) {
      trackPageView(pathname);
    }
  }, [pathname]);

  return null;
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <FirestoreErrorBoundary>
      <QueryClientProvider client={queryClient}>
        {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
        <ThemeProvider>
          <SettingsProvider>
            <AuthProvider>
              <AnalyticsTracker />
              <PreloaderOverlay />
              <MotionOrchestrator />
              <ThemedToaster />
              <Outlet />
            </AuthProvider>
          </SettingsProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </FirestoreErrorBoundary>
  );
}
