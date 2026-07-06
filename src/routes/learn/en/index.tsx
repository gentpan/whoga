import { createFileRoute } from "@tanstack/react-router";
import { LearnIndexPage } from "@/src/components/learn/learn-index-page";

export const Route = createFileRoute("/learn/en/")({
  head: () => ({
    meta: [
      { title: "WHOIS/RDAP Technical Guides | WHO.GA Learn" },
      {
        name: "description",
        content:
          "30 bilingual articles on WHOIS and RDAP—protocols, IANA bootstrap, API integration, security, and self-hosting."
      },
      {
        name: "keywords",
        content: "WHOIS guide, RDAP tutorial, domain lookup SEO, IANA bootstrap, WHOIS API"
      },
      { name: "robots", content: "index, follow" },
      { property: "og:title", content: "WHOIS/RDAP Technical Guides | WHO.GA" },
      {
        property: "og:description",
        content: "Professional WHOIS/RDAP knowledge base for developers and security teams."
      },
      { property: "og:url", content: "https://who.ga/learn/en" }
    ],
    links: [
      { rel: "canonical", href: "https://who.ga/learn/en" },
      { rel: "alternate", hreflang: "en", href: "https://who.ga/learn/en" },
      { rel: "alternate", hreflang: "zh-CN", href: "https://who.ga/learn" }
    ]
  }),
  component: LearnIndexEnPage
});

function LearnIndexEnPage() {
  return <LearnIndexPage locale="en" />;
}
