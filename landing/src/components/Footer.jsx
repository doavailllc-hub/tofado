import { Link } from "react-router-dom";
import logo from "../assets/tofado-logo.png";

export default function Footer() {
  return (
    <footer className="site-footer">
      <div className="footer-shell">
        <div className="footer-brand">
          <img src={logo} alt="Tofado Merchant" />
          <p>
            A simple B2B operating system for retailers, wholesalers,
            catalogs, orders, invoices, payments, and delivery.
          </p>
        </div>

        <div>
          <h4>Solutions</h4>
          <Link to="/solutions/retailers">Retailers</Link>
          <Link to="/solutions/wholesalers">Wholesalers</Link>
          <Link to="/pricing">Pricing</Link>
        </div>

        <div>
          <h4>Company</h4>
          <Link to="/about">About</Link>
          <Link to="/industries">Industries</Link>
          <Link to="/contact">Contact</Link>
        </div>

        <div>
          <h4>Resources</h4>
          <a href="#faq">Help center</a>
          <a href="#privacy">Privacy</a>
          <a href="#terms">Terms</a>
        </div>
      </div>

      <div className="footer-bottom">
        <span>© 2026 Tofado Merchant</span>
        <span>Built for modern B2B commerce.</span>
      </div>
    </footer>
  );
}
