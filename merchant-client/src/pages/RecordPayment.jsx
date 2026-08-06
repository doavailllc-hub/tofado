import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  ArrowLeft, CalendarDays, CheckCircle2, CreditCard,
  FileText, Hash, LoaderCircle, Save, Store, Wallet
} from "lucide-react";
import api from "../services/api";
import { Spinner } from "../components/UI";
import "./PaymentManagement.css";

const initial = {
  invoice_id: "",
  amount: "",
  method: "bank_transfer",
  reference_no: "",
  status: "paid",
  paid_at: "",
};

const money = value =>
  `SAR ${Number(value || 0).toLocaleString("en-SA", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const rowsFrom = data =>
  Array.isArray(data) ? data :
  Array.isArray(data?.invoices) ? data.invoices :
  Array.isArray(data?.rows) ? data.rows : [];

const balanceOf = invoice =>
  Math.max(
    Number(invoice?.total_amount || 0) -
    Number(invoice?.paid_amount || 0),
    0
  );

export default function RecordPayment() {
  const navigate = useNavigate();
  const [params] = useSearchParams();

  const [form, setForm] = useState(initial);
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const { data } = await api.get("/wholesaler/invoices");
      const rows = rowsFrom(data).filter(row =>
        String(row.status || "").toLowerCase() !== "paid" &&
        balanceOf(row) > 0
      );
      setInvoices(rows);

      const invoice = params.get("invoice");
      if (invoice) {
        const selected = rows.find(row => String(row.id) === String(invoice));
        setForm(current => ({
          ...current,
          invoice_id: invoice,
          amount: selected ? String(balanceOf(selected)) : "",
        }));
      }
    } catch (err) {
      setError(err.response?.data?.message || "Unable to load invoices.");
    } finally {
      setLoading(false);
    }
  }, [params]);

  useEffect(() => { load(); }, [load]);

  const selected = useMemo(
    () => invoices.find(row => String(row.id) === String(form.invoice_id)) || null,
    [invoices, form.invoice_id]
  );

  const outstanding = balanceOf(selected);

  const change = (field, value) => {
    setError("");
    setSuccess("");
    setForm(current => ({ ...current, [field]: value }));
  };

  const selectInvoice = value => {
    const invoice = invoices.find(row => String(row.id) === String(value));
    setForm(current => ({
      ...current,
      invoice_id: value,
      amount: invoice ? String(balanceOf(invoice)) : "",
    }));
  };

  const submit = async event => {
    event.preventDefault();
    const amount = Number(form.amount || 0);

    if (!selected) return setError("Select an invoice.");
    if (amount <= 0) return setError("Enter a valid amount.");
    if (amount > outstanding) {
      return setError(`Payment cannot exceed ${money(outstanding)}.`);
    }

    try {
      setSaving(true);
      const { data } = await api.post("/wholesaler/payments", {
        invoice_id: Number(form.invoice_id),
        amount,
        method: form.method,
        reference_no: form.reference_no.trim() || null,
        status: form.status,
        paid_at: form.paid_at || null,
      });

      setSuccess("Payment recorded successfully.");
      const id = data?.payment?.id || data?.id;

      window.setTimeout(() => {
        navigate(id ? `/wholesaler/payments/${id}` : "/wholesaler/payments", {
          replace: true,
        });
      }, 600);
    } catch (err) {
      setError(err.response?.data?.message || "Unable to record payment.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Spinner />;

  return (
    <div className="payment-form-page">
      <header className="payment-form-header">
        <button className="payment-back-button" onClick={() => navigate("/wholesaler/payments")}>
          <ArrowLeft size={18}/> Payments
        </button>
        <div><span>Collections</span><h1>Record payment</h1><p>Apply a retailer payment to an unpaid or partially paid invoice.</p></div>
      </header>

      <form className="payment-form-layout" onSubmit={submit}>
        <section className="payment-form-card">
          <div className="payment-section-heading"><div><FileText size={20}/></div><span><strong>Select invoice</strong><small>Choose the invoice receiving this payment.</small></span></div>

          <label className="payment-field">
            <span>Invoice *</span>
            <select value={form.invoice_id} onChange={e => selectInvoice(e.target.value)} required>
              <option value="">Select unpaid invoice</option>
              {invoices.map(invoice => (
                <option key={invoice.id} value={invoice.id}>
                  {invoice.invoice_no} — {invoice.retailer_name || invoice.business_name || "Retailer"} — {money(balanceOf(invoice))}
                </option>
              ))}
            </select>
          </label>

          {selected && (
            <div className="selected-invoice-card">
              <div><Store size={17}/><span><small>Retailer</small><strong>{selected.retailer_name || selected.business_name || "Retailer"}</strong></span></div>
              <div><FileText size={17}/><span><small>Invoice</small><strong>{selected.invoice_no}</strong></span></div>
              <div><Wallet size={17}/><span><small>Total</small><strong>{money(selected.total_amount)}</strong></span></div>
              <div><CheckCircle2 size={17}/><span><small>Already paid</small><strong>{money(selected.paid_amount)}</strong></span></div>
              <div className="selected-invoice-balance"><span>Outstanding balance</span><strong>{money(outstanding)}</strong></div>
            </div>
          )}
        </section>

        <section className="payment-form-card">
          <div className="payment-section-heading"><div><CreditCard size={20}/></div><span><strong>Payment details</strong><small>Enter amount, method, reference, and date.</small></span></div>

          <div className="payment-form-grid">
            <label className="payment-field">
              <span>Payment amount *</span>
              <div className="payment-money-input"><span>SAR</span><input type="number" min="0.01" max={outstanding || undefined} step="0.01" value={form.amount} onChange={e => change("amount", e.target.value)} required/></div>
            </label>

            <label className="payment-field">
              <span>Payment method *</span>
              <select value={form.method} onChange={e => change("method", e.target.value)}>
                <option value="cash">Cash</option>
                <option value="bank_transfer">Bank transfer</option>
                <option value="card">Card</option>
                <option value="credit">Credit</option>
              </select>
            </label>

            <label className="payment-field">
              <span>Reference number</span>
              <div className="payment-input-icon"><Hash size={17}/><input value={form.reference_no} placeholder="Bank or receipt reference" onChange={e => change("reference_no", e.target.value)}/></div>
            </label>

            <label className="payment-field">
              <span>Payment date</span>
              <div className="payment-input-icon"><CalendarDays size={17}/><input type="datetime-local" value={form.paid_at} onChange={e => change("paid_at", e.target.value)}/></div>
            </label>

            <label className="payment-field full">
              <span>Status</span>
              <select value={form.status} onChange={e => change("status", e.target.value)}>
                <option value="paid">Paid</option>
                <option value="pending">Pending</option>
                <option value="failed">Failed</option>
              </select>
            </label>
          </div>
        </section>

        {error && <div className="payment-alert error">{error}</div>}
        {success && <div className="payment-alert success"><CheckCircle2 size={17}/>{success}</div>}

        <footer className="payment-form-footer">
          <button type="button" className="payment-cancel-button" onClick={() => navigate("/wholesaler/payments")}>Cancel</button>
          <button type="submit" className="payment-save-button" disabled={saving || !selected}>
            {saving ? <><LoaderCircle size={18} className="payment-spin"/>Recording...</> : <><Save size={18}/>Record payment</>}
          </button>
        </footer>
      </form>
    </div>
  );
}
