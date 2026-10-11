import { useEffect, useState } from "react";
import { CheckCircle2, Clock3, IndianRupee, Package, Store } from "lucide-react";
import { useParams } from "react-router-dom";
import api from "../services/api";
import "./EnquiryQuote.css";

const money = (value) => `₹${Number(value || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function EnquiryQuote() {
  const { token } = useParams();
  const [quote, setQuote] = useState(null), [address, setAddress] = useState("");
  const [loading, setLoading] = useState(true), [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(""), [order, setOrder] = useState(null);
  useEffect(() => { api.get(`/public/enquiry-quotes/${token}`).then(({ data }) => setQuote(data)).catch((e) => setError(e.response?.data?.message || "Unable to open this price offer.")).finally(() => setLoading(false)); }, [token]);
  const accept = async (event) => { event.preventDefault(); try { setSubmitting(true); setError(""); const { data } = await api.post(`/public/enquiry-quotes/${token}/accept`, { delivery_address: address }); setOrder(data); } catch (e) { setError(e.response?.data?.message || "Unable to accept this offer."); } finally { setSubmitting(false); } };
  if (loading) return <main className="quote-page"><div className="quote-card">Loading price offer…</div></main>;
  if (error && !quote) return <main className="quote-page"><div className="quote-card quote-error">{error}</div></main>;
  if (order) return <main className="quote-page"><div className="quote-card quote-success"><CheckCircle2 size={46}/><h1>Order started</h1><p>Your offer was accepted and order <strong>{order.order_no}</strong> has been sent to the wholesaler.</p><strong>{money(order.total_amount)}</strong></div></main>;
  const unavailable = quote.expired || quote.quote_accepted_at;
  return <main className="quote-page"><article className="quote-card"><header><Store size={24}/><div><span>Price offer from</span><h1>{quote.wholesaler_name}</h1></div></header><section className="quote-product"><Package/><div><span>Product</span><strong>{quote.product_name}</strong><small>{quote.quantity} {quote.unit}</small></div></section><section className="quote-breakdown"><div><span>Unit price</span><strong>{money(quote.quote_unit_price)}</strong></div><div><span>Subtotal</span><strong>{money(quote.subtotal)}</strong></div><div><span>GST ({quote.quote_gst_rate}%)</span><strong>{money(quote.tax_amount)}</strong></div><div><span>Delivery</span><strong>{money(quote.quote_delivery_fee)}</strong></div><div className="grand"><span>Total</span><strong>{money(quote.total_amount)}</strong></div></section>{quote.quote_notes && <p className="quote-notes">{quote.quote_notes}</p>}<p className="quote-valid"><Clock3 size={15}/>Valid until {new Date(quote.quote_valid_until).toLocaleString("en-IN")}</p>{unavailable ? <div className="quote-error">{quote.quote_accepted_at ? "This offer has already been accepted." : "This offer has expired."}</div> : <form onSubmit={accept}><label>Delivery address<textarea required value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Shop name, street, city, state and PIN code" /></label>{error && <div className="quote-error">{error}</div>}<button disabled={submitting} type="submit"><IndianRupee size={18}/>{submitting ? "Creating order…" : "Accept price and start order"}</button></form>}</article></main>;
}
