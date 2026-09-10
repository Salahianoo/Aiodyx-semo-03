"use client";

import dynamic from "next/dynamic";
import { useState } from "react";

import { Nav } from "@/components/nav";
import { useLocale } from "@/components/providers";
import { usePrefersReducedMotion } from "@/components/story-page";
import { useLenis } from "@/lib/scroll";
import { t } from "@/lib/content";
import { offices, telHref } from "@/lib/offices";

const Stage = dynamic(
  () => import("@/components/scene/stage").then((m) => m.Stage),
  { ssr: false },
);
const ContactScene = dynamic(
  () => import("@/components/scene/contact-scene").then((m) => m.ContactScene),
  { ssr: false },
);

/**
 * Where the form actually delivers.
 *
 * FormSubmit forwards the submission by email, which is what this site needs:
 * GitHub Pages serves files and cannot run a route handler, so the form had
 * nowhere to post and showed its error note to anyone who tried it.
 *
 * The `/ajax/` endpoint rather than a plain `action=` on the form: a normal
 * POST navigates the browser to FormSubmit's own thank-you page, which would
 * throw away the validation, the field-level errors and the sent state below.
 * This keeps the visitor on the page.
 *
 * Two things to know about this address:
 *
 * 1. It has to be confirmed once. The first submission sends an activation
 *    link to it and nothing is forwarded until someone clicks it.
 * 2. It is visible in the page source, so scrapers can read it. FormSubmit
 *    issues a random alias for exactly this reason — swapping this string for
 *    that alias, once activated, keeps the address off the page.
 */
const FORM_ENDPOINT = "https://formsubmit.co/ajax/m.salem@shamsieh.com";

type Status = "idle" | "sending" | "sent" | "error";
type Errors = Partial<Record<string, string>>;

/**
 * Read per render rather than built at module scope.
 *
 * As a module constant this list was evaluated once, at import — which froze
 * it in whichever language happened to load first and left the Arabic page
 * showing English offices.
 */
