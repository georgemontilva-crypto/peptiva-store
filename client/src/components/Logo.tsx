export default function Logo({ inverted = false }: { inverted?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-2 font-display text-[1.35rem] font-bold tracking-tight ${inverted ? "text-white" : "text-navy"}`}>
      <svg viewBox="0 0 28 28" className="h-7 w-7" aria-hidden>
        <rect x="9" y="2" width="10" height="4" rx="1.5" fill="currentColor" />
        <path d="M8.5 7h11v15a4 4 0 0 1-4 4h-3a4 4 0 0 1-4-4V7z" fill="none" stroke="currentColor" strokeWidth="2" />
        <path d="M10.5 16h7v6a2 2 0 0 1-2 2h-3a2 2 0 0 1-2-2v-6z" fill="#0fb0b3" />
      </svg>
      Peptiva
    </span>
  );
}
