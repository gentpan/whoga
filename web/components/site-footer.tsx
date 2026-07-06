import { GitHubBrandIcon, XBrandIcon } from "@/web/components/brand-icons";
import { SITE_COPY, type SiteLocale } from "@/web/lib/site-copy";

interface SiteFooterProps {
  locale: SiteLocale;
}

export function SiteFooter({ locale }: SiteFooterProps) {
  const t = SITE_COPY[locale];

  return (
    <footer className="footer">
      <div className="footer-inner">
        <div className="footer-bottom">
          <div className="footer-copyright">
            <p>{t.copyright}</p>
          </div>
          <div className="footer-social">
            <a
              href="https://x.com/gentpan"
              target="_blank"
              rel="noreferrer"
              aria-label="X"
              title="X"
            >
              <XBrandIcon />
            </a>
            <a
              href="https://github.com/gentpan"
              target="_blank"
              rel="noreferrer"
              aria-label="GitHub"
              title="GitHub"
            >
              <GitHubBrandIcon />
            </a>
            <a
              href="https://giantaccel.com"
              target="_blank"
              rel="noreferrer"
              aria-label="Powered by GiantAccel"
              title="Powered by GiantAccel"
              data-tooltip="Powered by GiantAccel"
              className="footer-giantaccel"
            >
              <svg viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                <path d="M512 851.456c187.904 0 340.992-152.064 343.04-339.456h-145.408c-2.048 107.52-89.6 194.048-197.632 194.048S316.416 619.52 314.368 512H168.96c2.048 187.392 155.136 339.456 343.04 339.456zM550.912 216.064H855.04v145.408h-304.128z" />
              </svg>
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
