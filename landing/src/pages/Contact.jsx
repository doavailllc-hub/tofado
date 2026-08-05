import { Mail, MapPin, MessageCircle, Phone } from "lucide-react";
import { useState } from "react";

export default function Contact() {
  const [sent, setSent] = useState(false);

  const submit = (event) => {
    event.preventDefault();
    setSent(true);
  };

  return (
    <>
      <section className="page-hero">
        <span>Contact</span>
        <h1>Talk to the Tofado Merchant team.</h1>
        <p>
          Tell us about your retail, wholesale, or distribution workflow and we
          will help you choose the right setup.
        </p>
      </section>

      <section className="section contact-layout">
        <div className="contact-info">
          <span>Contact sales</span>
          <h2>Let’s build a better B2B operation.</h2>
          <p>
            Use this form for product demos, enterprise pricing, partnerships,
            onboarding, or general questions.
          </p>

          <div>
            <article><Mail size={20} /><span><small>Email</small><strong>contact@tofado.com</strong></span></article>
            <article><Phone size={20} /><span><small>Phone</small><strong>+966 00 000 0000</strong></span></article>
            <article><MessageCircle size={20} /><span><small>WhatsApp</small><strong>Available for business enquiries</strong></span></article>
            <article><MapPin size={20} /><span><small>Region</small><strong>Saudi Arabia & GCC</strong></span></article>
          </div>
        </div>

        <form className="contact-form" onSubmit={submit}>
          <div className="form-grid">
            <label><span>Name</span><input required placeholder="Your name" /></label>
            <label><span>Business name</span><input required placeholder="Company or shop" /></label>
            <label><span>Email</span><input required type="email" placeholder="you@business.com" /></label>
            <label><span>Phone</span><input required placeholder="+966" /></label>
            <label className="full"><span>I am interested in</span>
              <select defaultValue="wholesaler">
                <option value="wholesaler">Wholesaler solution</option>
                <option value="retailer">Retailer solution</option>
                <option value="enterprise">Enterprise plan</option>
                <option value="partner">Partnership</option>
              </select>
            </label>
            <label className="full"><span>Message</span><textarea rows="5" placeholder="Tell us about your business..." /></label>
          </div>

          {sent && <div className="form-success">Thank you. Your enquiry is ready to connect to your backend or email service.</div>}
          <button className="primary-button" type="submit">Send enquiry</button>
        </form>
      </section>
    </>
  );
}
