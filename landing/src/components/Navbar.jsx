import { useState } from "react";
import { ChevronDown, Menu, X } from "lucide-react";
import { Link, NavLink } from "react-router-dom";
import logo from "../assets/tofado-logo.png";

const merchantAppUrl =
  import.meta.env.VITE_MERCHANT_APP_URL || "http://localhost:5173/login";

export default function Navbar() {
  const [open, setOpen] = useState(false);
  const [solutionsOpen, setSolutionsOpen] = useState(false);

  const close = () => {
    setOpen(false);
    setSolutionsOpen(false);
  };

  return (
    <header className="site-header">
      <div className="nav-shell">
        <Link to="/" className="brand" onClick={close}>
          <img src={logo} alt="Tofado Merchant" />
        </Link>

        <nav className={open ? "main-nav open" : "main-nav"}>
          <div className="nav-dropdown">
            <button
              type="button"
              onClick={() => setSolutionsOpen((value) => !value)}
              aria-expanded={solutionsOpen}
            >
              Solutions <ChevronDown size={16} />
            </button>

            <div className={solutionsOpen ? "dropdown-menu show" : "dropdown-menu"}>
              <NavLink to="/solutions/retailers" onClick={close}>
                <strong>For retailers</strong>
                <span>Purchase smarter and track every order.</span>
              </NavLink>
              <NavLink to="/solutions/wholesalers" onClick={close}>
                <strong>For wholesalers</strong>
                <span>Sell through catalogs and automate fulfilment.</span>
              </NavLink>
            </div>
          </div>

          <NavLink to="/industries" onClick={close}>Industries</NavLink>
          <NavLink to="/pricing" onClick={close}>Pricing</NavLink>
          <NavLink to="/about" onClick={close}>About</NavLink>
          <NavLink to="/contact" onClick={close}>Contact</NavLink>
        </nav>

        <div className="nav-actions">
          <a href={merchantAppUrl} className="text-link">Sign in</a>
          <a href={`${merchantAppUrl.replace(/\/login$/, "")}/apply`} className="primary-button compact">
            Get started
          </a>

          <button
            type="button"
            className="mobile-toggle"
            onClick={() => setOpen((value) => !value)}
            aria-label="Toggle navigation"
          >
            {open ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>
    </header>
  );
}
