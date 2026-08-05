import { ArrowRight } from "lucide-react";

const merchantAppUrl =
  import.meta.env.VITE_MERCHANT_APP_URL || "http://localhost:5173/login";

export default function CTA() {
  return (
    <section className="cta-section">
      <div className="cta-card">
        <div>
          <span>Start selling smarter</span>
          <h2>Build a simpler B2B sales operation with Tofado Merchant.</h2>
          <p>
            Create your catalog, receive direct orders, generate invoices,
            manage payment terms, and coordinate delivery from one workspace.
          </p>
        </div>

        <div className="cta-actions">
          <a href={`${merchantAppUrl.replace(/\/login$/, "")}/apply`} className="primary-button">
            Get started <ArrowRight size={18} />
          </a>
          <LinkFallback />
        </div>
      </div>
    </section>
  );
}

function LinkFallback() {
  return <a href="/contact" className="secondary-button">Book a demo</a>;
}
