import type { ReactNode } from "react";
import { SiteFooter } from "@/web/components/site-footer";
import { SiteHeader } from "@/web/components/site-header";
import { useSiteLocale } from "@/web/lib/use-site-locale";

interface SiteShellProps {
  children: ReactNode;
  pageClassName?: string;
  activeNav?: string;
  onSectionClick?: (sectionId: string, navKey: string) => void;
  trailing?: ReactNode;
}

export function SiteShell({ children, pageClassName, activeNav, onSectionClick, trailing }: SiteShellProps) {
  const [locale, setLocale] = useSiteLocale();
  const pageClass = pageClassName ? `page ${pageClassName}` : "page";

  return (
    <main className={pageClass}>
      <SiteHeader
        locale={locale}
        onLocaleChange={setLocale}
        activeNav={activeNav}
        onSectionClick={onSectionClick}
      />
      <div className="container">
        <div className="page-main">{children}</div>
        <SiteFooter locale={locale} />
      </div>
      {trailing}
    </main>
  );
}
