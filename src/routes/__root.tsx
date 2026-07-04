import { HeadContent, Outlet, Scripts, createRootRoute } from "@tanstack/react-router";
import appCss from "../styles.css?url";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      {
        name: "theme-color",
        content: "#22C55F"
      },
      {
        title: "WHO.GA - RDAP Whois Query Tool"
      },
      {
        name: "description",
        content:
          "WHO.GA is an RDAP Whois query tool for domains, suffixes, IP addresses, and ASNs."
      }
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "/favicon.ico" },
      { rel: "icon", href: "/favicon-32x32.png", type: "image/png", sizes: "32x32" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png", sizes: "180x180" },
      { rel: "manifest", href: "/site.webmanifest" },
      { rel: "mask-icon", href: "/logo.svg", color: "#22C55F" }
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
