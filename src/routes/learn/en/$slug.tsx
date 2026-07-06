import { createFileRoute, notFound } from "@tanstack/react-router";
import {
  articleCanonicalUrl,
  buildArticleJsonLd,
  getArticle,
  getArticleContent,
  getRelatedArticles
} from "@/lib/articles";
import { ArticleLayout } from "@/src/components/learn/article-layout";

export const Route = createFileRoute("/learn/en/$slug")({
  loader: ({ params }) => {
    const record = getArticle(params.slug);
    const content = getArticleContent(params.slug, "en");
    if (!record || !content) {
      throw notFound();
    }
    return {
      record,
      content,
      related: getRelatedArticles(params.slug, "en")
    };
  },
  head: ({ loaderData, params }) => {
    const content = loaderData?.content;
    if (!content) {
      return {};
    }
    const canonical = articleCanonicalUrl(params.slug, "en");
    const jsonLd = buildArticleJsonLd(params.slug, "en");
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
        { rel: "alternate", hreflang: "en", href: canonical },
        {
          rel: "alternate",
          hreflang: "zh-CN",
          href: articleCanonicalUrl(params.slug, "zh")
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
  component: LearnArticleEnPage
});

function LearnArticleEnPage() {
  const { record, content, related } = Route.useLoaderData();
  return <ArticleLayout locale="en" record={record} content={content} related={related} />;
}
