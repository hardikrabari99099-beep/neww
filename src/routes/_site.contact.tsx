import { createFileRoute } from "@tanstack/react-router";
import { Contact } from "@/views/SimplePages";
import { PAGE_SEO, buildRouteHead } from "@/lib/seo";

export const Route = createFileRoute("/_site/contact")({
  head: () => buildRouteHead(PAGE_SEO["/contact"]),
  component: Contact,
});
