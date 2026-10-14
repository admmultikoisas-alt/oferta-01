import { createFileRoute } from "@tanstack/react-router";
import {
  ArrowRight,
  AudioLines,
  Check,
  Clock3,
  Copy,
  CreditCard,
  Info,
  LockKeyhole,
  Mail,
  ShieldCheck,
  Zap,
} from "lucide-react";
import { type FormEvent, useState } from "react";

import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/refound")({
  head: () => ({
    meta: [
      { title: "Request a Refund — Spotify Rewards" },
      {
        name: "description",
        content: "Submit a secure refund request for your Spotify Rewards purchase.",
      },
      { property: "og:title", content: "Request a Refund — Spotify Rewards" },
      {
        property: "og:description",
        content: "Submit a secure refund request for your Spotify Rewards purchase.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: RefundPage,
});

function RefundPage() {
  const submitted = false;
  const protocol = "";
  const customer = { name: "", email: "" };
  const [copied, setCopied] = useState(false);
  const [sendError, setSendError] = useState("");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSendError("Refund requests are currently unavailable.");
  }

  async function copyProtocol() {
    await navigator.clipboard.writeText(protocol);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }

  return (
    <main className="refund-dark flex min-h-screen items-center justify-center px-5 py-12 font-sans text-foreground sm:py-16">
      <div className="w-full max-w-[410px]">
        <div className="refund-reveal mb-5 flex justify-center" style={{ "--reveal-delay": "0ms" } as React.CSSProperties}>
          <div className="inline-flex items-center gap-2 text-sm font-bold text-foreground">
            <span className="flex size-7 items-center justify-center rounded-full bg-brand text-brand-foreground">
              <AudioLines className="size-4" aria-hidden="true" />
            </span>
            Spotify <span className="font-medium text-muted-foreground">Rewards</span>
          </div>
        </div>

        <ol className="refund-reveal mx-auto mb-4 flex max-w-[230px] items-center text-[11px] font-semibold" style={{ "--reveal-delay": "120ms" } as React.CSSProperties}>
          <li className={`flex items-center gap-1.5 ${submitted ? "text-brand" : "text-brand-soft-foreground"}`}>
            <span className="flex size-5 items-center justify-center rounded-full bg-brand text-[10px] text-brand-foreground">
              {submitted ? <Check className="size-3" aria-hidden="true" /> : "1"}
            </span>
            Request
          </li>
          <span className="mx-3 h-px flex-1 bg-border" aria-hidden="true" />
          <li className={`flex items-center gap-1.5 ${submitted ? "text-brand-soft-foreground" : "text-muted-foreground"}`}>
            <span className={`flex size-5 items-center justify-center rounded-full text-[10px] ${submitted ? "bg-brand text-brand-foreground" : "bg-muted text-muted-foreground"}`}>
              2
            </span>
            Confirmation
          </li>
        </ol>

        {!submitted && <header className="refund-reveal mb-6 text-center" style={{ "--reveal-delay": "220ms" } as React.CSSProperties}>
          <h1 className="text-[28px] font-extrabold leading-tight text-foreground">
            Request a refund
          </h1>
          <p className="mx-auto mt-2 max-w-[350px] text-sm leading-5 text-muted-foreground">
            Refund requests are currently unavailable.
          </p>
        </header>}

        <section className="refund-reveal rounded-xl border border-border bg-refund-surface p-5 shadow-refund sm:p-6" style={{ "--reveal-delay": "340ms" } as React.CSSProperties}>
          {submitted ? (
            <div className="refund-reveal text-center" aria-live="polite">
              <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-brand text-brand-foreground shadow-lg shadow-brand/20 animate-scale-in">
                <Check className="size-7" strokeWidth={3} aria-hidden="true" />
              </span>
              <h1 className="mt-4 text-xl font-extrabold">Request submitted</h1>
              <p className="mx-auto mt-1.5 max-w-[320px] text-xs leading-5 text-muted-foreground">
                Your refund is already being processed. We just sent a confirmation to your purchase email.
              </p>

              <div className="mt-4 rounded-lg border border-brand/20 bg-brand-soft px-4 py-3">
                <p className="text-[9px] font-extrabold uppercase text-brand-soft-foreground">Protocol number</p>
                <p className="mt-0.5 text-xl font-black tracking-wide text-foreground">{protocol}</p>
                <Button type="button" variant="outline" size="sm" className="mt-1 h-7 gap-1.5 px-2.5 text-[10px]" onClick={copyProtocol}>
                  {copied ? <Check className="size-3" aria-hidden="true" /> : <Copy className="size-3" aria-hidden="true" />}
                  {copied ? "Copied" : "Copy"}
                </Button>
              </div>

              <div className="mt-3 rounded-lg bg-refund-field p-3 text-left text-[11px] leading-5 text-muted-foreground">
                <p><strong className="text-foreground">Name:</strong> {customer.name}</p>
                <p><strong className="text-foreground">Email:</strong> {customer.email}</p>
              </div>

              <div className="mt-3 text-left">
                <h2 className="text-xs font-extrabold">How will you receive the refund?</h2>
                <div className="mt-2 space-y-2.5">
                  <div className="flex gap-2.5">
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-brand-soft text-brand-soft-foreground"><Mail className="size-3.5" aria-hidden="true" /></span>
                    <div><p className="text-[11px] font-bold">Next 24 hours</p><p className="text-[9px] leading-4 text-muted-foreground">Confirmation email with processing details — already on its way</p></div>
                  </div>
                  <div className="flex gap-2.5">
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-brand-soft text-brand-soft-foreground"><Zap className="size-3.5" aria-hidden="true" /></span>
                    <div><p className="text-[11px] font-bold">Up to 7 business days</p><p className="text-[9px] leading-4 text-muted-foreground">Refund processed by our finance team</p></div>
                  </div>
                  <div className="flex gap-2.5">
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-brand-soft text-brand-soft-foreground"><CreditCard className="size-3.5" aria-hidden="true" /></span>
                    <div><p className="text-[11px] font-bold">Next card statement</p><p className="text-[9px] leading-4 text-muted-foreground">Amount appears as a credit or deducted from the total</p></div>
                  </div>
                </div>
              </div>

              <div className="mt-4 flex gap-2 rounded-lg border border-warning/30 bg-warning/10 p-2.5 text-left text-[9px] leading-4 text-muted-foreground">
                <Clock3 className="mt-0.5 size-3.5 shrink-0 text-warning-foreground" aria-hidden="true" />
                <p>The timeframe may vary depending on your bank or card operator. Keep this protocol if you need to follow up.</p>
              </div>

            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              <div className="mb-5 flex gap-3 rounded-lg border border-brand/20 bg-brand-soft p-3 text-brand-soft-foreground">
                <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-brand/15">
                  <Info className="size-3.5" aria-hidden="true" />
                </span>
                <div>
                  <p className="text-xs font-bold">Important</p>
                  <p className="mt-0.5 text-[11px] leading-4">
                    We locate your purchase with the email used at checkout. Fill both fields carefully so we can process this quickly.
                  </p>
                </div>
              </div>

              <label className="block text-xs font-bold" htmlFor="refund-name">
                Full name <span className="text-destructive">*</span>
              </label>
              <input
                id="refund-name"
                name="name"
                type="text"
                autoComplete="name"
                required
                placeholder="Name on the purchase"
                className="mt-2 h-11 w-full rounded-lg border border-transparent bg-refund-field px-3.5 text-sm outline-none transition placeholder:text-muted-foreground focus:border-brand focus:ring-2 focus:ring-brand/20"
              />

              <label className="mt-4 block text-xs font-bold" htmlFor="refund-email">
                Purchase email <span className="text-destructive">*</span>
              </label>
              <input
                id="refund-email"
                name="email"
                type="email"
                autoComplete="email"
                required
                placeholder="email@used-to-buy.com"
                className="mt-2 h-11 w-full rounded-lg border border-transparent bg-refund-field px-3.5 text-sm outline-none transition placeholder:text-muted-foreground focus:border-brand focus:ring-2 focus:ring-brand/20"
              />
              <p className="mt-1.5 text-[10px] text-muted-foreground">Use the same email registered for the purchase</p>

              <Button
                type="submit"
                disabled
                className="mt-4 h-12 w-full bg-brand font-bold text-brand-foreground shadow-lg shadow-brand/20 hover:bg-brand/90"
              >
                Request refund
                <ArrowRight aria-hidden="true" />
              </Button>

              {sendError && (
                <p className="mt-3 text-center text-xs font-semibold text-destructive" role="alert">
                  {sendError}
                </p>
              )}

              <p className="mt-3 flex items-center justify-center gap-1.5 text-[10px] text-muted-foreground">
                <LockKeyhole className="size-3 text-brand" aria-hidden="true" />
                Your information is used only to process the refund
              </p>
            </form>
          )}
        </section>

        <div className="refund-reveal mt-4 flex items-center justify-center gap-5 text-[10px] text-muted-foreground" style={{ "--reveal-delay": "460ms" } as React.CSSProperties}>
          <span className="flex items-center gap-1.5">
            <ShieldCheck className="size-3.5 text-brand" aria-hidden="true" />
            Secure request
          </span>
          <span className="flex items-center gap-1.5">
            <CreditCard className="size-3.5 text-brand" aria-hidden="true" />
            Same card / method
          </span>
        </div>
      </div>
    </main>
  );
}