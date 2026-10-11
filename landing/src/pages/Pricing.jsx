import { CheckCircle2 } from "lucide-react";
import SectionHeading from "../components/SectionHeading";
import CTA from "../components/CTA";

const plans = [
  {
    name: "Starter",
    price: "Free",
    text: "For small businesses testing digital B2B commerce.",
    features: ["Business profile", "Basic product catalog", "Public catalog link", "Order receiving", "Email support"],
    cta: "Start free",
    role: "retailer",
  },
  {
    name: "Business",
    price: "INR 1,999",
    period: "/ month",
    text: "For growing retailers and wholesalers that need complete operations.",
    featured: true,
    features: ["14-day free trial", "Unlimited catalog products", "Up to 8 team members", "Order workflow", "GST-ready invoices", "Payment and delivery management", "Commerce intelligence", "Priority support"],
    cta: "Start 14-day trial",
    role: "wholesaler",
  },
  {
    name: "Enterprise",
    price: "Custom",
    text: "For larger companies, groups, and multi-location operations.",
    features: ["Everything in Business", "Multiple branches", "Custom roles", "API access", "Custom onboarding", "Advanced reporting", "Dedicated support"],
    cta: "Contact sales",
    href: "/contact",
  },
];

export default function Pricing() {
  const merchantAppUrl = import.meta.env.VITE_MERCHANT_APP_URL || "http://localhost:5173/login";
  const applyUrl = role => `${merchantAppUrl.replace(/\/login$/, "")}/apply?role=${role}`;
  return (
    <>
      <section className="page-hero">
        <span>Pricing</span>
        <h1>Simple plans for every stage of growth.</h1>
        <p>
          Start with the essentials and upgrade when your business needs more
          catalog, order, payment, and delivery capabilities.
        </p>
      </section>

      <section className="section">
        <SectionHeading
          eyebrow="Transparent pricing"
          title="Choose the right plan for your business"
          text="Start free, then unlock complete wholesale operations with Tofado Business at INR 1,999 per month."
        />

        <div className="pricing-grid">
          {plans.map((plan) => (
            <article className={plan.featured ? "pricing-card featured" : "pricing-card"} key={plan.name}>
              {plan.featured && <span className="popular">Most popular</span>}
              <h3>{plan.name}</h3>
              <p>{plan.text}</p>
              <div className="price"><strong>{plan.price}</strong>{plan.period && <span>{plan.period}</span>}</div>
              <a href={plan.href || applyUrl(plan.role)} className={plan.featured ? "primary-button" : "secondary-button"}>{plan.cta}</a>
              <ul>
                {plan.features.map((feature) => (
                  <li key={feature}><CheckCircle2 size={17} /> {feature}</li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </section>

      <CTA />
    </>
  );
}
