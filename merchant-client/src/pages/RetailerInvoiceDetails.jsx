import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Building2,
  CalendarDays,
  CheckCircle2,
  Clock3,
  CreditCard,
  Download,
  FileText,
  MapPin,
  Package,
  Printer,
  ReceiptText,
  RefreshCw,
  Send,
  Store,
  Wallet,
} from "lucide-react";

import api from "../services/api";
import { useAuth } from "../context/AuthContext";
import InvoiceTemplatePicker from "../components/InvoiceTemplatePicker";
import { getInvoiceColor, getInvoiceTemplate, saveInvoiceColor, saveInvoiceTemplate } from "../services/invoicePreferences";
import "./InvoiceDetails.css";
import "./Retailer.css";

const money = (value) =>
  `INR ${Number(value || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const date = (value, includeTime = false) => {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    ...(includeTime
      ? { hour: "2-digit", minute: "2-digit" }
      : {}),
  }).format(parsed);
};

const title = (value) =>
  String(value || "pending")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());

export default function RetailerInvoiceDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [templateId, setTemplateId] = useState(() => getInvoiceTemplate(user?.id));
  const [invoiceColor, setInvoiceColor] = useState(() => getInvoiceColor(user?.id));

  const [payload, setPayload] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const paymentRequestKey = useRef(null);

  const [payment, setPayment] = useState({
    amount: "",
    method: "bank_transfer",
    reference_no: "",
  });

  const load = useCallback(
    async (refresh = false) => {
      try {
        refresh ? setRefreshing(true) : setLoading(true);
        setError("");

        const { data } = await api.get(
          `/retailer/invoices/${id}`
        );

        setPayload(data);

        const outstanding = Number(
          data?.invoice?.outstanding_amount || 0
        );

        setPayment((current) => ({
          ...current,
          amount:
            current.amount ||
            (outstanding > 0
              ? outstanding.toFixed(2)
              : ""),
        }));
      } catch (requestError) {
        setError(
          requestError.response?.data?.message ||
            "Unable to load this invoice."
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [id]
  );

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setTemplateId(getInvoiceTemplate(user?.id));
    setInvoiceColor(getInvoiceColor(user?.id));
  }, [user?.id]);

  const chooseTemplate = (nextTemplate) => {
    setTemplateId(saveInvoiceTemplate(user?.id, nextTemplate));
  };
  const chooseColor = (color) => setInvoiceColor(saveInvoiceColor(user?.id, color));

  const invoice = payload?.invoice;
  const items = Array.isArray(payload?.items)
    ? payload.items
    : [];
  const payments = Array.isArray(payload?.payments)
    ? payload.payments
    : [];

  const paymentStatus =
    invoice?.calculated_payment_status ||
    invoice?.payment_status ||
    "pending";

  const totals = useMemo(() => {
    const subtotal = Number(invoice?.subtotal || 0);
    const tax = Number(invoice?.tax_amount || 0);
    const total = Number(invoice?.total_amount || 0);
    const paid = Number(invoice?.paid_amount || 0);
    const pending = Number(
      invoice?.pending_payment_amount || 0
    );
    const outstanding = Number(
      invoice?.outstanding_amount || 0
    );

    return {
      subtotal,
      tax,
      total,
      paid,
      pending,
      outstanding,
    };
  }, [invoice]);

  const submitPayment = async (event) => {
    event.preventDefault();

    try {
      setSubmitting(true);
      setError("");
      setNotice("");

      const amount = Number(payment.amount);

      if (!Number.isFinite(amount) || amount <= 0) {
        setError("Enter a valid payment amount.");
        return;
      }

      paymentRequestKey.current ||= `web:${crypto.randomUUID()}`;
      const { data } = await api.post(
        `/retailer/invoices/${id}/payments`,
        {
          amount,
          method: payment.method,
          reference_no:
            payment.reference_no.trim() || null,
        },
        { headers: { "Idempotency-Key": paymentRequestKey.current } }
      );

      paymentRequestKey.current = null;

      setNotice(
        data?.message ||
          "Payment submitted for verification."
      );

      setPayment((current) => ({
        ...current,
        amount: "",
        reference_no: "",
      }));

      await load(true);
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          "Unable to submit payment."
      );
    } finally {
      setSubmitting(false);
    }
  };

  const printInvoice = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="retailer-invoice-state">
        <RefreshCw className="retailer-detail-spin" size={28} />
        <p>Loading invoice...</p>
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="retailer-invoice-state">
        <FileText size={32} />
        <h2>Unable to load this invoice.</h2>
        <p>{error || "Invoice not found."}</p>
        <button
          type="button"
          onClick={() => navigate("/retailer/invoices")}
        >
          Back to invoices
        </button>
      </div>
    );
  }

  const canPay =
    invoice.status !== "cancelled" &&
    totals.outstanding > 0;

  return (
    <div className="retailer-invoice-page">
      <header className="retailer-invoice-header no-print">
        <div>
          <button
            type="button"
            className="retailer-invoice-back"
            onClick={() => navigate("/retailer/invoices")}
          >
            <ArrowLeft size={16} />
            Invoices
          </button>

          <span>Retail finance</span>
          <h1>{invoice.invoice_no}</h1>
          <p>
            Purchase invoice from {invoice.wholesaler_name}.
          </p>
        </div>

        <div className="retailer-invoice-header-actions">
          <button
            type="button"
            className="retailer-invoice-secondary"
            disabled={refreshing}
            onClick={() => load(true)}
          >
            <RefreshCw
              size={16}
              className={refreshing ? "retailer-detail-spin" : ""}
            />
            Refresh
          </button>

          <button
            type="button"
            className="retailer-invoice-secondary"
            onClick={printInvoice}
          >
            <Printer size={16} />
            Print
          </button>

          <button
            type="button"
            className="retailer-invoice-primary"
            onClick={printInvoice}
            title="Use Save as PDF in the print dialog"
          >
            <Download size={16} />
            Save PDF
          </button>
        </div>
      </header>

      {error && (
        <div className="retailer-details-alert no-print">
          {error}
        </div>
      )}

      {notice && (
        <div className="retailer-form-alert success no-print">
          {notice}
        </div>
      )}

      <InvoiceTemplatePicker value={templateId} onChange={chooseTemplate} color={invoiceColor} onColorChange={chooseColor} />

      <section className={`retailer-invoice-document invoice-template-${templateId}`} style={{ "--invoice-accent-custom": invoiceColor }}>
        <div className="retailer-invoice-document-head">
          <div className="retailer-invoice-brand">
            <div>
              {invoice.wholesaler_logo_url ? (
                <img src={invoice.wholesaler_logo_url} alt="" />
              ) : (
                <Store size={24} />
              )}
            </div>

            <section>
              <span>Issued by</span>
              <strong>{invoice.wholesaler_name}</strong>
              <p>
                {invoice.wholesaler_address ||
                  invoice.wholesaler_location ||
                  "Wholesale business"}
              </p>
            </section>
          </div>

          <div className="retailer-invoice-status-block">
            <span className={`invoice-payment-status ${paymentStatus}`}>
              {title(paymentStatus)}
            </span>
            <small>Invoice {title(invoice.status)}</small>
          </div>
        </div>

        <div className="retailer-invoice-meta-grid">
          <article>
            <ReceiptText size={18} />
            <div>
              <span>Invoice number</span>
              <strong>{invoice.invoice_no}</strong>
            </div>
          </article>

          <article>
            <Package size={18} />
            <div>
              <span>Purchase order</span>
              <strong>{invoice.order_no}</strong>
            </div>
          </article>

          <article>
            <CalendarDays size={18} />
            <div>
              <span>Invoice date</span>
              <strong>{date(invoice.created_at)}</strong>
            </div>
          </article>

          <article>
            <Clock3 size={18} />
            <div>
              <span>Payment due</span>
              <strong>{date(invoice.payment_due_date)}</strong>
            </div>
          </article>
        </div>

        <div className="retailer-invoice-parties">
          <article>
            <span>Bill to</span>
            <strong>
              {invoice.business_name ||
                invoice.customer_name ||
                "Retail customer"}
            </strong>
            <p>{invoice.customer_name}</p>
            <p>{invoice.email || "—"}</p>
            <p>{invoice.phone || "—"}</p>
          </article>

          <article>
            <span>Deliver to</span>
            <strong>
              {invoice.delivery_address || "Delivery address"}
            </strong>
            <p>
              Required date: {date(invoice.required_date)}
            </p>
          </article>

          <article>
            <span>Payment terms</span>
            <strong>{title(invoice.payment_type)}</strong>
            <p>
              Status: {title(paymentStatus)}
            </p>
          </article>
        </div>

        <div className="retailer-invoice-items">
          <div className="retailer-invoice-items-header">
            <span>Item</span>
            <span>Qty</span>
            <span>Unit price</span>
            <span>Total</span>
          </div>

          {items.map((item) => (
            <div
              className="retailer-invoice-item-row"
              key={item.id}
            >
              <div>
                <strong>{item.product_name}</strong>
                <small>{item.notes || item.unit || "—"}</small>
              </div>

              <span>
                {Number(item.quantity || 0).toLocaleString(
                  "en-IN"
                )}{" "}
                {item.unit || ""}
              </span>

              <span>{money(item.unit_price)}</span>
              <strong>{money(item.line_total)}</strong>
            </div>
          ))}
        </div>

        <div className="retailer-invoice-bottom-grid">
          <div className="retailer-invoice-notes">
            <Building2 size={18} />
            <div>
              <strong>Order information</strong>
              <p>
                {invoice.order_notes ||
                  "No additional purchase-order notes."}
              </p>
            </div>
          </div>

          <div className="retailer-invoice-totals">
            <div>
              <span>Subtotal</span>
              <strong>{money(totals.subtotal)}</strong>
            </div>
            <div>
              <span>Tax</span>
              <strong>{money(totals.tax)}</strong>
            </div>
            <div className="total">
              <span>Invoice total</span>
              <strong>{money(totals.total)}</strong>
            </div>
            <div className="paid">
              <span>Paid</span>
              <strong>{money(totals.paid)}</strong>
            </div>
            {totals.pending > 0 && (
              <div className="pending">
                <span>Awaiting verification</span>
                <strong>{money(totals.pending)}</strong>
              </div>
            )}
            <div className="outstanding">
              <span>Outstanding</span>
              <strong>{money(totals.outstanding)}</strong>
            </div>
          </div>
        </div>
      </section>

      <section className="retailer-invoice-workspace no-print">
        <div className="retailer-invoice-payments-card">
          <div className="retailer-invoice-section-title">
            <Wallet size={19} />
            <div>
              <strong>Payment history</strong>
              <span>
                Verified and pending invoice payments
              </span>
            </div>
          </div>

          {payments.length ? (
            <div className="retailer-invoice-payment-list">
              {payments.map((record) => (
                <article key={record.id}>
                  <div className="payment-history-leading">
                    <div>
                      {record.status === "paid" ? (
                        <CheckCircle2 size={18} />
                      ) : (
                        <Clock3 size={18} />
                      )}
                    </div>

                    <section>
                      <strong>{record.payment_no}</strong>
                      <span>
                        {title(record.method)}
                        {record.reference_no
                          ? ` · ${record.reference_no}`
                          : ""}
                      </span>
                    </section>
                  </div>

                  <div>
                    <strong>{money(record.amount)}</strong>
                    <span>{date(record.paid_at || record.created_at)}</span>
                  </div>

                  <span className={`payment-history-status ${record.status}`}>
                    {title(record.status)}
                  </span>
                </article>
              ))}
            </div>
          ) : (
            <div className="retailer-invoice-payment-empty">
              No payments recorded for this invoice.
            </div>
          )}
        </div>

        <form
          className="retailer-invoice-payment-form"
          onSubmit={submitPayment}
        >
          <div className="retailer-invoice-section-title">
            <CreditCard size={19} />
            <div>
              <strong>Make a payment</strong>
              <span>
                Submit payment information for wholesaler verification
              </span>
            </div>
          </div>

          {canPay ? (
            <>
              <label>
                <span>Payment amount</span>
                <div className="retailer-invoice-money-input">
                  <span>INR</span>
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    max={totals.outstanding}
                    value={payment.amount}
                    onChange={(event) =>
                      setPayment((current) => ({
                        ...current,
                        amount: event.target.value,
                      }))
                    }
                  />
                </div>
              </label>

              <label>
                <span>Payment method</span>
                <select
                  value={payment.method}
                  onChange={(event) =>
                    setPayment((current) => ({
                      ...current,
                      method: event.target.value,
                    }))
                  }
                >
                  <option value="bank_transfer">
                    Bank transfer
                  </option>
                  <option value="upi">UPI</option>
                  <option value="card">Card</option>
                  <option value="cash">Cash</option>
                  <option value="credit">Credit</option>
                </select>
              </label>

              <label>
                <span>
                  Payment reference
                  {["bank_transfer", "upi", "card"].includes(
                    payment.method
                  )
                    ? " *"
                    : ""}
                </span>
                <input
                  type="text"
                  maxLength={120}
                  placeholder="Transaction or receipt reference"
                  value={payment.reference_no}
                  onChange={(event) =>
                    setPayment((current) => ({
                      ...current,
                      reference_no: event.target.value,
                    }))
                  }
                />
              </label>

              <button
                type="submit"
                disabled={submitting}
              >
                <Send size={16} />
                {submitting
                  ? "Submitting..."
                  : "Submit payment"}
              </button>

              <p>
                The payment remains Pending until the
                wholesaler verifies it.
              </p>
            </>
          ) : (
            <div className="retailer-invoice-paid-message">
              <CheckCircle2 size={20} />
              <div>
                <strong>
                  {invoice.status === "cancelled"
                    ? "Invoice cancelled"
                    : "Invoice fully paid"}
                </strong>
                <span>
                  {invoice.status === "cancelled"
                    ? "No payments can be submitted."
                    : "There is no outstanding balance."}
                </span>
              </div>
            </div>
          )}
        </form>
      </section>
    </div>
  );
}
