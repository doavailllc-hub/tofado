import {
  Apple,
  Building2,
  Car,
  Factory,
  HardHat,
  HeartPulse,
  Hotel,
  Laptop,
  Package,
  Pill,
  Utensils,
  Shirt,
  ShoppingBasket,
  Wrench,
} from "lucide-react";
import SectionHeading from "../components/SectionHeading";
import CTA from "../components/CTA";

const industries = [
  [ShoppingBasket, "Grocery & supermarkets", "Fast-moving products, frequent replenishment, pack pricing, and repeat orders."],
  [Pill, "Pharmacy & healthcare", "Structured purchasing for pharmacies, clinics, and medical suppliers."],
  [Utensils, "Restaurants & catering", "Food ingredients, packaging, and operational supply ordering."],
  [Hotel, "Hotels & hospitality", "Centralized purchasing across housekeeping, food, and guest supplies."],
  [HardHat, "Construction", "Bulk materials, project requirements, and delivery coordination."],
  [Factory, "Industrial supply", "Parts, consumables, tools, and recurring procurement workflows."],
  [Laptop, "Electronics", "Catalog-led B2B sales for devices, accessories, and components."],
  [Car, "Automotive", "Parts catalogs, workshops, distributors, and commercial buyers."],
  [Shirt, "Fashion & textiles", "Variants, packs, seasonal lines, and wholesale ordering."],
  [Wrench, "Hardware", "Tools, fittings, building materials, and dealer networks."],
  [HeartPulse, "Medical equipment", "Product catalogs, institutional customers, and delivery records."],
  [Apple, "Food distribution", "Fresh, frozen, packaged, and bulk food supply operations."],
  [Building2, "Corporate procurement", "Approved vendors, purchase requests, invoices, and payments."],
  [Package, "General wholesale", "A flexible platform for almost any B2B catalog and sales process."],
];

export default function Industries() {
  return (
    <>
      <section className="page-hero">
        <span>Industries</span>
        <h1>Built for the way B2B businesses actually trade.</h1>
        <p>
          Tofado Merchant supports different products, pack sizes, buying cycles,
          payment terms, and delivery methods.
        </p>
      </section>

      <section className="section">
        <SectionHeading
          eyebrow="Flexible by design"
          title="One platform, many industries"
          text="Adapt the same simple order workflow to your market."
        />

        <div className="industry-detail-grid">
          {industries.map(([Icon, title, text]) => (
            <article key={title}>
              <div><Icon size={22} /></div>
              <h3>{title}</h3>
              <p>{text}</p>
            </article>
          ))}
        </div>
      </section>

      <CTA />
    </>
  );
}
