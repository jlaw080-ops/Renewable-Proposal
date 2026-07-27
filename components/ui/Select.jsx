"use client";
import { useId } from "react";
import "./field.css";

export default function Select({ label, options = [], placeholder, error, className = "", ...selectProps }) {
  const id = useId();
  return (
    <div className={`field ${className}`}>
      {label && <label className="field__label" htmlFor={id}>{label}</label>}
      <select id={id} className={`field__input field__select ${error ? "field__input--error" : ""}`}
        aria-invalid={error ? true : undefined} {...selectProps}>
        {placeholder && <option value="">{placeholder}</option>}
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      {error && <p className="field__error" role="alert">{error}</p>}
    </div>
  );
}
