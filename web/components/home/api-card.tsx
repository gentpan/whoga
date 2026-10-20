import { Code2 } from "lucide-react";
import type { HomeCopy } from "@/web/lib/i18n";

interface ApiCardProps {
  t: HomeCopy;
}

export function ApiCard({ t }: ApiCardProps) {
  return (
    <section className="api-usage-section" id="section-api">
      <article className="result-card squircle">
        <div className="result-card-head">
          <span className="result-card-icon" aria-hidden>
            <Code2 size={14} strokeWidth={2} />
          </span>
          <h3 className="result-card-title">
            <span className="term-hash" aria-hidden># </span>
            {t.apiUsageTitle}
          </h3>
          <span className="result-card-meta">{t.apiCardMeta}</span>
        </div>
        <p className="api-card-note">{t.apiUsageDescription}</p>
        <pre className="api-card-line squircle">
          <code>
            <span className="api-card-method">GET</span>
            {`  https://api.who.ga/<query>`}
          </code>
        </pre>
        <div className="api-card-actions">
          <a
            className="api-card-link plain-link"
            href="https://api.who.ga/example.com"
            target="_blank"
            rel="noreferrer"
          >
            {t.apiCardTry} →
          </a>
        </div>
      </article>
    </section>
  );
}
