import {
  ArrowRight,
  BarChart3,
  Building2,
  CheckCircle2,
  CreditCard,
  FileText,
  Globe2,
  Hotel,
  PackageCheck,
  Pill,
  QrCode,
  Utensils,
  Share2,
  ShoppingBasket,
  ShoppingCart,
  Store,
  Truck,
  Users,
  Warehouse,
  Zap,
} from "lucide-react";
import { Link } from "react-router-dom";
import BrowserMockup from "../components/BrowserMockup";
import SectionHeading from "../components/SectionHeading";
import CTA from "../components/CTA";

const merchantAppUrl =
  import.meta.env.VITE_MERCHANT_APP_URL || "http://localhost:5173/login";

const features = [
  {
    icon: ShoppingCart,
    title: "One order workspace",
    text: "Review products, confirm orders, generate invoices, manage payments, and prepare delivery.",
  },
  {
    icon: Globe2,
    title: "Shareable wholesale store",
    text: "Give every wholesaler a clean public catalog that can be shared through WhatsApp, email, QR, or web.",
  },
  {
    icon: CreditCard,
    title: "Flexible payment terms",
    text: "Support online payment, due dates, credit accounts, cash on delivery, and payment tracking.",
  },
  {
    icon: Truck,
    title: "Delivery operations",
    text: "Handle merchant delivery, third-party delivery, and customer pickup from the same order flow.",
  },
  {
    icon: Users,
    title: "Verified business network",
    text: "Connect approved retailers and wholesalers in a trusted B2B marketplace.",
  },
  {
    icon: BarChart3,
    title: "Clear commercial insights",
    text: "Monitor order value, outstanding balances, active workflows, and merchant activity.",
  },
];

const industries = [
  [ShoppingBasket, "Grocery & supermarkets"],
  [Pill, "Pharmacy & medical"],
  [Utensils, "Restaurants & catering"],
  [Hotel, "Hotels & hospitality"],
  [Building2, "Construction supplies"],
  [Warehouse, "Industrial wholesale"],
];

