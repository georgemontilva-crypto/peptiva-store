import { Link } from "react-router-dom";
import { trpc } from "../lib/trpc";
import { usePageMeta } from "../lib/format";

export default function Faq() {
  usePageMeta("FAQ — Peptiva Supplies", "Answers about research peptides, purity testing, shipping, storage and returns at Peptiva Supplies.");
  const { data } = trpc.content.faq.useQuery();
  const sections = [...new Set((data ?? []).map((i) => i.section))];

  return (
    <div className="mx-auto max-w-6xl px-5 py-16">
      <div className="grid gap-12 md:grid-cols-[1fr_2fr]">
        <div className="md:sticky md:top-32 md:self-start">
          <h1 className="text-4xl font-bold tracking-tight">Frequently asked questions</h1>
          <p className="mt-4 text-slate">Can't find what you need?</p>
          <Link to="/contact" className="btn btn-ghost mt-5">Contact support</Link>
        </div>
        <div className="space-y-12">
          {sections.map((section) => (
            <section key={section}>
              <h2 className="text-xl font-medium">{section}</h2>
              <div className="mt-4 divide-y divide-line border-y border-line">
                {data!.filter((i) => i.section === section).map((item) => (
                  <details key={item.q} className="group py-5">
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-6 font-display text-[1.05rem] font-medium text-ink marker:hidden">
                      {item.q}
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-line text-navy transition-transform group-open:rotate-45" aria-hidden>+</span>
                    </summary>
                    <div className="prose-copy mt-3 text-[0.95rem]" dangerouslySetInnerHTML={{ __html: item.a }} />
                  </details>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
