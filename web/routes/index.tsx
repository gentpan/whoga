import { createFileRoute } from "@tanstack/react-router";
import { HomePage } from "@/web/components/home-page";

export const Route = createFileRoute("/")({
  component: HomePage
});
