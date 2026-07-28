"use client";
import "./button.css";

export default function Button({ variant = "primary", size = "md", type = "button", className = "", children, ...props }) {
  return (
    <button type={type} className={`btn btn--${variant} btn--${size} ${className}`} {...props}>
      {children}
    </button>
  );
}
