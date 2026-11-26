import { createFileRoute } from "@tanstack/react-router";
import AdminLayout from "@/views/admin/AdminLayout";
import { buildRouteHead } from "@/lib/seo";

export const Route = createFileRoute("/admin")({
  ssr: false,
  head: () =>
    buildRouteHead({
      path: "/admin",
      title: "Admin | IndiFunded",
      description: "IndiFunded admin panel.",
      noindex: true,
    }),
  component: AdminLayout,
});
