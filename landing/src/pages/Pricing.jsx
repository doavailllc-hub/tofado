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
  },
  {
    name: "Business",
    price: "SAR 149",
    period: "/ month",
    text: "For growing retailers and wholesalers that need complete operations.",
    featured: true,
    features: ["Everything in Starter", "Unlimited catalog products", "Order workflow", "Invoice generation", "Payment terms", "Delivery management", "Business analytics", "Priority support"],
    cta: "Start business",
  },
  {
    name: "Enterprise",
    price: "Custom",
    text: "For larger companies, groups, and multi-location operations.",
    features: ["Everything in Business", "Multiple branches", "Custom roles", "API access", "Custom onboarding", "Advanced reporting", "Dedicated support"],
    cta: "Contact sales",
  },
];

export default function Pricing() {
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
          text="Prices shown are sample launch pricing and can be changed before production."
        />

        <div className="pricing-grid">
          {plans.map((plan) => (
            <article className={plan.featured ? "pricing-card featured" : "pricing-card"} key={plan.name}>
              {plan.featured && <span className="popular">Most popular</span>}
              <h3>{plan.name}</h3>
              <p>{plan.text}</p>
              <div className="price"><strong>{plan.price}</strong>{plan.period && <span>{plan.period}</span>}</div>
              <a href="/contact" className={plan.featured ? "primary-button" : "secondary-button"}>{plan.cta}</a>
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
