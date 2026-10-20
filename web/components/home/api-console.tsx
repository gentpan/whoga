import { useState } from "react";
import { Play } from "lucide-react";
import type { HomeCopy } from "@/web/lib/i18n";
import { errorToMessage } from "@/web/lib/rdap-format";

interface ApiConsoleProps {
  t: HomeCopy;
}

export function ApiConsole({ t }: ApiConsoleProps) {
  const [apiConsoleLoading, setApiConsoleLoading] = useState(false);
  const [apiConsoleError, setApiConsoleError] = useState<string | null>(null);
  const [apiConsoleResult, setApiConsoleResult] = useState<string | null>(null);

  const apiCurlExamples = ["google.tt", "8.8.8.8", "AS15169"];

  async function handleRunApi(query: string): Promise<void> {
    const apiRunValue = query.trim() || "google.tt";
    setApiConsoleLoading(true);
    setApiConsoleError(null);
    try {
      const response = await fetch(`/api/whois?domain=${encodeURIComponent(apiRunValue)}`, {
        cache: "no-store"
      });
      const payload = await response.json();
      setApiConsoleResult(JSON.stringify(payload, null, 2));
      if (!response.ok) {
        setApiConsoleError(
          typeof payload?.error === "string" ? payload.error : `Request failed: ${response.status}`
        );
      }
    } catch (error) {
      setApiConsoleResult(null);
      setApiConsoleError(errorToMessage(error, "API request failed"));
    } finally {
      setApiConsoleLoading(false);
    }
  }

  return (
    <section className="api-usage-section" id="section-api">
      <h2>{t.apiUsageTitle}</h2>
      <div className="api-usage-grid">
        <article className="api-usage-card squircle">
          <p className="api-usage-kicker">{t.apiUsageLead}</p>
          <p className="api-usage-description">{t.apiUsageDescription}</p>
          <div className="api-usage-notes">
            {t.apiUsageNotes.map((note) => (
              <p className="api-usage-note" key={note}>
                {note}
              </p>
            ))}
          </div>
          <div className="api-curl-list">
            {apiCurlExamples.map((query) => (
              <div className="api-curl-row squircle" key={query}>
                <code className="api-curl-command">{`curl https://api.who.ga/${query}`}</code>
                <button
                  type="button"
                  className="api-curl-run squircle"
                  onClick={() => void handleRunApi(query)}
                >
                  <Play aria-hidden size={15} strokeWidth={2.4} />
                  <span>{t.apiConsoleRun}</span>
                </button>
              </div>
            ))}
          </div>
          {apiConsoleLoading || apiConsoleError || apiConsoleResult ? (
            <div className="terminal squircle api-console-terminal">
              <div className="terminal-header">
                <span className="dot" />
                <span className="dot" />
                <span className="dot" />
                <span>{t.apiConsoleResponse}</span>
              </div>
              <div className="terminal-body">
                {apiConsoleLoading ? (
                  <span>{t.apiConsoleLoading}</span>
                ) : apiConsoleError ? (
                  <span>{apiConsoleError}</span>
                ) : apiConsoleResult ? (
                  <pre className="api-console-output">{apiConsoleResult}</pre>
                ) : null}
              </div>
            </div>
          ) : null}
        </article>
      </div>
    </section>
  );
}
