import { createFileRoute } from "@tanstack/react-router";
import Login from "@/views/Login";
import { buildRouteHead } from "@/lib/seo";

export const Route = createFileRoute("/_site/login")({
  head: () =>
    buildRouteHead({
      path: "/login",
      title: "Sign In | IndiFunded",
      description: "Sign in or create your IndiFunded trader account.",
      noindex: true,
    }),
  component: Login,
});
