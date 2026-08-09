"use client";
import Link from "next/link";
import "./stepper.css";

export default function Stepper({ items = [], statuses = {} }) {
  return (
    <ol className="stepper">
      {items.map((it, i) => {
        const st = statuses[it.segment] ?? "todo";
        return (
          <li key={it.segment}>
            <Link href={it.href} className={`stepper__item stepper__item--${st}`}
              aria-current={st === "active" ? "step" : undefined}>
              <span className={`stepper__state stepper__state--${st}`} aria-hidden="true">
                {st === "done" ? "✓" : ""}
              </span>
              <span className="stepper__text">
                <span className="stepper__label">{i + 1}. {it.label}</span>
                <span className="stepper__desc">{it.desc}</span>
                {st === "done" && <span className="visually-hidden">완료됨</span>}
              </span>
            </Link>
          </li>
        );
      })}
    </ol>
  );
}
