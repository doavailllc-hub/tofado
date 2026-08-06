import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft, Banknote, Building2, CalendarDays, CheckCircle2,
  CreditCard, FileText, Hash, Mail, MapPin, Phone,
  Printer, RefreshCw, Store, UserRound, Wallet
} from "lucide-react";
import api from "../services/api";
import { Badge, Spinner, statusTone } from "../components/UI";
import "./PaymentManagement.css";

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
    hour: "2-digit", minute: "2-digit",
  }).format(parsed);
};

const readable = (value = "") =>
  String(value).replaceAll("_", " ").replace(/\b\w/g, c => c.toUpperCase());

export default function PaymentDetails() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [payment, setPayment] = useState(null);
  const [invoice, setInvoice] = useState({});
  const [merchant, setMerchant] = useState({});
  const [retailer, setRetailer] = useState({});
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async (refresh = false) => {
    try {
      if (refresh) setRefreshing(true);
      setError("");
      const { data } = await api.get(`/wholesaler/payments/${id}`);
      setPayment(data?.payment || data || null);
      setInvoice(data?.invoice || {});
      setMerchant(data?.merchant || data?.wholesaler || {});
      setRetailer(data?.retailer || {});
    } catch (err) {
      setError(err.response?.data?.message || "Unable to load payment details.");
    } finally {
      setRefreshing(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const remaining = useMemo(() => Math.max(
    Number(invoice.total_amount || 0) - Number(invoice.paid_amount || 0),
    0
  ), [invoice]);

  if (!payment && !error) return <Spinner />;

  return (
    <div className="payment-details-page">
      <header className="payment-details-screen-header no-print">
        <button className="payment-back-button" onClick={() => navigate("/wholesaler/payments")}>
          <ArrowLeft size={18}/> Payments
        </button>
        <div className="payment-header-actions">
          <button className="payment-secondary-button" onClick={() => load(true)} disabled={refreshing}>
            <RefreshCw size={17} className={refreshing ? "payment-spin" : ""}/> Refresh
          </button>
          <button className="payment-primary-button" onClick={() => window.print()}>
            <Printer size={17}/> Print receipt
          </button>
        </div>
      </header>

      {error && <div className="payment-alert error no-print">{error}</div>}

      {payment && (
        <main className="payment-receipt">
          <section className="payment-receipt-header">
            <div className="payment-receipt-brand">
              <div className="payment-receipt-logo">
                {merchant.logo_url ? <img src={merchant.logo_url} alt="Merchant logo"/> : <Store size={28}/>}
              </div>
              <div><h1>{merchant.business_name || "Tofado Merchant"}</h1><p>Official payment receipt</p></div>
            </div>

            <div className="payment-receipt-title">
              <span>Payment receipt</span>
              <h2>{payment.payment_no || `PAY-${payment.id}`}</h2>
              <Badge tone={statusTone(payment.status)}>{readable(payment.status)}</Badge>
            </div>
          </section>

          <section className="payment-receipt-highlight">
            <span>Amount received</span>
            <strong>{money(payment.amount)}</strong>
            <small>{readable(payment.method)}</small>
          </section>

          <section className="payment-receipt-grid">
            <ReceiptCard title="Received by" subtitle="Wholesaler information" icon={Building2}>
              <Info icon={Store} label="Business" value={merchant.business_name}/>
              <Info icon={UserRound} label="Contact" value={merchant.name}/>
              <Info icon={Phone} label="Phone" value={merchant.phone}/>
              <Info icon={Mail} label="Email" value={merchant.email}/>
            </ReceiptCard>

            <ReceiptCard title="Received from" subtitle="Retailer information" icon={Store}>
              <Info icon={Building2} label="Business" value={retailer.business_name}/>
              <Info icon={UserRound} label="Contact" value={retailer.name}/>
              <Info icon={Phone} label="Phone" value={retailer.phone}/>
              <Info icon={MapPin} label="Location" value={retailer.location}/>
            </ReceiptCard>

            <ReceiptCard title="Payment information" subtitle="Transaction details" icon={CreditCard}>
              <Info icon={Wallet} label="Method" value={readable(payment.method)}/>
              <Info icon={Hash} label="Reference" value={payment.reference_no}/>
              <Info icon={CalendarDays} label="Paid date" value={date(payment.paid_at || payment.created_at)}/>
              <Info icon={CheckCircle2} label="Status" value={readable(payment.status)}/>
            </ReceiptCard>

            <ReceiptCard title="Invoice information" subtitle="Applied invoice and balance" icon={FileText}>
              <Info icon={FileText} label="Invoice" value={invoice.invoice_no || payment.invoice_no || payment.invoice_id}/>
              <Info icon={Wallet} label="Invoice total" value={money(invoice.total_amount)}/>
              <Info icon={CheckCircle2} label="Total paid" value={money(invoice.paid_amount)}/>
              <Info icon={Banknote} label="Balance remaining" value={money(remaining)}/>
            </ReceiptCard>
          </section>

          <footer className="payment-receipt-footer">
            <div><strong>Payment received successfully.</strong><p>This receipt was generated by Tofado Merchant.</p></div>
            <div><span>Receipt: {payment.payment_no || `PAY-${payment.id}`}</span><span>Date: {date(payment.paid_at || payment.created_at)}</span></div>
          </footer>
        </main>
      )}
    </div>
  );
}

function ReceiptCard({ title, subtitle, icon: Icon, children }) {
  return (
    <article className="payment-receipt-card">
      <div className="payment-section-heading compact">
        <div><Icon size={19}/></div>
        <span><strong>{title}</strong><small>{subtitle}</small></span>
      </div>
      {children}
    </article>
  );
}

function Info({ icon: Icon, label, value }) {
  return (
    <div className="payment-receipt-info">
      <Icon size={16}/>
      <span><small>{label}</small><strong>{value || "—"}</strong></span>
    </div>
  );
}
