import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  BadgeCheck,
  Building2,
  CheckCircle2,
  ChevronRight,
  Eye,
  EyeOff,
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
import "./Register.css";

const BUSINESS_CATEGORIES = [
  "Grocery & FMCG",
  "Food & Beverage",
  "Pharmacy & Medical",
  "Restaurant Supplies",
  "Hotel Supplies",
  "Building Materials",
  "Construction",
  "Industrial",
  "Electronics",
  "Automotive",
  "Fashion & Apparel",
  "Office Supplies",
  "Cleaning & Hygiene",
  "Packaging",
  "Other",
];

const RETAILER_TYPES = [
  "Grocery store",
  "Supermarket",
  "Minimart / convenience store",
  "Restaurant / cafe",
  "Hotel / hospitality",
  "Pharmacy",
  "Hardware store",
  "Electronics store",
  "Fashion / apparel store",
  "Online retailer",
  "Other retailer",
];

const WHOLESALER_TYPES = [
  "Wholesaler",
  "Distributor",
  "Importer",
  "Manufacturer",
  "Authorized dealer",
  "Trading company",
  "Cash & carry",
  "Other wholesaler",
];

const initialForm = {
  role: "retailer",
  name: "",
  business_name: "",
  business_category: "",
  shop_type: "",
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
  const [form, setForm] = useState(initialForm);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [submittedEmail, setSubmittedEmail] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const businessTypes = useMemo(
    () => (form.role === "wholesaler" ? WHOLESALER_TYPES : RETAILER_TYPES),
    [form.role]
  );

  const passwordStrong =
    form.password.length >= 8 &&
    /[A-Za-z]/.test(form.password) &&
    /\d/.test(form.password);

  const passwordMatches =
    form.confirm_password.length > 0 &&
    form.password === form.confirm_password;

  const updateField = (key, value) => {
    setError("");

    setForm((current) => ({
      ...current,
      [key]: value,
      ...(key === "role" ? { shop_type: "" } : {}),
    }));
  };

  const submit = async (event) => {
    event.preventDefault();

    if (
      !form.name.trim() ||
      !form.business_name.trim() ||
      !form.business_category ||
      !form.shop_type ||
      !form.email.trim() ||
      !form.phone.trim() ||
      !form.location.trim() ||
      !form.address.trim()
    ) {
      setError("Complete all required business details.");
      return;
    }

    if (!passwordStrong) {
      setError("Password must be at least 8 characters and include a letter and number.");
      return;
    }

    if (!passwordMatches) {
      setError("Password confirmation does not match.");
      return;
    }

    try {
      setSubmitting(true);
      setError("");

      const email = form.email.trim().toLowerCase();

      await api.post("/applications", {
        role: form.role,
        name: form.name.trim(),
        business_name: form.business_name.trim(),
        business_category: form.business_category,
        shop_type: form.shop_type,
        email,
        phone: form.phone.trim(),
        location: form.location.trim(),
        address: form.address.trim(),
        tax_number: form.tax_number.trim() || null,
        license_number: form.license_number.trim() || null,
        password: form.password,
      });

      setSubmittedEmail(email);
      setSuccess(true);
      setForm(initialForm);
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          "Unable to submit your merchant application."
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (success) {
    return (
      <div className="merchant-register-page">
        <header className="merchant-register-topbar">
          <Link to="/login" className="merchant-register-logo">
            <img src={logo} alt="Tofado Merchant" />
          </Link>

          <Link to="/login" className="merchant-register-back">
            <ArrowLeft size={16} />
            Sign in
          </Link>
        </header>

        <main className="merchant-register-success-wrap">
          <section className="merchant-register-success-card">
            <div className="merchant-register-success-icon">
              <CheckCircle2 size={34} />
            </div>

            <span className="merchant-register-kicker">Application received</span>
            <h1>Your business is under verification.</h1>
            <p>
              We received the merchant application for <strong>{submittedEmail}</strong>.
              Tofado Admin will review the business information before the account
              becomes active.
            </p>

            <div className="merchant-register-status-flow">
              <div className="done">
                <span>1</span>
                <div>
                  <strong>Application submitted</strong>
                  <small>Your business details were received.</small>
                </div>
              </div>

              <div className="active">
                <span>2</span>
                <div>
                  <strong>Admin verification</strong>
                  <small>Business information is being reviewed.</small>
                </div>
              </div>

              <div>
                <span>3</span>
                <div>
                  <strong>Account activation</strong>
                  <small>After approval, sign in with the password you created.</small>
                </div>
              </div>
            </div>

            <Link to="/login" className="merchant-register-primary-link">
              Go to sign in
              <ChevronRight size={17} />
            </Link>

            <button
              type="button"
              className="merchant-register-secondary-link"
              onClick={() => {
                setSuccess(false);
                setSubmittedEmail("");
              }}
            >
              Submit another application
            </button>
          </section>
        </main>
      </div>
    );
  }

  return (
    <div className="merchant-register-page">
      <header className="merchant-register-topbar">
        <Link to="/login" className="merchant-register-logo">
          <img src={logo} alt="Tofado Merchant" />
        </Link>

        <Link to="/login" className="merchant-register-back">
          <ArrowLeft size={16} />
          Back to sign in
        </Link>
      </header>

      <main className="merchant-register-shell">
        <aside className="merchant-register-intro">
          <span className="merchant-register-kicker">TOFADO MERCHANT</span>
          <h1>Join the B2B marketplace built for direct trade.</h1>
          <p>
            Register your retail or wholesale business. After verification,
            retailers can discover suppliers and wholesalers can publish their
            storefront and catalog.
          </p>

          <div className="merchant-register-benefits">
            <div>
              <BadgeCheck size={19} />
              <span>
                <strong>Verified business network</strong>
                <small>Merchant accounts are activated after admin approval.</small>
              </span>
            </div>

            <div>
              <Store size={19} />
              <span>
                <strong>Marketplace visibility</strong>
                <small>Approved wholesalers can publish a searchable storefront.</small>
              </span>
            </div>

            <div>
              <ShieldCheck size={19} />
              <span>
                <strong>Controlled B2B access</strong>
                <small>Retailers and wholesalers operate through verified accounts.</small>
              </span>
            </div>
          </div>

          <div className="merchant-register-flow-card">
            <span>How it works</span>
            <div>
              <b>1</b>
              <p><strong>Register</strong><small>Submit business details</small></p>
            </div>
            <div>
              <b>2</b>
              <p><strong>Verify</strong><small>Admin reviews the application</small></p>
            </div>
            <div>
              <b>3</b>
              <p><strong>Trade</strong><small>Account becomes active</small></p>
            </div>
          </div>
        </aside>

        <section className="merchant-register-card">
          <div className="merchant-register-heading">
            <span>Merchant registration</span>
            <h2>Create your business account</h2>
            <p>Fields marked with * are required for verification.</p>
          </div>

          <form onSubmit={submit} className="merchant-register-form">
            <section className="merchant-register-section">
              <div className="merchant-register-section-head">
                <span>1</span>
                <div>
                  <h3>Choose account type</h3>
                  <p>Select the role your business will use on Tofado.</p>
                </div>
              </div>

              <div className="merchant-register-role-grid">
                <button
                  type="button"
                  className={form.role === "retailer" ? "active" : ""}
                  onClick={() => updateField("role", "retailer")}
                >
                  <div className="merchant-register-role-icon">
                    <Store size={21} />
                  </div>
                  <span>
                    <strong>Retailer</strong>
                    <small>Find wholesalers and purchase for your business.</small>
                  </span>
                  {form.role === "retailer" && <CheckCircle2 size={18} />}
                </button>

                <button
                  type="button"
                  className={form.role === "wholesaler" ? "active" : ""}
                  onClick={() => updateField("role", "wholesaler")}
                >
                  <div className="merchant-register-role-icon">
                    <Building2 size={21} />
                  </div>
                  <span>
                    <strong>Wholesaler</strong>
                    <small>Publish products and sell directly to retailers.</small>
                  </span>
                  {form.role === "wholesaler" && <CheckCircle2 size={18} />}
                </button>
              </div>
            </section>

            <section className="merchant-register-section">
              <div className="merchant-register-section-head">
                <span>2</span>
                <div>
                  <h3>Business details</h3>
                  <p>Use official information that Tofado can verify.</p>
                </div>
              </div>

              <div className="merchant-register-grid">
                <Field label="Contact person *" icon={<UserRound size={16} />}>
                  <input
                    required
                    autoComplete="name"
                    value={form.name}
                    placeholder="Full name"
                    onChange={(e) => updateField("name", e.target.value)}
                  />
                </Field>

                <Field label="Business name *" icon={<Building2 size={16} />}>
                  <input
                    required
                    value={form.business_name}
                    placeholder="Registered business name"
                    onChange={(e) => updateField("business_name", e.target.value)}
                  />
                </Field>

                <Field label="Business category *" icon={<Store size={16} />}>
                  <select
                    required
                    value={form.business_category}
                    onChange={(e) => updateField("business_category", e.target.value)}
                  >
                    <option value="">Select category</option>
                    {BUSINESS_CATEGORIES.map((category) => (
                      <option value={category} key={category}>
                        {category}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field
                  label={form.role === "wholesaler" ? "Wholesale business type *" : "Retail shop type *"}
                  icon={<Store size={16} />}
                >
                  <select
                    required
                    value={form.shop_type}
                    onChange={(e) => updateField("shop_type", e.target.value)}
                  >
                    <option value="">Select business type</option>
                    {businessTypes.map((type) => (
                      <option value={type} key={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Email address *" icon={<Mail size={16} />}>
                  <input
                    required
                    type="email"
                    autoComplete="email"
                    value={form.email}
                    placeholder="business@example.com"
                    onChange={(e) => updateField("email", e.target.value)}
                  />
                </Field>

                <Field label="Phone number *" icon={<Phone size={16} />}>
                  <input
                    required
                    type="tel"
                    autoComplete="tel"
                    value={form.phone}
                    placeholder="+966 5X XXX XXXX"
                    onChange={(e) => updateField("phone", e.target.value)}
                  />
                </Field>

                <Field label="City / location *" icon={<MapPin size={16} />}>
                  <input
                    required
                    value={form.location}
                    placeholder="Riyadh, Saudi Arabia"
                    onChange={(e) => updateField("location", e.target.value)}
                  />
                </Field>

                <Field label="Tax / VAT number" icon={<FileBadge2 size={16} />}>
                  <input
                    value={form.tax_number}
                    placeholder="Optional"
                    onChange={(e) => updateField("tax_number", e.target.value)}
                  />
                </Field>

                <Field label="Commercial licence / CR number" icon={<FileBadge2 size={16} />}>
                  <input
                    value={form.license_number}
                    placeholder="Optional"
                    onChange={(e) => updateField("license_number", e.target.value)}
                  />
                </Field>

                <label className="merchant-register-field full">
                  <span>Business address *</span>
                  <div className="merchant-register-control textarea">
                    <MapPin size={16} />
                    <textarea
                      required
                      rows="3"
                      value={form.address}
                      placeholder="Building, street, district, city and postal code"
                      onChange={(e) => updateField("address", e.target.value)}
                    />
                  </div>
                </label>
              </div>
            </section>

            <section className="merchant-register-section">
              <div className="merchant-register-section-head">
                <span>3</span>
                <div>
                  <h3>Account security</h3>
                  <p>Create the password you will use after approval.</p>
                </div>
              </div>

              <div className="merchant-register-grid">
                <label className="merchant-register-field">
                  <span>Password *</span>
                  <div className="merchant-register-control">
                    <LockKeyhole size={16} />
                    <input
                      required
                      minLength="8"
                      type={showPassword ? "text" : "password"}
                      autoComplete="new-password"
                      value={form.password}
                      placeholder="Minimum 8 characters"
                      onChange={(e) => updateField("password", e.target.value)}
                    />
                    <button
                      type="button"
                      className="merchant-register-eye"
                      onClick={() => setShowPassword((value) => !value)}
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  <small className={form.password && passwordStrong ? "valid" : ""}>
                    Use at least 8 characters with a letter and number.
                  </small>
                </label>

                <label className="merchant-register-field">
                  <span>Confirm password *</span>
                  <div className="merchant-register-control">
                    <LockKeyhole size={16} />
                    <input
                      required
                      minLength="8"
                      type={showConfirmPassword ? "text" : "password"}
                      autoComplete="new-password"
                      value={form.confirm_password}
                      placeholder="Enter password again"
                      onChange={(e) =>
                        updateField("confirm_password", e.target.value)
                      }
                    />
                    <button
                      type="button"
                      className="merchant-register-eye"
                      onClick={() =>
                        setShowConfirmPassword((value) => !value)
                      }
                      aria-label={
                        showConfirmPassword ? "Hide password" : "Show password"
                      }
                    >
                      {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                    {passwordMatches && (
                      <CheckCircle2
                        size={16}
                        className="merchant-register-valid-icon"
                      />
                    )}
                  </div>
                  <small className={passwordMatches ? "valid" : ""}>
                    {form.confirm_password
                      ? passwordMatches
                        ? "Passwords match."
                        : "Passwords must match."
                      : "Repeat your password."}
                  </small>
                </label>
              </div>
            </section>

            <div className="merchant-register-review-note">
              <ShieldCheck size={18} />
              <p>
                <strong>Verification required.</strong>
                Tofado Admin reviews your application before activating the
                merchant account.
              </p>
            </div>

            {error && (
              <div className="merchant-register-alert" role="alert">
                {error}
              </div>
            )}

            <button
              type="submit"
              className="merchant-register-submit"
              disabled={submitting}
            >
              {submitting ? (
                <>
                  <LoaderCircle size={18} className="merchant-register-spin" />
                  Submitting application...
                </>
              ) : (
                <>
                  Submit for verification
                  <ChevronRight size={17} />
                </>
              )}
            </button>

            <p className="merchant-register-login">
              Already approved? <Link to="/login">Sign in to Tofado Merchant</Link>
            </p>
          </form>
        </section>
      </main>
    </div>
  );
}

function Field({ label, icon, children }) {
  return (
    <label className="merchant-register-field">
      <span>{label}</span>
      <div className="merchant-register-control">
        {icon}
        {children}
      </div>
    </label>
  );
}