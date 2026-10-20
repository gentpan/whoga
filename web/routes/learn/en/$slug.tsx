import { createFileRoute } from "@tanstack/react-router";
import { ArticleLayout } from "@/web/components/learn/article-layout";
import { learnArticleHead, learnArticleLoader } from "@/web/lib/learn-route";

export const Route = createFileRoute("/learn/en/$slug")({
  loader: learnArticleLoader("en"),
  head: learnArticleHead("en"),
  component: LearnArticleEnPage
});

function LearnArticleEnPage() {
  const { record, content, related } = Route.useLoaderData();
  return <ArticleLayout locale="en" record={record} content={content} related={related} />;
}
