import { createFileRoute, notFound, redirect } from "@tanstack/react-router";
import {
  articleCanonicalUrl,
  buildArticleJsonLd,
  getArticle,
  getArticleContent,
  getRelatedArticles
} from "@/lib/articles";
import { ArticleLayout } from "@/web/components/learn/article-layout";

export const Route = createFileRoute("/learn/$slug")({
  loader: ({ params }) => {
    if (params.slug === "en") {
      throw redirect({ to: "/learn/en" });
    }
    const record = getArticle(params.slug);
    const content = getArticleContent(params.slug, "zh");
    if (!record || !content) {
      throw notFound();
    }
    return {
      record,
      content,
      related: getRelatedArticles(params.slug, "zh")
    };
  },
  head: ({ loaderData, params }) => {
    const content = loaderData?.content;
    if (!content) {
      return {};
    }
    const canonical = articleCanonicalUrl(params.slug, "zh");
    const jsonLd = buildArticleJsonLd(params.slug, "zh");
    return {
      meta: [
        { title: `${content.title} | WHO.GA` },
        { name: "description", content: content.description },
        { name: "keywords", content: content.keywords.join(", ") },
        { name: "robots", content: "index, follow" },
        { property: "og:type", content: "article" },
        { property: "og:title", content: content.title },
        { property: "og:description", content: content.description },
        { property: "og:url", content: canonical },
        { name: "twitter:card", content: "summary" },
        { name: "twitter:title", content: content.title },
        { name: "twitter:description", content: content.description }
      ],
      links: [
        { rel: "canonical", href: canonical },
        { rel: "alternate", hreflang: "zh-CN", href: canonical },
        {
          rel: "alternate",
          hreflang: "en",
          href: articleCanonicalUrl(params.slug, "en")
        }
      ],
      scripts: jsonLd
        ? [
            {
              type: "application/ld+json",
              children: JSON.stringify(jsonLd)
            }
          ]
        : []
    };
  },
  component: LearnArticleZhPage
});

function LearnArticleZhPage() {
  const { record, content, related } = Route.useLoaderData();
  return <ArticleLayout locale="zh" record={record} content={content} related={related} />;
}
