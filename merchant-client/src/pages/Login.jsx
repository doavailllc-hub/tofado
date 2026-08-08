import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  KeyRound,
  Sparkles,
  Eye,
  EyeOff,
  LoaderCircle,
  LockKeyhole,
  Mail,
  ShieldCheck,
  Store,
} from "lucide-react";

import { useAuth } from "../context/AuthContext";
import logo from "../assets/tofado-logo.png";
import "./Login-Google.css";

const demoAccounts = [
  {
    label: "Administrator",
    description: "Manage merchants and marketplace activity",
    email: "admin@tofado.com",
    password: "Admin@123",
    icon: ShieldCheck,
  },
  {
    label: "Retail shop",
    description: "Create purchase lists and track orders",
    email: "retailer@tofado.com",
    password: "Retailer@123",
    icon: Store,
  },
  {
    label: "Wholesaler",
    description: "Manage products, orders, and collections",
    email: "wholesaler@tofado.com",
    password: "Wholesale@123",
    icon: Building2,
  },
];

const benefits = [
  "Verified retailer and wholesaler accounts",
  "Secure B2B purchase-order management",
  "Catalog, invoice, payment, and delivery tools",
];

export default function Login() {
  const [form, setForm] = useState({
    email: "admin@tofado.com",
    password: "Admin@123",
  });
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const { login, loading } = useAuth();
  const navigate = useNavigate();

  const updateField = (field, value) => {
    setError("");
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const useDemoAccount = (account) => {
    setError("");
    setForm({
      email: account.email,
      password: account.password,
    });
  };

  const submit = async (event) => {
    event.preventDefault();
    setError("");

    try {
      const user = await login(
        form.email.trim().toLowerCase(),
        form.password
      );

      navigate(`/${user.role}`, {
        replace: true,
      });
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          "Unable to sign in. Please check your email and password."
      );
    }
  };

  return (
    <div className="google-login-page">
      <header className="google-login-header">
        <Link to="/login" className="google-login-brand">
          <img src={logo} alt="Tofado Merchant" />
        </Link>

        <div className="google-login-header-links">
          <span>Verified B2B marketplace</span>
          <Link to="/register" className="google-header-create">
            Create account
            <ArrowRight size={14} />
          </Link>
        </div>
      </header>

      <main className="google-login-main">
        <section className="google-login-intro">
          <span className="google-login-eyebrow">
            <Sparkles size={14} />
            Tofado Merchant
          </span>

          <h1>
            Business commerce,
            <span className="google-login-title-accent"> simplified.</span>
          </h1>

          <p>
            Connect verified retailers and wholesalers, manage procurement,
            organize product catalogs, and track every order from one secure
            business platform.
          </p>

          <div className="google-login-benefits">
            {benefits.map((benefit) => (
              <div key={benefit}>
                <span>
                  <CheckCircle2 size={18} />
                </span>
                <p>{benefit}</p>
              </div>
            ))}
          </div>

          <div className="google-login-trust">
            <div>
              <ShieldCheck size={20} />
            </div>

            <span>
              <strong>Admin-verified access</strong>
              <small>
                Every retailer and wholesaler is reviewed before account
                activation.
              </small>
            </span>
          </div>
        </section>

        <section className="google-login-card">
          <div className="google-login-heading">
            <span>Welcome back</span>
            <h2>Sign in to Tofado</h2>
            <p>Access your merchant workspace securely.</p>
          </div>

          <form className="google-login-form" onSubmit={submit}>
            <label>
              <span>Email address</span>

              <div className="google-login-control">
                <Mail size={18} />

                <input
                  type="email"
                  value={form.email}
                  autoComplete="email"
                  placeholder="you@business.com"
                  onChange={(event) =>
                    updateField("email", event.target.value)
                  }
                  required
                />
              </div>
            </label>

            <label>
              <span>Password</span>

              <div className="google-login-control">
                <LockKeyhole size={18} />

                <input
                  type={showPassword ? "text" : "password"}
                  value={form.password}
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  onChange={(event) =>
                    updateField("password", event.target.value)
                  }
                  required
                />

                <button
                  type="button"
                  className="google-password-toggle"
                  onClick={() =>
                    setShowPassword((current) => !current)
                  }
                  aria-label={
                    showPassword
                      ? "Hide password"
                      : "Show password"
                  }
                >
                  {showPassword ? (
                    <EyeOff size={18} />
                  ) : (
                    <Eye size={18} />
                  )}
                </button>
              </div>
            </label>

            <div className="google-login-options">
              <label className="google-remember">
                <input type="checkbox" />
                <span>Remember me</span>
              </label>

              <Link to="/forgot-password" className="google-forgot-link">
                <KeyRound size={14} />
                Forgot password?
              </Link>
            </div>

            {error && (
              <div className="google-login-alert" role="alert">
                {error}
              </div>
            )}

            <button
              type="submit"
              className="google-login-submit"
              disabled={loading}
            >
              {loading ? (
                <>
                  <LoaderCircle
                    size={18}
                    className="google-login-spinner"
                  />
                  Signing in...
                </>
              ) : (
                <>
                  Sign in
                  <ArrowRight size={18} />
                </>
              )}
            </button>
          </form>

          <div className="google-login-divider">
            <span>New to Tofado?</span>
          </div>

          <Link to="/Register" className="google-create-account">
            <span className="google-create-icon">
              <Store size={18} />
            </span>

            <span>
              <strong>Create merchant account</strong>
              <small>Apply as a retailer or wholesaler</small>
            </span>

            <ArrowRight size={17} />
          </Link>

          <details className="google-demo-panel">
            <summary>Use a demo account</summary>

            <div className="google-demo-list">
              {demoAccounts.map((account) => {
                const Icon = account.icon;

                return (
                  <button
                    type="button"
                    key={account.email}
                    onClick={() => useDemoAccount(account)}
                  >
                    <span className="google-demo-icon">
                      <Icon size={18} />
                    </span>

                    <span className="google-demo-copy">
                      <strong>{account.label}</strong>
                      <small>{account.description}</small>
                    </span>

                    <ArrowRight size={16} />
                  </button>
                );
              })}
            </div>
          </details>
        </section>
      </main>

      <footer className="google-login-footer">
        <span>© 2026 Tofado Merchant</span>
        <div>
          <span>Secure access</span>
          <span>•</span>
          <span>Verified marketplace</span>
        </div>
      </footer>
    </div>
  );
}