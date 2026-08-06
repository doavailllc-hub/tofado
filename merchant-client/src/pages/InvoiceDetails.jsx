import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Building2,
  CalendarDays,
  CheckCircle2,
  CircleDollarSign,
  CreditCard,
  Download,
  FileText,
  LoaderCircle,
  Mail,
  MapPin,
  Phone,
  Printer,
  ReceiptText,
  RefreshCw,
  Send,
  Store,
  UserRound,
  Wallet,
} from "lucide-react";

import api from "../services/api";
import {
  Badge,
  Spinner,
  statusTone,
} from "../components/UI";
import "./InvoiceDetails.css";

const emptyInvoice = {
  id: null,
  invoice_no: "",
  order_id: null,
  order_no: "",
  retailer_id: null,
  wholesaler_id: null,
  subtotal: 0,
  tax_amount: 0,
  total_amount: 0,
  paid_amount: 0,
  due_date: null,
  status: "unpaid",
  created_at: null,
};

const emptyMerchant = {
  business_name: "Tofado Merchant",
  name: "",
  email: "",
  phone: "",
  location: "",
  address: "",
  tax_number: "",
  license_number: "",
  website: "",
  logo_url: "",
};

const emptyRetailer = {
  business_name: "",
  name: "",
  email: "",
  phone: "",
  location: "",
  address: "",
  tax_number: "",
};

function normalizeInvoiceResponse(data) {
  const invoice =
    data?.invoice && typeof data.invoice === "object"
      ? data.invoice
      : data || {};

  return {
    invoice: {
      ...emptyInvoice,
      ...invoice,
    },
    merchant: {
      ...emptyMerchant,
      ...(data?.merchant ||
        data?.wholesaler ||
        invoice?.merchant ||
        invoice?.wholesaler ||
        {}),
    },
    retailer: {
      ...emptyRetailer,
      ...(data?.retailer || invoice?.retailer || {}),
    },
    items: Array.isArray(data?.items)
      ? data.items
      : Array.isArray(invoice?.items)
        ? invoice.items
        : [],
    payments: Array.isArray(data?.payments)
      ? data.payments
      : Array.isArray(invoice?.payments)
        ? invoice.payments
        : [],
  };
}

