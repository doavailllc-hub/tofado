import { useEffect, useMemo, useState } from "react";
import {
  Clock3,
  Mail,
  MessageSquare,
  Phone,
  RefreshCw,
  Search,
  Store,
  UserRound,
} from "lucide-react";

import api from "../services/api";
import {
  Badge,
  Empty,
  Spinner,
  statusTone,
} from "../components/UI";
import "./Commerce-Google.css";

const statuses = ["new", "contacted", "quoted", "closed"];

export default function CatalogEnquiries() {
  const [enquiries, setEnquiries] = useState(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [updatingId, setUpdatingId] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const loadEnquiries = async (showRefresh = false) => {
    try {
      if (showRefresh) {
        setRefreshing(true);
      }

      setError("");

      const response = await api.get(
        "/wholesaler/catalog/enquiries"
      );

      setEnquiries(response.data || []);
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          "Unable to load catalog enquiries."
      );

      setEnquiries([]);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadEnquiries();
  }, []);

  const filteredEnquiries = useMemo(() => {
    if (!enquiries) {
      return [];
    }

    const value = search.trim().toLowerCase();

    return enquiries.filter((enquiry) => {
      const matchesSearch =
        !value ||
        [
          enquiry.enquiry_no,
          enquiry.customer_name,
          enquiry.business_name,
          enquiry.phone,
          enquiry.email,
          enquiry.product_name,
          enquiry.message,
        ].some((field) =>
          String(field || "")
            .toLowerCase()
            .includes(value)
        );

      const matchesStatus =
        statusFilter === "all" ||
        enquiry.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [enquiries, search, statusFilter]);

  const summary = useMemo(() => {
    if (!enquiries) {
      return {
        total: 0,
        new: 0,
        contacted: 0,
        closed: 0,
      };
    }

    return enquiries.reduce(
      (result, enquiry) => {
        result.total += 1;

        if (enquiry.status === "new") {
          result.new += 1;
        }

        if (
          enquiry.status === "contacted" ||
          enquiry.status === "quoted"
        ) {
          result.contacted += 1;
        }

        if (enquiry.status === "closed") {
          result.closed += 1;
        }

        return result;
      },
      {
        total: 0,
        new: 0,
        contacted: 0,
        closed: 0,
      }
    );
  }, [enquiries]);

  const updateStatus = async (id, status) => {
    try {
      setUpdatingId(id);
      setError("");

      await api.patch(
        `/wholesaler/catalog/enquiries/${id}/status`,
        {
          status,
        }
      );

      setEnquiries((current) =>
        current.map((enquiry) =>
          enquiry.id === id
            ? {
                ...enquiry,
                status,
              }
            : enquiry
        )
      );
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          "Unable to update enquiry status."
      );
    } finally {
      setUpdatingId(null);
    }
  };

  if (!enquiries) {
    return <Spinner />;
  }

  return (
    <div className="catalog-enquiries-page">
      <section className="catalog-enquiries-heading">
        <div>
          <span className="catalog-enquiries-eyebrow">
            Customer communication
          </span>

          <h1>Catalog enquiries</h1>

          <p>
            Review product questions, quotation requests, and customer
            messages received from your public catalog.
          </p>
        </div>

        <button
          type="button"
          className="catalog-enquiries-refresh"
          disabled={refreshing}
          onClick={() => loadEnquiries(true)}
        >
          <RefreshCw
            size={17}
            className={refreshing ? "catalog-refresh-spin" : ""}
          />

          Refresh
        </button>
      </section>

      <section className="catalog-enquiry-stats">
        <article>
          <div className="catalog-enquiry-stat-icon blue">
            <MessageSquare size={20} />
          </div>

          <span>Total enquiries</span>
          <strong>{summary.total}</strong>
        </article>

        <article>
          <div className="catalog-enquiry-stat-icon orange">
            <Clock3 size={20} />
          </div>

          <span>New enquiries</span>
          <strong>{summary.new}</strong>
        </article>

        <article>
          <div className="catalog-enquiry-stat-icon purple">
            <Phone size={20} />
          </div>

          <span>In progress</span>
          <strong>{summary.contacted}</strong>
        </article>

        <article>
          <div className="catalog-enquiry-stat-icon green">
            <MessageSquare size={20} />
          </div>

          <span>Closed</span>
          <strong>{summary.closed}</strong>
        </article>
      </section>

      <section className="catalog-enquiries-panel">
        <div className="catalog-enquiries-toolbar">
          <div className="catalog-enquiries-search">
            <Search size={18} />

            <input
              type="search"
              placeholder="Search customer, product, phone or enquiry..."
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
            />
          </div>

          <select
            value={statusFilter}
            onChange={(event) =>
              setStatusFilter(event.target.value)
            }
          >
            <option value="all">All statuses</option>

            {statuses.map((status) => (
              <option value={status} key={status}>
                {status}
              </option>
            ))}
          </select>
        </div>

        {error && (
          <div className="catalog-enquiries-alert">{error}</div>
        )}

        {filteredEnquiries.length ? (
          <div className="catalog-enquiries-list">
            {filteredEnquiries.map((enquiry) => (
              <article
                className="catalog-enquiry-card"
                key={enquiry.id}
              >
                <div className="catalog-enquiry-card-header">
                  <div className="catalog-enquiry-reference">
                    <div className="catalog-enquiry-reference-icon">
                      <MessageSquare size={20} />
                    </div>

                    <div>
                      <span>Enquiry reference</span>

                      <strong>
                        {enquiry.enquiry_no ||
                          `ENQ-${enquiry.id}`}
                      </strong>
                    </div>
                  </div>

                  <Badge tone={statusTone(enquiry.status)}>
                    {enquiry.status}
                  </Badge>
                </div>

                <div className="catalog-enquiry-info-grid">
                  <div>
                    <UserRound size={17} />

                    <span>
                      <small>Customer</small>
                      <strong>
                        {enquiry.customer_name || "—"}
                      </strong>
                    </span>
                  </div>

                  <div>
                    <Store size={17} />

                    <span>
                      <small>Business</small>
                      <strong>
                        {enquiry.business_name ||
                          "Not provided"}
                      </strong>
                    </span>
                  </div>

                  <div>
                    <Phone size={17} />

                    <span>
                      <small>Phone</small>
                      <strong>{enquiry.phone || "—"}</strong>
                    </span>
                  </div>

                  <div>
                    <Mail size={17} />

                    <span>
                      <small>Email</small>
                      <strong>
                        {enquiry.email || "Not provided"}
                      </strong>
                    </span>
                  </div>
                </div>

                <div className="catalog-enquiry-product">
                  <span>Product</span>

                  <strong>
                    {enquiry.product_name ||
                      "General catalog enquiry"}
                  </strong>

                  {enquiry.quantity && (
                    <small>
                      Requested quantity: {enquiry.quantity}
                    </small>
                  )}
                </div>

                <div className="catalog-enquiry-message">
                  <span>Customer message</span>

                  <p>
                    {enquiry.message ||
                      "No enquiry message was provided."}
                  </p>
                </div>

                <div className="catalog-enquiry-footer">
                  <span>
                    <Clock3 size={15} />

                    {enquiry.created_at
                      ? new Date(
                          enquiry.created_at
                        ).toLocaleString()
                      : "—"}
                  </span>

                  <div className="catalog-enquiry-status-control">
                    <label>Update status</label>

                    <select
                      value={enquiry.status}
                      disabled={updatingId === enquiry.id}
                      onChange={(event) =>
                        updateStatus(
                          enquiry.id,
                          event.target.value
                        )
                      }
                    >
                      {statuses.map((status) => (
                        <option value={status} key={status}>
                          {status}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="catalog-enquiries-empty">
            <Empty />
            <p>No catalog enquiries found.</p>
          </div>
        )}
      </section>
    </div>
  );
}