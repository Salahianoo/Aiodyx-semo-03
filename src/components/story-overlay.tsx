"use client";

import { useEffect, useRef, type ReactNode } from "react";

import { scroll } from "@/lib/scroll";
import type { Beat } from "@/lib/story";

/**
 * The copy layer, shared by every story page.
 *
 * Beat visibility is driven from scroll position on the render loop rather
 * than by IntersectionObserver, so the copy and the 3D scene read the exact
 * same value and cannot drift out of sync. The scene needs a continuous
 * progress signal anyway; deriving the copy from a second, independent
 * mechanism was what let the two disagree.
 *
 * Cost is one cached-offset comparison per frame and a single attribute write
 * when the active beat actually changes — no layout reads inside the loop.
 * Like any rAF work this pauses in a background tab, which is correct: there
 * is nothing to reveal to someone who isn't looking.
 */
export function StoryOverlay({
  beats,
  align = "alternate",
  intro,
  children,
}: {
  beats: Beat[];
  /** "alternate" staggers left/right; "center" keeps every beat centred. */
  align?: "alternate" | "center";
  /** Rendered inside the opening beat — the things a visitor needs before
   *  they have scrolled anywhere, like who this is and what it is built on. */
  intro?: ReactNode;
  /** Rendered inside the final beat — CTAs, a form, anything interactive. */
  children?: ReactNode;
}) {
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const sections = Array.from(
      root.current?.querySelectorAll<HTMLElement>("[data-beat]") ?? [],
    );
    if (!sections.length) return;

    // Cached layout — measured here and on resize, never inside the loop
    let offsets: { top: number; height: number }[] = [];

    const measure = () => {
      offsets = sections.map((s) => ({
        top: s.offsetTop,
        height: s.offsetHeight,
      }));

      const max = document.documentElement.scrollHeight - window.innerHeight;
      if (max <= 0) return;
      const half = window.innerHeight / 2;

      // Publish each beat's scroll range so the 3D scene keys off the same
      // layout the copy uses — correct whatever height a beat's copy is.
      const next: Record<string, [number, number]> = {};
      sections.forEach((s, i) => {
        const id = s.dataset.beat;
        if (!id) return;
        next[id] = [
          (offsets[i].top - half) / max,
          (offsets[i].top + offsets[i].height - half) / max,
        ];
      });
      scroll.ranges = next;
      scroll.measured = true;
    };

    measure();
    // Fonts settle after first paint and change section heights
    const settle = requestAnimationFrame(measure);
    window.addEventListener("resize", measure);

    let active = -1;
    let raf = 0;

    const tick = () => {
      const mid = window.scrollY + window.innerHeight / 2;

      let next = 0;
      for (let i = 0; i < offsets.length; i++) {
        if (mid >= offsets[i].top) next = i;
        else break;
      }

      if (next !== active) {
        if (active >= 0) sections[active].setAttribute("data-active", "false");
        sections[next].setAttribute("data-active", "true");
        active = next;
      }

      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      cancelAnimationFrame(settle);
      window.removeEventListener("resize", measure);
      // Ranges belong to this page's layout; the next page must re-measure
      // before any scene derives state from them.
      scroll.measured = false;
      scroll.ranges = {};
    };
  }, [beats]);

  return (
    <div ref={root} className="relative z-10">
      {beats.map((b, i) => {
        const isEdge = i === 0 || i === beats.length - 1;
        const centred = align === "center" || isEdge;

        return (
          <section
            key={b.id}
            data-beat={b.id}
            data-active="false"
            className="beat flex min-h-screen items-center px-6 sm:px-10"
            style={{
              justifyContent: centred
                ? "center"
                : i % 2 === 0
                  ? "flex-start"
                  : "flex-end",
            }}
          >
            <div
              className="beat__inner max-w-xl"
              style={{ textAlign: centred ? "center" : "start" }}
            >
              {b.kicker && <p className="beat__kicker">{b.kicker}</p>}
              <h2 className="beat__title">{b.title}</h2>
              {b.body && <p className="beat__body">{b.body}</p>}
              {b.points && (
                <ul className="beat__points">
                  {b.points.map((p) => (
                    <li key={p}>{p}</li>
                  ))}
                </ul>
              )}
              {b.items && (
                <ul className="beat__cards">
                  {b.items.map((item) => (
                    <li key={item.title} className="card">
                      <h3 className="card__title">{item.title}</h3>
                      <p className="card__text">{item.text}</p>
                    </li>
                  ))}
                </ul>
              )}
              {i === 0 && intro}
              {i === beats.length - 1 && children}
            </div>
          </section>
        );
      })}
    </div>
  );
}
