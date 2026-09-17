export default function QuantityStepper({ value, onChange, size = "md", label = "Quantity" }: { value: number; onChange: (v: number) => void; size?: "sm" | "md"; label?: string }) {
  const h = size === "sm" ? "h-8" : "h-11";
  const w = size === "sm" ? "w-8" : "w-11";
  return (
    <div className={`inline-flex ${h} items-center rounded-full border border-line`} role="group" aria-label={label}>
      <button type="button" className={`${w} ${h} rounded-full text-lg text-navy disabled:text-muted`} onClick={() => onChange(value - 1)} disabled={value <= 1} aria-label="Decrease quantity">
        −
      </button>
      <span className="min-w-7 text-center text-sm font-semibold tabular-nums" aria-live="polite">{value}</span>
      <button type="button" className={`${w} ${h} rounded-full text-lg text-navy disabled:text-muted`} onClick={() => onChange(value + 1)} disabled={value >= 99} aria-label="Increase quantity">
        +
      </button>
    </div>
  );
}
