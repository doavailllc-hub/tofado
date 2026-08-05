import {
  BarChart3,
  CheckCircle2,
  Clock3,
  FileText,
  Search,
  ShoppingCart,
  Store,
  Truck,
  Wallet,
} from "lucide-react";
import SectionHeading from "../components/SectionHeading";
import CTA from "../components/CTA";

export default function Retailers() {
  const items = [
    [Search, "Find approved wholesalers", "Browse connected suppliers and their available catalogs."],
    [ShoppingCart, "Create clear purchase orders", "Send product requirements, quantities, notes, and delivery dates."],
    [Clock3, "Track every stage", "See pending, confirmed, packed, dispatched, and delivered orders."],
    [FileText, "Keep invoices organized", "Access invoices and payment information from one workspace."],
    [Wallet, "Understand outstanding balances", "See due amounts and payment progress without spreadsheets."],
    [Truck, "Follow delivery progress", "Know when an order is ready, dispatched, or completed."],
  ];

  return (
    <>
      <section className="page-hero">
        <span>Solution for retailers</span>
        <h1>Purchase smarter from trusted wholesalers.</h1>
        <p>
          Replace calls, paper lists, and scattered WhatsApp messages with one
          clear purchasing workflow.
        </p>
      </section>

      <section className="section">
        <SectionHeading
          eyebrow="Retailer workspace"
          title="Everything your shop needs to buy better"
          text="Plan, submit, and track wholesale purchases with less manual follow-up."
        />

        <div className="feature-grid">
          {items.map(([Icon, title, text]) => (
            <article className="feature-card" key={title}>
              <div><Icon size={22} /></div>
              <h3>{title}</h3>
              <p>{text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="section split-section">
        <div className="split-copy">
          <span>Better visibility</span>
          <h2>Know what was ordered, what is pending, and what is due.</h2>
          <p>
            Retailers can see every order, invoice, and delivery without checking
            multiple systems.
          </p>

          <div className="check-list">
            <div><CheckCircle2 size={19} /><span><strong>Order history</strong><small>Keep a clear record of all supplier purchases.</small></span></div>
            <div><CheckCircle2 size={19} /><span><strong>Invoice tracking</strong><small>See paid, due, and outstanding amounts.</small></span></div>
            <div><CheckCircle2 size={19} /><span><strong>Delivery visibility</strong><small>Follow fulfilment from confirmation to completion.</small></span></div>
          </div>
        </div>

        <div className="solution-dashboard">
          <div className="solution-dashboard-header"><Store size={19} /> Retailer workspace</div>
          <div className="solution-stat-grid">
            <article><ShoppingCart size={18} /><span><small>Total orders</small><strong>42</strong></span></article>
            <article><Clock3 size={18} /><span><small>Pending</small><strong>6</strong></span></article>
            <article><Wallet size={18} /><span><small>Outstanding</small><strong>SAR 9,400</strong></span></article>
            <article><BarChart3 size={18} /><span><small>Purchase value</small><strong>SAR 82K</strong></span></article>
          </div>
        </div>
      </section>

      <CTA />
    </>
  );
}
