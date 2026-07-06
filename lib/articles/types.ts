export type ArticleLocale = "zh" | "en";

export type ArticleSection =
  | { type: "heading"; text: string }
  | { type: "paragraph"; text: string }
  | { type: "list"; items: string[] }
  | { type: "code"; language: string; code: string }
  | { type: "note"; text: string };

export interface ArticleContent {
  title: string;
  description: string;
  keywords: string[];
  sections: ArticleSection[];
}

export interface ArticleRecord {
  slug: string;
  category: { zh: string; en: string };
  readingMinutes: number;
  publishedAt: string;
  updatedAt: string;
  zh: ArticleContent;
  en: ArticleContent;
}
