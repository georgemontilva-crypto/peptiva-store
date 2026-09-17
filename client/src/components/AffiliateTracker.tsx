import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { trpc } from "../lib/trpc";
import { readRefParam, storeAffiliateCode } from "../lib/affiliate";

/** Registra la visita cuando alguien entra con ?ref=CODE y guarda la atribución. */
export default function AffiliateTracker() {
  const { search, pathname } = useLocation();
  const track = trpc.shop.trackAffiliateVisit.useMutation();
  const done = useRef<string | null>(null);

  useEffect(() => {
    const code = readRefParam(search);
    if (!code || done.current === code) return;
    done.current = code;
    track.mutate(
      { code, path: pathname, referrer: document.referrer || undefined },
      {
        onSuccess: (r) => {
          if (r.valid) storeAffiliateCode(r.code, r.cookieDays);
        },
      },
    );
  }, [search]); // eslint-disable-line react-hooks/exhaustive-deps

  return null;
}
