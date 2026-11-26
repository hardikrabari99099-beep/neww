import { createFileRoute } from "@tanstack/react-router";
import CheckoutSuccess from "@/views/CheckoutSuccess";
import { buildRouteHead } from "@/lib/seo";

export const Route = createFileRoute("/_site/checkout/success")({
  head: () =>
    buildRouteHead({
      path: "/checkout/success",
      title: "Payment Received | IndiFunded",
      description: "Your IndiFunded challenge payment status.",
      noindex: true,
    }),
  component: CheckoutSuccess,
});
