import { useEffect, useMemo, useRef, useState } from "react";
import {
  Building2,
  Camera,
  CheckCircle2,
  FileBadge2,
  Globe2,
  ImagePlus,
  LoaderCircle,
  Mail,
  MapPin,
  Phone,
  Save,
  ShieldCheck,
  Store,
  Trash2,
  UploadCloud,
  UserRound,
} from "lucide-react";

import api from "../services/api";
import { useAuth } from "../context/AuthContext";
import { Spinner } from "../components/UI";
import "./Profile.css";

const BUSINESS_CATEGORIES = [
  "Grocery & Supermarket",
  "Food Distribution",
  "Fresh Produce",
  "Bakery & Confectionery",
  "Beverages",
  "Frozen Foods",
  "Dairy Products",
  "Meat & Poultry",
  "Cleaning & Household",
  "Personal Care",
  "General Trading",
  "Other",
];

const SHOP_TYPES = [
  "Retail Shop",
  "Supermarket",
  "Mini Market",
  "Hypermarket",
  "Wholesaler",
  "Distributor",
  "Importer",
  "Manufacturer",
  "Other",
];

const EMPTY_PROFILE = {
  name: "",
  business_name: "",
  email: "",
  phone: "",
  location: "",
  address: "",
  tax_number: "",
  business_category: "",
  shop_type: "",
  description: "",
  website: "",
  logo_url: "",
};

function normalizeProfile(data = {}) {
  return {
    ...EMPTY_PROFILE,
    ...data,
    business_category: data.business_category || "",
    shop_type: data.shop_type || "",
    description: data.description || "",
    website: data.website || "",
    logo_url: data.logo_url || "",
  };
}

function validateProfile(profile) {
  if (!profile.name.trim()) return "Contact name is required.";
  if (!profile.business_name.trim()) return "Business name is required.";
  if (!profile.phone.trim()) return "Phone number is required.";
  if (!profile.location.trim()) return "City or location is required.";
  if (!profile.business_category) return "Select a business category.";
  if (!profile.shop_type) return "Select a shop type.";
  return "";
}

