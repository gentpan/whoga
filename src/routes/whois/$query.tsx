import { createFileRoute } from "@tanstack/react-router";
import { HomePage } from "@/src/components/home-page";

export const Route = createFileRoute("/whois/$query")({
  component: HomePage
});
