import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Building2,
  CheckCircle2,
  CreditCard,
  LoaderCircle,
  Mail,
  MapPin,
  Phone,
  Save,
  Store,
  UserRound,
} from "lucide-react";

import api from "../services/api";
import "./RetailerManagement.css";

const initialForm = {
  business_name: "",
  name: "",
  email: "",
  phone: "",
  location: "",
  address: "",
  vat_number: "",
  credit_limit: "",
  payment_terms: "cash",
  notes: "",
};

export default function AddRetailer() {
  const navigate = useNavigate();
  const [form, setForm] = useState(initialForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const updateField = (field, value) => {
    setError("");
    setSuccess("");
    setForm((current) => ({ ...current, [field]: value }));
  };

  const submit = async (event) => {
    event.preventDefault();

    try {
      setSaving(true);
      setError("");
      setSuccess("");

      await api.post("/wholesaler/retailers", {
        ...form,
        business_name: form.business_name.trim(),
        name: form.name.trim(),
        email: form.email.trim().toLowerCase(),
        phone: form.phone.trim(),
        location: form.location.trim(),
        address: form.address.trim(),
        vat_number: form.vat_number.trim(),
        notes: form.notes.trim(),
        credit_limit: form.credit_limit ? Number(form.credit_limit) : 0,
      });

      setSuccess("Retailer added successfully.");

      window.setTimeout(() => {
        navigate("/wholesaler/retailers", { replace: true });
      }, 700);
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          "Unable to add retailer."
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="retailer-management-page">
      <header className="retailer-management-header">
        <button
          type="button"
          className="retailer-back-button"
          onClick={() => navigate("/wholesaler/retailers")}
        >
          <ArrowLeft size={18} />
          Back to retailers
        </button>

        <div>
          <span>Retailer network</span>
          <h1>Add retailer manually</h1>
          <p>
            Create a retailer profile and connect it to your
            wholesale business.
          </p>
        </div>
      </header>

      <form className="retailer-form-layout" onSubmit={submit}>
        <section className="retailer-form-card">
          <div className="retailer-section-heading">
            <div><Store size={20} /></div>
            <span>
              <strong>Business details</strong>
              <small>Add the retailer shop and primary contact.</small>
            </span>
          </div>

          <div className="retailer-form-grid">
            <label className="retailer-field full">
              <span>Business name *</span>
              <div className="retailer-input">
                <Building2 size={18} />
                <input
                  value={form.business_name}
                  placeholder="Fresh Basket Grocery"
                  onChange={(event) =>
                    updateField("business_name", event.target.value)
                  }
                  required
                />
              </div>
            </label>

            <label className="retailer-field">
              <span>Contact person *</span>
              <div className="retailer-input">
                <UserRound size={18} />
                <input
                  value={form.name}
                  placeholder="Ahmed Saleh"
                  onChange={(event) =>
                    updateField("name", event.target.value)
                  }
                  required
                />
              </div>
            </label>

            <label className="retailer-field">
              <span>Phone number *</span>
              <div className="retailer-input">
                <Phone size={18} />
                <input
                  value={form.phone}
                  placeholder="0551001001"
                  onChange={(event) =>
                    updateField("phone", event.target.value)
                  }
                  required
                />
              </div>
            </label>

            <label className="retailer-field">
              <span>Email address</span>
              <div className="retailer-input">
                <Mail size={18} />
                <input
                  type="email"
                  value={form.email}
                  placeholder="retailer@business.com"
                  onChange={(event) =>
                    updateField("email", event.target.value)
                  }
                />
              </div>
            </label>

            <label className="retailer-field">
              <span>City or location *</span>
              <div className="retailer-input">
                <MapPin size={18} />
                <input
                  value={form.location}
                  placeholder="Dammam"
                  onChange={(event) =>
                    updateField("location", event.target.value)
                  }
                  required
                />
              </div>
            </label>

            <label className="retailer-field full">
              <span>Business address</span>
              <textarea
                value={form.address}
                rows={3}
                placeholder="Street, district, building and delivery details"
                onChange={(event) =>
                  updateField("address", event.target.value)
                }
              />
            </label>
          </div>
        </section>

        <section className="retailer-form-card">
          <div className="retailer-section-heading">
            <div><CreditCard size={20} /></div>
            <span>
              <strong>Commercial settings</strong>
              <small>Set VAT, credit, and payment preferences.</small>
            </span>
          </div>

          <div className="retailer-form-grid">
            <label className="retailer-field">
              <span>VAT number</span>
              <input
                value={form.vat_number}
                placeholder="300000000000003"
                onChange={(event) =>
                  updateField("vat_number", event.target.value)
                }
              />
            </label>

            <label className="retailer-field">
              <span>Credit limit</span>
              <div className="retailer-money-input">
                <span>SAR</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.credit_limit}
                  placeholder="0.00"
                  onChange={(event) =>
                    updateField("credit_limit", event.target.value)
                  }
                />
              </div>
            </label>

            <label className="retailer-field full">
              <span>Default payment terms</span>
              <select
                value={form.payment_terms}
                onChange={(event) =>
                  updateField("payment_terms", event.target.value)
                }
              >
                <option value="cash">Cash / immediate</option>
                <option value="due_7">Due in 7 days</option>
                <option value="due_15">Due in 15 days</option>
                <option value="due_30">Due in 30 days</option>
                <option value="credit">Credit account</option>
                <option value="cod">Cash on delivery</option>
              </select>
            </label>

            <label className="retailer-field full">
              <span>Internal notes</span>
              <textarea
                value={form.notes}
                rows={4}
                placeholder="Add sales notes, delivery instructions, or credit remarks"
                onChange={(event) =>
                  updateField("notes", event.target.value)
                }
              />
            </label>
          </div>
        </section>

        {error && (
          <div className="retailer-form-alert error">{error}</div>
        )}

        {success && (
          <div className="retailer-form-alert success">
            <CheckCircle2 size={17} />
            {success}
          </div>
        )}

        <footer className="retailer-form-footer">
          <button
            type="button"
            className="retailer-cancel-button"
            onClick={() => navigate("/wholesaler/retailers")}
          >
            Cancel
          </button>

          <button
            type="submit"
            className="retailer-save-button"
            disabled={saving}
          >
            {saving ? (
              <>
                <LoaderCircle size={18} className="retailer-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save size={18} />
                Add retailer
              </>
            )}
          </button>
        </footer>
      </form>
    </div>
  );
}
