import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Building2,
  CheckCircle2,
  FileBadge2,
  Eye,
  EyeOff,
  LoaderCircle,
  LockKeyhole,
  Mail,
  MapPin,
  Phone,
  ShieldCheck,
  Store,
  UserRound,
} from "lucide-react";

import api from "../services/api";
import logo from "../assets/tofado-logo.png";
import "./Register.css";

const initialForm = {
  role: "retailer",
  name: "",
  business_name: "",
  email: "",
  phone: "",
  location: "",
  address: "",
  tax_number: "",
  license_number: "",
  password: "",
  confirm_password: "",
};

export default function Register() {
  const navigate = useNavigate();

  const [form, setForm] = useState(initialForm);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const passwordMatches = useMemo(
    () =>
      form.confirm_password.length > 0 &&
      form.password === form.confirm_password,
    [form.password, form.confirm_password]
  );

  const updateField = (key, value) => {
    setError("");
    setSuccess("");

    setForm((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const submit = async (event) => {
    event.preventDefault();

    if (form.password.length < 8) {
      setError("Password must contain at least 8 characters.");
      return;
    }

    if (form.password !== form.confirm_password) {
      setError("Password confirmation does not match.");
      return;
    }

    try {
      setSubmitting(true);
      setError("");
      setSuccess("");

      await api.post("/applications", {
        role: form.role,
        name: form.name.trim(),
        business_name: form.business_name.trim(),
        email: form.email.trim().toLowerCase(),
        phone: form.phone.trim(),
        location: form.location.trim(),
        address: form.address.trim(),
        tax_number: form.tax_number.trim() || null,
        license_number: form.license_number.trim() || null,
        password: form.password,
      });

      setSuccess(
        "Your registration request has been submitted. Tofado Admin will verify your business before activating the account."
      );

      setForm(initialForm);
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          "Unable to submit registration request."
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="google-register-page">
      <header className="google-register-topbar">
        <Link to="/login" className="google-register-logo-link">
          <img src={logo} alt="Tofado Merchant" />
        </Link>

        <Link to="/login" className="google-register-signin-link">
          <ArrowLeft size={16} />
          Back to sign in
        </Link>
      </header>

      <main className="google-register-main">
        <section className="google-register-card">
          <div className="google-register-heading">
            <span className="google-register-eyebrow">Merchant registration</span>
            <h1>Create your Tofado Merchant account</h1>
            <p>
              Submit your business details for verification. Access is enabled
              after Tofado Admin approves your application.
            </p>
          </div>

          <form className="google-register-form" onSubmit={submit}>
            <section className="google-register-section">
              <div className="google-register-section-title">
                <span className="google-register-step">1</span>
                <div>
                  <h2>Business type</h2>
                  <p>Choose how you will use Tofado Merchant.</p>
                </div>
              </div>

              <div className="google-register-role-grid">
                <button
                  type="button"
                  className={form.role === "retailer" ? "active" : ""}
                  onClick={() => updateField("role", "retailer")}
                >
                  <span className="google-register-role-icon retailer">
                    <Store size={20} />
                  </span>
                  <span>
                    <strong>Retail shop</strong>
                    <small>Buy products from verified wholesalers</small>
                  </span>
                  <span className="google-register-role-check">
                    {form.role === "retailer" && <CheckCircle2 size={18} />}
                  </span>
                </button>

                <button
                  type="button"
                  className={form.role === "wholesaler" ? "active" : ""}
                  onClick={() => updateField("role", "wholesaler")}
                >
                  <span className="google-register-role-icon wholesaler">
                    <Building2 size={20} />
                  </span>
                  <span>
                    <strong>Wholesale dealer</strong>
                    <small>Sell products and manage retailer orders</small>
                  </span>
                  <span className="google-register-role-check">
                    {form.role === "wholesaler" && <CheckCircle2 size={18} />}
                  </span>
                </button>
              </div>
            </section>

            <section className="google-register-section">
              <div className="google-register-section-title">
                <span className="google-register-step">2</span>
                <div>
                  <h2>Business information</h2>
                  <p>Use your official business and contact details.</p>
                </div>
              </div>

              <div className="google-register-grid">
                <label className="google-register-field">
                  <span>Contact person</span>
                  <div>
                    <UserRound size={17} />
                    <input
                      required
                      autoComplete="name"
                      value={form.name}
                      placeholder="Full name"
                      onChange={(event) =>
                        updateField("name", event.target.value)
                      }
                    />
                  </div>
                </label>

                <label className="google-register-field">
                  <span>Business name</span>
                  <div>
                    <Building2 size={17} />
                    <input
                      required
                      value={form.business_name}
                      placeholder="Registered business name"
                      onChange={(event) =>
                        updateField("business_name", event.target.value)
                      }
                    />
                  </div>
                </label>

                <label className="google-register-field">
                  <span>Email address</span>
                  <div>
                    <Mail size={17} />
                    <input
                      required
                      type="email"
                      autoComplete="email"
                      value={form.email}
                      placeholder="business@example.com"
                      onChange={(event) =>
                        updateField("email", event.target.value)
                      }
                    />
                  </div>
                </label>

                <label className="google-register-field">
                  <span>Phone number</span>
                  <div>
                    <Phone size={17} />
                    <input
                      required
                      type="tel"
                      autoComplete="tel"
                      value={form.phone}
                      placeholder="+966 5X XXX XXXX"
                      onChange={(event) =>
                        updateField("phone", event.target.value)
                      }
                    />
                  </div>
                </label>

                <label className="google-register-field">
                  <span>City or location</span>
                  <div>
                    <MapPin size={17} />
                    <input
                      required
                      value={form.location}
                      placeholder="Jubail, Saudi Arabia"
                      onChange={(event) =>
                        updateField("location", event.target.value)
                      }
                    />
                  </div>
                </label>

                <label className="google-register-field">
                  <span>Tax / VAT number</span>
                  <div>
                    <FileBadge2 size={17} />
                    <input
                      value={form.tax_number}
                      placeholder="Optional"
                      onChange={(event) =>
                        updateField("tax_number", event.target.value)
                      }
                    />
                  </div>
                </label>

                <label className="google-register-field">
                  <span>Commercial licence number</span>
                  <div>
                    <FileBadge2 size={17} />
                    <input
                      value={form.license_number}
                      placeholder="Optional"
                      onChange={(event) =>
                        updateField("license_number", event.target.value)
                      }
                    />
                  </div>
                </label>

                <label className="google-register-field full">
                  <span>Business address</span>
                  <div className="textarea">
                    <MapPin size={17} />
                    <textarea
                      required
                      rows="3"
                      autoComplete="street-address"
                      value={form.address}
                      placeholder="Building, street, district, city and postal code"
                      onChange={(event) =>
                        updateField("address", event.target.value)
                      }
                    />
                  </div>
                </label>
              </div>
            </section>

            <section className="google-register-section">
              <div className="google-register-section-title">
                <span className="google-register-step">3</span>
                <div>
                  <h2>Security</h2>
                  <p>Create a password for your merchant account.</p>
                </div>
              </div>

              <div className="google-register-grid">
                <label className="google-register-field">
                  <span>Password</span>
                  <div>
                    <LockKeyhole size={17} />
                    <input
                      required
                      minLength="8"
                      type={showPassword ? "text" : "password"}
                      autoComplete="new-password"
                      value={form.password}
                      placeholder="Minimum 8 characters"
                      onChange={(event) =>
                        updateField("password", event.target.value)
                      }
                    />
                    <button
                      type="button"
                      className="google-register-password-toggle"
                      onClick={() => setShowPassword((value) => !value)}
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                    </button>
                  </div>
                </label>

                <label className="google-register-field">
                  <span>Confirm password</span>
                  <div>
                    <LockKeyhole size={17} />
                    <input
                      required
                      minLength="8"
                      type={showConfirmPassword ? "text" : "password"}
                      autoComplete="new-password"
                      value={form.confirm_password}
                      placeholder="Enter password again"
                      onChange={(event) =>
                        updateField("confirm_password", event.target.value)
                      }
                    />
                    <button
                      type="button"
                      className="google-register-password-toggle"
                      onClick={() =>
                        setShowConfirmPassword((value) => !value)
                      }
                      aria-label={
                        showConfirmPassword
                          ? "Hide password"
                          : "Show password"
                      }
                    >
                      {showConfirmPassword ? (
                        <EyeOff size={17} />
                      ) : (
                        <Eye size={17} />
                      )}
                    </button>
                    {passwordMatches && (
                      <CheckCircle2
                        size={17}
                        className="google-register-password-valid"
                      />
                    )}
                  </div>
                </label>
              </div>
            </section>

            <div className="google-register-notice">
              <ShieldCheck size={18} />
              <span>
                Your application is reviewed by Tofado Admin before account
                activation.
              </span>
            </div>

            {error && (
              <div className="google-register-alert error" role="alert">
                {error}
              </div>
            )}

            {success && (
              <div className="google-register-alert success">
                <CheckCircle2 size={18} />
                <span>{success}</span>
              </div>
            )}

            <button
              type="submit"
              className="google-register-submit"
              disabled={submitting}
            >
              {submitting ? (
                <>
                  <LoaderCircle
                    size={18}
                    className="google-register-spinner"
                  />
                  Submitting application...
                </>
              ) : (
                <>
                  Submit application
                </>
              )}
            </button>

            <p className="google-register-login">
              Already have an account? <Link to="/login">Sign in</Link>
            </p>
          </form>
        </section>
      </main>
    </div>
  );
}