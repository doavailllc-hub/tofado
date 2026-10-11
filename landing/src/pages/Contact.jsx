import { Mail, MapPin, MessageCircle, Phone } from "lucide-react";
import { useState } from "react";

export default function Contact() {
  const [sent, setSent] = useState(false);

  const submit = (event) => {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    const body = ['Name: ' + fields.get('name'), 'Business: ' + fields.get('business'), 'Email: ' + fields.get('email'), 'Phone: ' + fields.get('phone'), 'Interest: ' + fields.get('interest'), '', fields.get('message')].join('\n');
    window.location.href = 'mailto:contact@tofado.com?subject=' + encodeURIComponent('Tofado business enquiry') + '&body=' + encodeURIComponent(body);
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

            <article><MessageCircle size={20} /><span><small>WhatsApp</small><strong>Available for business enquiries</strong></span></article>
            <article><MapPin size={20} /><span><small>Market</small><strong>India</strong></span></article>
          </div>
        </div>

        <form className="contact-form" onSubmit={submit}>
          <div className="form-grid">
            <label><span>Name</span><input name="name" required maxLength={120} placeholder="Your name" /></label>
            <label><span>Business name</span><input name="business" required maxLength={180} placeholder="Company or shop" /></label>
            <label><span>Email</span><input name="email" required type="email" placeholder="you@business.com" /></label>
            <label><span>Phone</span><input name="phone" required maxLength={30} placeholder="Phone number" /></label>
            <label className="full"><span>I am interested in</span>
              <select name="interest" defaultValue="wholesaler">
                <option value="wholesaler">Wholesaler solution</option>
                <option value="retailer">Retailer solution</option>
                <option value="enterprise">Enterprise plan</option>
                <option value="partner">Partnership</option>
              </select>
            </label>
            <label className="full"><span>Message</span><textarea name="message" maxLength={4000} rows="5" placeholder="Tell us about your business..." /></label>
          </div>

          {sent && <div className="form-success">Your email draft is ready. Send it from your email app to contact us. You can also email contact@tofado.com directly.</div>}
          <button className="primary-button" type="submit">Open email draft</button>
        </form>
      </section>
    </>
  );
}
