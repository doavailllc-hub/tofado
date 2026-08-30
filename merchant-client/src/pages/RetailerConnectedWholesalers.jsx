import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  CheckCircle2,
  MapPin,
  Plus,
  RefreshCw,
  Search,
  ShoppingCart,
  Store,
  Users,
} from "lucide-react";

import api from "../services/api";
import "./Retailer.css";

export default function RetailerConnectedWholesalers() {
  const navigate = useNavigate();

  const [rows, setRows] = useState([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async (refresh = false) => {
    try {
      refresh ? setRefreshing(true) : setLoading(true);
      setError("");

      const { data } = await api.get("/retailer/wholesalers");

      setRows(
        Array.isArray(data)
          ? data
          : Array.isArray(data?.wholesalers)
            ? data.wholesalers
            : []
      );
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          "Unable to load connected wholesalers."
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
      [
        item.business_name,
        item.name,
        item.location,
        item.business_category,
        item.shop_type,
      ].some((value) =>
        String(value || "").toLowerCase().includes(term)
      )
    );
  }, [rows, query]);

  return (
    <div className="retailer-network-page">
      <header className="retailer-network-header">
        <div>
          <span>Vendor network</span>
          <h1>Connected wholesalers</h1>
          <p>
            These wholesalers accepted your business connection.
            You can create purchase orders only with businesses in this list.
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
            <Plus size={17} />
            Add wholesaler
          </button>
        </div>
      </header>

      <section className="retailer-network-summary">
        <article>
          <Users size={20} />
          <span>Connected vendors</span>
          <strong>{rows.length}</strong>
        </article>

        <article>
          <CheckCircle2 size={20} />
          <span>Approved</span>
          <strong>{rows.length}</strong>
        </article>

        <article>
          <ShoppingCart size={20} />
          <span>Ready to order</span>
          <strong>{rows.length}</strong>
        </article>
      </section>

      <section className="retailer-network-panel">
        <div className="retailer-network-toolbar">
          <div className="retailer-network-search">
            <Search size={18} />
            <input
              type="search"
              placeholder="Search connected wholesalers..."
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>

          <button
            type="button"
            className="retailer-network-secondary"
            onClick={() => navigate("/retailer/wholesaler-requests")}
          >
            View requests
          </button>
        </div>

        {error && <div className="retailer-details-alert">{error}</div>}

        {loading ? (
          <div className="retailer-network-loading">
            Loading connected wholesalers...
          </div>
        ) : filtered.length ? (
          <div className="retailer-network-grid">
            {filtered.map((item) => (
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
                    <span>
                      {item.business_category ||
                        item.shop_type ||
                        "Wholesale business"}
                    </span>
                  </div>

                  <span className="network-state active">Connected</span>
                </div>

                <div className="retailer-network-meta">
                  <span>
                    <MapPin size={15} />
                    {item.location || "Location not provided"}
                  </span>

                  <p>
                    Payment terms: {item.payment_terms || "As agreed"}
                    {item.credit_limit
                      ? ` · Credit limit INR ${Number(
                          item.credit_limit
                        ).toLocaleString()}`
                      : ""}
                  </p>
                </div>

                <div className="retailer-network-actions">
                  <button
                    type="button"
                    className="network-connected"
                    onClick={() =>
                      navigate(
                        `/retailer/orders/new?wholesaler=${item.id}`
                      )
                    }
                  >
                    <ShoppingCart size={16} />
                    Create purchase order
                  </button>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="retailer-network-empty">
            <Users size={30} />
            <h3>No connected wholesalers yet</h3>
            <p>
              Find verified wholesalers, send a request, and order after
              they accept your business.
            </p>

            <button
              type="button"
              className="retailer-vendor-empty-add"
              onClick={() => navigate("/retailer/wholesalers/find")}
            >
              <Plus size={16} />
              Find wholesalers
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
