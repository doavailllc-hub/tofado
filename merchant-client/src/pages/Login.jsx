import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowRight,
  CheckCircle2,
  Sparkles,
  LoaderCircle,
  Mail,
  ShieldCheck,
  Store,
} from "lucide-react";

import { useAuth } from "../context/AuthContext";
import logo from "../assets/tofado-logo.png";
import "./Login-Google.css";

const benefits = [
  "Verified retailer and wholesaler accounts",
  "Secure B2B purchase-order management",
  "Catalog, invoice, payment, and delivery tools",
];

export default function Login() {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [role, setRole] = useState("retailer");
  const [stage, setStage] = useState("email");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const googleButtonRef = useRef(null);

  const { requestEmailCode, verifyEmailCode, googleLogin, loading } = useAuth();
  const navigate = useNavigate();
  const googleClientId = import.meta.env.VITE_GOOGLE_WEB_CLIENT_ID;

  const finishLogin = (user) => navigate(`/${user.role}`, { replace: true });

  const sendCode = async (event) => {
    event.preventDefault();
    setError("");
    setSending(true);
    try {
      await requestEmailCode(email);
      setStage("code");
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Unable to send the verification code.");
    } finally {
      setSending(false);
    }
  };

  const verifyCode = async (event) => {
    event.preventDefault();
    setError("");
    try {
      finishLogin(await verifyEmailCode(email, code, role));
    } catch (requestError) {
      setError(requestError.response?.data?.message || "The verification code is invalid or expired.");
    }
  };

  useEffect(() => {
    if (!googleClientId) return undefined;
    const renderGoogleButton = () => {
      if (!window.google?.accounts?.id || !googleButtonRef.current) return;
      window.google.accounts.id.initialize({
        client_id: googleClientId,
        callback: async ({ credential }) => {
          setError("");
          try {
            finishLogin(await googleLogin(credential, role));
          } catch (requestError) {
            setError(requestError.response?.data?.message || "Google sign-in could not be completed.");
          }
        },
      });
      googleButtonRef.current.replaceChildren();
      window.google.accounts.id.renderButton(googleButtonRef.current, {
        theme: "outline", size: "large", width: 360, text: "continue_with",
      });
    };
    const existing = document.querySelector('script[src="https://accounts.google.com/gsi/client"]');
    if (existing) {
      if (window.google?.accounts?.id) renderGoogleButton();
      else existing.addEventListener("load", renderGoogleButton, { once: true });
      return () => existing.removeEventListener("load", renderGoogleButton);
    }
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.onload = renderGoogleButton;
    document.head.appendChild(script);
    return undefined;
  }, [googleClientId, role]);

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
            <p>No password needed. We will email you a secure six-digit code.</p>
          </div>

          <div className="google-role-picker" aria-label="Account type">
            {[["retailer", "Retailer"], ["wholesaler", "Wholesaler"]].map(([value, label]) => (
              <button key={label} type="button" className={role === value ? "active" : ""} onClick={() => setRole(value)}>{label}</button>
            ))}
          </div>

          <form className="google-login-form" onSubmit={stage === "email" ? sendCode : verifyCode}>
            <label>
              <span>Email address</span>

              <div className="google-login-control">
                <Mail size={18} />

                <input
                  type="email"
                  value={email}
                  autoComplete="email"
                  placeholder="you@business.com"
                  onChange={(event) => { setEmail(event.target.value); setError(""); }}
                  disabled={stage === "code"}
                  required
                />
              </div>
            </label>

            {stage === "code" && <label>
              <span>Verification code</span>
              <div className="google-login-control google-code-control">
                <ShieldCheck size={18} />
                <input type="text" inputMode="numeric" autoComplete="one-time-code" value={code} maxLength={6} placeholder="000000" onChange={(event) => { setCode(event.target.value.replace(/\D/g, "").slice(0, 6)); setError(""); }} required />
              </div>
            </label>}

            {error && (
              <div className="google-login-alert" role="alert">
                {error}
              </div>
            )}

            <button
              type="submit"
              className="google-login-submit"
              disabled={loading || sending || (stage === "code" && code.length !== 6)}
            >
              {loading || sending ? (
                <>
                  <LoaderCircle
                    size={18}
                    className="google-login-spinner"
                  />
                  {stage === "email" ? "Sending code..." : "Verifying..."}
                </>
              ) : (
                <>
                  {stage === "email" ? "Continue with email" : "Verify and sign in"}
                  <ArrowRight size={18} />
                </>
              )}
            </button>
            {stage === "code" && <button type="button" className="google-login-secondary" onClick={() => { setStage("email"); setCode(""); setError(""); }}>Use another email</button>}
          </form>

          <div className="google-login-divider">
            <span>or</span>
          </div>

          {googleClientId ? <div className="google-signin-button" ref={googleButtonRef} /> : <div className="google-login-alert">Google sign-in is not configured.</div>}

          <div className="google-login-divider"><span>New to Tofado?</span></div>

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
