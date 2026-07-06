import { HeadContent, Outlet, Scripts, createRootRoute } from "@tanstack/react-router";
import appCss from "../styles.css?url";

const SITE_TITLE = "WHO.GA - RDAP WHOIS 查询与 JSON API | Domain, IP, ASN Lookup";
const SITE_DESCRIPTION =
  "WHO.GA 提供基于 RDAP 的域名、IP、ASN 与后缀查询服务，支持结构化 JSON API、在线调试与开发者集成. WHO.GA provides RDAP-based lookup for domains, IPs, ASNs, and suffixes with structured JSON API access.";

const SORA_FONT_URL = "https://static.bluecdn.com/fonts/sora.css";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { name: "theme-color", content: "#22C55F" },
      { title: SITE_TITLE },
      { name: "description", content: SITE_DESCRIPTION },
      {
        name: "keywords",
        content:
          "WHOIS 查询, RDAP 查询, 域名查询, IP 查询, ASN 查询, 后缀查询, WHOIS API, RDAP API, JSON API, domain lookup, IP lookup, ASN lookup, RDAP WHOIS, domain whois api"
      },
      { name: "robots", content: "index, follow" },
      { name: "application-name", content: "WHO.GA" },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://who.ga" },
      { property: "og:site_name", content: "WHO.GA" },
      { property: "og:title", content: SITE_TITLE },
      { property: "og:description", content: SITE_DESCRIPTION },
      { property: "og:locale", content: "zh_CN" },
      { property: "og:image", content: "https://who.ga/android-chrome-512x512.png" },
      { property: "og:image:width", content: "512" },
      { property: "og:image:height", content: "512" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "WHO.GA - RDAP WHOIS 查询与 JSON API" },
      {
        name: "twitter:description",
        content:
          "域名、IP、ASN 与后缀查询，支持结构化 JSON API 与在线调试. RDAP lookup and JSON API for domains, IPs, ASNs, and suffixes."
      },
      { name: "mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-title", content: "WHO.GA" },
      { name: "apple-mobile-web-app-status-bar-style", content: "default" }
    ],
    links: [
      { rel: "preconnect", href: "https://static.bluecdn.com" },
      { rel: "stylesheet", href: SORA_FONT_URL },
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "/favicon.ico" },
      { rel: "icon", href: "/favicon-16x16.png", type: "image/png", sizes: "16x16" },
      { rel: "icon", href: "/favicon-32x32.png", type: "image/png", sizes: "32x32" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png", sizes: "180x180" },
      { rel: "manifest", href: "/site.webmanifest" },
      { rel: "mask-icon", href: "/logo-mask.svg", color: "#22C55E" },
      { rel: "canonical", href: "https://who.ga" },
      { rel: "alternate", hreflang: "zh-CN", href: "https://who.ga" },
      { rel: "alternate", hreflang: "en", href: "https://who.ga/learn/en" }
    ]
  }),
  component: RootComponent,
  shellComponent: RootDocument
});

function RootComponent() {
  return <Outlet />;
}

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <head>
        <meta httpEquiv="Cache-Control" content="no-cache, no-store, must-revalidate" />
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){var k="who-ga-css-reload";function r(){if(sessionStorage.getItem(k))return;sessionStorage.setItem(k,"1");location.reload()}document.addEventListener("DOMContentLoaded",function(){document.querySelectorAll('link[rel="stylesheet"]').forEach(function(l){l.addEventListener("error",r)})});window.addEventListener("pageshow",function(e){if(e.persisted)sessionStorage.removeItem(k)})})();`
          }}
        />
        <HeadContent />
        <script
          defer
          src="https://tongji.giantaccel.com/script.js"
          data-website-id="2b33e095-6708-4461-91c0-a15f464fdc3d"
        />
      </head>
      <body>
        <div className="root">{children}</div>
        <Scripts />
      </body>
    </html>
  );
}
