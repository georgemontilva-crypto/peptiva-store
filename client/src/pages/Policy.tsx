import { Link } from "react-router-dom";
import { trpc } from "../lib/trpc";
import { usePageMeta } from "../lib/format";
import { POLICY_LINKS } from "../lib/site";
import NotFound from "./NotFound";

export default function Policy({ slug }: { slug: string }) {
  const { data, isLoading, error } = trpc.content.page.useQuery({ slug }, { retry: false });
  usePageMeta(data ? `${data.title} — Peptiva Supplies` : undefined);

  if (isLoading) return <div className="mx-auto h-[60vh] max-w-6xl px-5 py-16" aria-busy="true" />;
  if (error || !data) return <NotFound />;

  return (
    <div className="mx-auto max-w-6xl px-5 py-16">
      <div className="grid gap-12 md:grid-cols-[1fr_3fr]">
        <nav aria-label="Policies" className="md:sticky md:top-32 md:self-start">
          <ul className="flex flex-wrap gap-2 md:flex-col md:gap-1">
            {POLICY_LINKS.map((l) => (
              <li key={l.to}>
                <Link to={l.to} aria-current={l.to === `/${slug}` ? "page" : undefined} className={`block rounded-xl px-3 py-2 text-sm font-semibold ${l.to === `/${slug}` ? "bg-mist text-navy" : "text-slate hover:text-navy"}`}>
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <article>
          <h1 className="text-4xl font-bold tracking-tight">{data.title}</h1>
          <div className="prose-copy mt-8" dangerouslySetInnerHTML={{ __html: data.html }} />
        </article>
      </div>
    </div>
  );
}
