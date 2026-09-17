/**
 * Logo oficial de Peptiva (PNG transparente en /public, sirve sobre fondo claro y oscuro).
 * - horizontal: ícono al lado del nombre, para el menú (se lee bien a poca altura)
 * - stacked: versión original apilada, para el footer y espacios amplios
 */
export default function Logo({ variant = "horizontal", className = "h-11" }: { variant?: "horizontal" | "stacked"; className?: string }) {
  const src = variant === "horizontal" ? "/logo-peptiva-horizontal.png" : "/logo-peptiva.png";
  const [w, h] = variant === "horizontal" ? [560, 153] : [440, 358];
  return (
    <img
      src={src}
      alt="Peptiva — Premium Research Peptides"
      width={w}
      height={h}
      className={`${className} w-auto rounded-none object-contain`}
      decoding="async"
    />
  );
}
