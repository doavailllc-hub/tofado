import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Building2,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  CreditCard,
  FileText,
  LoaderCircle,
  Mail,
  MapPin,
  Phone,
  ReceiptText,
  RefreshCw,
  ShoppingCart,
  Store,
  UserRound,
  Wallet,
} from "lucide-react";

import api from "../services/api";
import {
  Badge,
  Empty,
  Spinner,
  statusTone,
} from "../components/UI";
import "./RetailerDetails.css";

const tabs = [
  {
    id: "overview",
    label: "Overview",
    icon: Store,
  },
  {
    id: "orders",
    label: "Orders",
    icon: ShoppingCart,
  },
  {
    id: "invoices",
    label: "Invoices",
    icon: FileText,
  },
  {
    id: "payments",
    label: "Payments",
    icon: Wallet,
  },
];

const emptyRetailer = {
  id: null,
  business_name: "",
  name: "",
  email: "",
  phone: "",
  location: "",
  address: "",
  tax_number: "",
  status: "active",
  source: "manual",
  credit_limit: 0,
  payment_terms: "cash",
  notes: "",
  connected_at: null,
};

function asArray(value, keys = []) {
  if (Array.isArray(value)) {
    return value;
  }

  for (const key of keys) {
    if (Array.isArray(value?.[key])) {
      return value[key];
    }
  }

  return [];
}

