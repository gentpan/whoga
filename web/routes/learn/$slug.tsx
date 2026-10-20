import { createFileRoute } from "@tanstack/react-router";
import { ArticleLayout } from "@/web/components/learn/article-layout";
import { learnArticleHead, learnArticleLoader } from "@/web/lib/learn-route";

export const Route = createFileRoute("/learn/$slug")({
  loader: learnArticleLoader("zh"),
  head: learnArticleHead("zh"),
  component: LearnArticleZhPage
});

function LearnArticleZhPage() {
  const { record, content, related } = Route.useLoaderData();
  return <ArticleLayout locale="zh" record={record} content={content} related={related} />;
}
