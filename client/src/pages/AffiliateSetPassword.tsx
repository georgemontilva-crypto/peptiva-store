import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { trpc } from "../lib/trpc";
import { usePageMeta } from "../lib/format";

export default function AffiliateSetPassword() {
  usePageMeta("Create your password — Peptiva Supplies");
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const navigate = useNavigate();
  const utils = trpc.useUtils();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const setPw = trpc.affiliate.setPassword.useMutation({
    onSuccess: async () => {
      await utils.affiliate.me.invalidate();
      navigate("/affiliate-account", { replace: true });
    },
  });
  const mismatch = confirm.length > 0 && password !== confirm;

  return (
    <div className="mx-auto max-w-md px-5 py-16">
      <h1 className="text-3xl font-bold tracking-tight">Choose your password</h1>
      <p className="mt-3 text-slate">Use at least 10 characters. You'll use it with your email to open your affiliate dashboard.</p>
      {!token ? (
        <p className="mt-8 text-alert">This link is incomplete. <Link to="/affiliate-account" className="underline">Request a new one</Link>.</p>
      ) : (
        <form
          className="mt-8 grid gap-5 rounded-3xl bg-mist p-7"
          onSubmit={(e) => {
            e.preventDefault();
            if (password === confirm) setPw.mutate({ token, password });
          }}
        >
          <label><span className="label">New password</span><input type="password" required minLength={10} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} className="field" /></label>
          <label><span className="label">Repeat password</span><input type="password" required minLength={10} autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} className="field" /></label>
          {mismatch ? <p className="text-sm text-alert">Passwords don't match.</p> : null}
          {setPw.error ? <p role="alert" className="text-sm text-alert">{setPw.error.message} <Link to="/affiliate-account" className="underline">Request a new link</Link></p> : null}
          <button type="submit" className="btn btn-primary" disabled={setPw.isPending || mismatch}>{setPw.isPending ? "Saving…" : "Save and open dashboard"}</button>
        </form>
      )}
    </div>
  );
}