export function ContactPanel() {
  const reduced = usePrefersReducedMotion();
  const locale = useLocale();
  useLenis(!reduced);

  const directory = offices(locale);

  const [status, setStatus] = useState<Status>("idle");
  const [errors, setErrors] = useState<Errors>({});

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);

    const next: Errors = {};
    const name = String(data.get("name") ?? "").trim();
    const email = String(data.get("email") ?? "").trim();
    const message = String(data.get("message") ?? "").trim();

    if (!name) next.name = t(locale, "contact.form.error_required");
    if (!email) next.email = t(locale, "contact.form.error_required");
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      next.email = t(locale, "contact.form.error_email");
    if (message.length < 10) next.message = t(locale, "contact.form.error_minlength");

    setErrors(next);
    if (Object.keys(next).length) {
      form.querySelector<HTMLElement>("[aria-invalid='true']")?.focus();
      return;
    }

    setStatus("sending");
    try {
      const res = await fetch(FORM_ENDPOINT, {
        method: "POST",
        // Both headers matter: without `Accept` the endpoint answers with a
        // redirect to its HTML thank-you page instead of JSON.
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(Object.fromEntries(data)),
      });
      if (!res.ok) throw new Error(String(res.status));
      setStatus("sent");
      form.reset();
    } catch {
      setStatus("error");
    }
  }

  return (
    <>
      <Nav />
      {/* Bloom off: this page is about reading and typing, and glow behind a
          form is exactly the decoration that costs legibility. */}
      <Stage bloom={0}>
        <ContactScene reduced={reduced} locale={locale} />
      </Stage>

      <main className="contact">
        <header className="contact__head">
          <p className="beat__kicker">{t(locale, "brand.name")}</p>
          <h1 className="beat__title">{t(locale, "contact.hero.title")}</h1>
          <p className="beat__body">{t(locale, "contact.hero.subtitle")}</p>
        </header>

        <div className="contact__grid">
          <section className="panel">
            <h2 className="panel__title">{t(locale, "contact.form.title")}</h2>
            <p className="panel__sub">{t(locale, "contact.form.subtitle")}</p>

            <form onSubmit={onSubmit} noValidate className="form">
              {/* Honeypot — bots fill it, humans never see it. Named `_honey`
                  because that is the name FormSubmit looks for: anything that
                  arrives with it filled is dropped at their end rather than
                  landing in the inbox. */}
              <div aria-hidden className="form__trap">
                <label htmlFor="website">Website</label>
                <input id="website" name="_honey" tabIndex={-1} autoComplete="off" />
              </div>

              {/* Instructions to FormSubmit, not questions for the visitor.
                  They ride along in the form data like any other field.

                  `_captcha` off because the AJAX endpoint has no page on which
                  to show one — left on, a submission comes back asking for a
                  challenge the visitor never sees. The honeypot above is what
                  carries the spam load instead. */}
              <input type="hidden" name="_subject" value="AIODYX: new enquiry" />
              <input type="hidden" name="_template" value="table" />
              <input type="hidden" name="_captcha" value="false" />

              <div className="form__row">
                <Field id="name" label={t(locale, "contact.form.name")} error={errors.name} required>
                  <input
                    id="name"
                    name="name"
                    autoComplete="name"
                    aria-invalid={!!errors.name}
                    className="input"
                  />
                </Field>
                <Field id="email" label={t(locale, "contact.form.email")} error={errors.email} required>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    aria-invalid={!!errors.email}
                    className="input"
                  />
                </Field>
              </div>

              <div className="form__row">
                <Field id="company" label={t(locale, "contact.form.company")}>
                  <input id="company" name="company" autoComplete="organization" className="input" />
                </Field>
                <Field id="phone" label={t(locale, "contact.form.phone")}>
                  <input id="phone" name="phone" type="tel" autoComplete="tel" className="input" />
                </Field>
              </div>

              <Field id="message" label={t(locale, "contact.form.message")} error={errors.message} required>
                <textarea
                  id="message"
                  name="message"
                  rows={5}
                  aria-invalid={!!errors.message}
                  className="input"
                />
              </Field>

              <button type="submit" className="btn btn--primary" disabled={status === "sending"}>
                {status === "sending" ? t(locale, "contact.form.submitting") : t(locale, "contact.form.submit")}
              </button>

              <div aria-live="polite">
                {status === "sent" && (
                  <p className="note note--ok">{t(locale, "contact.form.success")}</p>
                )}
                {status === "error" && (
                  <p className="note note--bad">{t(locale, "contact.form.error")}</p>
                )}
              </div>
            </form>
          </section>

          <aside className="panel panel--quiet">
            <h2 className="panel__title">{t(locale, "contact.info.title")}</h2>
            <ul className="offices">
              {directory.map((o) => (
                <li key={o.key}>
                  <p className="offices__name">{o.country}</p>
                  {o.branches.map((br) => (
                    <div key={br.address} className="offices__branch">
                      <p className="offices__line">{br.address}</p>
                      {/* A phone number is read left-to-right in both
                          languages; without this the leading "+" is reordered
                          to the far end inside an RTL paragraph. */}
                      <a className="offices__link" href={telHref(br.phone)} dir="ltr">
                        {br.phone}
                      </a>
                      {br.label && <span className="offices__tag">{br.label}</span>}
                    </div>
                  ))}
                  {o.extra && (
                    <div className="offices__branch">
                      <a className="offices__link" href={telHref(o.extra.phone)} dir="ltr">
                        {o.extra.phone}
                      </a>
                      <span className="offices__tag">{o.extra.label}</span>
                    </div>
                  )}
                </li>
              ))}
              <li>
                <p className="offices__name">{t(locale, "contact.info.hours_label")}</p>
                <p className="offices__line">{t(locale, "about.locations.hours")}</p>
              </li>
              <li>
                <p className="offices__name">{t(locale, "contact.info.email_label")}</p>
                <a className="offices__link" href={`mailto:${t(locale, "footer.email")}`}>
                  {t(locale, "footer.email")}
                </a>
              </li>
            </ul>
          </aside>
        </div>
      </main>
    </>
  );
}

function Field({
  id,
  label,
  error,
  required,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="field">
      <label htmlFor={id}>
        {label}
        {required && <span aria-hidden> *</span>}
      </label>
      {children}
      {error && <p className="field__error">{error}</p>}
    </div>
  );
}
