"use client";
import Link from "next/link";
import "./stepper.css";

export default function Stepper({ items = [], activeSegment }) {
  return (
    <ol className="stepper">
      {items.map((it, i) => {
        const active = it.segment === activeSegment;
        return (
          <li key={it.segment}>
            <Link href={it.href} className={`stepper__item ${active ? "stepper__item--active" : ""}`}
              aria-current={active ? "step" : undefined}>
              <span className="stepper__dot" style={{ background: `var(${it.dotVar})` }} aria-hidden="true" />
              <span className="stepper__text">
                <span className="stepper__label">{i + 1}. {it.label}</span>
                <span className="stepper__desc">{it.desc}</span>
              </span>
            </Link>
          </li>
        );
      })}
    </ol>
  );
}
