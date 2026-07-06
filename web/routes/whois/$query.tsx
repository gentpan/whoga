import { createFileRoute } from "@tanstack/react-router";
import { HomePage } from "@/web/components/home-page";

export const Route = createFileRoute("/whois/$query")({
  component: HomePage
});
