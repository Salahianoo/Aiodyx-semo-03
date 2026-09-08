import { t } from "@/lib/content";
import type { Locale } from "@/lib/i18n";

/**
 * The office directory, in one place.
 *
 * The contact page and the home page's closing block both list the same
 * addresses and numbers. They used to read them from two different halves of
 * the dictionary — `contact.info.address_jordan` and
 * `about.locations.jordan.address` held the same string, in both languages, so
 * every address existed four times and adding a branch meant four edits that
 * could silently disagree. A wrong phone number on a contact page is the kind
 * of drift nobody notices until a customer cannot reach you.
 *
 * `about.locations` is the source now; the duplicated `contact.info` keys are
 * gone.
 */

/** One place you can walk into, and the line that rings there. */
export type Branch = {
  address: string;
  phone: string;
  /** What kind of line it is. Absent where an office has only the one. */
  label?: string;
};

export type Office = {
  key: string;
  /** The country, as the about page names it. */
  country: string;
  branches: Branch[];
  /** A number that belongs to the office rather than to one of its branches. */
  extra?: { label: string; phone: string };
};

export function offices(locale: Locale): Office[] {
  const jordan = (k: string) => t(locale, `about.locations.jordan.${k}`);
  const saudi = (k: string) => t(locale, `about.locations.saudi.${k}`);
  const line = jordan("landline_label");

  return [
    {
      key: "jordan",
      country: jordan("country"),
      branches: [
        { address: jordan("address"), phone: jordan("phone"), label: line },
        { address: jordan("address_2"), phone: jordan("phone_2"), label: line },
      ],
      extra: {
        label: jordan("secretary_label"),
        phone: jordan("secretary"),
      },
    },
    {
      key: "saudi",
      country: saudi("country"),
      branches: [{ address: saudi("address"), phone: saudi("phone") }],
    },
  ];
}

/** `tel:` wants the number and nothing else — no spaces, no brackets. */
export const telHref = (phone: string) => `tel:${phone.replace(/[^\d+]/g, "")}`;
