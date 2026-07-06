export type SiteLocale = "zh" | "en";

export const SITE_COPY = {
  en: {
    navStats: "Stats",
    navApi: "API",
    navTlds: "TLDs",
    navFaq: "FAQ",
    navLearn: "Learn",
    navRequests: "Requests",
    navApiCta: "Open API",
    copyright: "© 2026 WHO.GA. All rights reserved.",
    backToTop: "Back to Top"
  },
  zh: {
    navStats: "统计",
    navApi: "API",
    navTlds: "后缀",
    navFaq: "FAQ",
    navLearn: "指南",
    navRequests: "需求",
    navApiCta: "打开 API",
    copyright: "© 2026 WHO.GA 保留所有权利。",
    backToTop: "回到顶部"
  }
} as const;
