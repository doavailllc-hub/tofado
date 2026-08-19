import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  CheckCircle2,
  Clock3,
  MapPin,
  RefreshCw,
  Search,
  Store,
  X,
} from "lucide-react";

import api from "../services/api";
import "./Retailer.css";

function statusLabel(status) {
  if (status === "active") return "Connected";
  if (status === "pending") return "Pending";
  if (status === "rejected") return "Rejected";
  if (status === "blocked") return "Blocked";
  return "Unknown";
}

export default function RetailerWholesalerRequests() {
  const navigate = useNavigate();

  const [rows, setRows] = useState([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [cancellingId, setCancellingId] = useState(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async (refresh = false) => {
    try {
      refresh ? setRefreshing(true) : setLoading(true);
      setError("");

      const { data } = await api.get(
        "/retailer/wholesaler-requests"
      );

      setRows(
        Array.isArray(data)
          ? data
          : Array.isArray(data?.requests)
            ? data.requests
            : []
      );
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          "Unable to load connection requests."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return rows;

    return rows.filter((item) =>
      [item.business_name, item.location, item.status]
        .some((value) =>
          String(value || "").toLowerCase().includes(term)
        )
    );
  }, [rows, query]);

  const cancel = async (row) => {
    try {
      setCancellingId(row.connection_id);
      setError("");
      setNotice("");

      const { data } = await api.delete(
        `/retailer/wholesaler-requests/${row.connection_id}`
      );

      setRows((current) =>
        current.filter(
          (item) => item.connection_id !== row.connection_id
        )
      );

      setNotice(data?.message || "Connection request cancelled.");
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          "Unable to cancel the request."
      );
    } finally {
      setCancellingId(null);
    }
  };

  return (
    <div className="retailer-network-page">
      <header className="retailer-network-header">
        <div>
          <span>Vendor network</span>
          <h1>Connection requests</h1>
          <p>
            Track requests sent to wholesalers and see when your business
            becomes connected.
          </p>
        </div>

        <div className="retailer-vendor-header-actions">
          <button
            type="button"
            className="retailer-network-refresh"
            disabled={refreshing}
            onClick={() => load(true)}
          >
            <RefreshCw
              size={17}
              className={refreshing ? "retailer-detail-spin" : ""}
            />
            Refresh
          </button>

          <button
            type="button"
            className="retailer-vendor-add"
            onClick={() => navigate("/retailer/wholesalers/find")}
          >
            Find wholesalers
          </button>
        </div>
      </header>

      <section className="retailer-network-panel">
        <div className="retailer-network-toolbar">
          <div className="retailer-network-search">
            <Search size={18} />
            <input
              type="search"
              placeholder="Search requests..."
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>

          <button
            type="button"
            className="retailer-network-secondary"
            onClick={() => navigate("/retailer/wholesalers")}
          >
            Connected wholesalers
          </button>
        </div>

        {error && <div className="retailer-details-alert">{error}</div>}
        {notice && <div className="retailer-form-alert success">{notice}</div>}

        {loading ? (
          <div className="retailer-network-loading">
            Loading connection requests...
          </div>
        ) : filtered.length ? (
          <div className="retailer-request-list">
            {filtered.map((row) => (
              <article
                className="retailer-request-card retailer-request-card-retailer"
                key={row.connection_id}
              >
                <div className="retailer-request-business">
                  <div className="retailer-network-logo">
                    {row.logo_url ? (
                      <img src={row.logo_url} alt="" />
                    ) : (
                      <Store size={22} />
                    )}
                  </div>

                  <div>
                    <strong>{row.business_name}</strong>
                    <span>
                      <MapPin size={14} />
                      {row.location || "Location not provided"}
                    </span>
                  </div>
                </div>

                <div className="retailer-request-message">
                  {row.status === "active" ? (
                    <CheckCircle2 size={15} />
                  ) : (
                    <Clock3 size={15} />
                  )}

                  <p>
                    {row.request_message ||
                      "Business connection request"}
                  </p>
                </div>

                <div className="retailer-request-actions">
                  <span className={`network-state ${row.status}`}>
                    {statusLabel(row.status)}
                  </span>

                  {row.status === "pending" && (
                    <button
                      type="button"
                      className="reject"
                      disabled={cancellingId === row.connection_id}
                      onClick={() => cancel(row)}
                    >
                      <X size={15} />
                      {cancellingId === row.connection_id
                        ? "Cancelling..."
                        : "Cancel request"}
                    </button>
                  )}

                  {row.status === "active" && (
                    <button
                      type="button"
                      className="accept"
                      onClick={() =>
                        navigate(
                          `/retailer/orders/new?wholesaler=${row.wholesaler_id}`
                        )
                      }
                    >
                      Create order
                    </button>
                  )}
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="retailer-network-empty">
            <Clock3 size={30} />
            <h3>No connection requests</h3>
            <p>Find a wholesaler and send your first request.</p>
          </div>
        )}
      </section>
    </div>
  );
}
