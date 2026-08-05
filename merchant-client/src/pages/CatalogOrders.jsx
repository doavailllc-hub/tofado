import { useEffect, useMemo, useState } from "react";
import {
  Banknote,
  CheckCircle2,
  ChevronRight,
  Clock3,
  CreditCard,
  FileText,
  MapPin,
  PackageCheck,
  RefreshCw,
  Search,
  ShoppingCart,
  Store,
  Truck,
  UserRound,
  Wallet,
  X,
} from "lucide-react";

import api from "../services/api";
import {
  Badge,
  Empty,
  Spinner,
  statusTone,
} from "../components/UI";
import "./OrdersV3.css";

const statuses = [
  "pending",
  "confirmed",
  "packed",
  "dispatched",
  "delivered",
  "cancelled",
];

const paymentTypes = [
  { value: "online", label: "Online payment" },
  { value: "due", label: "Due payment" },
  { value: "credit", label: "Credit account" },
  { value: "cash_on_delivery", label: "Cash on delivery" },
];

const deliveryTypes = [
  { value: "merchant_delivery", label: "Merchant delivery" },
  { value: "customer_pickup", label: "Collect from store" },
  { value: "third_party", label: "Third-party delivery" },
];

function formatDate(value) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-SA", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function money(value) {
  return Number(value || 0).toLocaleString("en-SA", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function getStatusIndex(status) {
  const index = statuses.indexOf(status);
  return index < 0 ? 0 : index;
}

export default function CatalogOrders() {
  const [orders, setOrders] = useState(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const [selectedOrder, setSelectedOrder] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [workflowLoading, setWorkflowLoading] = useState(false);
  const [workflowError, setWorkflowError] = useState("");

  const [paymentType, setPaymentType] = useState("due");
  const [paymentDueDate, setPaymentDueDate] = useState("");
  const [deliveryType, setDeliveryType] = useState(
    "merchant_delivery"
  );
  const [deliveryNotes, setDeliveryNotes] = useState("");

  const loadOrders = async (showRefresh = false) => {
    try {
      if (showRefresh) setRefreshing(true);
      setError("");

      const response = await api.get(
        "/wholesaler/catalog/orders"
      );

      setOrders(response.data || []);
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          "Unable to load orders."
      );
      setOrders([]);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadOrders();
  }, []);

  const filteredOrders = useMemo(() => {
    if (!orders) return [];

    const value = search.trim().toLowerCase();

    return orders.filter((order) => {
      const searchable = [
        order.order_no,
        order.customer_name,
        order.business_name,
        order.phone,
        order.email,
        order.delivery_address,
        order.invoice_no,
      ];

      const matchesSearch =
        !value ||
        searchable.some((field) =>
          String(field || "")
            .toLowerCase()
            .includes(value)
        );

      const matchesStatus =
        statusFilter === "all" ||
        order.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [orders, search, statusFilter]);

  const summary = useMemo(() => {
    if (!orders) {
      return {
        total: 0,
        active: 0,
        delivered: 0,
        value: 0,
      };
    }

    return orders.reduce(
      (result, order) => {
        result.total += 1;

        if (
          ["pending", "confirmed", "packed", "dispatched"].includes(
            order.status
          )
        ) {
          result.active += 1;
        }

        if (order.status === "delivered") {
          result.delivered += 1;
        }

        result.value += Number(order.total_amount || 0);

        return result;
      },
      {
        total: 0,
        active: 0,
        delivered: 0,
        value: 0,
      }
    );
  }, [orders]);

  const openOrder = async (order) => {
    setSelectedOrder(order);
    setDetailsLoading(true);
    setWorkflowError("");

    try {
      const response = await api.get(
        `/wholesaler/catalog/orders/${order.id}`
      );

      const details = response.data || order;

      setSelectedOrder(details);
      setPaymentType(details.payment_type || "due");
      setPaymentDueDate(
        details.payment_due_date
          ? String(details.payment_due_date).slice(0, 10)
          : ""
      );
      setDeliveryType(
        details.delivery_type || "merchant_delivery"
      );
      setDeliveryNotes(details.delivery_notes || "");
    } catch (requestError) {
      setWorkflowError(
        requestError.response?.data?.message ||
          "Unable to load order details."
      );
    } finally {
      setDetailsLoading(false);
    }
  };

  const closeOrder = () => {
    if (workflowLoading) return;
    setSelectedOrder(null);
    setWorkflowError("");
  };

  const updateLocalOrder = (orderId, changes) => {
    setOrders((current) =>
      current.map((order) =>
        order.id === orderId
          ? { ...order, ...changes }
          : order
      )
    );

    setSelectedOrder((current) =>
      current?.id === orderId
        ? { ...current, ...changes }
        : current
    );
  };

  const confirmAndGenerateInvoice = async () => {
    if (!selectedOrder) return;

    try {
      setWorkflowLoading(true);
      setWorkflowError("");

      const response = await api.post(
        `/wholesaler/catalog/orders/${selectedOrder.id}/confirm`,
        {
          payment_type: paymentType,
          payment_due_date:
            paymentType === "due" ||
            paymentType === "credit"
              ? paymentDueDate || null
              : null,
        }
      );

      const result = response.data || {};

      updateLocalOrder(selectedOrder.id, {
        status: "confirmed",
        invoice_id: result.invoice_id,
        invoice_no: result.invoice_no,
        payment_type: paymentType,
        payment_status:
          result.payment_status || "pending",
        payment_due_date: paymentDueDate || null,
      });
    } catch (requestError) {
      setWorkflowError(
        requestError.response?.data?.message ||
          "Unable to confirm the order."
      );
    } finally {
      setWorkflowLoading(false);
    }
  };

  const savePaymentTerms = async () => {
    if (!selectedOrder) return;

    try {
      setWorkflowLoading(true);
      setWorkflowError("");

      await api.patch(
        `/wholesaler/catalog/orders/${selectedOrder.id}/payment`,
        {
          payment_type: paymentType,
          payment_due_date:
            paymentType === "due" ||
            paymentType === "credit"
              ? paymentDueDate || null
              : null,
        }
      );

      updateLocalOrder(selectedOrder.id, {
        payment_type: paymentType,
        payment_due_date: paymentDueDate || null,
      });
    } catch (requestError) {
      setWorkflowError(
        requestError.response?.data?.message ||
          "Unable to update payment terms."
      );
    } finally {
      setWorkflowLoading(false);
    }
  };

  const markPaymentPaid = async () => {
    if (!selectedOrder) return;

    try {
      setWorkflowLoading(true);
      setWorkflowError("");

      await api.patch(
        `/wholesaler/catalog/orders/${selectedOrder.id}/payment-status`,
        {
          payment_status: "paid",
        }
      );

      updateLocalOrder(selectedOrder.id, {
        payment_status: "paid",
      });
    } catch (requestError) {
      setWorkflowError(
        requestError.response?.data?.message ||
          "Unable to mark the payment as paid."
      );
    } finally {
      setWorkflowLoading(false);
    }
  };

  const createDelivery = async () => {
    if (!selectedOrder) return;

    try {
      setWorkflowLoading(true);
      setWorkflowError("");

      const response = await api.post(
        `/wholesaler/catalog/orders/${selectedOrder.id}/delivery`,
        {
          delivery_type: deliveryType,
          delivery_notes: deliveryNotes,
        }
      );

      const result = response.data || {};

      updateLocalOrder(selectedOrder.id, {
        status: result.status || "packed",
        delivery_id: result.delivery_id,
        delivery_type: deliveryType,
        delivery_notes: deliveryNotes,
      });
    } catch (requestError) {
      setWorkflowError(
        requestError.response?.data?.message ||
          "Unable to create delivery."
      );
    } finally {
      setWorkflowLoading(false);
    }
  };

  const updateStatus = async (status) => {
    if (!selectedOrder) return;

    try {
      setWorkflowLoading(true);
      setWorkflowError("");

      await api.patch(
        `/wholesaler/catalog/orders/${selectedOrder.id}/status`,
        { status }
      );

      updateLocalOrder(selectedOrder.id, { status });
    } catch (requestError) {
      setWorkflowError(
        requestError.response?.data?.message ||
          "Unable to update order status."
      );
    } finally {
      setWorkflowLoading(false);
    }
  };

  if (!orders) {
    return <Spinner />;
  }

  return (
    <div className="ov3-page">
      <header className="ov3-page-header">
        <div>
          <span>Sales operations</span>
          <h1>Orders</h1>
          <p>
            Review products, generate invoices, manage payment,
            and prepare delivery.
          </p>
        </div>

        <button
          type="button"
          disabled={refreshing}
          onClick={() => loadOrders(true)}
        >
          <RefreshCw
            size={17}
            className={refreshing ? "ov3-spin" : ""}
          />
          Refresh
        </button>
      </header>

      <section className="ov3-stats">
        <article>
          <div className="blue">
            <ShoppingCart size={19} />
          </div>
          <span>Total orders</span>
          <strong>{summary.total}</strong>
        </article>

        <article>
          <div className="orange">
            <Clock3 size={19} />
          </div>
          <span>Active workflow</span>
          <strong>{summary.active}</strong>
        </article>

        <article>
          <div className="green">
            <CheckCircle2 size={19} />
          </div>
          <span>Delivered</span>
          <strong>{summary.delivered}</strong>
        </article>

        <article>
          <div className="purple">
            <Wallet size={19} />
          </div>
          <span>Total value</span>
          <strong>SAR {money(summary.value)}</strong>
        </article>
      </section>

      <section className="ov3-panel">
        <div className="ov3-toolbar">
          <label>
            <Search size={18} />
            <input
              type="search"
              placeholder="Search order, customer, shop, invoice or phone..."
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
            />
          </label>

          <select
            value={statusFilter}
            onChange={(event) =>
              setStatusFilter(event.target.value)
            }
          >
            <option value="all">All statuses</option>
            {statuses.map((status) => (
              <option value={status} key={status}>
                {status}
              </option>
            ))}
          </select>
        </div>

        {error && <div className="ov3-error">{error}</div>}

        {filteredOrders.length ? (
          <div className="ov3-list">
            {filteredOrders.map((order) => (
              <button
                type="button"
                className={`ov3-order-card ov3-${String(
                  order.status || "pending"
                ).toLowerCase()}`}
                key={order.id}
                onClick={() => openOrder(order)}
              >
                <div className="ov3-order-top">
                  <div className="ov3-order-id">
                    <span>
                      <ShoppingCart size={18} />
                    </span>
                    <div>
                      <small>Order</small>
                      <strong>
                        {order.order_no || `CAT-${order.id}`}
                      </strong>
                    </div>
                  </div>

                  <Badge tone={statusTone(order.status)}>
                    {order.status}
                  </Badge>
                </div>

                <div className="ov3-order-main">
                  <div>
                    <small>Customer</small>
                    <strong>
                      {order.customer_name || "—"}
                    </strong>
                    <span>
                      {order.business_name ||
                        "Business not provided"}
                    </span>
                  </div>

                  <div>
                    <small>Required date</small>
                    <strong>
                      {formatDate(order.required_date)}
                    </strong>
                  </div>

                  <div>
                    <small>Items</small>
                    <strong>
                      {order.items_count || 0}
                    </strong>
                  </div>

                  <div className="ov3-order-amount">
                    <small>Total</small>
                    <strong>
                      SAR {money(order.total_amount)}
                    </strong>
                  </div>
                </div>

                <div className="ov3-order-bottom">
                  <span>
                    Created {formatDate(order.created_at)}
                  </span>

                  <span className="ov3-view">
                    View details
                    <ChevronRight size={16} />
                  </span>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="ov3-empty">
            <Empty />
          </div>
        )}
      </section>

      {selectedOrder && (
        <div
          className="ov3-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeOrder();
            }
          }}
        >
          <aside className="ov3-drawer">
            <header className="ov3-drawer-header">
              <div>
                <span>Order details</span>
                <h2>
                  {selectedOrder.order_no ||
                    `CAT-${selectedOrder.id}`}
                </h2>
              </div>

              <button
                type="button"
                onClick={closeOrder}
                aria-label="Close order details"
              >
                <X size={20} />
              </button>
            </header>

            {detailsLoading ? (
              <Spinner />
            ) : (
              <div className="ov3-drawer-body">
                <section className="ov3-customer-grid">
                  <article>
                    <UserRound size={17} />
                    <div>
                      <small>Customer</small>
                      <strong>
                        {selectedOrder.customer_name || "—"}
                      </strong>
                    </div>
                  </article>

                  <article>
                    <Store size={17} />
                    <div>
                      <small>Business</small>
                      <strong>
                        {selectedOrder.business_name ||
                          "Not provided"}
                      </strong>
                    </div>
                  </article>

                  <article>
                    <MapPin size={17} />
                    <div>
                      <small>Delivery address</small>
                      <strong>
                        {selectedOrder.delivery_address || "—"}
                      </strong>
                    </div>
                  </article>

                  <article>
                    <Truck size={17} />
                    <div>
                      <small>Required date</small>
                      <strong>
                        {formatDate(
                          selectedOrder.required_date
                        )}
                      </strong>
                    </div>
                  </article>
                </section>

                <section className="ov3-progress">
                  {[
                    ["pending", "Review"],
                    ["confirmed", "Invoice"],
                    ["packed", "Prepare"],
                    ["dispatched", "Delivery"],
                    ["delivered", "Done"],
                  ].map(([value, label], index) => {
                    const currentIndex = getStatusIndex(
                      selectedOrder.status
                    );
                    const stepIndex = getStatusIndex(value);

                    return (
                      <div
                        className={
                          currentIndex >= stepIndex
                            ? "complete"
                            : ""
                        }
                        key={value}
                      >
                        <span>{index + 1}</span>
                        <small>{label}</small>
                      </div>
                    );
                  })}
                </section>

                <section className="ov3-section">
                  <div className="ov3-section-title">
                    <div>
                      <PackageCheck size={18} />
                      <span>
                        <strong>Products</strong>
                        <small>
                          Review before confirmation
                        </small>
                      </span>
                    </div>

                    <strong>
                      SAR {money(selectedOrder.total_amount)}
                    </strong>
                  </div>

                  <div className="ov3-products">
                    {(selectedOrder.items || []).length ? (
                      selectedOrder.items.map((item) => (
                        <article
                          key={item.id || item.product_id}
                        >
                          <div>
                            {item.image_url ? (
                              <img
                                src={item.image_url}
                                alt={item.product_name}
                              />
                            ) : (
                              <PackageCheck size={20} />
                            )}
                          </div>

                          <span>
                            <strong>{item.product_name}</strong>
                            <small>
                              {item.quantity}{" "}
                              {item.unit || "piece"} ·{" "}
                              {item.sku || "No SKU"}
                            </small>
                          </span>

                          <strong>
                            SAR {money(item.line_total)}
                          </strong>
                        </article>
                      ))
                    ) : (
                      <p>No product details available.</p>
                    )}
                  </div>
                </section>

                <section className="ov3-section">
                  <div className="ov3-section-title">
                    <div>
                      <FileText size={18} />
                      <span>
                        <strong>Invoice</strong>
                        <small>
                          Generated after confirmation
                        </small>
                      </span>
                    </div>

                    {selectedOrder.invoice_no && (
                      <Badge tone="blue">
                        {selectedOrder.invoice_no}
                      </Badge>
                    )}
                  </div>

                  {selectedOrder.status === "pending" ? (
                    <div className="ov3-confirm-box">
                      <p>
                        Confirm this order to generate its invoice.
                      </p>

                      <button
                        type="button"
                        disabled={workflowLoading}
                        onClick={confirmAndGenerateInvoice}
                      >
                        <CheckCircle2 size={17} />
                        Confirm and generate invoice
                      </button>
                    </div>
                  ) : (
                    <div className="ov3-invoice-grid">
                      <span>
                        <small>Invoice</small>
                        <strong>
                          {selectedOrder.invoice_no ||
                            "Generated"}
                        </strong>
                      </span>
                      <span>
                        <small>Amount</small>
                        <strong>
                          SAR{" "}
                          {money(selectedOrder.total_amount)}
                        </strong>
                      </span>
                    </div>
                  )}
                </section>

                <section className="ov3-section">
                  <div className="ov3-section-title">
                    <div>
                      <CreditCard size={18} />
                      <span>
                        <strong>Payment</strong>
                        <small>
                          Set payment terms and status
                        </small>
                      </span>
                    </div>

                    <Badge
                      tone={
                        selectedOrder.payment_status === "paid"
                          ? "green"
                          : "amber"
                      }
                    >
                      {selectedOrder.payment_status ||
                        "pending"}
                    </Badge>
                  </div>

                  <div className="ov3-form-grid">
                    <label>
                      <span>Payment type</span>
                      <select
                        value={paymentType}
                        onChange={(event) =>
                          setPaymentType(
                            event.target.value
                          )
                        }
                      >
                        {paymentTypes.map((option) => (
                          <option
                            value={option.value}
                            key={option.value}
                          >
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>

                    {(paymentType === "due" ||
                      paymentType === "credit") && (
                      <label>
                        <span>Due date</span>
                        <input
                          type="date"
                          value={paymentDueDate}
                          onChange={(event) =>
                            setPaymentDueDate(
                              event.target.value
                            )
                          }
                        />
                      </label>
                    )}
                  </div>

                  <div className="ov3-actions">
                    <button
                      type="button"
                      className="secondary"
                      disabled={workflowLoading}
                      onClick={savePaymentTerms}
                    >
                      Save payment terms
                    </button>

                    {selectedOrder.payment_status !== "paid" && (
                      <button
                        type="button"
                        className="paid"
                        disabled={workflowLoading}
                        onClick={markPaymentPaid}
                      >
                        <Banknote size={16} />
                        Mark paid
                      </button>
                    )}
                  </div>
                </section>

                <section className="ov3-section">
                  <div className="ov3-section-title">
                    <div>
                      <Truck size={18} />
                      <span>
                        <strong>Delivery</strong>
                        <small>
                          Delivery or store collection
                        </small>
                      </span>
                    </div>
                  </div>

                  <div className="ov3-form-grid">
                    <label>
                      <span>Delivery type</span>
                      <select
                        value={deliveryType}
                        onChange={(event) =>
                          setDeliveryType(
                            event.target.value
                          )
                        }
                      >
                        {deliveryTypes.map((option) => (
                          <option
                            value={option.value}
                            key={option.value}
                          >
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="full">
                      <span>Delivery notes</span>
                      <textarea
                        rows="3"
                        placeholder="Driver, vehicle, pickup counter, or instructions"
                        value={deliveryNotes}
                        onChange={(event) =>
                          setDeliveryNotes(
                            event.target.value
                          )
                        }
                      />
                    </label>
                  </div>

                  <button
                    type="button"
                    className="ov3-primary"
                    disabled={
                      workflowLoading ||
                      selectedOrder.status === "pending"
                    }
                    onClick={createDelivery}
                  >
                    <Truck size={17} />
                    Create delivery
                  </button>
                </section>

                {selectedOrder.status !== "pending" && (
                  <section className="ov3-section">
                    <div className="ov3-section-title">
                      <div>
                        <Clock3 size={18} />
                        <span>
                          <strong>Order status</strong>
                          <small>
                            Update fulfilment progress
                          </small>
                        </span>
                      </div>
                    </div>

                    <div className="ov3-status-actions">
                      {statuses
                        .filter(
                          (status) => status !== "pending"
                        )
                        .map((status) => (
                          <button
                            type="button"
                            className={
                              selectedOrder.status === status
                                ? "active"
                                : ""
                            }
                            disabled={workflowLoading}
                            onClick={() =>
                              updateStatus(status)
                            }
                            key={status}
                          >
                            {status}
                          </button>
                        ))}
                    </div>
                  </section>
                )}

                {workflowError && (
                  <div className="ov3-error">
                    {workflowError}
                  </div>
                )}
              </div>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}