function formatMoney(value) {
  return `SAR ${Number(value || 0).toLocaleString("en-SA", {
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

function getLineTotal(item) {
  if (item.line_total !== undefined && item.line_total !== null) {
    return Number(item.line_total) || 0;
  }

  return (
    (Number(item.quantity) || 0) *
    (Number(item.unit_price) || 0)
  );
}

export default function InvoiceDetails() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [invoice, setInvoice] = useState(emptyInvoice);
  const [merchant, setMerchant] = useState(emptyMerchant);
  const [retailer, setRetailer] = useState(emptyRetailer);
  const [items, setItems] = useState([]);
  const [payments, setPayments] = useState([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const loadInvoice = useCallback(
    async (showRefresh = false) => {
      try {
        if (showRefresh) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }

        setError("");
        setMessage("");

        const { data } = await api.get(
          `/wholesaler/invoices/${id}`
        );

        const normalized = normalizeInvoiceResponse(data);

        setInvoice(normalized.invoice);
        setMerchant(normalized.merchant);
        setRetailer(normalized.retailer);
        setItems(normalized.items);
        setPayments(normalized.payments);
      } catch (requestError) {
        setError(
          requestError.response?.data?.message ||
            "Unable to load invoice details."
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [id]
  );

  useEffect(() => {
    loadInvoice();
  }, [loadInvoice]);

  const summary = useMemo(() => {
    const subtotalFromItems = items.reduce(
      (sum, item) => sum + getLineTotal(item),
      0
    );

    const subtotal =
      Number(invoice.subtotal) || subtotalFromItems;

    const taxAmount =
      Number(invoice.tax_amount) || 0;

    const totalAmount =
      Number(invoice.total_amount) ||
      subtotal + taxAmount;

    const paidFromPayments = payments.reduce(
      (sum, payment) =>
        sum +
        (String(payment.status || "").toLowerCase() ===
        "failed"
          ? 0
          : Number(payment.amount || 0)),
      0
    );

    const paidAmount =
      Number(invoice.paid_amount) || paidFromPayments;

    return {
      subtotal,
      taxAmount,
      totalAmount,
      paidAmount,
      outstanding: Math.max(
        totalAmount - paidAmount,
        0
      ),
    };
  }, [invoice, items, payments]);

  const printInvoice = () => {
    window.print();
  };

  const sendInvoice = async () => {
    try {
      setSending(true);
      setError("");
      setMessage("");

      await api.post(
        `/wholesaler/invoices/${id}/send`
      );

      setMessage("Invoice sent successfully.");
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          "Unable to send invoice."
      );
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return <Spinner />;
  }

  return (
    <div className="invoice-details-page">
      <header className="invoice-screen-header no-print">
        <button
          type="button"
          className="invoice-back-button"
          onClick={() =>
            navigate("/wholesaler/invoices")
          }
        >
          <ArrowLeft size={18} />
          Invoices
        </button>

        <div className="invoice-screen-actions">
          <button
            type="button"
            className="invoice-secondary-button"
            disabled={refreshing}
            onClick={() => loadInvoice(true)}
          >
            <RefreshCw
              size={17}
              className={
                refreshing ? "invoice-spin" : ""
              }
            />
            Refresh
          </button>

          <button
            type="button"
            className="invoice-secondary-button"
            onClick={sendInvoice}
            disabled={sending}
          >
            {sending ? (
              <LoaderCircle
                size={17}
                className="invoice-spin"
              />
            ) : (
              <Send size={17} />
            )}
            Send
          </button>

          <button
            type="button"
            className="invoice-primary-button"
            onClick={printInvoice}
          >
            <Printer size={17} />
            Print / PDF
          </button>
        </div>
      </header>

      {error && (
        <div className="invoice-alert error no-print">
          {error}
        </div>
      )}

      {message && (
        <div className="invoice-alert success no-print">
          <CheckCircle2 size={17} />
          {message}
        </div>
      )}

      <main className="invoice-document">
        <section className="invoice-document-header">
          <div className="invoice-brand">
            <div className="invoice-logo-wrap">
              {merchant.logo_url ? (
                <img
                  src={merchant.logo_url}
                  alt={`${merchant.business_name} logo`}
                />
              ) : (
                <Store size={30} />
              )}
            </div>

            <div>
              <h1>
                {merchant.business_name ||
                  "Tofado Merchant"}
              </h1>

              <p>
                {merchant.description ||
                  "Wholesale merchant and B2B supplier"}
              </p>
            </div>
          </div>

          <div className="invoice-title-block">
            <div className="invoice-title-kicker">
              <ReceiptText size={15} />
              <span>Tax Invoice</span>
            </div>
            <h2>
              {invoice.invoice_no ||
                `INV-${invoice.id || id}`}
            </h2>

            <div className="invoice-title-status-row">
              <Badge tone={statusTone(invoice.status)}>
                {readable(invoice.status || "unpaid")}
              </Badge>

              <strong>{formatMoney(summary.totalAmount)}</strong>
            </div>
          </div>
        </section>

        <section className="invoice-meta-grid">
          <article className="invoice-party-card">
            <div className="invoice-section-label">
              <Building2 size={17} />
              Seller
            </div>

            <h3>
              {merchant.business_name ||
                "Tofado Merchant"}
            </h3>

            <InvoiceInfoLine
              icon={UserRound}
              value={merchant.name}
            />

            <InvoiceInfoLine
              icon={MapPin}
              value={[
                merchant.address,
                merchant.location,
              ]
                .filter(Boolean)
                .join(", ")}
            />

            <InvoiceInfoLine
              icon={Phone}
              value={merchant.phone}
            />

            <InvoiceInfoLine
              icon={Mail}
              value={merchant.email}
            />

            <div className="invoice-registration-grid">
              <div>
                <span>VAT number</span>
                <strong>
                  {merchant.tax_number || "—"}
                </strong>
              </div>

              <div>
                <span>License number</span>
                <strong>
                  {merchant.license_number || "—"}
                </strong>
              </div>
            </div>
          </article>

          <article className="invoice-party-card">
            <div className="invoice-section-label">
              <Store size={17} />
              Bill to
            </div>

            <h3>
              {retailer.business_name ||
                invoice.retailer_name ||
                "Retailer"}
            </h3>

            <InvoiceInfoLine
              icon={UserRound}
              value={
                retailer.name ||
                invoice.retailer_contact
              }
            />

            <InvoiceInfoLine
              icon={MapPin}
              value={[
                retailer.address,
                retailer.location,
              ]
                .filter(Boolean)
                .join(", ")}
            />

            <InvoiceInfoLine
              icon={Phone}
              value={retailer.phone}
            />

            <InvoiceInfoLine
              icon={Mail}
              value={retailer.email}
            />

            <div className="invoice-registration-grid">
              <div>
                <span>VAT number</span>
                <strong>
                  {retailer.tax_number || "—"}
                </strong>
              </div>

              <div>
                <span>Retailer ID</span>
                <strong>
                  {retailer.id ||
                    invoice.retailer_id ||
                    "—"}
                </strong>
              </div>
            </div>
          </article>

          <article className="invoice-summary-card">
            <div className="invoice-summary-line">
              <span>
                <FileText size={15} />
                Invoice number
              </span>

              <strong>
                {invoice.invoice_no ||
                  `INV-${invoice.id || id}`}
              </strong>
            </div>

            <div className="invoice-summary-line">
              <span>
                <ReceiptText size={15} />
                Order number
              </span>

              <strong>
                {invoice.order_no ||
                  invoice.order_id ||
                  "—"}
              </strong>
            </div>

            <div className="invoice-summary-line">
              <span>
                <CalendarDays size={15} />
                Invoice date
              </span>

              <strong>
                {formatDate(invoice.created_at)}
              </strong>
            </div>

            <div className="invoice-summary-line">
              <span>
                <CalendarDays size={15} />
                Due date
              </span>

              <strong>
                {formatDate(invoice.due_date)}
              </strong>
            </div>
          </article>
        </section>

        <section className="invoice-items-section">
          <div className="invoice-items-heading">
            <div>
              <FileText size={18} />
              <span>
                <strong>Invoice items</strong>
                <small>
                  Products and quantities included in this invoice
                </small>
              </span>
            </div>
          </div>

          <div className="invoice-table-wrap">
            <table className="invoice-items-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Product</th>
                  <th>Quantity</th>
                  <th>Unit</th>
                  <th>Unit price</th>
                  <th>Amount</th>
                </tr>
              </thead>

              <tbody>
                {items.length ? (
                  items.map((item, index) => (
                    <tr key={item.id || index}>
                      <td>{index + 1}</td>

                      <td>
                        <strong>
                          {item.product_name ||
                            item.name ||
                            "Product"}
                        </strong>

                        {item.notes && (
                          <small>{item.notes}</small>
                        )}
                      </td>

                      <td>
                        {Number(
                          item.quantity || 0
                        ).toLocaleString("en-SA")}
                      </td>

                      <td>{item.unit || "—"}</td>

                      <td>
                        {formatMoney(item.unit_price)}
                      </td>

                      <td>
                        {formatMoney(
                          getLineTotal(item)
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td
                      className="invoice-empty-row"
                      colSpan={6}
                    >
                      No invoice items were returned by the API.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="invoice-bottom-grid">
          <div className="invoice-payment-area">
            <article className="invoice-payment-card">
              <div className="invoice-section-label">
                <Wallet size={17} />
                Payment information
              </div>

              <div className="invoice-payment-summary">
                <div>
                  <span>Total paid</span>
                  <strong>
                    {formatMoney(summary.paidAmount)}
                  </strong>
                </div>

                <div>
                  <span>Outstanding</span>
                  <strong>
                    {formatMoney(
                      summary.outstanding
                    )}
                  </strong>
                </div>
              </div>

              {payments.length ? (
                <div className="invoice-payment-list">
                  {payments.map((payment) => (
                    <div
                      key={payment.id}
                      className="invoice-payment-row"
                    >
                      <span>
                        <CreditCard size={15} />

                        <span>
                          <small>
                            {payment.payment_no ||
                              `PAY-${payment.id}`}
                          </small>

                          <strong>
                            {readable(payment.method)}
                          </strong>
                        </span>
                      </span>

                      <span>
                        <small>
                          {formatDate(
                            payment.paid_at ||
                              payment.created_at
                          )}
                        </small>

                        <strong>
                          {formatMoney(
                            payment.amount
                          )}
                        </strong>
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="invoice-no-payments">
                  No payments have been recorded.
                </p>
              )}
            </article>

            <article className="invoice-notes-card">
              <div className="invoice-section-label">
                <CircleDollarSign size={17} />
                Payment terms
              </div>

              <p>
                {invoice.payment_terms ||
                  "Payment is due on or before the due date shown on this invoice."}
              </p>

              {invoice.notes && (
                <>
                  <div className="invoice-notes-separator" />

                  <strong>Notes</strong>
                  <p>{invoice.notes}</p>
                </>
              )}
            </article>
          </div>

          <article className="invoice-totals-card">
            <div className="invoice-total-row">
              <span>Subtotal</span>
              <strong>
                {formatMoney(summary.subtotal)}
              </strong>
            </div>

            <div className="invoice-total-row">
              <span>VAT / Tax</span>
              <strong>
                {formatMoney(summary.taxAmount)}
              </strong>
            </div>

            <div className="invoice-total-row grand">
              <span>Total</span>
              <strong>
                {formatMoney(summary.totalAmount)}
              </strong>
            </div>

            <div className="invoice-total-row paid">
              <span>Paid</span>
              <strong>
                {formatMoney(summary.paidAmount)}
              </strong>
            </div>

            <div className="invoice-total-row balance">
              <span>Balance due</span>
              <strong>
                {formatMoney(summary.outstanding)}
              </strong>
            </div>
          </article>
        </section>

        <footer className="invoice-document-footer">
          <div>
            <strong>
              Thank you for your business.
            </strong>

            <p>
              This invoice was generated by Tofado Merchant.
            </p>
          </div>

          <div>
            {merchant.website && (
              <span>{merchant.website}</span>
            )}

            {merchant.email && (
              <span>{merchant.email}</span>
            )}

            {merchant.phone && (
              <span>{merchant.phone}</span>
            )}
          </div>
        </footer>
      </main>
    </div>
  );
}

function InvoiceInfoLine({ icon: Icon, value }) {
  if (!value) return null;

  return (
    <div className="invoice-info-line">
      <Icon size={15} />
      <span>{value}</span>
    </div>
  );
}