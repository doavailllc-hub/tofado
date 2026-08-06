import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  Clock3,
  FileText,
  PackageCheck,
  Plus,
  ReceiptText,
  RefreshCw,
  ShoppingCart,
  Store,
  Truck,
  Users,
  Wallet,
} from "lucide-react";

import api from "../services/api";
import { useAuth } from "../context/AuthContext";
import { Badge, Spinner, statusTone } from "../components/UI";
import "./Dashboard-Google.css";
import "./Dashboard-Colorful-Live.css";

const roleContent = {
  admin: {
    eyebrow: "Marketplace overview",
    title: "Manage the Tofado network",
    subtitle:
      "Review merchant activity, approvals, purchase orders, and marketplace performance.",
    primaryAction: {
      label: "Review applications",
      path: "/admin/applications",
      icon: Users,
    },
    secondaryAction: {
      label: "View all orders",
      path: "/admin/orders",
    },
  },
  retailer: {
    eyebrow: "Retail procurement",
    title: "Keep your shop fully stocked",
    subtitle:
      "Create purchase lists, order from verified wholesalers, and track every delivery.",
    primaryAction: {
      label: "New purchase list",
      path: "/retailer/new-order",
      icon: Plus,
    },
    secondaryAction: {
      label: "Track orders",
      path: "/retailer/orders",
    },
  },
  wholesaler: {
    eyebrow: "Wholesale operations",
    title: "Manage retailer demand",
    subtitle:
      "Manage products, retailer orders, deliveries, invoices, and collections from one workspace.",
    primaryAction: {
      label: "Open product catalog",
      path: "/wholesaler/catalog",
      icon: Store,
    },
    secondaryAction: {
      label: "View retailer orders",
      path: "/wholesaler/orders",
    },
  },
};

const iconMap = {
  total_orders: ShoppingCart,
  pending_orders: Clock3,
  delivered_orders: PackageCheck,
  purchase_value: Wallet,
  outstanding: ReceiptText,
  retailers: Store,
  wholesalers: Building2,
  pending_verifications: Users,
  order_value: Wallet,
};

