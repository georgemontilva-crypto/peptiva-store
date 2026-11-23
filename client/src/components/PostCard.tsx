import { Link } from "react-router-dom";
import { VIALS } from "../lib/site";

export type PostCardData = { slug: string; title: string; excerpt: string; coverImage: string | null; coverAlt: string | null; category: string | null; publishedAt: Date | string | null; minutes: number };

const BANDS = ["band-lilac", "band-mint", "band-pastel", "panel-soft"];
const ALL_VIALS = Object.values(VIALS);
const hash = (s: string) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);

export const fmtPostDate = (d: Date | string | null) => (d ? new Date(d).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) : "");

/**
 * Portada de un artículo. Si no tiene imagen propia se compone una con los colores de la web y un
 * frasco, elegidos a partir de la dirección del artículo: cada uno recibe siempre la misma, y el
 * listado no queda con huecos grises mientras se suben las portadas definitivas.
 */
export function PostCover({ post, className = "", eager = false }: { post: Pick<PostCardData, "slug" | "title" | "coverImage" | "coverAlt" | "category">; className?: string; eager?: boolean }) {
  if (post.coverImage) {
    return <img src={post.coverImage} alt={post.coverAlt ?? ""} loading={eager ? "eager" : "lazy"} className={`h-full w-full rounded-none object-cover ${className}`} />;
  }
  const h = hash(post.slug);
  return (
    <div className={`relative h-full w-full overflow-hidden ${BANDS[h % BANDS.length]} ${className}`} aria-hidden>
      <div className="lab-grid absolute inset-0 opacity-60" />
      <img src={ALL_VIALS[h % ALL_VIALS.length]} alt="" loading={eager ? "eager" : "lazy"} className="float-shadow absolute bottom-[-18%] right-[8%] h-[105%] w-auto max-w-none rotate-[10deg] rounded-none object-contain" />
      {post.category ? <span className="chip absolute left-4 top-4 bg-white/85 text-navy backdrop-blur">{post.category}</span> : null}
    </div>
  );
}

export default function PostCard({ post }: { post: PostCardData }) {
  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-[1.75rem] bg-white shadow-[0_24px_50px_-38px_rgba(12,42,71,0.5)] ring-1 ring-line transition-shadow hover:shadow-[0_30px_60px_-34px_rgba(12,42,71,0.55)]">
      <Link to={`/blog/${post.slug}`} className="block aspect-[16/9] overflow-hidden" tabIndex={-1} aria-hidden>
        <PostCover post={post} className="transition-transform duration-500 group-hover:scale-[1.03]" />
      </Link>
      <div className="flex flex-1 flex-col p-6">
        <p className="text-xs font-medium text-muted">
          {post.coverImage && post.category ? <span className="text-navy">{post.category} · </span> : null}
          {fmtPostDate(post.publishedAt)} · {post.minutes} min read
        </p>
        <h3 className="mt-2 text-xl font-semibold leading-snug">
          <Link to={`/blog/${post.slug}`} className="hover:underline hover:underline-offset-4">{post.title}</Link>
        </h3>
        <p className="mt-2.5 line-clamp-3 flex-1 text-[0.95rem] font-light leading-relaxed text-slate">{post.excerpt}</p>
        <Link to={`/blog/${post.slug}`} className="mt-5 inline-flex items-center gap-2 text-[0.95rem] font-medium text-ink underline underline-offset-4" aria-label={`Read: ${post.title}`}>
          Read the guide
        </Link>
      </div>
    </article>
  );
}
