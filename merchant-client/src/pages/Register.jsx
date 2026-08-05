import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Building2,
  CheckCircle2,
  FileBadge2,
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
    <div className="merchant-register-page">
      <div className="merchant-register-background" />

      <main className="merchant-register-shell">
        <section className="merchant-register-brand-panel">
          <div className="merchant-register-logo">
            <img src={logo} alt="Tofado Merchant" />
          </div>

          <span className="merchant-register-eyebrow">
            Verified B2B marketplace
          </span>

          <h1>Grow your grocery business with Tofado Merchant</h1>

          <p>
            Retail shops and wholesale dealers can request access to a
            trusted procurement network. Every business is reviewed by
            Tofado Admin before activation.
          </p>

          <div className="merchant-register-benefits">
            <article>
              <div>
                <ShieldCheck size={20} />
              </div>

              <span>
                <strong>Admin verification</strong>
                <small>
                  Every shop and wholesaler is checked before account
                  activation.
                </small>
              </span>
            </article>

            <article>
              <div>
                <Store size={20} />
              </div>

              <span>
                <strong>Retail and wholesale access</strong>
                <small>
                  Select the correct business type during registration.
                </small>
              </span>
            </article>

            <article>
              <div>
                <Building2 size={20} />
              </div>

              <span>
                <strong>Professional business tools</strong>
                <small>
                  Manage orders, catalogues, invoices, deliveries, and
                  payments.
                </small>
              </span>
            </article>
          </div>
        </section>

        <section className="merchant-register-form-panel">
          <div className="merchant-register-form-header">
            <Link to="/login">
              <ArrowLeft size={17} />
              Back to sign in
            </Link>

            <span>Merchant application</span>
            <h2>Request an account</h2>

            <p>
              Complete your business information. Registration does not
              provide immediate access until admin approval.
            </p>
          </div>

          <form className="merchant-register-form" onSubmit={submit}>
            <div className="merchant-type-selector">
              <button
                type="button"
                className={
                  form.role === "retailer"
                    ? "merchant-type-active"
                    : ""
                }
                onClick={() => updateField("role", "retailer")}
              >
                <Store size={21} />

                <span>
                  <strong>Retail shop</strong>
                  <small>
                    Purchase grocery items from wholesale dealers
                  </small>
                </span>
              </button>

              <button
                type="button"
                className={
                  form.role === "wholesaler"
                    ? "merchant-type-active"
                    : ""
                }
                onClick={() => updateField("role", "wholesaler")}
              >
                <Building2 size={21} />

                <span>
                  <strong>Wholesale dealer</strong>
                  <small>
                    Supply products and manage retailer orders
                  </small>
                </span>
              </button>
            </div>

            <div className="merchant-register-grid">
              <label className="merchant-register-field">
                <span>Contact person</span>

                <div>
                  <UserRound size={18} />

                  <input
                    required
                    value={form.name}
                    placeholder="Enter full name"
                    onChange={(event) =>
                      updateField("name", event.target.value)
                    }
                  />
                </div>
              </label>

              <label className="merchant-register-field">
                <span>Business name</span>

                <div>
                  <Building2 size={18} />

                  <input
                    required
                    value={form.business_name}
                    placeholder="Registered shop or company name"
                    onChange={(event) =>
                      updateField(
                        "business_name",
                        event.target.value
                      )
                    }
                  />
                </div>
              </label>

              <label className="merchant-register-field">
                <span>Email address</span>

                <div>
                  <Mail size={18} />

                  <input
                    required
                    type="email"
                    value={form.email}
                    placeholder="business@example.com"
                    onChange={(event) =>
                      updateField("email", event.target.value)
                    }
                  />
                </div>
              </label>

              <label className="merchant-register-field">
                <span>Phone number</span>

                <div>
                  <Phone size={18} />

                  <input
                    required
                    type="tel"
                    value={form.phone}
                    placeholder="+966 5X XXX XXXX"
                    onChange={(event) =>
                      updateField("phone", event.target.value)
                    }
                  />
                </div>
              </label>

              <label className="merchant-register-field">
                <span>City or location</span>

                <div>
                  <MapPin size={18} />

                  <input
                    required
                    value={form.location}
                    placeholder="Example: Jubail, Saudi Arabia"
                    onChange={(event) =>
                      updateField("location", event.target.value)
                    }
                  />
                </div>
              </label>

              <label className="merchant-register-field">
                <span>Tax or VAT number</span>

                <div>
                  <FileBadge2 size={18} />

                  <input
                    value={form.tax_number}
                    placeholder="Optional"
                    onChange={(event) =>
                      updateField(
                        "tax_number",
                        event.target.value
                      )
                    }
                  />
                </div>
              </label>

              <label className="merchant-register-field">
                <span>Commercial licence number</span>

                <div>
                  <FileBadge2 size={18} />

                  <input
                    value={form.license_number}
                    placeholder="Optional"
                    onChange={(event) =>
                      updateField(
                        "license_number",
                        event.target.value
                      )
                    }
                  />
                </div>
              </label>

              <label className="merchant-register-field full">
                <span>Business address</span>

                <div className="textarea">
                  <MapPin size={18} />

                  <textarea
                    required
                    rows="4"
                    value={form.address}
                    placeholder="Building, street, district, city and postal code"
                    onChange={(event) =>
                      updateField("address", event.target.value)
                    }
                  />
                </div>
              </label>

              <label className="merchant-register-field">
                <span>Password</span>

                <div>
                  <LockKeyhole size={18} />

                  <input
                    required
                    minLength="8"
                    type="password"
                    value={form.password}
                    placeholder="Minimum 8 characters"
                    onChange={(event) =>
                      updateField("password", event.target.value)
                    }
                  />
                </div>
              </label>

              <label className="merchant-register-field">
                <span>Confirm password</span>

                <div>
                  <LockKeyhole size={18} />

                  <input
                    required
                    minLength="8"
                    type="password"
                    value={form.confirm_password}
                    placeholder="Enter password again"
                    onChange={(event) =>
                      updateField(
                        "confirm_password",
                        event.target.value
                      )
                    }
                  />

                  {passwordMatches && (
                    <CheckCircle2
                      size={17}
                      className="merchant-password-valid"
                    />
                  )}
                </div>
              </label>
            </div>

            <div className="merchant-register-notice">
              <ShieldCheck size={19} />

              <p>
                Submitting this form creates a verification request only.
                Tofado Admin will approve or reject the business after
                checking the provided information.
              </p>
            </div>

            {error && (
              <div className="merchant-register-alert error">
                {error}
              </div>
            )}

            {success && (
              <div className="merchant-register-alert success">
                <CheckCircle2 size={19} />
                <span>{success}</span>
              </div>
            )}

            <button
              type="submit"
              className="merchant-register-submit"
              disabled={submitting}
            >
              {submitting ? (
                <>
                  <LoaderCircle
                    size={18}
                    className="merchant-register-spinner"
                  />
                  Submitting request...
                </>
              ) : (
                <>
                  <ShieldCheck size={18} />
                  Submit verification request
                </>
              )}
            </button>

            <p className="merchant-register-login">
              Already submitted or approved?{" "}
              <Link to="/login">Sign in</Link>
            </p>
          </form>
        </section>
      </main>
    </div>
  );
}