function formatLabel(value = "") {
  return String(value)
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatDate(value) {
  if (!value) return "—";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  return new Intl.DateTimeFormat("en-SA", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function formatStatValue(key, value) {
  const numericValue = Number(value);

  if (
    ["purchase_value", "outstanding", "order_value"].includes(key) &&
    Number.isFinite(numericValue)
  ) {
    return `SAR ${numericValue.toLocaleString("en-SA", {
      maximumFractionDigits: 2,
    })}`;
  }

  return value ?? 0;
}

function EmptyActivity() {
  return (
    <div className="dashboard-empty">
      <div className="dashboard-empty-icon">
        <FileText size={22} />
      </div>
      <h3>No recent activity</h3>
      <p>Orders and business updates will appear here.</p>
    </div>
  );
}

function getQuickActions(role) {
  if (role === "retailer") {
    return [
      {
        label: "Create purchase list",
        description: "Send requirements to a wholesaler",
        path: "/retailer/new-order",
        icon: ShoppingCart,
      },
      {
        label: "Track orders",
        description: "Review pending and delivered orders",
        path: "/retailer/orders",
        icon: FileText,
      },
    ];
  }

  if (role === "wholesaler") {
    return [
      {
        label: "Product catalog",
        description: "Add and manage your products",
        path: "/wholesaler/catalog",
        icon: Store,
      },
      {
        label: "Retailer orders",
        description: "Process incoming purchase orders",
        path: "/wholesaler/orders",
        icon: ShoppingCart,
      },
      {
        label: "Payments",
        description: "Review collections and balances",
        path: "/wholesaler/payments",
        icon: Wallet,
      },
    ];
  }

  return [
    {
      label: "Merchant verification",
      description: "Review merchant applications",
      path: "/admin/applications",
      icon: Users,
    },
    {
      label: "Marketplace orders",
      description: "Monitor marketplace activity",
      path: "/admin/orders",
      icon: FileText,
    },
  ];
}

export default function Dashboard() {
  const { user } = useAuth();
  const [dashboard, setDashboard] = useState(null);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);

  const role = user?.role || "admin";
  const content = roleContent[role] || roleContent.admin;
  const quickActions = getQuickActions(role);

  useEffect(() => {
    let active = true;

    async function loadDashboard() {
      try {
        setError("");
        const response = await api.get(`/${role}/dashboard`);

        if (active) {
          setDashboard(response.data || { stats: {}, recent: [] });
          setLastUpdated(new Date());
        }
      } catch (requestError) {
        if (active) {
          setError(
            requestError.response?.data?.message || "Unable to load dashboard"
          );
        }
      }
    }

    loadDashboard();

    return () => {
      active = false;
    };
  }, [role]);

  const statEntries = useMemo(() => {
    if (!dashboard?.stats) return [];
    return Object.entries(dashboard.stats);
  }, [dashboard]);

  if (!dashboard && !error) {
    return <Spinner />;
  }

  if (error) {
    return (
      <div className="dashboard-error">
        <h2>Dashboard unavailable</h2>
        <p>{error}</p>
        <button
          type="button"
          className="dashboard-primary-action"
          onClick={() => window.location.reload()}
        >
          Try again
        </button>
      </div>
    );
  }

  const PrimaryIcon = content.primaryAction.icon;

  return (
    <div className="dashboard-page">
      <section className="dashboard-welcome">
        <div className="dashboard-welcome-copy">
          <span className="dashboard-eyebrow">{content.eyebrow}</span>
          <h1>Good day, {user?.name?.split(" ")[0] || "Merchant"}</h1>
          <p>{content.subtitle}</p>

          <div className="dashboard-hero-actions">
            <Link
              className="dashboard-primary-action"
              to={content.primaryAction.path}
            >
              <PrimaryIcon size={17} />
              {content.primaryAction.label}
            </Link>

            <Link
              className="dashboard-secondary-action"
              to={content.secondaryAction.path}
            >
              {content.secondaryAction.label}
              <ArrowRight size={16} />
            </Link>
          </div>
        </div>

        <div className="dashboard-account-card">
          <div className="dashboard-account-icon">
            {role === "retailer" ? (
              <ShoppingCart size={22} />
            ) : role === "wholesaler" ? (
              <Truck size={22} />
            ) : (
              <Users size={22} />
            )}
          </div>

          <div className="dashboard-account-copy">
            <span>Active workspace</span>
            <strong>{user?.business_name || "Tofado Merchant"}</strong>
            <small>{formatLabel(role)} account</small>
          </div>

          <CheckCircle2 className="dashboard-account-check" size={20} />
        </div>

        <button
          type="button"
          className="dashboard-live-refresh"
          disabled={refreshing}
          onClick={() => {
            setRefreshing(true);
            window.location.reload();
          }}
        >
          <RefreshCw
            size={17}
            className={refreshing ? "dashboard-spin" : ""}
          />
          <span>
            <strong>{refreshing ? "Refreshing..." : "Live database"}</strong>
            <small>
              {lastUpdated
                ? `Updated ${formatDate(lastUpdated)}`
                : "Connected"}
            </small>
          </span>
        </button>
      </section>

      <section className="dashboard-stats-grid">
        {statEntries.map(([key, value], index) => {
          const Icon =
            iconMap[key] ||
            [ShoppingCart, Clock3, FileText, Wallet, Users, Truck][index % 6];

          return (
            <article className={`dashboard-stat-card dashboard-stat-${index % 4}`} key={key}>
              <div className="dashboard-stat-icon">
                <Icon size={19} />
              </div>

              <div className="dashboard-stat-copy">
                <span className="dashboard-stat-label">{formatLabel(key)}</span>
                <strong className="dashboard-stat-value">
                  {formatStatValue(key, value)}
                </strong>
                <small>Live database data</small>
              </div>
            </article>
          );
        })}
      </section>

      <section className="dashboard-main-grid">
        <div className="dashboard-panel dashboard-activity-panel">
          <div className="dashboard-panel-header">
            <div>
              <span className="dashboard-panel-kicker">Latest updates</span>
              <h2>Recent activity</h2>
              <p>Recent purchase orders and marketplace updates.</p>
            </div>

            <Link
              className="dashboard-panel-link"
              to={
                role === "admin"
                  ? "/admin/orders"
                  : role === "retailer"
                    ? "/retailer/orders"
                    : "/wholesaler/orders"
              }
            >
              View all
              <ArrowRight size={15} />
            </Link>
          </div>

          {dashboard.recent?.length ? (
            <div className="dashboard-activity-list">
              {dashboard.recent.slice(0, 6).map((item) => (
                <article className="dashboard-activity-item" key={item.id}>
                  <div className="dashboard-activity-symbol">
                    <ShoppingCart size={17} />
                  </div>

                  <div className="dashboard-activity-main">
                    <div className="dashboard-activity-heading">
                      <div>
                        <strong>
                          {item.order_no || item.reference_no || "Order"}
                        </strong>
                        <span>
                          {item.business_name ||
                            item.party_name ||
                            "Tofado merchant"}
                        </span>
                      </div>

                      <Badge tone={statusTone(item.status)}>
                        {item.status || "pending"}
                      </Badge>
                    </div>

                    <div className="dashboard-activity-meta">
                      <span>
                        <Clock3 size={13} />
                        {formatDate(item.created_at)}
                      </span>

                      <strong>
                        {item.total_amount
                          ? `SAR ${Number(item.total_amount).toLocaleString(
                              "en-SA",
                              {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              }
                            )}`
                          : "Amount pending"}
                      </strong>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <EmptyActivity />
          )}
        </div>

        <aside className="dashboard-side-column">
          <div className="dashboard-panel dashboard-quick-panel">
            <div className="dashboard-panel-header compact">
              <div>
                <span className="dashboard-panel-kicker">Quick access</span>
                <h2>Common actions</h2>
              </div>
            </div>

            <div className="dashboard-quick-actions">
              {quickActions.map((action) => {
                const Icon = action.icon;

                return (
                  <Link to={action.path} key={action.path}>
                    <div className="dashboard-quick-icon">
                      <Icon size={17} />
                    </div>

                    <span>
                      <strong>{action.label}</strong>
                      <small>{action.description}</small>
                    </span>

                    <ArrowRight size={15} />
                  </Link>
                );
              })}
            </div>
          </div>

          <div className="dashboard-status-card">
            <div className="dashboard-status-icon">
              <CheckCircle2 size={20} />
            </div>
            <div>
              <span>Workspace status</span>
              <h3>Verified and active</h3>
              <p>Your workspace is ready for business.</p>
            </div>
          </div>
        </aside>
      </section>
    </div>
  );
}