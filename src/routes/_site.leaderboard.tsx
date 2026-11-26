import { createFileRoute } from "@tanstack/react-router";
import Leaderboard from "@/views/Leaderboard";
import { PAGE_SEO, buildRouteHead } from "@/lib/seo";

export const Route = createFileRoute("/_site/leaderboard")({
  head: () => buildRouteHead(PAGE_SEO["/leaderboard"]),
  component: Leaderboard,
});
