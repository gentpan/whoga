import { Link } from "@tanstack/react-router";
import type { ArticleLocale, ArticleRecord } from "@/lib/articles/types";
import { getArticlesByCategory } from "@/lib/articles";
import { SiteShell } from "@/web/components/site-shell";

interface LearnIndexPageProps {
  locale: ArticleLocale;
}

export function LearnIndexPage({ locale }: LearnIndexPageProps) {
  const isZh = locale === "zh";
  const groups = getArticlesByCategory(locale);

  return (
    <SiteShell pageClassName="learn-page">
      <div className="page-content learn-main">
        <header className="learn-hero">
          <p className="learn-eyebrow">{isZh ? "WHOIS · RDAP · 域名情报" : "WHOIS · RDAP · Domain Intelligence"}</p>
          <h1 className="learn-title">
            {isZh ? "技术指南与 SEO 知识库" : "Technical Guides & Knowledge Base"}
          </h1>
          <p className="learn-subtitle">
            {isZh
              ? "30 篇中英文对照文章，涵盖 RDAP 协议、IANA Bootstrap、API 集成、安全调查与自托管实践。为开发者、运维与安全团队提供可索引的专业内容。"
              : "30 bilingual articles on RDAP, IANA bootstrap, API integration, security workflows, and self-hosting—optimized for search and practical engineering."}
          </p>
        </header>

        {groups.map((group) => (
          <section key={group.category} className="learn-category-block">
            <h2 className="learn-category-title">{group.category}</h2>
            <div className="learn-card-grid">
              {group.items.map((item: ArticleRecord) => {
                const content = item[locale];
                const to = isZh ? "/learn/$slug" : "/learn/en/$slug";
                return (
                  <Link
                    key={item.slug}
                    to={to}
                    params={{ slug: item.slug }}
                    className="learn-card"
                    style={{ textDecoration: "none" }}
                  >
                    <div className="learn-card-meta">
                      <time dateTime={item.updatedAt}>{item.updatedAt}</time>
                      <span>
                        {item.readingMinutes} {isZh ? "分钟" : "min"}
                      </span>
                    </div>
                    <h3>{content.title}</h3>
                    <p>{content.description}</p>
                  </Link>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </SiteShell>
  );
}
