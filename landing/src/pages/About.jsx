import { CheckCircle2, Globe2, ShieldCheck, Sparkles, Users } from "lucide-react";
import SectionHeading from "../components/SectionHeading";
import CTA from "../components/CTA";

export default function About() {
  return (
    <>
      <section className="page-hero">
        <span>About Tofado Merchant</span>
        <h1>Making B2B commerce easier for every merchant.</h1>
        <p>
          Tofado Merchant is designed to replace fragmented sales and procurement
          processes with one simple, trusted digital workflow.
        </p>
      </section>

      <section className="section split-section">
        <div className="split-copy">
          <span>Our mission</span>
          <h2>Help retailers and wholesalers grow together.</h2>
          <p>
            Many businesses still rely on calls, notebooks, spreadsheets, and
            scattered messages. Tofado Merchant brings products, orders, invoices,
            payments, and delivery into one clear system.
          </p>

          <div className="check-list">
            <div><CheckCircle2 size={19} /><span><strong>Simple by default</strong><small>Clear enough for everyday business users.</small></span></div>
            <div><CheckCircle2 size={19} /><span><strong>Built for trust</strong><small>Verified merchant access and transparent workflows.</small></span></div>
            <div><CheckCircle2 size={19} /><span><strong>Designed to scale</strong><small>Useful for one shop or a large business network.</small></span></div>
          </div>
        </div>

        <div className="value-grid">
          <article><Sparkles size={22} /><h3>Simple</h3><p>Clean product experiences inspired by Google.</p></article>
          <article><Users size={22} /><h3>Connected</h3><p>Retailers and wholesalers work in one network.</p></article>
          <article><ShieldCheck size={22} /><h3>Trusted</h3><p>Business verification supports safer commerce.</p></article>
          <article><Globe2 size={22} /><h3>Accessible</h3><p>Built for browser, desktop, and mobile use.</p></article>
        </div>
      </section>

      <CTA />
    </>
  );
}
