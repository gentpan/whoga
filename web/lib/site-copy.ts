import { I18N, type Locale } from "@/web/lib/i18n";

export type SiteLocale = Locale;

export const SITE_COPY = {
  en: {
    navStats: I18N.en.navStats,
    navApi: I18N.en.navApi,
    navTlds: I18N.en.navTlds,
    navFaq: I18N.en.navFaq,
    navLearn: I18N.en.navLearn,
    navRequests: I18N.en.navRequests,
    navApiCta: I18N.en.navApiCta,
    themeMenuLabel: I18N.en.themeMenuLabel,
    themeLight: I18N.en.themeLight,
    themeDark: I18N.en.themeDark,
    themeTerminal: I18N.en.themeTerminal,
    copyright: "© 2026 WHO.GA. All rights reserved.",
    backToTop: "Back to Top"
  },
  zh: {
    navStats: I18N.zh.navStats,
    navApi: I18N.zh.navApi,
    navTlds: I18N.zh.navTlds,
    navFaq: I18N.zh.navFaq,
    navLearn: I18N.zh.navLearn,
    navRequests: I18N.zh.navRequests,
    navApiCta: I18N.zh.navApiCta,
    themeMenuLabel: I18N.zh.themeMenuLabel,
    themeLight: I18N.zh.themeLight,
    themeDark: I18N.zh.themeDark,
    themeTerminal: I18N.zh.themeTerminal,
    copyright: "© 2026 WHO.GA 保留所有权利。",
    backToTop: "回到顶部"
  }
} as const;
