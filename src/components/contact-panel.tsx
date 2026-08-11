"use client";

import dynamic from "next/dynamic";
import { useState } from "react";

import { Nav } from "@/components/nav";
import { usePrefersReducedMotion } from "@/components/story-page";
import { useLenis } from "@/lib/scroll";
import { t } from "@/lib/content";

const Stage = dynamic(
  () => import("@/components/scene/stage").then((m) => m.Stage),
  { ssr: false },
);
const ContactScene = dynamic(
  () => import("@/components/scene/contact-scene").then((m) => m.ContactScene),
  { ssr: false },
);

type Status = "idle" | "sending" | "sent" | "error";
type Errors = Partial<Record<string, string>>;

const OFFICES = [
  {
    name: t("contact.info.office_jordan"),
    address: t("contact.info.address_jordan"),
    phone: t("contact.info.phone_jordan"),
  },
  {
    name: t("contact.info.office_sa"),
    address: t("contact.info.address_sa"),
    phone: t("contact.info.phone_sa"),
  },
];

export function ContactPanel() {
  const reduced = usePrefersReducedMotion();
  useLenis(!reduced);

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

    if (!name) next.name = t("contact.form.error_required");
    if (!email) next.email = t("contact.form.error_required");
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      next.email = t("contact.form.error_email");
    if (message.length < 10) next.message = t("contact.form.error_minlength");

    setErrors(next);
    if (Object.keys(next).length) {
      form.querySelector<HTMLElement>("[aria-invalid='true']")?.focus();
      return;
    }

    setStatus("sending");
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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
        <ContactScene reduced={reduced} />
      </Stage>

      <main className="contact">
        <header className="contact__head">
          <p className="beat__kicker">{t("brand.name")}</p>
          <h1 className="beat__title">{t("contact.hero.title")}</h1>
          <p className="beat__body">{t("contact.hero.subtitle")}</p>
        </header>

        <div className="contact__grid">
          <section className="panel">
            <h2 className="panel__title">{t("contact.form.title")}</h2>
            <p className="panel__sub">{t("contact.form.subtitle")}</p>

            <form onSubmit={onSubmit} noValidate className="form">
              {/* Honeypot — bots fill it, humans never see it */}
              <div aria-hidden className="form__trap">
                <label htmlFor="website">Website</label>
                <input id="website" name="website" tabIndex={-1} autoComplete="off" />
              </div>

              <div className="form__row">
                <Field id="name" label={t("contact.form.name")} error={errors.name} required>
                  <input
                    id="name"
                    name="name"
                    autoComplete="name"
                    aria-invalid={!!errors.name}
                    className="input"
                  />
                </Field>
                <Field id="email" label={t("contact.form.email")} error={errors.email} required>
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
                <Field id="company" label={t("contact.form.company")}>
                  <input id="company" name="company" autoComplete="organization" className="input" />
                </Field>
                <Field id="phone" label={t("contact.form.phone")}>
                  <input id="phone" name="phone" type="tel" autoComplete="tel" className="input" />
                </Field>
              </div>

              <Field id="message" label={t("contact.form.message")} error={errors.message} required>
                <textarea
                  id="message"
                  name="message"
                  rows={5}
                  aria-invalid={!!errors.message}
                  className="input"
                />
              </Field>

              <button type="submit" className="btn btn--primary" disabled={status === "sending"}>
                {status === "sending" ? t("contact.form.submitting") : t("contact.form.submit")}
              </button>

              <div aria-live="polite">
                {status === "sent" && (
                  <p className="note note--ok">{t("contact.form.success")}</p>
                )}
                {status === "error" && (
                  <p className="note note--bad">{t("contact.form.error")}</p>
                )}
              </div>
            </form>
          </section>

          <aside className="panel panel--quiet">
            <h2 className="panel__title">{t("contact.info.title")}</h2>
            <ul className="offices">
              {OFFICES.map((o) => (
                <li key={o.name}>
                  <p className="offices__name">{o.name}</p>
                  <p className="offices__line">{o.address}</p>
                  <a className="offices__link" href={`tel:${o.phone.replace(/\s/g, "")}`}>
                    {o.phone}
                  </a>
                </li>
              ))}
              <li>
                <p className="offices__name">{t("contact.info.hours_label")}</p>
                <p className="offices__line">{t("contact.info.hours")}</p>
              </li>
              <li>
                <p className="offices__name">{t("contact.info.email_label")}</p>
                <a className="offices__link" href={`mailto:${t("footer.email")}`}>
                  {t("footer.email")}
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
