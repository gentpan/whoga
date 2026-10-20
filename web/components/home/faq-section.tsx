import { useState } from "react";
import type { HomeCopy } from "@/web/lib/i18n";

interface FaqSectionProps {
  t: HomeCopy;
}

export function FaqSection({ t }: FaqSectionProps) {
  const [openFaqIndex, setOpenFaqIndex] = useState(0);
  const faqItems = t.faqItems;

  return (
    <section className="faq-section" id="section-faq">
      <h2>{t.faq}</h2>
      <div className="faq-list">
        {faqItems.map((item, index) => {
          const isOpen = openFaqIndex === index;
          return (
            <article key={item.question} className="faq-item squircle">
              <button
                type="button"
                className="faq-trigger"
                aria-expanded={isOpen}
                onClick={() => setOpenFaqIndex(isOpen ? -1 : index)}
              >
                <span>{item.question}</span>
                <span className="faq-symbol">{isOpen ? "−" : "+"}</span>
              </button>
              {isOpen ? <div className="faq-content">{item.answer}</div> : null}
            </article>
          );
        })}
      </div>
    </section>
  );
}
