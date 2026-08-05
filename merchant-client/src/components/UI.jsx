import {
  Inbox,
  LoaderCircle,
} from "lucide-react";

export const StatCard = ({
  label,
  value,
  sub,
  icon: Icon,
}) => (
  <article className="stat-card">
    <div className="stat-icon" aria-hidden="true">
      {Icon && <Icon size={21} strokeWidth={2} />}
    </div>

    <div className="stat-content">
      <p>{label || "Statistic"}</p>
      <h2>{value ?? "—"}</h2>

      {sub && <small>{sub}</small>}
    </div>
  </article>
);

export const Badge = ({
  children,
  tone = "gray",
}) => (
  <span className={`badge ${tone}`}>
    {children || "—"}
  </span>
);

export const Empty = ({
  title = "Nothing here",
  text = "New activity will appear here.",
  icon: Icon = Inbox,
}) => (
  <div className="empty">
    <div className="empty-icon" aria-hidden="true">
      <Icon size={24} strokeWidth={1.8} />
    </div>

    <h3>{title}</h3>
    <p>{text}</p>
  </div>
);

export const PageHeader = ({
  title,
  subtitle,
  action,
}) => (
  <header className="page-header">
    <div className="page-header-copy">
      <h1>{title}</h1>

      {subtitle && <p>{subtitle}</p>}
    </div>

    {action && (
      <div className="page-header-action">
        {action}
      </div>
    )}
  </header>
);

export const Spinner = ({
  label = "Loading",
}) => (
  <div
    className="spinner-wrap"
    role="status"
    aria-live="polite"
  >
    <LoaderCircle
      className="spinner"
      size={28}
      aria-hidden="true"
    />

    <span className="sr-only">{label}</span>
  </div>
);

export const statusTone = (status) => {
  const tones = {
    pending: "amber",
    approved: "green",
    active: "green",
    verified: "green",

    confirmed: "blue",

    packed: "purple",
    dispatched: "purple",

    delivered: "green",
    completed: "green",
    paid: "green",

    partial: "amber",
    processing: "amber",

    unpaid: "red",
    overdue: "red",
    cancelled: "red",
    rejected: "red",
    failed: "red",

    inactive: "gray",
    hidden: "gray",
    draft: "gray",
  };

  return tones[String(status || "").toLowerCase()] || "gray";
};