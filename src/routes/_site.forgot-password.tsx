import { createFileRoute } from "@tanstack/react-router";
import { ForgotPassword } from "@/views/ExtraPages";
import { buildRouteHead } from "@/lib/seo";

export const Route = createFileRoute("/_site/forgot-password")({
  head: () =>
    buildRouteHead({
      path: "/forgot-password",
      title: "Forgot Password | IndiFunded",
      description: "Get a link to reset your IndiFunded account password.",
      noindex: true,
    }),
  component: ForgotPassword,
});
