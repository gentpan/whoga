import articlesJson from "./articles.json";
import type { ArticleContent, ArticleLocale, ArticleRecord, ArticleSection } from "./types";

export type { ArticleContent, ArticleLocale, ArticleRecord, ArticleSection };

const articles = articlesJson as ArticleRecord[];

const bySlug = new Map(articles.map((item) => [item.slug, item]));

export function getAllArticles(): ArticleRecord[] {
  return articles;
}

export function getArticle(slug: string): ArticleRecord | null {
  return bySlug.get(slug) ?? null;
}

export function getArticleContent(slug: string, locale: ArticleLocale): ArticleContent | null {
  const record = getArticle(slug);
  if (!record) {
    return null;
  }
  return record[locale];
}

export function getArticlesByCategory(locale: ArticleLocale): Array<{
  category: string;
  items: ArticleRecord[];
}> {
  const groups = new Map<string, ArticleRecord[]>();
  for (const item of articles) {
    const key = item.category[locale];
    const list = groups.get(key) ?? [];
    list.push(item);
    groups.set(key, list);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([category, items]) => ({
      category,
      items: items.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    }));
}

export function getRelatedArticles(slug: string, locale: ArticleLocale, limit = 4): ArticleRecord[] {
  const current = getArticle(slug);
  if (!current) {
    return [];
  }
  const category = current.category[locale];
  return articles
    .filter((item) => item.slug !== slug && item.category[locale] === category)
    .slice(0, limit);
}

export function articleCanonicalUrl(slug: string, locale: ArticleLocale): string {
  const base = "https://who.ga";
  return locale === "en" ? `${base}/learn/en/${slug}` : `${base}/learn/${slug}`;
}

export function estimateWordCount(content: ArticleContent): number {
  let count = 0;
  for (const section of content.sections) {
    if (section.type === "paragraph" || section.type === "note" || section.type === "heading") {
      count += section.text.split(/\s+/).length;
    }
    if (section.type === "list") {
      count += section.items.join(" ").split(/\s+/).length;
    }
    if (section.type === "code") {
      count += section.code.split(/\s+/).length;
    }
  }
  return count;
}

export function buildArticleJsonLd(slug: string, locale: ArticleLocale) {
  const record = getArticle(slug);
  const content = record?.[locale];
  if (!record || !content) {
    return null;
  }
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: content.title,
    description: content.description,
    datePublished: record.publishedAt,
    dateModified: record.updatedAt,
    inLanguage: locale === "zh" ? "zh-CN" : "en-US",
    author: {
      "@type": "Organization",
      name: "WHO.GA",
      url: "https://who.ga"
    },
    publisher: {
      "@type": "Organization",
      name: "WHO.GA",
      logo: {
        "@type": "ImageObject",
        url: "https://who.ga/logo.svg"
      }
    },
    mainEntityOfPage: articleCanonicalUrl(slug, locale),
    keywords: content.keywords.join(", ")
  };
}

export function getSitemapEntries(): Array<{ loc: string; lastmod: string }> {
  const entries: Array<{ loc: string; lastmod: string }> = [
    { loc: "https://who.ga/", lastmod: "2026-07-06" },
    { loc: "https://who.ga/learn", lastmod: "2026-07-06" },
    { loc: "https://who.ga/learn/en", lastmod: "2026-07-06" },
    { loc: "https://who.ga/requests", lastmod: "2026-07-06" }
  ];
  for (const item of articles) {
    entries.push({
      loc: articleCanonicalUrl(item.slug, "zh"),
      lastmod: item.updatedAt
    });
    entries.push({
      loc: articleCanonicalUrl(item.slug, "en"),
      lastmod: item.updatedAt
    });
  }
  return entries;
}