export default function Profile() {
  const { user } = useAuth();
  const fileInputRef = useRef(null);

  const [form, setForm] = useState(null);
  const [originalForm, setOriginalForm] = useState(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [removingLogo, setRemovingLogo] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadProfile() {
      try {
        setError("");

        const response = await api.get("/profile");
        const profile = normalizeProfile(response.data);

        if (active) {
          setForm(profile);
          setOriginalForm(profile);
        }
      } catch (requestError) {
        if (active) {
          setError(
            requestError.response?.data?.message ||
              "Unable to load business profile."
          );
        }
      }
    }

    loadProfile();

    return () => {
      active = false;
    };
  }, []);

  const initials = useMemo(() => {
    const value =
      form?.business_name || form?.name || user?.name || "Tofado";

    return String(value)
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("");
  }, [form, user]);

  const hasChanges = useMemo(() => {
    if (!form || !originalForm) return false;
    return JSON.stringify(form) !== JSON.stringify(originalForm);
  }, [form, originalForm]);

  const updateField = (key, value) => {
    setMessage("");
    setError("");

    setForm((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const uploadLogo = async (file) => {
    if (!file) return;

    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];

    if (!allowedTypes.includes(file.type)) {
      setError("Use a JPG, PNG, or WEBP image.");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError("Logo must be smaller than 5 MB.");
      return;
    }

    try {
      setUploadingLogo(true);
      setError("");
      setMessage("");

      const payload = new FormData();
      payload.append("logo", file);

      const response = await api.post("/profile/logo", payload, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      const logoUrl = response.data?.logo_url;

      if (!logoUrl) {
        throw new Error("Logo URL was not returned by the server.");
      }

      setForm((current) => ({
        ...current,
        logo_url: logoUrl,
      }));

      setOriginalForm((current) => ({
        ...current,
        logo_url: logoUrl,
      }));

      setMessage("Business logo uploaded successfully.");
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          requestError.message ||
          "Unable to upload business logo."
      );
    } finally {
      setUploadingLogo(false);

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const removeLogo = async () => {
    if (!form?.logo_url) return;

    try {
      setRemovingLogo(true);
      setError("");
      setMessage("");

      await api.delete("/profile/logo");

      setForm((current) => ({
        ...current,
        logo_url: "",
      }));

      setOriginalForm((current) => ({
        ...current,
        logo_url: "",
      }));

      setMessage("Business logo removed.");
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          "Unable to remove business logo."
      );
    } finally {
      setRemovingLogo(false);
    }
  };

  const saveProfile = async (event) => {
    event.preventDefault();

    const validationError = validateProfile(form);

    if (validationError) {
      setError(validationError);
      return;
    }

    try {
      setSaving(true);
      setMessage("");
      setError("");

      const payload = {
        name: form.name.trim(),
        business_name: form.business_name.trim(),
        phone: form.phone.trim(),
        location: form.location.trim(),
        address: form.address.trim(),
        tax_number: form.tax_number.trim(),
        business_category: form.business_category,
        shop_type: form.shop_type,
        description: form.description.trim(),
        website: form.website.trim(),
      };

      const response = await api.put("/profile", payload);
      const updatedProfile = normalizeProfile({
        ...form,
        ...(response.data || {}),
      });

      setForm(updatedProfile);
      setOriginalForm(updatedProfile);
      setMessage("Business profile updated successfully.");
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          "Unable to update business profile."
      );
    } finally {
      setSaving(false);
    }
  };

  if (!form && !error) {
    return <Spinner />;
  }

  if (error && !form) {
    return (
      <div className="profile-load-error">
        <h2>Unable to load profile</h2>
        <p>{error}</p>
      </div>
    );
  }

  return (
    <div className="business-profile-page">
      <section className="business-profile-header">
        <div>
          <span className="business-profile-eyebrow">
            Account settings
          </span>

          <h1>Business profile</h1>

          <p>
            Manage your company details, public business logo, category,
            shop type, tax registration, and contact information.
          </p>
        </div>

        <div className="business-profile-header-status">
          <div className="business-profile-header-icon">
            <Building2 size={29} />
          </div>

          <span>
            <strong>Verified workspace</strong>
            <small>Business information connected</small>
          </span>

          <CheckCircle2 size={20} />
        </div>
      </section>

      <div className="business-profile-layout">
        <aside className="business-profile-sidebar">
          <div className="business-identity-card">
            <div className="business-logo-wrap">
              {form.logo_url ? (
                <img
                  src={form.logo_url}
                  alt={`${form.business_name || "Business"} logo`}
                  className="business-logo-image"
                />
              ) : (
                <div className="business-profile-avatar">
                  {initials}
                </div>
              )}

              <button
                type="button"
                className="business-logo-edit"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingLogo}
                aria-label="Upload business logo"
              >
                {uploadingLogo ? (
                  <LoaderCircle
                    size={17}
                    className="profile-save-spinner"
                  />
                ) : (
                  <Camera size={17} />
                )}
              </button>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              hidden
              onChange={(event) =>
                uploadLogo(event.target.files?.[0])
              }
            />

            <h2>{form.business_name || "Business name"}</h2>
            <p>{form.name || "Contact person"}</p>

            <div className="business-verification-badge">
              <ShieldCheck size={17} />
              Verified merchant
            </div>

            <div className="business-logo-actions">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingLogo}
              >
                <UploadCloud size={16} />
                {form.logo_url ? "Change logo" : "Upload logo"}
              </button>

              {form.logo_url && (
                <button
                  type="button"
                  className="remove"
                  onClick={removeLogo}
                  disabled={removingLogo}
                >
                  {removingLogo ? (
                    <LoaderCircle
                      size={16}
                      className="profile-save-spinner"
                    />
                  ) : (
                    <Trash2 size={16} />
                  )}
                  Remove
                </button>
              )}
            </div>

            <small className="business-logo-help">
              JPG, PNG, or WEBP. Maximum 5 MB.
            </small>

            <div className="business-profile-meta">
              <div>
                <Store size={17} />

                <span>
                  <small>Account type</small>
                  <strong>{user?.role || "merchant"}</strong>
                </span>
              </div>

              <div>
                <MapPin size={17} />

                <span>
                  <small>Location</small>
                  <strong>{form.location || "Not added"}</strong>
                </span>
              </div>

              <div>
                <Mail size={17} />

                <span>
                  <small>Email</small>
                  <strong>{form.email || "Not available"}</strong>
                </span>
              </div>
            </div>
          </div>

          <div className="profile-security-card">
            <div className="profile-security-icon">
              <CheckCircle2 size={21} />
            </div>

            <div>
              <span>Protected information</span>
              <p>
                Email and merchant role can only be changed by an
                administrator.
              </p>
            </div>
          </div>
        </aside>

        <form
          className="business-profile-form-card"
          onSubmit={saveProfile}
        >
          <div className="business-profile-form-header">
            <div>
              <span>Company details</span>
              <h2>Business information</h2>
              <p>
                These details are used for orders, invoices, catalog
                pages, and merchant verification.
              </p>
            </div>

            <FileBadge2 size={23} />
          </div>

          <div className="business-profile-form-grid">
            <label className="business-profile-field">
              <span>Contact name *</span>

              <div className="business-profile-control">
                <UserRound size={18} />

                <input
                  value={form.name}
                  placeholder="Enter contact person name"
                  onChange={(event) =>
                    updateField("name", event.target.value)
                  }
                  required
                />
              </div>
            </label>

            <label className="business-profile-field">
              <span>Business name *</span>

              <div className="business-profile-control">
                <Building2 size={18} />

                <input
                  value={form.business_name}
                  placeholder="Enter registered business name"
                  onChange={(event) =>
                    updateField(
                      "business_name",
                      event.target.value
                    )
                  }
                  required
                />
              </div>
            </label>

            <label className="business-profile-field">
              <span>Business category *</span>

              <div className="business-profile-control">
                <Store size={18} />

                <select
                  value={form.business_category}
                  onChange={(event) =>
                    updateField(
                      "business_category",
                      event.target.value
                    )
                  }
                  required
                >
                  <option value="">Select category</option>

                  {BUSINESS_CATEGORIES.map((category) => (
                    <option value={category} key={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </div>
            </label>

            <label className="business-profile-field">
              <span>Shop type *</span>

              <div className="business-profile-control">
                <ImagePlus size={18} />

                <select
                  value={form.shop_type}
                  onChange={(event) =>
                    updateField("shop_type", event.target.value)
                  }
                  required
                >
                  <option value="">Select shop type</option>

                  {SHOP_TYPES.map((shopType) => (
                    <option value={shopType} key={shopType}>
                      {shopType}
                    </option>
                  ))}
                </select>
              </div>
            </label>

            <label className="business-profile-field">
              <span>Email address</span>

              <div className="business-profile-control disabled">
                <Mail size={18} />
                <input value={form.email} disabled />
              </div>

              <small className="business-profile-help">
                Email changes require administrator approval.
              </small>
            </label>

            <label className="business-profile-field">
              <span>Phone number *</span>

              <div className="business-profile-control">
                <Phone size={18} />

                <input
                  type="tel"
                  value={form.phone}
                  placeholder="+966 5X XXX XXXX"
                  onChange={(event) =>
                    updateField("phone", event.target.value)
                  }
                  required
                />
              </div>
            </label>

            <label className="business-profile-field">
              <span>City or location *</span>

              <div className="business-profile-control">
                <MapPin size={18} />

                <input
                  value={form.location}
                  placeholder="Example: Jubail, Saudi Arabia"
                  onChange={(event) =>
                    updateField("location", event.target.value)
                  }
                  required
                />
              </div>
            </label>

            <label className="business-profile-field">
              <span>Tax or VAT number</span>

              <div className="business-profile-control">
                <FileBadge2 size={18} />

                <input
                  value={form.tax_number}
                  placeholder="Enter tax registration number"
                  onChange={(event) =>
                    updateField("tax_number", event.target.value)
                  }
                />
              </div>
            </label>

            <div className="business-profile-section-divider full">
              <div>
                <Globe2 size={18} />
              </div>

              <span>
                <strong>Public business details</strong>
                <small>Information used across your storefront and documents.</small>
              </span>
            </div>

            <label className="business-profile-field full">
              <span>Website</span>

              <div className="business-profile-control">
                <Globe2 size={18} />

                <input
                  type="url"
                  value={form.website}
                  placeholder="https://yourbusiness.com"
                  onChange={(event) =>
                    updateField("website", event.target.value)
                  }
                />
              </div>
            </label>

            <label className="business-profile-field full">
              <span>Business description</span>

              <div className="business-profile-control textarea">
                <Building2 size={18} />

                <textarea
                  rows="4"
                  maxLength="500"
                  value={form.description}
                  placeholder="Describe your products, service area, and business."
                  onChange={(event) =>
                    updateField("description", event.target.value)
                  }
                />
              </div>

              <small className="business-profile-help">
                {form.description.length}/500 characters
              </small>
            </label>

            <label className="business-profile-field full">
              <span>Registered business address</span>

              <div className="business-profile-control textarea">
                <MapPin size={18} />

                <textarea
                  rows="4"
                  value={form.address}
                  placeholder="Building, street, district, city, and postal code"
                  onChange={(event) =>
                    updateField("address", event.target.value)
                  }
                />
              </div>
            </label>
          </div>

          {message && (
            <div className="business-profile-alert success">
              <CheckCircle2 size={19} />
              <span>{message}</span>
            </div>
          )}

          {error && (
            <div className="business-profile-alert error">
              <span className="profile-error-symbol">!</span>
              <span>{error}</span>
            </div>
          )}

          <div className="business-profile-actions">
            <span>
              {hasChanges
                ? "You have unsaved changes."
                : "Your profile information is up to date."}
            </span>

            <button
              type="submit"
              className="business-profile-save"
              disabled={saving || !hasChanges}
            >
              {saving ? (
                <>
                  <LoaderCircle
                    size={18}
                    className="profile-save-spinner"
                  />
                  Saving...
                </>
              ) : (
                <>
                  <Save size={18} />
                  Save changes
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}