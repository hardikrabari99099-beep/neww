import { createFileRoute } from "@tanstack/react-router";
import UserDashboardLayout from "@/views/app/UserDashboardLayout";
import { buildRouteHead } from "@/lib/seo";

export const Route = createFileRoute("/app")({
  ssr: false,
  head: () =>
    buildRouteHead({
      path: "/app",
      title: "Trader Dashboard | IndiFunded",
      description: "Your IndiFunded trader dashboard.",
      noindex: true,
    }),
  component: UserDashboardLayout,
});
