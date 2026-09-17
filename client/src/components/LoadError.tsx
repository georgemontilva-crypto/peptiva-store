export default function LoadError({ onRetry, what = "this content" }: { onRetry: () => void; what?: string }) {
  return (
    <div role="alert" className="rounded-3xl border border-line bg-mist px-6 py-12 text-center">
      <p className="font-display text-lg font-medium text-ink">We couldn't load {what}.</p>
      <p className="mt-2 text-sm text-slate">Check your connection and try again.</p>
      <button type="button" className="btn btn-primary mt-6" onClick={onRetry}>Try again</button>
    </div>
  );
}
