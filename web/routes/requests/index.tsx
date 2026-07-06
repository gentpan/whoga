import { createFileRoute } from "@tanstack/react-router";
import { SuffixRequestsPage } from "@/web/components/suffix-requests-page";

export const Route = createFileRoute("/requests/")({
  head: () => ({
    meta: [
      { title: "后缀支持请求 | WHO.GA" },
      {
        name: "description",
        content: "公开的后缀支持请求列表。后缀上线查询支持后自动移除。"
      },
      { name: "robots", content: "index, follow" }
    ],
    links: [{ rel: "canonical", href: "https://who.ga/requests" }]
  }),
  component: SuffixRequestsRoutePage
});

function SuffixRequestsRoutePage() {
  return <SuffixRequestsPage />;
}
