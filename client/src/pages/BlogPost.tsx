import { Link, useParams } from "react-router-dom";
import { trpc } from "../lib/trpc";
import { usePageMeta, useJsonLd, breadcrumbLd, SITE_URL } from "../lib/format";
import PostCard, { PostCover, fmtPostDate } from "../components/PostCard";
import NotFound from "./NotFound";

export default function BlogPost() {
  const { slug = "" } = useParams();
  const q = trpc.content.blog.get.useQuery({ slug }, { retry: (n, err) => err.data?.code !== "NOT_FOUND" && n < 2 });
  const post = q.data;

  usePageMeta(
    post ? (post.seoTitle ?? `${post.title} | Peptiva Supplies`) : undefined,
    post ? (post.seoDescription ?? post.excerpt) : undefined,
    { image: post?.coverImage ?? undefined, type: "article" },
  );
  useJsonLd(
    "article",
    post && post.state === "live"
      ? {
          "@context": "https://schema.org",
          "@type": "Article",
          headline: post.title,
          description: post.seoDescription ?? post.excerpt,
          image: post.coverImage ? [post.coverImage.startsWith("http") ? post.coverImage : SITE_URL + post.coverImage] : undefined,
          datePublished: post.publishedAt ? new Date(post.publishedAt).toISOString() : undefined,
          dateModified: new Date(post.updatedAt).toISOString(),
          articleSection: post.category ?? undefined,
          mainEntityOfPage: `${SITE_URL}/blog/${post.slug}`,
          author: { "@type": "Organization", name: "Peptiva Supplies", url: SITE_URL },
          publisher: { "@type": "Organization", name: "Peptiva Supplies", logo: { "@type": "ImageObject", url: `${SITE_URL}/logo-peptiva.png` } },
        }
      : null,
  );
  useJsonLd(
    "article-crumbs",
    post ? breadcrumbLd([{ name: "Home", path: "/" }, { name: "Research Guides", path: "/blog" }, { name: post.title, path: `/blog/${post.slug}` }]) : null,
  );

  if (q.error?.data?.code === "NOT_FOUND") return <NotFound />;
  if (!post) {
    return (
      <div className="wrap py-16" aria-busy="true">
        <div className="skeleton mx-auto h-10 max-w-2xl rounded-xl" />
        <div className="skeleton mx-auto mt-8 h-80 max-w-3xl rounded-[2rem]" />
      </div>
    );
  }

  return (
    <article>
      {/* Solo lo ve quien tiene sesión de admin: el público recibe un 404 hasta que se publica */}
      {post.state !== "live" ? (
        <p className="bg-amber-100 px-4 py-2.5 text-center text-sm font-medium text-amber-900">
          Preview — {post.state === "scheduled" ? `scheduled for ${fmtPostDate(post.publishedAt)}` : "this article is a draft"}. Visitors can't see it yet.
        </p>
      ) : null}

      <header className="band-lilac">
        <div className="wrap py-12 lg:py-16">
          <div className="mx-auto max-w-3xl text-center">
            <nav aria-label="Breadcrumb" className="text-sm text-slate">
              <Link to="/blog" className="hover:underline">Research Guides</Link>
              {post.category ? (<> <span aria-hidden>›</span> <Link to={`/blog?category=${encodeURIComponent(post.category)}`} className="hover:underline">{post.category}</Link></>) : null}
            </nav>
            <h1 className="mt-5 text-[2.1rem] font-semibold leading-[1.08] sm:text-[3rem]">{post.title}</h1>
            <p className="mt-5 text-sm font-medium text-slate">
              {post.publishedAt ? <time dateTime={new Date(post.publishedAt).toISOString()}>{fmtPostDate(post.publishedAt)}</time> : "Not published"} · {post.minutes} min read
            </p>
          </div>
        </div>
      </header>

      <div className="wrap">
        {post.coverImage ? (
          <div className="mx-auto -mt-6 aspect-[16/8] max-w-4xl overflow-hidden rounded-[2rem] shadow-[0_30px_70px_-45px_rgba(12,42,71,0.6)]">
            <PostCover post={post} eager />
          </div>
        ) : null}

        <div className="prose-copy article-body mx-auto py-12 lg:py-16" dangerouslySetInnerHTML={{ __html: post.bodyHtml }} />

        <aside className="mx-auto mb-16 flex max-w-[44rem] flex-col items-start gap-5 rounded-[1.75rem] bg-mist p-7 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-lg font-semibold">Find the certificate for your lot</p>
            <p className="mt-1 text-[0.95rem] font-light text-slate">Every Peptiva lot has its Certificate of Analysis published. All material is supplied for laboratory research use only.</p>
          </div>
          <Link to="/coas" className="btn btn-primary shrink-0">Open the COA library</Link>
        </aside>
      </div>

      {post.related.length ? (
        <section className="band-ice">
          <div className="wrap py-14 lg:py-20">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <h2 className="text-[1.8rem] font-semibold sm:text-[2.3rem]">Keep reading</h2>
              <Link to="/blog" className="font-medium text-ink underline underline-offset-4">All research guides</Link>
            </div>
            <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {post.related.map((p) => <PostCard key={p.slug} post={p} />)}
            </div>
          </div>
        </section>
      ) : null}
    </article>
  );
}
