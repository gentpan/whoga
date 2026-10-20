import { createFileRoute } from "@tanstack/react-router";
import { LearnIndexPage } from "@/web/components/learn/learn-index-page";
import { learnIndexHead } from "@/web/lib/learn-route";

export const Route = createFileRoute("/learn/en/")({
  head: learnIndexHead("en"),
  component: LearnIndexEnPage
});

function LearnIndexEnPage() {
  return <LearnIndexPage locale="en" />;
}
