import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Check,
  Clock3,
  MapPin,
  RefreshCw,
  Store,
  UserRound,
  X,
} from "lucide-react";

import api from "../services/api";
import "./Retailer.css";

export default function WholesalerRetailerRequests() {
  const navigate = useNavigate();

  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [processingId, setProcessingId] = useState(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async (showRefresh = false) => {
    try {
      showRefresh ? setRefreshing(true) : setLoading(true);
      setError("");

      const { data } = await api.get(
        "/wholesaler/retailer-requests"
      );

      setRequests(
        Array.isArray(data)
          ? data
          : Array.isArray(data?.requests)
            ? data.requests
            : []
      );
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          "Unable to load retailer requests."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();

    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") load();
    }, 30000);

    return () => window.clearInterval(timer);
  }, [load]);

  const respond = async (request, action) => {
    try {
      setProcessingId(request.connection_id);
      setError("");
      setNotice("");

      const { data } = await api.patch(
        `/wholesaler/retailer-requests/${request.connection_id}`,
        { action }
      );

      setRequests((current) =>
        current.filter(
          (item) =>
            item.connection_id !== request.connection_id
        )
      );

      setNotice(data?.message || "Retailer request updated.");
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          "Unable to update retailer request."
      );
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className="retailer-network-page">
      <header className="retailer-network-header">
        <div>
          <button
            type="button"
            className="retailer-network-back"
            onClick={() => navigate("/wholesaler/retailers")}
          >
            <ArrowLeft size={16} />
            Retailers
          </button>
          <span>Retailer network</span>
          <h1>Connection requests</h1>
          <p>
            Review retailer businesses requesting permission to order
            from your wholesale company.
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

      {error && <div className="retailer-details-alert">{error}</div>}
      {notice && <div className="retailer-form-alert success">{notice}</div>}

      <section className="retailer-network-panel">
        {loading ? (
          <div className="retailer-network-loading">
            Loading retailer requests...
          </div>
        ) : requests.length ? (
          <div className="retailer-request-list">
            {requests.map((request) => (
              <article
                className="retailer-request-card"
                key={request.connection_id}
              >
                <div className="retailer-request-business">
                  <div className="retailer-network-logo">
                    {request.logo_url ? (
                      <img src={request.logo_url} alt="" />
                    ) : (
                      <Store size={22} />
                    )}
                  </div>

                  <div>
                    <strong>{request.business_name}</strong>
                    <span>
                      <UserRound size={14} />
                      {request.name || "Retailer contact"}
                    </span>
                    <span>
                      <MapPin size={14} />
                      {request.location || "Location not provided"}
                    </span>
                  </div>
                </div>

                <div className="retailer-request-message">
                  <Clock3 size={15} />
                  <p>
                    {request.request_message ||
                      "This retailer would like to connect with your business and place purchase orders."}
                  </p>
                </div>

                <div className="retailer-request-actions">
                  <button
                    type="button"
                    className="reject"
                    disabled={processingId === request.connection_id}
                    onClick={() => respond(request, "reject")}
                  >
                    <X size={16} />
                    Reject
                  </button>

                  <button
                    type="button"
                    className="accept"
                    disabled={processingId === request.connection_id}
                    onClick={() => respond(request, "accept")}
                  >
                    <Check size={16} />
                    {processingId === request.connection_id
                      ? "Updating..."
                      : "Accept retailer"}
                  </button>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="retailer-network-empty">
            <Check size={30} />
            <h3>No pending requests</h3>
            <p>New retailer connection requests will appear here.</p>
          </div>
        )}
      </section>
    </div>
  );
}
