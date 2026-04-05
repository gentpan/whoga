import type { Metadata, Viewport } from "next";
import Script from "next/script";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://who.ga"),
  title: {
    default: "WHO.GA - RDAP WHOIS 查询与 JSON API | Domain, IP, ASN Lookup",
    template: "%s | WHO.GA"
  },
  description:
    "WHO.GA 提供基于 RDAP 的域名、IP、ASN 与后缀查询服务，支持结构化 JSON API、在线调试与开发者集成. WHO.GA provides RDAP-based lookup for domains, IPs, ASNs, and suffixes with structured JSON API access.",
  keywords: [
    "WHOIS 查询",
    "RDAP 查询",
    "域名查询",
    "IP 查询",
    "ASN 查询",
    "后缀查询",
    "WHOIS API",
    "RDAP API",
    "JSON API",
    "domain lookup",
    "IP lookup",
    "ASN lookup",
    "RDAP WHOIS",
    "domain whois api"
  ],
  category: "technology",
  robots: {
    index: true,
    follow: true
  },
  manifest: "/site.webmanifest",
  applicationName: "WHO.GA",
  openGraph: {
    type: "website",
    url: "https://who.ga",
    siteName: "WHO.GA",
    title: "WHO.GA - RDAP WHOIS 查询与 JSON API | Domain, IP, ASN Lookup",
    description:
      "面向开发者的 RDAP 查询平台，支持域名、IP、ASN 与后缀的结构化 JSON 返回。Developer-friendly RDAP lookup platform for domains, IPs, ASNs, and suffixes.",
    locale: "zh_CN",
    alternateLocale: ["en_US"]
  },
  twitter: {
    card: "summary_large_image",
    title: "WHO.GA - RDAP WHOIS 查询与 JSON API",
    description:
      "域名、IP、ASN 与后缀查询，支持结构化 JSON API 与在线调试. RDAP lookup and JSON API for domains, IPs, ASNs, and suffixes."
  },
  appleWebApp: {
    capable: true,
    title: "WHO.GA",
    statusBarStyle: "default"
  },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon-16x16.png", type: "image/png", sizes: "16x16" },
      { url: "/favicon-32x32.png", type: "image/png", sizes: "32x32" }
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
    shortcut: ["/favicon.ico"],
    other: [
      { rel: "mask-icon", url: "/logo-whoga-green.svg", color: "#22C55F" }
    ]
  }
};

export const viewport: Viewport = {
  themeColor: "#22C55F"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <head>
        <link
          rel="stylesheet"
          href="https://icons.bluecdn.com/fontawesome-pro/css/all.min.css"
        />
        <link
          rel="stylesheet"
          href="https://static.bluecdn.com/npm/flag-icons@7.3.2/css/flag-icons.min.css"
        />
        <Script
          defer
          src="https://tongji.giantaccel.com/script.js"
          data-website-id="2b33e095-6708-4461-91c0-a15f464fdc3d"
          strategy="afterInteractive"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
