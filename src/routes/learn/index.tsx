import { createFileRoute } from "@tanstack/react-router";
import { LearnIndexPage } from "@/src/components/learn/learn-index-page";

export const Route = createFileRoute("/learn/")({
  head: () => ({
    meta: [
      {
        title: "WHOIS/RDAP 技术指南 | WHO.GA Learn"
      },
      {
        name: "description",
        content:
          "30 篇中英文 WHOIS 与 RDAP 技术文章：协议对比、IANA Bootstrap、API 集成、安全调查与自托管实践。"
      },
      {
        name: "keywords",
        content: "WHOIS 教程, RDAP 指南, 域名查询 SEO, IANA bootstrap, WHOIS API"
      },
      { name: "robots", content: "index, follow" },
      { property: "og:title", content: "WHOIS/RDAP 技术指南 | WHO.GA" },
      {
        property: "og:description",
        content: "专业 WHOIS/RDAP 中英文知识库，面向开发者与安全团队。"
      },
      { property: "og:url", content: "https://who.ga/learn" }
    ],
    links: [
      { rel: "canonical", href: "https://who.ga/learn" },
      { rel: "alternate", hreflang: "zh-CN", href: "https://who.ga/learn" },
      { rel: "alternate", hreflang: "en", href: "https://who.ga/learn/en" }
    ]
  }),
  component: LearnIndexZhPage
});

function LearnIndexZhPage() {
  return <LearnIndexPage locale="zh" />;
}
