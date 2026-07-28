"use client";
import { useId } from "react";
import "./field.css";

export default function Field({ label, hint, error, mono = false, className = "", ...inputProps }) {
  const id = useId();
  return (
    <div className={`field ${className}`}>
      {label && <label className="field__label" htmlFor={id}>{label}</label>}
      <input id={id} className={`field__input ${mono ? "mono" : ""} ${error ? "field__input--error" : ""}`}
        aria-invalid={error ? true : undefined} {...inputProps} />
      {error ? <p className="field__error" role="alert">{error}</p>
        : hint ? <p className="field__hint">{hint}</p> : null}
    </div>
  );
}
