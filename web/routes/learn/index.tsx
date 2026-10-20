import { createFileRoute } from "@tanstack/react-router";
import { LearnIndexPage } from "@/web/components/learn/learn-index-page";
import { learnIndexHead } from "@/web/lib/learn-route";

export const Route = createFileRoute("/learn/")({
  head: learnIndexHead("zh"),
  component: LearnIndexZhPage
});

function LearnIndexZhPage() {
  return <LearnIndexPage locale="zh" />;
}
