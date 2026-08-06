import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowDownUp, Banknote, CalendarDays, CheckCircle2,
  CircleDollarSign, CreditCard, Filter, Plus,
  RefreshCw, Search, Store, Wallet
} from "lucide-react";
import api from "../services/api";
import { Badge, Empty, Spinner, statusTone } from "../components/UI";
import "./PaymentManagement.css";

const readable = (value = "") =>
  String(value).replaceAll("_", " ").replace(/\b\w/g, c => c.toUpperCase());

const money = value =>
  `SAR ${Number(value || 0).toLocaleString("en-SA", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const date = value => {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return String(value);
  return new Intl.DateTimeFormat("en-SA", {
    day: "2-digit", month: "short", year: "numeric",
  }).format(parsed);
};

const rowsFrom = data =>
  Array.isArray(data) ? data :
  Array.isArray(data?.payments) ? data.payments :
  Array.isArray(data?.rows) ? data.rows : [];

export default function PaymentList() {
  const navigate = useNavigate();
  const [payments, setPayments] = useState(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [method, setMethod] = useState("all");
  const [sort, setSort] = useState("desc");
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async (refresh = false) => {
    try {
      if (refresh) setRefreshing(true);
      setError("");
      const { data } = await api.get("/wholesaler/payments");
      setPayments(rowsFrom(data));
    } catch (err) {
      setPayments([]);
      setError(err.response?.data?.message || "Unable to load payments.");
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return [...(payments || [])]
      .filter(row => {
        const text = [
          row.payment_no, row.invoice_no, row.retailer_name,
          row.business_name, row.reference_no, row.method
        ].join(" ").toLowerCase();

        return (!q || text.includes(q)) &&
          (status === "all" || row.status === status) &&
          (method === "all" || row.method === method);
      })
      .sort((a, b) => {
        const aTime = new Date(a.paid_at || a.created_at || 0).getTime();
        const bTime = new Date(b.paid_at || b.created_at || 0).getTime();
        return sort === "desc" ? bTime - aTime : aTime - bTime;
      });
  }, [payments, search, status, method, sort]);

  const summary = useMemo(() => (payments || []).reduce((acc, row) => {
    acc.total += 1;
    const amount = Number(row.amount || 0);
    if (row.status === "paid") acc.collected += amount;
    if (row.status === "pending") acc.pending += amount;
    if (row.status === "paid") acc.completed += 1;
    return acc;
  }, { total: 0, collected: 0, pending: 0, completed: 0 }), [payments]);

  if (!payments) return <Spinner />;

  return (
    <div className="payment-page">
      <header className="payment-page-header">
        <div>
          <span>Wholesale finance</span>
          <h1>Payments</h1>
          <p>Record collections, review receipts, and track retailer payment activity.</p>
        </div>
        <div className="payment-header-actions">
          <button className="payment-secondary-button" onClick={() => load(true)} disabled={refreshing}>
            <RefreshCw size={17} className={refreshing ? "payment-spin" : ""} /> Refresh
          </button>
          <button className="payment-primary-button" onClick={() => navigate("/wholesaler/payments/new")}>
            <Plus size={17} /> Record payment
          </button>
        </div>
      </header>

      <section className="payment-summary-grid">
        <article><div className="payment-summary-icon blue"><Wallet size={20}/></div><span>Total payments</span><strong>{summary.total}</strong></article>
        <article><div className="payment-summary-icon green"><CheckCircle2 size={20}/></div><span>Collected</span><strong>{money(summary.collected)}</strong></article>
        <article><div className="payment-summary-icon orange"><CircleDollarSign size={20}/></div><span>Pending</span><strong>{money(summary.pending)}</strong></article>
        <article><div className="payment-summary-icon purple"><CreditCard size={20}/></div><span>Completed entries</span><strong>{summary.completed}</strong></article>
      </section>

      <section className="payment-list-panel">
        <div className="payment-toolbar">
          <div className="payment-search"><Search size={18}/><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search payment, invoice, retailer or reference..."/></div>
          <div className="payment-toolbar-actions">
            <div className="payment-select-wrap"><Filter size={16}/><select value={status} onChange={e => setStatus(e.target.value)}><option value="all">All statuses</option><option value="pending">Pending</option><option value="paid">Paid</option><option value="failed">Failed</option></select></div>
            <div className="payment-select-wrap"><CreditCard size={16}/><select value={method} onChange={e => setMethod(e.target.value)}><option value="all">All methods</option><option value="cash">Cash</option><option value="bank_transfer">Bank transfer</option><option value="card">Card</option><option value="credit">Credit</option></select></div>
            <button className="payment-sort-button" onClick={() => setSort(v => v === "desc" ? "asc" : "desc")}><ArrowDownUp size={17}/>{sort === "desc" ? "Newest first" : "Oldest first"}</button>
          </div>
        </div>

        {error && <div className="payment-alert error">{error}</div>}
        <div className="payment-results-info">Showing <strong>{filtered.length}</strong> of <strong>{payments.length}</strong> payments</div>

        {filtered.length ? (
          <div className="payment-card-list">
            {filtered.map(row => {
              const Icon = row.method === "cash" ? Banknote : row.method === "card" ? CreditCard : Wallet;
              return (
                <button className="payment-list-card" key={row.id} onClick={() => navigate(`/wholesaler/payments/${row.id}`)}>
                  <div className="payment-card-main"><div className="payment-card-icon"><Icon size={20}/></div><span><small>Payment</small><strong>{row.payment_no || `PAY-${row.id}`}</strong><em>{readable(row.method)}</em></span></div>
                  <div className="payment-card-field"><Store size={15}/><span><small>Retailer</small><strong>{row.retailer_name || row.business_name || "Retailer"}</strong></span></div>
                  <div className="payment-card-field"><Wallet size={15}/><span><small>Invoice</small><strong>{row.invoice_no || row.invoice_id || "—"}</strong></span></div>
                  <div className="payment-card-field"><CalendarDays size={15}/><span><small>Paid date</small><strong>{date(row.paid_at || row.created_at)}</strong></span></div>
                  <div className="payment-card-amount"><small>Amount</small><strong>{money(row.amount)}</strong></div>
                  <Badge tone={statusTone(row.status)}>{readable(row.status || "paid")}</Badge>
                </button>
              );
            })}
          </div>
        ) : <div className="payment-empty"><Empty/><h3>No payments found</h3><p>Recorded retailer payments will appear here.</p></div>}
      </section>
    </div>
  );
}
