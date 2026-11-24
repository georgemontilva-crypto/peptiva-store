import { useState } from "react";
import { trpc } from "../lib/trpc";
import Logo from "../components/Logo";
import { Button, Field, inputCls } from "./ui";

export default function Login() {
  const utils = trpc.useUtils();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const login = trpc.admin.auth.login.useMutation({ onSuccess: () => utils.admin.auth.me.invalidate() });
  const setup = trpc.admin.auth.setup.useQuery(undefined, { staleTime: 60_000 });
  const issue = setup.data?.issue
    ? {
        missing: "No administrator exists yet. Add ADMIN_EMAIL and ADMIN_PASSWORD (at least 10 characters) in the hosting variables and redeploy.",
        email: "ADMIN_EMAIL in the hosting variables is not a valid email address, so it was not applied.",
        short: "ADMIN_PASSWORD in the hosting variables has fewer than 10 characters, so it was not applied. Use a longer one and redeploy.",
      }[setup.data.issue]
    : null;

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-mist p-4">
      <form
        className="w-full max-w-sm rounded-2xl border border-line bg-white p-8 shadow-sm"
        onSubmit={(e) => {
          e.preventDefault();
          login.mutate({ email: email.trim(), password });
        }}
      >
        <div className="flex items-center gap-2"><Logo className="h-10" /><span className="rounded-md bg-navy px-1.5 py-0.5 text-[0.65rem] font-bold tracking-wider text-white">ADMIN</span></div>
        <h1 className="mt-6 font-display text-2xl font-bold text-navy">Sign in</h1>
        <div className="mt-6 space-y-4">
          <Field label="Email"><input type="email" required autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} /></Field>
          <Field label="Password"><input type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} className={inputCls} /></Field>
        </div>
        {issue ? <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">{issue}</p> : null}
        {login.error ? <p role="alert" className="mt-4 text-sm text-red-700">{login.error.message}</p> : null}
        <Button type="submit" className="mt-6 w-full" disabled={login.isPending}>{login.isPending ? "Signing in…" : "Sign in"}</Button>
      </form>
    </div>
  );
}
