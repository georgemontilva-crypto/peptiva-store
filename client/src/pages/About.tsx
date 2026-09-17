import { Link } from "react-router-dom";
import { usePageMeta } from "../lib/format";
import { HERO_VIALS } from "../lib/site";

const STANDARDS = [
  { title: "Purity first", body: "Every compound undergoes HPLC and mass spectrometry testing to confirm 99%+ purity before release." },
  { title: "Transparency", body: "Certificates of analysis are published on the site, so you know exactly what's in each batch." },
  { title: "Reliability", body: "Responsive support and complete product documentation for researchers in academic, private and independent labs." },
  { title: "Community", body: "A network of professionals who value precision, integrity and responsible scientific research." },
];

export default function About() {
  usePageMeta("About Peptiva Supplies — Research Peptides Supplier", "Peptiva Supplies is a U.S.-based supplier of research-use-only peptides focused on purity, traceability and reliable shipping.");
  return (
    <>
      <section className="bg-mist">
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-5 py-20 md:grid-cols-[1.3fr_1fr]">
          <div>
            <p className="text-sm font-semibold text-teal">About Peptiva</p>
            <h1 className="mt-3 text-4xl font-bold leading-tight tracking-tight sm:text-5xl">Built on precision, consistency and quality.</h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-slate">
              Our processes are designed for accuracy and reproducibility at every stage, so researchers can rely on dependable peptide materials in controlled laboratory settings.
            </p>
          </div>
          <div className="flex justify-center" aria-hidden>
            {HERO_VIALS[0] ? <img src={HERO_VIALS[0]} alt="" className="vial aspect-square w-full max-w-80 rounded-3xl object-cover shadow-[0_28px_50px_-20px_rgba(12,42,71,0.45)]" /> : null}
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-10 px-5 py-24 md:grid-cols-[1fr_1.6fr]">
        <h2 className="text-3xl font-bold">Our mission</h2>
        <div className="space-y-5 text-lg leading-relaxed text-slate">
          <p>We take quality seriously, applying disciplined processes and clear standards to support confident, responsible research.</p>
          <p>
            Peptiva Supplies is a supplier of research-use-only peptides. Each product is sourced and processed with attention to purity and traceability, so researchers receive
            materials they can work with confidently.
          </p>
          <p>Based in the U.S., we ship promptly to keep your research on track, whether you work in an academic lab, a private facility or an independent setting.</p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5">
        <h2 className="text-3xl font-bold">Our standards</h2>
        <div className="mt-10 grid gap-px overflow-hidden rounded-3xl bg-line sm:grid-cols-2">
          {STANDARDS.map((s) => (
            <div key={s.title} className="bg-white p-8 sm:p-10">
              <h3 className="text-xl font-medium">{s.title}</h3>
              <p className="mt-3 leading-relaxed text-slate">{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto mt-24 max-w-6xl px-5">
        <div className="flex flex-col items-start justify-between gap-6 rounded-[2rem] bg-navy-deep p-10 text-white sm:flex-row sm:items-center sm:p-14">
          <div>
            <h2 className="text-3xl font-bold text-white">See the full catalog</h2>
            <p className="mt-2 text-white/70">Every compound comes with a published certificate of analysis.</p>
          </div>
          <Link to="/shop" className="btn bg-teal px-7 py-3.5 text-white hover:bg-white hover:text-navy">Shop products</Link>
        </div>
      </section>
    </>
  );
}