export default function Home() {
  return (
    <>
      <section className="hero">
        <div className="hero-orb hero-orb-one" />
        <div className="hero-orb hero-orb-two" />

        <div className="hero-shell">
          <div className="hero-copy">
            <div className="announcement">
              <Zap size={16} />
              B2B commerce, simplified for every merchant
            </div>

            <h1>
              Sell more.
              <span> Manage less.</span>
              Grow together.
            </h1>

            <p>
              Tofado Merchant gives retailers and wholesalers one simple
              platform for catalogs, orders, invoices, payments, and delivery.
            </p>

            <div className="hero-actions">
              <a href={`${merchantAppUrl.replace(/\/login$/, "")}/apply`} className="primary-button">
                Start now <ArrowRight size={18} />
              </a>
              <Link to="/contact" className="secondary-button">Book a demo</Link>
            </div>

            <div className="hero-proof">
              <span><CheckCircle2 size={16} /> No complex setup</span>
              <span><CheckCircle2 size={16} /> Mobile friendly</span>
              <span><CheckCircle2 size={16} /> Built for B2B</span>
            </div>
          </div>

          <BrowserMockup />
        </div>
      </section>

      <section className="logo-strip">
        <p>Built for businesses across modern trade and distribution</p>
        <div>
          {["Retail shops", "Wholesalers", "Pharmacies", "Hotels", "Restaurants", "Industrial suppliers"].map((item) => (
            <span key={item}>{item}</span>
          ))}
        </div>
      </section>

      <section className="section">
        <SectionHeading
          eyebrow="One connected platform"
          title="Everything your B2B sales operation needs"
          text="A clean Google-style workspace that helps teams move from product discovery to completed delivery."
        />

        <div className="feature-grid">
          {features.map(({ icon: Icon, title, text }) => (
            <article className="feature-card" key={title}>
              <div><Icon size={22} /></div>
              <h3>{title}</h3>
              <p>{text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="section split-section">
        <div className="split-visual catalog-visual">
          <div className="catalog-phone">
            <div className="catalog-phone-top">
              <div className="mini-logo">T</div>
              <span>Nasa Marketing</span>
              <ShoppingCart size={18} />
            </div>
            <div className="catalog-search">Search products</div>
            <div className="catalog-products">
              {["Premium Rice", "Ceramic Tiles", "Fresh Oil", "Office Paper"].map((name, index) => (
                <article key={name}>
                  <div className={`product-art art-${index + 1}`} />
                  <strong>{name}</strong>
                  <small>Wholesale price</small>
                  <b>SAR {(index + 1) * 42}.00</b>
                </article>
              ))}
            </div>
          </div>
        </div>

        <div className="split-copy">
          <span>Public catalog</span>
          <h2>Your wholesale store, ready to share anywhere.</h2>
          <p>
            Every wholesaler gets a clean online store that retailers can open
            without installing an app.
          </p>

          <div className="check-list">
            <div><Share2 size={19} /><span><strong>Share instantly</strong><small>WhatsApp, email, QR code, or direct link.</small></span></div>
            <div><ShoppingCart size={19} /><span><strong>Receive direct orders</strong><small>Retailers can select products and submit complete purchase requests.</small></span></div>
            <div><QrCode size={19} /><span><strong>Reach more buyers</strong><small>Use the catalog link on your website, social pages, and printed material.</small></span></div>
          </div>

          <Link to="/solutions/wholesalers" className="inline-link">
            Explore wholesaler solution <ArrowRight size={17} />
          </Link>
        </div>
      </section>

      <section className="section workflow-section">
        <SectionHeading
          eyebrow="A complete workflow"
          title="From product to payment to delivery"
          text="Every step stays connected, visible, and easy to manage."
        />

        <div className="workflow-grid">
          {[
            [PackageCheck, "Upload products", "Build your wholesale catalog."],
            [Share2, "Share your store", "Send your catalog to retailers."],
            [ShoppingCart, "Receive orders", "Review customer and product details."],
            [FileText, "Generate invoice", "Confirm and create the invoice."],
            [CreditCard, "Track payment", "Online, due, credit, or COD."],
            [Truck, "Complete delivery", "Deliver or arrange store pickup."],
          ].map(([Icon, title, text], index) => (
            <article key={title}>
              <span>{index + 1}</span>
              <div><Icon size={21} /></div>
              <h3>{title}</h3>
              <p>{text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="section industry-preview">
        <SectionHeading
          eyebrow="Made for real businesses"
          title="Flexible across industries"
          text="Tofado Merchant adapts to different products, order sizes, and commercial workflows."
        />

        <div className="industry-grid">
          {industries.map(([Icon, title]) => (
            <Link to="/industries" key={title}>
              <Icon size={23} />
              <strong>{title}</strong>
              <ArrowRight size={17} />
            </Link>
          ))}
        </div>
      </section>

      <section className="section metrics-section">
        <div className="metrics-card">
          <div>
            <small>Unified platform</small>
            <strong>1</strong>
            <span>workspace for commerce</span>
          </div>
          <div>
            <small>Core workflow</small>
            <strong>6</strong>
            <span>connected stages</span>
          </div>
          <div>
            <small>Business access</small>
            <strong>24/7</strong>
            <span>cloud availability</span>
          </div>
          <div>
            <small>Setup model</small>
            <strong>Simple</strong>
            <span>for every merchant</span>
          </div>
        </div>
      </section>

      <section className="section faq-section" id="faq">
        <SectionHeading
          eyebrow="Frequently asked questions"
          title="Everything you need to know"
        />

        <div className="faq-list">
          {[
            ["What is Tofado Merchant?", "Tofado Merchant is a B2B sales and procurement platform designed for retailers and wholesalers."],
            ["Can wholesalers share a public store?", "Yes. Every wholesaler can publish and share a direct catalog link through WhatsApp, email, QR, or web."],
            ["Can retailers order without installing an app?", "Yes. Retailers can open the public catalog in a browser and submit an order directly."],
            ["Does the platform support payment terms?", "Yes. Online, due, credit, and cash-on-delivery workflows can be managed at order level."],
            ["Can I manage delivery and store pickup?", "Yes. Orders can move through merchant delivery, third-party delivery, or customer pickup."],
          ].map(([question, answer]) => (
            <details key={question}>
              <summary>{question}<span>+</span></summary>
              <p>{answer}</p>
            </details>
          ))}
        </div>
      </section>

      <CTA />
    </>
  );
}