function formatMoney(value) {
  const amount = Number(value || 0);

  return `SAR ${amount.toLocaleString("en-SA", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatDate(value, includeTime = false) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return new Intl.DateTimeFormat("en-SA", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    ...(includeTime
      ? {
          hour: "2-digit",
          minute: "2-digit",
        }
      : {}),
  }).format(date);
}

function readable(value) {
  if (!value) return "—";

  return String(value)
    .replaceAll("_", " ")
    .replace(/\b\w/g, (character) =>
      character.toUpperCase()
    );
}

function getInvoiceOutstanding(invoice) {
  const total = Number(invoice.total_amount || 0);
  const paid = Number(invoice.paid_amount || 0);

  return Math.max(total - paid, 0);
}

export default function RetailerDetails() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState("overview");
  const [retailer, setRetailer] = useState(emptyRetailer);
  const [orders, setOrders] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [payments, setPayments] = useState([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tabLoading, setTabLoading] = useState({
    orders: false,
    invoices: false,
    payments: false,
  });
  const [loadedTabs, setLoadedTabs] = useState({
    orders: false,
    invoices: false,
    payments: false,
  });
  const [error, setError] = useState("");

  const loadRetailer = useCallback(
    async (showRefresh = false) => {
      try {
        if (showRefresh) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }

        setError("");

        const { data } = await api.get(
          `/wholesaler/retailers/${id}`
        );

        const retailerData =
          data?.retailer && typeof data.retailer === "object"
            ? data.retailer
            : data;

        setRetailer({
          ...emptyRetailer,
          ...(retailerData || {}),
        });

        if (Array.isArray(data?.orders)) {
          setOrders(data.orders);
          setLoadedTabs((current) => ({
            ...current,
            orders: true,
          }));
        }

        if (Array.isArray(data?.invoices)) {
          setInvoices(data.invoices);
          setLoadedTabs((current) => ({
            ...current,
            invoices: true,
          }));
        }

        if (Array.isArray(data?.payments)) {
          setPayments(data.payments);
          setLoadedTabs((current) => ({
            ...current,
            payments: true,
          }));
        }
      } catch (requestError) {
        setError(
          requestError.response?.data?.message ||
            "Unable to load retailer details."
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [id]
  );

  const loadTab = useCallback(
    async (tab, force = false) => {
      if (
        tab === "overview" ||
        (!force && loadedTabs[tab])
      ) {
        return;
      }

      try {
        setTabLoading((current) => ({
          ...current,
          [tab]: true,
        }));
        setError("");

        const { data } = await api.get(
          `/wholesaler/retailers/${id}/${tab}`
        );

        if (tab === "orders") {
          setOrders(asArray(data, ["orders", "rows"]));
        }

        if (tab === "invoices") {
          setInvoices(asArray(data, ["invoices", "rows"]));
        }

        if (tab === "payments") {
          setPayments(asArray(data, ["payments", "rows"]));
        }

        setLoadedTabs((current) => ({
          ...current,
          [tab]: true,
        }));
      } catch (requestError) {
        setError(
          requestError.response?.data?.message ||
            `Unable to load retailer ${tab}.`
        );
      } finally {
        setTabLoading((current) => ({
          ...current,
          [tab]: false,
        }));
      }
    },
    [id, loadedTabs]
  );

  useEffect(() => {
    loadRetailer();
  }, [loadRetailer]);

  useEffect(() => {
    loadTab(activeTab);
  }, [activeTab, loadTab]);

  const summary = useMemo(() => {
    const orderTotal = orders.reduce(
      (sum, order) =>
        sum + Number(order.total_amount || 0),
      0
    );

    const outstanding = invoices.reduce(
      (sum, invoice) =>
        sum + getInvoiceOutstanding(invoice),
      0
    );

    const paid = payments.reduce(
      (sum, payment) =>
        sum + Number(payment.amount || 0),
      0
    );

    const lastOrder = [...orders]
      .sort((first, second) => {
        const firstDate = new Date(
          first.created_at || first.order_date || 0
        ).getTime();

        const secondDate = new Date(
          second.created_at || second.order_date || 0
        ).getTime();

        return secondDate - firstDate;
      })[0];

    return {
      ordersCount:
        Number(retailer.orders_count) || orders.length,
      orderTotal:
        Number(retailer.order_value) || orderTotal,
      outstanding:
        Number(retailer.outstanding) || outstanding,
      paid:
        Number(retailer.paid_amount) || paid,
      lastOrder:
        retailer.last_order_at ||
        lastOrder?.created_at ||
        lastOrder?.order_date ||
        null,
    };
  }, [retailer, orders, invoices, payments]);

  const changeTab = (tab) => {
    setActiveTab(tab);
  };

  const refreshCurrent = async () => {
    await loadRetailer(true);

    if (activeTab !== "overview") {
      await loadTab(activeTab, true);
    }
  };

  if (loading) {
    return <Spinner />;
  }

  return (
    <div className="retailer-details-page">
      <header className="retailer-details-header">
        <button
          type="button"
          className="retailer-details-back"
          onClick={() =>
            navigate("/wholesaler/retailers")
          }
        >
          <ArrowLeft size={18} />
          Retailers
        </button>

        <div className="retailer-details-title-row">
          <div className="retailer-details-identity">
            <div className="retailer-details-avatar">
              <Store size={25} />
            </div>

            <div>
              <div className="retailer-details-kicker">
                Retailer account
              </div>

              <div className="retailer-details-name-line">
                <h1>
                  {retailer.business_name ||
                    "Retailer details"}
                </h1>

                <Badge tone={statusTone(retailer.status)}>
                  {retailer.status || "active"}
                </Badge>
              </div>

              <p>
                {retailer.name || "No contact person"}
                {retailer.location
                  ? ` · ${retailer.location}`
                  : ""}
              </p>
            </div>
          </div>

          <div className="retailer-details-actions">
            <button
              type="button"
              className="retailer-detail-secondary-button"
              disabled={refreshing}
              onClick={refreshCurrent}
            >
              <RefreshCw
                size={17}
                className={
                  refreshing
                    ? "retailer-detail-spin"
                    : ""
                }
              />
              Refresh
            </button>

            <button
              type="button"
              className="retailer-detail-primary-button"
              onClick={() =>
                navigate(
                  `/wholesaler/orders/new?retailer=${retailer.id}`
                )
              }
            >
              <ShoppingCart size={17} />
              Create order
            </button>
          </div>
        </div>
      </header>

      {error && (
        <div className="retailer-details-alert">
          {error}
        </div>
      )}

      <section className="retailer-details-summary">
        <article>
          <div className="retailer-summary-icon blue">
            <ShoppingCart size={20} />
          </div>

          <span>Total orders</span>
          <strong>{summary.ordersCount}</strong>
        </article>

        <article>
          <div className="retailer-summary-icon purple">
            <CircleDollarSign size={20} />
          </div>

          <span>Order value</span>
          <strong>{formatMoney(summary.orderTotal)}</strong>
        </article>

        <article>
          <div className="retailer-summary-icon orange">
            <ReceiptText size={20} />
          </div>

          <span>Outstanding</span>
          <strong>{formatMoney(summary.outstanding)}</strong>
        </article>

        <article>
          <div className="retailer-summary-icon green">
            <CalendarDays size={20} />
          </div>

          <span>Last order</span>
          <strong>{formatDate(summary.lastOrder)}</strong>
        </article>
      </section>

      <section className="retailer-details-workspace">
        <nav
          className="retailer-details-tabs"
          aria-label="Retailer sections"
        >
          {tabs.map((tab) => {
            const Icon = tab.icon;

            return (
              <button
                type="button"
                key={tab.id}
                className={
                  activeTab === tab.id ? "active" : ""
                }
                onClick={() => changeTab(tab.id)}
              >
                <Icon size={17} />
                {tab.label}
              </button>
            );
          })}
        </nav>

        <div className="retailer-details-content">
          {activeTab === "overview" && (
            <OverviewTab retailer={retailer} />
          )}

          {activeTab === "orders" && (
            <OrdersTab
              rows={orders}
              loading={tabLoading.orders}
              navigate={navigate}
            />
          )}

          {activeTab === "invoices" && (
            <InvoicesTab
              rows={invoices}
              loading={tabLoading.invoices}
              navigate={navigate}
            />
          )}

          {activeTab === "payments" && (
            <PaymentsTab
              rows={payments}
              loading={tabLoading.payments}
            />
          )}
        </div>
      </section>
    </div>
  );
}

function OverviewTab({ retailer }) {
  return (
    <div className="retailer-overview-grid">
      <section className="retailer-detail-card">
        <div className="retailer-detail-card-heading">
          <div>
            <UserRound size={19} />
          </div>

          <span>
            <strong>Contact information</strong>
            <small>
              Primary retailer and communication details
            </small>
          </span>
        </div>

        <div className="retailer-information-list">
          <InformationRow
            icon={Building2}
            label="Business name"
            value={retailer.business_name}
          />

          <InformationRow
            icon={UserRound}
            label="Contact person"
            value={retailer.name}
          />

          <InformationRow
            icon={Phone}
            label="Phone"
            value={retailer.phone}
            href={
              retailer.phone
                ? `tel:${retailer.phone}`
                : undefined
            }
          />

          <InformationRow
            icon={Mail}
            label="Email"
            value={retailer.email}
            href={
              retailer.email
                ? `mailto:${retailer.email}`
                : undefined
            }
          />
        </div>
      </section>

      <section className="retailer-detail-card">
        <div className="retailer-detail-card-heading">
          <div>
            <MapPin size={19} />
          </div>

          <span>
            <strong>Business address</strong>
            <small>
              Shop location and delivery information
            </small>
          </span>
        </div>

        <div className="retailer-address-block">
          <strong>{retailer.location || "No location"}</strong>
          <p>
            {retailer.address ||
              "No business address has been added."}
          </p>
        </div>
      </section>

      <section className="retailer-detail-card">
        <div className="retailer-detail-card-heading">
          <div>
            <CreditCard size={19} />
          </div>

          <span>
            <strong>Commercial settings</strong>
            <small>
              Credit and payment preferences
            </small>
          </span>
        </div>

        <div className="retailer-commercial-grid">
          <div>
            <span>Tax / VAT number</span>
            <strong>
              {retailer.tax_number || "Not provided"}
            </strong>
          </div>

          <div>
            <span>Credit limit</span>
            <strong>
              {formatMoney(retailer.credit_limit)}
            </strong>
          </div>

          <div>
            <span>Payment terms</span>
            <strong>
              {readable(retailer.payment_terms)}
            </strong>
          </div>

          <div>
            <span>Source</span>
            <strong>{readable(retailer.source)}</strong>
          </div>

          <div>
            <span>Connected</span>
            <strong>
              {formatDate(retailer.connected_at)}
            </strong>
          </div>

          <div>
            <span>Account status</span>
            <strong>{readable(retailer.status)}</strong>
          </div>
        </div>
      </section>

      <section className="retailer-detail-card">
        <div className="retailer-detail-card-heading">
          <div>
            <FileText size={19} />
          </div>

          <span>
            <strong>Internal notes</strong>
            <small>
              Sales, delivery, and account remarks
            </small>
          </span>
        </div>

        <div className="retailer-notes-block">
          {retailer.notes ||
            "No internal notes have been added."}
        </div>
      </section>
    </div>
  );
}

function InformationRow({
  icon: Icon,
  label,
  value,
  href,
}) {
  const content = (
    <>
      <Icon size={17} />

      <span>
        <small>{label}</small>
        <strong>{value || "Not provided"}</strong>
      </span>
    </>
  );

  if (href && value) {
    return (
      <a
        className="retailer-information-row"
        href={href}
      >
        {content}
      </a>
    );
  }

  return (
    <div className="retailer-information-row">
      {content}
    </div>
  );
}

function OrdersTab({ rows, loading, navigate }) {
  if (loading) {
    return <TabLoader label="Loading orders..." />;
  }

  if (!rows.length) {
    return (
      <TabEmpty
        title="No orders yet"
        text="Orders created for this retailer will appear here."
      />
    );
  }

  return (
    <div className="retailer-record-list">
      {rows.map((order) => (
        <button
          type="button"
          className="retailer-record-row"
          key={order.id}
          onClick={() =>
            navigate(`/wholesaler/orders/${order.id}`)
          }
        >
          <div className="retailer-record-leading">
            <div className="retailer-record-icon">
              <ShoppingCart size={18} />
            </div>

            <span>
              <small>Order</small>
              <strong>
                {order.order_no || `ORD-${order.id}`}
              </strong>
            </span>
          </div>

          <div>
            <small>Created</small>
            <strong>
              {formatDate(order.created_at)}
            </strong>
          </div>

          <div>
            <small>Required date</small>
            <strong>
              {formatDate(order.required_date)}
            </strong>
          </div>

          <div>
            <small>Total</small>
            <strong>
              {formatMoney(order.total_amount)}
            </strong>
          </div>

          <Badge tone={statusTone(order.status)}>
            {order.status || "pending"}
          </Badge>

          <ChevronRight size={18} />
        </button>
      ))}
    </div>
  );
}

function InvoicesTab({ rows, loading, navigate }) {
  if (loading) {
    return <TabLoader label="Loading invoices..." />;
  }

  if (!rows.length) {
    return (
      <TabEmpty
        title="No invoices yet"
        text="Invoices generated for this retailer will appear here."
      />
    );
  }

  return (
    <div className="retailer-record-list">
      {rows.map((invoice) => (
        <button
          type="button"
          className="retailer-record-row"
          key={invoice.id}
          onClick={() =>
            navigate(`/wholesaler/invoices/${invoice.id}`)
          }
        >
          <div className="retailer-record-leading">
            <div className="retailer-record-icon">
              <ReceiptText size={18} />
            </div>

            <span>
              <small>Invoice</small>
              <strong>
                {invoice.invoice_no ||
                  `INV-${invoice.id}`}
              </strong>
            </span>
          </div>

          <div>
            <small>Order</small>
            <strong>{invoice.order_no || "—"}</strong>
          </div>

          <div>
            <small>Due date</small>
            <strong>
              {formatDate(invoice.due_date)}
            </strong>
          </div>

          <div>
            <small>Outstanding</small>
            <strong>
              {formatMoney(
                getInvoiceOutstanding(invoice)
              )}
            </strong>
          </div>

          <Badge tone={statusTone(invoice.status)}>
            {invoice.status || "pending"}
          </Badge>

          <ChevronRight size={18} />
        </button>
      ))}
    </div>
  );
}

function PaymentsTab({ rows, loading }) {
  if (loading) {
    return <TabLoader label="Loading payments..." />;
  }

  if (!rows.length) {
    return (
      <TabEmpty
        title="No payments yet"
        text="Recorded retailer payments will appear here."
      />
    );
  }

  return (
    <div className="retailer-record-list">
      {rows.map((payment) => (
        <article
          className="retailer-record-row"
          key={payment.id}
        >
          <div className="retailer-record-leading">
            <div className="retailer-record-icon">
              <Wallet size={18} />
            </div>

            <span>
              <small>Payment</small>
              <strong>
                {payment.payment_no ||
                  `PAY-${payment.id}`}
              </strong>
            </span>
          </div>

          <div>
            <small>Invoice</small>
            <strong>{payment.invoice_no || "—"}</strong>
          </div>

          <div>
            <small>Method</small>
            <strong>{readable(payment.method)}</strong>
          </div>

          <div>
            <small>Amount</small>
            <strong>
              {formatMoney(payment.amount)}
            </strong>
          </div>

          <Badge tone={statusTone(payment.status)}>
            {payment.status || "completed"}
          </Badge>

          <CheckCircle2 size={18} />
        </article>
      ))}
    </div>
  );
}

function TabLoader({ label }) {
  return (
    <div className="retailer-tab-loader">
      <LoaderCircle
        size={24}
        className="retailer-detail-spin"
      />
      <span>{label}</span>
    </div>
  );
}

function TabEmpty({ title, text }) {
  return (
    <div className="retailer-tab-empty">
      <Empty />
      <h3>{title}</h3>
      <p>{text}</p>
    </div>
  );
}
