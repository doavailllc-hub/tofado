import {
  BarChart3,
  Boxes,
  CheckCircle2,
  CreditCard,
  FileText,
  Globe2,
  Share2,
  ShoppingCart,
  Truck,
  Users,
} from "lucide-react";
import SectionHeading from "../components/SectionHeading";
import CTA from "../components/CTA";

export default function Wholesalers() {
  const items = [
    [Boxes, "Build your product catalog", "Upload products, pricing, packs, stock, and wholesale terms."],
    [Globe2, "Publish a public store", "Give retailers a clean online catalog they can browse anywhere."],
    [Share2, "Share through any channel", "Use WhatsApp, email, QR code, website, or social media."],
    [ShoppingCart, "Receive structured orders", "Capture customer, product, delivery, and date information clearly."],
    [FileText, "Generate invoices", "Confirm orders and issue invoices from the same workflow."],
    [CreditCard, "Manage payment terms", "Support online, due, credit, and cash-on-delivery arrangements."],
    [Truck, "Coordinate fulfilment", "Prepare merchant delivery, third-party delivery, or store collection."],
    [BarChart3, "Understand performance", "Track sales value, workflow status, customers, and outstanding balances."],
  ];

  return (
    <>
      <section className="page-hero">
        <span>Solution for wholesalers</span>
        <h1>Turn your wholesale business into a shareable digital store.</h1>
        <p>
          Publish products, receive direct orders, invoice customers, and manage
          delivery from one professional workspace.
        </p>
      </section>

      <section className="section">
        <SectionHeading
          eyebrow="Wholesaler operating system"
          title="Sell more without adding more complexity"
          text="Move every order through a consistent commercial workflow."
        />

        <div className="feature-grid four">
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
        <div className="solution-dashboard purple">
          <div className="solution-dashboard-header"><Users size={19} /> Wholesale network</div>
          <div className="public-link-card">
            <span>Public catalog</span>
            <strong>tofado.com/catalog/your-business</strong>
            <button><Share2 size={16} /> Share catalog</button>
          </div>
        </div>

        <div className="split-copy">
          <span>A better sales channel</span>
          <h2>Give every buyer one clear place to order.</h2>
          <p>
            Stop sending product photos and price lists one by one. Share one
            branded catalog that stays current.
          </p>

          <div className="check-list">
            <div><CheckCircle2 size={19} /><span><strong>Always available</strong><small>Your product store works on desktop and mobile.</small></span></div>
            <div><CheckCircle2 size={19} /><span><strong>Structured demand</strong><small>Receive complete orders instead of incomplete messages.</small></span></div>
            <div><CheckCircle2 size={19} /><span><strong>Professional follow-up</strong><small>Invoice, payment, and delivery stay connected.</small></span></div>
          </div>
        </div>
      </section>

      <CTA />
    </>
  );
}
