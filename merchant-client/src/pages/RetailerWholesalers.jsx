import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  CheckCircle2,
  Clock3,
  MapPin,
  RefreshCw,
  Search,
  Send,
  Store,
  Users,
  X,
} from "lucide-react";

import api from "../services/api";
import "./Retailer.css";

function relationshipLabel(status) {
  if (status === "active") return "Connected";
  if (status === "pending") return "Request pending";
  if (status === "rejected") return "Request again";
  if (status === "blocked") return "Unavailable";
  return "Connect";
}

export default function RetailerWholesalers() {
  const navigate = useNavigate();

  const [wholesalers, setWholesalers] = useState([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sendingId, setSendingId] = useState(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async (showRefresh = false) => {
    try {
      showRefresh ? setRefreshing(true) : setLoading(true);
      setError("");

      const { data } = await api.get(
        "/retailer/wholesalers/search",
        { params: { q: query.trim() } }
      );

      setWholesalers(
        Array.isArray(data)
          ? data
          : Array.isArray(data?.wholesalers)
            ? data.wholesalers
            : []
      );
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          "Unable to load wholesalers."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [query]);

  useEffect(() => {
    const timer = window.setTimeout(() => load(), 250);
    return () => window.clearTimeout(timer);
  }, [load]);

  const summary = useMemo(() => {
    return wholesalers.reduce(
      (result, item) => {
        result.total += 1;
        if (item.connection_status === "active") result.connected += 1;
        if (item.connection_status === "pending") result.pending += 1;
        return result;
      },
      { total: 0, connected: 0, pending: 0 }
    );
  }, [wholesalers]);

  const sendRequest = async (wholesaler) => {
    try {
      setSendingId(wholesaler.id);
      setError("");
      setNotice("");

      const { data } = await api.post(
        `/retailer/wholesalers/${wholesaler.id}/request`,
        {}
      );

      setWholesalers((current) =>
        current.map((item) =>
          item.id === wholesaler.id
            ? {
                ...item,
                connection_status: "pending",
                connection_id:
                  data?.connection_id || item.connection_id,
              }
            : item
        )
      );

      setNotice(data?.message || "Connection request sent.");
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          "Unable to send connection request."
      );
    } finally {
      setSendingId(null);
    }
  };

  return (
    <div className="retailer-network-page">
      <header className="retailer-network-header">
        <div>
          <span>Business network</span>
          <h1>Find wholesalers</h1>
          <p>
            Connect with verified wholesale businesses before placing
            purchase orders.
          </p>
        </div>

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
      </header>

      <section className="retailer-network-summary">
        <article>
          <Store size={20} />
          <span>Wholesalers</span>
          <strong>{summary.total}</strong>
        </article>
        <article>
          <CheckCircle2 size={20} />
          <span>Connected</span>
          <strong>{summary.connected}</strong>
        </article>
        <article>
          <Clock3 size={20} />
          <span>Pending requests</span>
          <strong>{summary.pending}</strong>
        </article>
      </section>

      <section className="retailer-network-panel">
        <div className="retailer-network-toolbar">
          <div className="retailer-network-search">
            <Search size={18} />
            <input
              type="search"
              placeholder="Search wholesaler, location or category..."
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            {query && (
              <button type="button" onClick={() => setQuery("")}>
                <X size={16} />
              </button>
            )}
          </div>

          <button
            type="button"
            className="retailer-network-secondary"
            onClick={() => navigate("/retailer/orders/new")}
          >
            Create order
          </button>
        </div>

        {error && <div className="retailer-details-alert">{error}</div>}
        {notice && <div className="retailer-form-alert success">{notice}</div>}

        {loading ? (
          <div className="retailer-network-loading">Loading wholesalers...</div>
        ) : wholesalers.length ? (
          <div className="retailer-network-grid">
            {wholesalers.map((item) => {
              const status = item.connection_status;
              const connected = status === "active";
              const pending = status === "pending";
              const blocked = status === "blocked";

              return (
                <article className="retailer-network-card" key={item.id}>
                  <div className="retailer-network-card-top">
                    <div className="retailer-network-logo">
                      {item.logo_url ? (
                        <img src={item.logo_url} alt="" />
                      ) : (
                        <Store size={22} />
                      )}
                    </div>

                    <div>
                      <strong>{item.business_name}</strong>
                      <span>{item.business_category || item.shop_type || "Wholesale business"}</span>
                    </div>

                    <span className={`network-state ${status || "none"}`}>
                      {relationshipLabel(status)}
                    </span>
                  </div>

                  <div className="retailer-network-meta">
                    <span>
                      <MapPin size={15} />
                      {item.location || "Location not provided"}
                    </span>
                    {item.description && <p>{item.description}</p>}
                  </div>

                  <div className="retailer-network-actions">
                    {connected ? (
                      <button
                        type="button"
                        className="network-connected"
                        onClick={() =>
                          navigate(`/retailer/orders/new?wholesaler=${item.id}`)
                        }
                      >
                        <CheckCircle2 size={16} />
                        Create order
                      </button>
                    ) : pending ? (
                      <button type="button" disabled>
                        <Clock3 size={16} />
                        Request pending
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={blocked || sendingId === item.id}
                        onClick={() => sendRequest(item)}
                      >
                        <Send size={16} />
                        {sendingId === item.id
                          ? "Sending..."
                          : relationshipLabel(status)}
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="retailer-network-empty">
            <Users size={30} />
            <h3>No wholesalers found</h3>
            <p>Try another business name, category or location.</p>
          </div>
        )}
      </section>
    </div>
  );
}
