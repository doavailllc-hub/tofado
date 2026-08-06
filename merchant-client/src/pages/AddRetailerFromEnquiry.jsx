import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Building2,
  CheckCircle2,
  LoaderCircle,
  Mail,
  MessageSquare,
  Phone,
  Search,
  Store,
  UserRound,
} from "lucide-react";

import api from "../services/api";
import { Badge, Empty, Spinner, statusTone } from "../components/UI";
import "./RetailerManagement.css";

export default function AddRetailerFromEnquiry() {
  const navigate = useNavigate();

  const [enquiries, setEnquiries] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loadEnquiries = async () => {
    try {
      setLoading(true);
      setError("");

      const { data } = await api.get(
        "/wholesaler/catalog/enquiries"
      );

      const rows = Array.isArray(data)
        ? data
        : Array.isArray(data?.enquiries)
          ? data.enquiries
          : [];

      setEnquiries(
        rows.filter(
          (enquiry) =>
            !enquiry.retailer_id &&
            enquiry.status !== "closed" &&
            enquiry.status !== "rejected"
        )
      );
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          "Unable to load enquiries."
      );
      setEnquiries([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEnquiries();
  }, []);

  const filteredEnquiries = useMemo(() => {
    const value = search.trim().toLowerCase();

    if (!value) {
      return enquiries;
    }

    return enquiries.filter((enquiry) =>
      [
        enquiry.enquiry_no,
        enquiry.customer_name,
        enquiry.business_name,
        enquiry.phone,
        enquiry.email,
        enquiry.product_name,
      ].some((field) =>
        String(field || "")
          .toLowerCase()
          .includes(value)
      )
    );
  }, [enquiries, search]);

  const selectedEnquiry = useMemo(
    () =>
      enquiries.find(
        (enquiry) =>
          String(enquiry.id) === String(selectedId)
      ) || null,
    [enquiries, selectedId]
  );

  const submit = async () => {
    if (!selectedEnquiry) {
      setError("Select an enquiry first.");
      return;
    }

    try {
      setSaving(true);
      setError("");
      setSuccess("");

      await api.post(
        `/wholesaler/retailers/from-enquiry/${selectedEnquiry.id}`
      );

      setSuccess(
        "Retailer created successfully from enquiry."
      );

      window.setTimeout(() => {
        navigate("/wholesaler/retailers", {
          replace: true,
        });
      }, 700);
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          "Unable to create retailer from enquiry."
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <Spinner />;
  }

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
          <h1>Add retailer from enquiry</h1>
          <p>
            Select a catalogue enquiry and convert the customer
            into a connected retailer.
          </p>
        </div>
      </header>

      <div className="enquiry-conversion-layout">
        <section className="enquiry-selection-card">
          <div className="retailer-section-heading">
            <div><MessageSquare size={20} /></div>
            <span>
              <strong>Select enquiry</strong>
              <small>
                Only open enquiries not already converted are shown.
              </small>
            </span>
          </div>

          <div className="retailer-enquiry-search">
            <Search size={18} />
            <input
              type="search"
              value={search}
              placeholder="Search customer, business, phone or product..."
              onChange={(event) =>
                setSearch(event.target.value)
              }
            />
          </div>

          {filteredEnquiries.length ? (
            <div className="retailer-enquiry-list">
              {filteredEnquiries.map((enquiry) => {
                const selected =
                  String(enquiry.id) === String(selectedId);

                return (
                  <button
                    type="button"
                    className={
                      selected
                        ? "retailer-enquiry-option selected"
                        : "retailer-enquiry-option"
                    }
                    key={enquiry.id}
                    onClick={() =>
                      setSelectedId(String(enquiry.id))
                    }
                  >
                    <div className="retailer-enquiry-option-top">
                      <span>
                        {enquiry.enquiry_no ||
                          `ENQ-${enquiry.id}`}
                      </span>

                      <Badge tone={statusTone(enquiry.status)}>
                        {enquiry.status}
                      </Badge>
                    </div>

                    <strong>
                      {enquiry.business_name ||
                        enquiry.customer_name ||
                        "Unnamed customer"}
                    </strong>

                    <small>
                      {enquiry.product_name ||
                        "General catalogue enquiry"}
                    </small>

                    <div className="retailer-enquiry-meta">
                      <span>
                        <Phone size={14} />
                        {enquiry.phone || "No phone"}
                      </span>

                      <span>
                        <Mail size={14} />
                        {enquiry.email || "No email"}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="retailer-enquiry-empty">
              <Empty
                title="No enquiries available"
                text="New public catalogue enquiries will appear here."
              />
            </div>
          )}
        </section>

        <section className="enquiry-preview-card">
          <div className="retailer-section-heading">
            <div><Store size={20} /></div>
            <span>
              <strong>Retailer preview</strong>
              <small>
                These details will be used to create the retailer.
              </small>
            </span>
          </div>

          {selectedEnquiry ? (
            <>
              <div className="retailer-preview-grid">
                <div>
                  <Building2 size={17} />
                  <span>
                    <small>Business name</small>
                    <strong>
                      {selectedEnquiry.business_name ||
                        "Not provided"}
                    </strong>
                  </span>
                </div>

                <div>
                  <UserRound size={17} />
                  <span>
                    <small>Contact person</small>
                    <strong>
                      {selectedEnquiry.customer_name ||
                        "Not provided"}
                    </strong>
                  </span>
                </div>

                <div>
                  <Phone size={17} />
                  <span>
                    <small>Phone</small>
                    <strong>
                      {selectedEnquiry.phone || "—"}
                    </strong>
                  </span>
                </div>

                <div>
                  <Mail size={17} />
                  <span>
                    <small>Email</small>
                    <strong>
                      {selectedEnquiry.email ||
                        "Not provided"}
                    </strong>
                  </span>
                </div>
              </div>

              <div className="retailer-preview-message">
                <span>Original enquiry</span>
                <p>
                  {selectedEnquiry.message ||
                    "No message provided."}
                </p>
              </div>

              <button
                type="button"
                className="retailer-save-button wide"
                disabled={saving}
                onClick={submit}
              >
                {saving ? (
                  <>
                    <LoaderCircle
                      size={18}
                      className="retailer-spin"
                    />
                    Creating retailer...
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={18} />
                    Create retailer
                  </>
                )}
              </button>
            </>
          ) : (
            <div className="retailer-preview-placeholder">
              <MessageSquare size={28} />
              <h3>Select an enquiry</h3>
              <p>
                Choose an enquiry from the left to preview the
                retailer details.
              </p>
            </div>
          )}

          {error && (
            <div className="retailer-form-alert error">
              {error}
            </div>
          )}

          {success && (
            <div className="retailer-form-alert success">
              <CheckCircle2 size={17} />
              {success}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
