import type { ArticleContent, ArticleLocale, ArticleRecord, ArticleSection } from "@/lib/articles/types";
import { SiteShell } from "@/web/components/site-shell";

function renderSection(section: ArticleSection, index: number) {
  switch (section.type) {
    case "heading":
      return (
        <h2 key={index} className="article-heading">
          {section.text}
        </h2>
      );
    case "paragraph":
      return (
        <p key={index} className="article-paragraph">
          {section.text}
        </p>
      );
    case "list":
      return (
        <ul key={index} className="article-list">
          {section.items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      );
    case "code":
      return (
        <pre key={index} className="article-code">
          <code>{section.code}</code>
        </pre>
      );
    case "note":
      return (
        <aside key={index} className="article-note">
          {section.text}
        </aside>
      );
    default:
      return null;
  }
}

interface ArticleBodyProps {
  content: ArticleContent;
}

export function ArticleBody({ content }: ArticleBodyProps) {
  return (
    <article className="article-prose">
      {content.sections.map((section, index) => renderSection(section, index))}
    </article>
  );
}

interface ArticleLayoutProps {
  locale: ArticleLocale;
  record: ArticleRecord;
  content: ArticleContent;
  related: ArticleRecord[];
}

export function ArticleLayout({ locale, record, content, related }: ArticleLayoutProps) {
  const isZh = locale === "zh";
  const otherLocale = isZh ? "en" : "zh";
  const otherContent = record[otherLocale];
  const listHref = isZh ? "/learn" : "/learn/en";
  const otherHref = isZh ? `/learn/en/${record.slug}` : `/learn/${record.slug}`;

  return (
    <SiteShell pageClassName="learn-page">
      <div className="page-content learn-main">
        <nav className="article-breadcrumb" aria-label="Breadcrumb">
          <a href={listHref} style={{ textDecoration: "none" }}>
            {isZh ? "技术指南" : "Learn"}
          </a>
          <span aria-hidden="true">/</span>
          <span>{record.category[locale]}</span>
        </nav>

        <header className="article-hero">
          <div className="article-meta-row">
            <span className="article-badge">{record.category[locale]}</span>
            <time dateTime={record.updatedAt}>
              {isZh ? "更新于" : "Updated"} {record.updatedAt}
            </time>
            <span>
              {record.readingMinutes} {isZh ? "分钟阅读" : "min read"}
            </span>
          </div>
          <h1 className="article-title">{content.title}</h1>
          <p className="article-description">{content.description}</p>
          <div className="article-keywords">
            {content.keywords.map((keyword) => (
              <span key={keyword} className="article-keyword">
                {keyword}
              </span>
            ))}
          </div>
        </header>

        <ArticleBody content={content} />

        <footer className="article-footer">
          <div className="article-lang-switch">
            <span>{isZh ? "阅读英文版：" : "Read in Chinese:"}</span>
            <a href={otherHref} style={{ textDecoration: "none" }}>
              {otherContent.title}
            </a>
          </div>

          {related.length > 0 ? (
            <section className="article-related">
              <h2 className="article-related-title">{isZh ? "相关文章" : "Related articles"}</h2>
              <div className="article-related-grid">
                {related.map((item) => {
                  const href = isZh ? `/learn/${item.slug}` : `/learn/en/${item.slug}`;
                  const meta = item[locale];
                  return (
                    <a key={item.slug} href={href} className="article-related-card" style={{ textDecoration: "none" }}>
                      <span className="article-badge">{item.category[locale]}</span>
                      <h3>{meta.title}</h3>
                      <p>{meta.description}</p>
                    </a>
                  );
                })}
              </div>
            </section>
          ) : null}

          <div className="article-cta">
            <p>{isZh ? "立即体验 RDAP/WHOIS 查询：" : "Try RDAP/WHOIS lookup now:"}</p>
            <a href="/" className="article-cta-button" style={{ textDecoration: "none" }}>
              who.ga
            </a>
          </div>
        </footer>
      </div>
    </SiteShell>
  );
}
