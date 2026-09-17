import { useEffect, useState } from "react";
import { trpc } from "../lib/trpc";

/** Hora actual en la zona del Este (EE. UU.), sin depender de la zona del visitante. */
function easternNow() {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", weekday: "short", hour: "numeric", minute: "numeric", hourCycle: "h23" }).formatToParts(new Date());
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return { weekday: get("weekday"), minutes: Number(get("hour")) * 60 + Number(get("minute")) };
}

const label12 = (h: number) => `${h % 12 === 0 ? 12 : h % 12}:00 ${h < 12 ? "AM" : "PM"}`;

/** "Order within 9h 53m to ship today · cutoff 2:00 PM ET". No se despacha en domingo. */
export default function ShipCountdown() {
  const info = trpc.shop.storeInfo.useQuery(undefined, { staleTime: 10 * 60_000 });
  const [now, setNow] = useState(easternNow);
  useEffect(() => {
    const t = window.setInterval(() => setNow(easternNow()), 30_000);
    return () => window.clearInterval(t);
  }, []);

  const cutoff = info.data?.shippingCutoffHour ?? 14;
  const left = cutoff * 60 - now.minutes;
  const shipsToday = now.weekday !== "Sun" && left > 0;
  const next = now.weekday === "Sat" || now.weekday === "Sun" ? (now.weekday === "Sat" && left > 0 ? "today" : "Monday") : "tomorrow";

  return (
    <p className="flex items-center gap-2.5 rounded-2xl border border-emerald-200 bg-emerald-50/60 px-4 py-3 text-sm text-slate">
      <span className="relative flex h-2.5 w-2.5 shrink-0" aria-hidden>
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-40" />
        <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-600" />
      </span>
      {shipsToday ? (
        <span>
          Order within <strong className="text-navy">{Math.floor(left / 60)}h {left % 60}m</strong> to ship today · cutoff {label12(cutoff)} ET
        </span>
      ) : (
        <span>
          Order now and it ships <strong className="text-navy">{next}</strong> · cutoff {label12(cutoff)} ET
        </span>
      )}
    </p>
  );
}
