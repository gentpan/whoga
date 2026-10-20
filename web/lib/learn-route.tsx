import { notFound, redirect } from "@tanstack/react-router";
import {
  articleCanonicalUrl,
  buildArticleJsonLd,
  getArticle,
  getArticleContent,
  getRelatedArticles,
  type ArticleContent,
  type ArticleLocale,
  type ArticleRecord
} from "@/lib/articles";

export interface LearnArticleLoaderData {
  record: ArticleRecord;
  content: ArticleContent;
  related: ArticleRecord[];
}

export function learnArticleLoader(locale: ArticleLocale) {
  return ({ params }: { params: { slug: string } }): LearnArticleLoaderData => {
    if (locale === "zh" && params.slug === "en") {
      throw redirect({ to: "/learn/en" });
    }
    const record = getArticle(params.slug);
    const content = getArticleContent(params.slug, locale);
    if (!record || !content) {
      throw notFound();
    }
    return {
      record,
      content,
      related: getRelatedArticles(params.slug, locale)
    };
  };
}

export function learnArticleHead(locale: ArticleLocale) {
  return ({
    loaderData,
    params
  }: {
    loaderData?: LearnArticleLoaderData;
    params: { slug: string };
  }) => {
    const content = loaderData?.content;
    if (!content) {
      return {};
    }
    const canonical = articleCanonicalUrl(params.slug, locale);
    const jsonLd = buildArticleJsonLd(params.slug, locale);
    const otherLocale: ArticleLocale = locale === "zh" ? "en" : "zh";
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
        { rel: "alternate", hreflang: locale === "zh" ? "zh-CN" : "en", href: canonical },
        {
          rel: "alternate",
          hreflang: otherLocale === "zh" ? "zh-CN" : "en",
          href: articleCanonicalUrl(params.slug, otherLocale)
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
  };
}

const LEARN_INDEX_COPY: Record<
  ArticleLocale,
  {
    title: string;
    description: string;
    keywords: string;
    ogTitle: string;
    ogDescription: string;
    canonical: string;
  }
> = {
  zh: {
    title: "WHOIS/RDAP 技术指南 | WHO.GA Learn",
    description:
      "30 篇中英文 WHOIS 与 RDAP 技术文章：协议对比、IANA Bootstrap、API 集成、安全调查与自托管实践。",
    keywords: "WHOIS 教程, RDAP 指南, 域名查询 SEO, IANA bootstrap, WHOIS API",
    ogTitle: "WHOIS/RDAP 技术指南 | WHO.GA",
    ogDescription: "专业 WHOIS/RDAP 中英文知识库，面向开发者与安全团队。",
    canonical: "https://who.ga/learn"
  },
  en: {
    title: "WHOIS/RDAP Technical Guides | WHO.GA Learn",
    description:
      "30 bilingual articles on WHOIS and RDAP—protocols, IANA bootstrap, API integration, security, and self-hosting.",
    keywords: "WHOIS guide, RDAP tutorial, domain lookup SEO, IANA bootstrap, WHOIS API",
    ogTitle: "WHOIS/RDAP Technical Guides | WHO.GA",
    ogDescription: "Professional WHOIS/RDAP knowledge base for developers and security teams.",
    canonical: "https://who.ga/learn/en"
  }
};

export function learnIndexHead(locale: ArticleLocale) {
  return () => {
    const copy = LEARN_INDEX_COPY[locale];
    const otherLocale: ArticleLocale = locale === "zh" ? "en" : "zh";
    return {
      meta: [
        { title: copy.title },
        { name: "description", content: copy.description },
        { name: "keywords", content: copy.keywords },
        { name: "robots", content: "index, follow" },
        { property: "og:title", content: copy.ogTitle },
        { property: "og:description", content: copy.ogDescription },
        { property: "og:url", content: copy.canonical }
      ],
      links: [
        { rel: "canonical", href: copy.canonical },
        { rel: "alternate", hreflang: locale === "zh" ? "zh-CN" : "en", href: copy.canonical },
        {
          rel: "alternate",
          hreflang: otherLocale === "zh" ? "zh-CN" : "en",
          href: LEARN_INDEX_COPY[otherLocale].canonical
        }
      ]
    };
  };
}
