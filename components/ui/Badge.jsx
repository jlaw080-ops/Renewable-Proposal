import "./badge.css";

export default function Badge({ tone = "na", className = "", children }) {
  return <span className={`badge badge--${tone} ${className}`}>{children}</span>;
}
