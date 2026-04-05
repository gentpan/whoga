import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "RDAP WHOIS 查询",
  description: "基于 IANA RDAP 的域名 WHOIS JSON 查询服务"
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
      </head>
      <body>{children}</body>
    </html>
  );
}
