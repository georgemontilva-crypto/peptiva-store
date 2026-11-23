import { Link, useSearchParams } from "react-router-dom";
import { trpc } from "../lib/trpc";
import { usePageMeta, useJsonLd, breadcrumbLd, SITE_URL } from "../lib/format";
import PostCard, { PostCover, fmtPostDate } from "../components/PostCard";

/** Listado del blog ("Research Guides"): el más reciente destacado y el resto en rejilla. */
export default function Blog() {
  const [params, setParams] = useSearchParams();
  const category = params.get("category") ?? "";
  const q = trpc.content.blog.list.useQuery(category ? { category } : undefined, { placeholderData: (p) => p });
  usePageMeta(
    `${category ? `${category} | ` : ""}Research Guides | Reading Peptide Labels, COAs and Lot Records | Peptiva Supplies`,
    "Plain-language guides for laboratories: how to read a peptide Certificate of Analysis, match a lot number to its report, and keep lot records for research materials.",
  );
  const posts = q.data?.posts ?? [];
  useJsonLd(
    "blog",
    posts.length
      ? {
          "@context": "https://schema.org",
          "@type": "Blog",
          name: "Peptiva Supplies Research Guides",
          url: `${SITE_URL}/blog`,
          blogPost: posts.slice(0, 20).map((p) => ({ "@type": "BlogPosting", headline: p.title, url: `${SITE_URL}/blog/${p.slug}`, datePublished: p.publishedAt ? new Date(p.publishedAt).toISOString() : undefined })),
        }
      : null,
  );
  useJsonLd("blog-crumbs", breadcrumbLd([{ name: "Home", path: "/" }, { name: "Research Guides", path: "/blog" }]));

  const [lead, ...rest] = posts;

  return (
    <>
      <section className="band-lilac">
        <div className="wrap py-14 text-center lg:py-20">
          <p className="eyebrow">Research Guides</p>
          <h1 className="mx-auto mt-4 max-w-3xl text-[2.4rem] font-semibold leading-[1.06] sm:text-[3.3rem]">
            Plain-language guides to <span className="serif">lab documentation</span>
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg font-light leading-relaxed text-slate">
            How to read a label, find the certificate that belongs to your lot, and keep records another researcher can follow.
          </p>
          {q.data && q.data.categories.length > 1 ? (
            <nav aria-label="Guide categories" className="mt-8 flex flex-wrap justify-center gap-2.5">
              {["", ...q.data.categories].map((c) => (
                <button
                  key={c || "all"}
                  type="button"
                  onClick={() => setParams(c ? { category: c } : {})}
                  aria-pressed={category === c}
                  className={`chip transition-colors ${category === c ? "bg-ink text-white" : "border border-line bg-white text-ink hover:border-ink"}`}
                >
                  {c || "All guides"}
                </button>
              ))}
            </nav>
          ) : null}
        </div>
      </section>

      <section className="wrap py-14 lg:py-20">
        {q.isPending ? (
          <div className="grid gap-6 md:grid-cols-3">{Array.from({ length: 3 }, (_, i) => <div key={i} className="skeleton h-80 rounded-[1.75rem]" />)}</div>
        ) : !lead ? (
          <div className="mx-auto max-w-xl py-10 text-center">
            <h2 className="text-2xl font-semibold">{category ? "No guides in this category yet" : "The first guides are on their way"}</h2>
            <p className="mt-3 font-light text-slate">Meanwhile, every lot's Certificate of Analysis is already published.</p>
            <Link to="/coas" className="btn btn-primary mt-6">Browse the certificates</Link>
          </div>
        ) : (
          <>
            <article className="group grid overflow-hidden rounded-[2rem] bg-white shadow-[0_30px_70px_-45px_rgba(12,42,71,0.55)] ring-1 ring-line lg:grid-cols-[1.1fr_1fr]">
              <Link to={`/blog/${lead.slug}`} className="block aspect-[16/10] overflow-hidden lg:aspect-auto lg:min-h-[340px]" tabIndex={-1} aria-hidden>
                <PostCover post={lead} eager className="transition-transform duration-500 group-hover:scale-[1.03]" />
              </Link>
              <div className="flex flex-col justify-center p-7 sm:p-10">
                <p className="text-sm font-medium text-muted">
                  <span className="text-navy">Latest guide</span> · {fmtPostDate(lead.publishedAt)} · {lead.minutes} min read
                </p>
                <h2 className="mt-3 text-[1.8rem] font-semibold leading-[1.12] sm:text-[2.3rem]">
                  <Link to={`/blog/${lead.slug}`} className="hover:underline hover:underline-offset-4">{lead.title}</Link>
                </h2>
                <p className="mt-4 text-[1.02rem] font-light leading-relaxed text-slate">{lead.excerpt}</p>
                <div>
                  <Link to={`/blog/${lead.slug}`} className="btn btn-primary mt-7">Read the guide</Link>
                </div>
              </div>
            </article>

            {rest.length ? (
              <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {rest.map((p) => <PostCard key={p.slug} post={p} />)}
              </div>
            ) : null}
          </>
        )}
      </section>
    </>
  );
}
