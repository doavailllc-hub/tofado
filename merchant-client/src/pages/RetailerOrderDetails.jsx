import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Building2,
  CalendarDays,
  CheckCircle2,
  Clock3,
  FileText,
  MapPin,
  PackageCheck,
  Phone,
  RefreshCw,
  ReceiptText,
  ShoppingCart,
  Store,
  Truck,
  Wallet,
} from "lucide-react";

import api from "../services/api";
import { Badge, Spinner, statusTone } from "../components/UI";
import "./Retailer.css";

const steps = [
  { id: "pending", label: "Sent", icon: ShoppingCart },
  { id: "confirmed", label: "Confirmed", icon: CheckCircle2 },
  { id: "packed", label: "Packed", icon: PackageCheck },
  { id: "dispatched", label: "Dispatched", icon: Truck },
  { id: "delivered", label: "Delivered", icon: CheckCircle2 },
];

const rank = {
  pending: 0,
  confirmed: 1,
  packed: 2,
  ready: 2,
  dispatched: 3,
  out_for_delivery: 3,
  delivered: 4,
};

function money(value) {
  return `INR ${Number(value || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function date(value) {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return String(value);

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(parsed);
}

function readable(value) {
  if (!value) return "—";
  return String(value)
    .replaceAll("_", " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

export default function RetailerOrderDetails() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [order, setOrder] = useState(null);
  const [items, setItems] = useState([]);
  const [invoice, setInvoice] = useState(null);
  const [delivery, setDelivery] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async (showRefresh = false) => {
    try {
      showRefresh ? setRefreshing(true) : setLoading(true);
      setError("");

      const { data } = await api.get(`/retailer/orders/${id}`);

      setOrder(data?.order || data || null);
      setItems(Array.isArray(data?.items) ? data.items : []);
      setInvoice(data?.invoice || null);
      setDelivery(data?.delivery || null);
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          "Unable to load order details."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const orderStatus = String(order?.status || "pending").toLowerCase();

  const progressRank = useMemo(() => {
    if (delivery?.status && rank[delivery.status] !== undefined) {
      return rank[delivery.status];
    }

    return rank[orderStatus] ?? 0;
  }, [delivery, orderStatus]);

  const awaitingQuote =
    Number(order?.total_amount || 0) <= 0 &&
    ["pending", "confirmed"].includes(orderStatus);

  if (loading) return <Spinner />;

  return (
    <div className="retailer-order-details-page">
      <header className="retailer-order-detail-header">
        <button
          type="button"
          className="retailer-order-back"
          onClick={() => navigate("/retailer/orders")}
        >
          <ArrowLeft size={17} />
          My orders
        </button>

        <div className="retailer-order-heading-row">
          <div className="retailer-order-heading-copy">
            <span>Retail purchase order</span>
            <div>
              <h1>{order?.order_no || `Order ${id}`}</h1>
              <Badge tone={statusTone(orderStatus)}>
                {readable(orderStatus)}
              </Badge>
            </div>
            <p>
              {order?.wholesaler_name || order?.wholesaler_business_name || "Wholesale dealer"}
            </p>
          </div>

          <button
            type="button"
            className="retailer-order-refresh"
            disabled={refreshing}
            onClick={() => load(true)}
          >
            <RefreshCw
              size={16}
              className={refreshing ? "retailer-detail-spin" : ""}
            />
            Refresh
          </button>
        </div>
      </header>

      {error && (
        <div className="retailer-details-alert">{error}</div>
      )}

      {order && (
        <>
          <section className="retailer-order-summary-grid">
            <SummaryCard
              icon={Store}
              tone="blue"
              label="Wholesale dealer"
              value={
                order.wholesaler_name ||
                order.wholesaler_business_name ||
                "—"
              }
            />
            <SummaryCard
              icon={CalendarDays}
              tone="purple"
              label="Required date"
              value={date(order.required_date)}
            />
            <SummaryCard
              icon={Wallet}
              tone="orange"
              label="Order value"
              value={
                awaitingQuote
                  ? "Awaiting quotation"
                  : money(order.total_amount)
              }
            />
            <SummaryCard
              icon={Truck}
              tone="green"
              label="Delivery"
              value={readable(delivery?.status || "Not created")}
            />
          </section>

          <section className="retailer-order-progress-card">
            <div className="retailer-order-section-title">
              <div><Truck size={19} /></div>
              <span>
                <strong>Order progress</strong>
                <small>Live status from wholesaler confirmation to delivery</small>
              </span>
            </div>

            <div className="retailer-order-stepper">
              {steps.map((step, index) => {
                const Icon = step.icon;
                const complete = progressRank >= index;

                return (
                  <div
                    className={`retailer-order-step ${complete ? "complete" : ""}`}
                    key={step.id}
                  >
                    <div className="retailer-order-step-marker">
                      <Icon size={16} />
                    </div>
                    {index < steps.length - 1 && (
                      <div className="retailer-order-step-line" />
                    )}
                    <span>{step.label}</span>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="retailer-order-main-grid">
            <article className="retailer-order-card retailer-order-products">
              <div className="retailer-order-section-title">
                <div><PackageCheck size={19} /></div>
                <span>
                  <strong>Products</strong>
                  <small>{items.length} item{items.length === 1 ? "" : "s"} in this purchase list</small>
                </span>
              </div>

              {items.length ? (
                <div className="retailer-order-item-list">
                  {items.map((item) => {
                    const itemTotal =
                      item.line_total !== null &&
                      item.line_total !== undefined
                        ? Number(item.line_total)
                        : Number(item.quantity || 0) *
                          Number(item.unit_price || item.price || 0);

                    const noPrice =
                      Number(item.unit_price || item.price || 0) <= 0;

                    return (
                      <div className="retailer-order-item" key={item.id}>
                        <div className="retailer-order-product-icon">
                          <PackageCheck size={17} />
                        </div>
                        <div>
                          <strong>{item.product_name || "Product"}</strong>
                          <small>
                            {item.quantity} {item.unit || "piece"}
                            {item.notes ? ` · ${item.notes}` : ""}
                          </small>
                        </div>
                        <div className="retailer-order-item-price">
                          {noPrice ? (
                            <span>Awaiting quotation</span>
                          ) : (
                            <>
                              <small>
                                {money(item.unit_price || item.price)}
                              </small>
                              <strong>{money(itemTotal)}</strong>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="retailer-order-empty">
                  No products were returned for this order.
                </div>
              )}
            </article>

            <aside className="retailer-order-side-stack">
              <article className="retailer-order-card">
                <div className="retailer-order-section-title compact">
                  <div><Building2 size={18} /></div>
                  <span>
                    <strong>Order information</strong>
                    <small>Purchase and delivery details</small>
                  </span>
                </div>

                <Info icon={Store} label="Wholesaler" value={order.wholesaler_name || order.wholesaler_business_name} />
                <Info icon={CalendarDays} label="Created" value={date(order.created_at)} />
                <Info icon={CalendarDays} label="Required date" value={date(order.required_date)} />
                <Info icon={MapPin} label="Delivery address" value={order.delivery_address} />
                <Info icon={FileText} label="Notes" value={order.notes} />
              </article>

              <article className="retailer-order-card">
                <div className="retailer-order-section-title compact">
                  <div><ReceiptText size={18} /></div>
                  <span>
                    <strong>Invoice & payment</strong>
                    <small>Commercial status for this order</small>
                  </span>
                </div>

                {invoice ? (
                  <>
                    <Info icon={ReceiptText} label="Invoice" value={invoice.invoice_no} />
                    <Info icon={Wallet} label="Total" value={money(invoice.total_amount)} />
                    <Info icon={Wallet} label="Paid" value={money(invoice.paid_amount)} />
                    <Info icon={Clock3} label="Payment status" value={readable(invoice.payment_status || invoice.status)} />
                  </>
                ) : (
                  <div className="retailer-order-soft-message">
                    {awaitingQuote
                      ? "The wholesaler is reviewing pricing. Invoice will appear after confirmation."
                      : "Invoice has not been generated yet."}
                  </div>
                )}
              </article>

              <article className="retailer-order-card">
                <div className="retailer-order-section-title compact">
                  <div><Truck size={18} /></div>
                  <span>
                    <strong>Delivery tracking</strong>
                    <small>Shipment information</small>
                  </span>
                </div>

                {delivery ? (
                  <>
                    <Info icon={Truck} label="Status" value={readable(delivery.status)} />
                    <Info icon={Truck} label="Delivery type" value={readable(delivery.delivery_type)} />
                    <Info icon={Phone} label="Driver phone" value={delivery.driver_phone} />
                    <Info icon={CalendarDays} label="Delivered" value={date(delivery.delivered_at)} />
                  </>
                ) : (
                  <div className="retailer-order-soft-message">
                    Delivery information will appear after the wholesaler prepares the order.
                  </div>
                )}
              </article>
            </aside>
          </section>
        </>
      )}
    </div>
  );
}

function SummaryCard({ icon: Icon, tone, label, value }) {
  return (
    <article className={`retailer-order-summary-card ${tone}`}>
      <div><Icon size={19} /></div>
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

function Info({ icon: Icon, label, value }) {
  return (
    <div className="retailer-order-info">
      <Icon size={15} />
      <span>
        <small>{label}</small>
        <strong>{value || "Not provided"}</strong>
      </span>
    </div>
  );
}