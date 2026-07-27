import "./card.css";

export default function Card({ title, actions, inner = false, className = "", children }) {
  return (
    <section className={`card ${inner ? "card--inner" : ""} ${className}`}>
      {(title || actions) && (
        <header className="card__head">
          {title && <h2 className="card__title">{title}</h2>}
          {actions && <div className="card__actions">{actions}</div>}
        </header>
      )}
      <div className="card__body">{children}</div>
    </section>
  );
}
