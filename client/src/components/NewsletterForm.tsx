import { useState } from "react";
import { trpc } from "../lib/trpc";

export default function NewsletterForm({ inverted = false }: { inverted?: boolean }) {
  const [email, setEmail] = useState("");
  const subscribe = trpc.content.subscribe.useMutation();

  if (subscribe.isSuccess) {
    return <p className={`text-sm ${inverted ? "text-white" : "text-navy"}`}>You're on the list. We'll email you about new compounds and restocks.</p>;
  }

  return (
    <form
      className="flex w-full max-w-md flex-col gap-2 sm:flex-row"
      onSubmit={(e) => {
        e.preventDefault();
        subscribe.mutate({ email, source: "newsletter" });
      }}
    >
      <label htmlFor={`nl-${inverted ? "dark" : "light"}`} className="sr-only">Email address</label>
      <input
        id={`nl-${inverted ? "dark" : "light"}`}
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@lab.com"
        className="field flex-1"
      />
      <button type="submit" className={`btn ${inverted ? "bg-teal text-white hover:bg-white hover:text-navy" : "btn-primary"}`} disabled={subscribe.isPending}>
        {subscribe.isPending ? "Joining…" : "Join the list"}
      </button>
      {subscribe.error ? <p className="text-sm text-red-300">{subscribe.error.message}</p> : null}
    </form>
  );
}
