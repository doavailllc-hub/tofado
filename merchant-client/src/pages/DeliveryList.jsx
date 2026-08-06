import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowDownUp,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Filter,
  MapPin,
  PackageCheck,
  RefreshCw,
  Search,
  Store,
  Truck,
  UserRound,
} from "lucide-react";

import api from "../services/api";
import {
  Badge,
  Empty,
  Spinner,
  statusTone,
} from "../components/UI";
import "./DeliveryManagement.css";

const deliveryStatusOptions = [
  "all",
  "pending",
  "packed",
  "ready",
  "dispatched",
  "out_for_delivery",
  "delivered",
  "cancelled",
];

function normalizeRows(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.deliveries)) return data.deliveries;
  if (Array.isArray(data?.rows)) return data.rows;
  return [];
}

function formatDate(value, includeTime = false) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return new Intl.DateTimeFormat("en-SA", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    ...(includeTime
      ? {
          hour: "2-digit",
          minute: "2-digit",
        }
      : {}),
  }).format(date);
}

function readable(value) {
  if (!value) return "—";

  return String(value)
    .replaceAll("_", " ")
    .replace(/\b\w/g, (character) =>
      character.toUpperCase()
    );
}

function getDeliveryTone(status) {
  const value = String(status || "").toLowerCase();

  if (value === "delivered") return "green";
  if (["dispatched", "out_for_delivery"].includes(value)) {
    return "blue";
  }
  if (["packed", "ready"].includes(value)) return "orange";
  if (value === "cancelled") return "red";
  return statusTone(value);
}

export default function DeliveryList() {
  const navigate = useNavigate();

  const [deliveries, setDeliveries] = useState(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortDirection, setSortDirection] = useState("desc");
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const loadDeliveries = useCallback(
    async (showRefresh = false) => {
      try {
        if (showRefresh) {
          setRefreshing(true);
        }

        setError("");

        const { data } = await api.get(
          "/wholesaler/deliveries"
        );

        setDeliveries(normalizeRows(data));
      } catch (requestError) {
        setDeliveries([]);
        setError(
          requestError.response?.data?.message ||
            "Unable to load deliveries."
        );
      } finally {
        setRefreshing(false);
      }
    },
    []
  );

  useEffect(() => {
    loadDeliveries();
  }, [loadDeliveries]);

  const filteredDeliveries = useMemo(() => {
    if (!Array.isArray(deliveries)) return [];

    const normalizedSearch = search.trim().toLowerCase();

    const rows = deliveries.filter((delivery) => {
      const matchesSearch =
        !normalizedSearch ||
        [
          delivery.delivery_no,
          delivery.order_no,
          delivery.retailer_name,
          delivery.business_name,
          delivery.driver_name,
          delivery.driver_phone,
          delivery.delivery_address,
          delivery.vehicle_no,
        ].some((value) =>
          String(value || "")
            .toLowerCase()
            .includes(normalizedSearch)
        );

      const matchesStatus =
        statusFilter === "all" ||
        String(delivery.status || "").toLowerCase() ===
          statusFilter;

      return matchesSearch && matchesStatus;
    });

    return [...rows].sort((first, second) => {
      const firstDate = new Date(
        first.created_at ||
          first.dispatched_at ||
          first.delivered_at ||
          0
      ).getTime();

      const secondDate = new Date(
        second.created_at ||
          second.dispatched_at ||
          second.delivered_at ||
          0
      ).getTime();

      return sortDirection === "asc"
        ? firstDate - secondDate
        : secondDate - firstDate;
    });
  }, [
    deliveries,
    search,
    statusFilter,
    sortDirection,
  ]);

  const summary = useMemo(() => {
    const rows = Array.isArray(deliveries)
      ? deliveries
      : [];

    return rows.reduce(
      (result, delivery) => {
        result.total += 1;

        const status = String(
          delivery.status || ""
        ).toLowerCase();

        if (
          [
            "pending",
            "packed",
            "ready",
            "dispatched",
            "out_for_delivery",
          ].includes(status)
        ) {
          result.active += 1;
        }

        if (status === "out_for_delivery") {
          result.onRoad += 1;
        }

        if (status === "delivered") {
          result.delivered += 1;
        }

        return result;
      },
      {
        total: 0,
        active: 0,
        onRoad: 0,
        delivered: 0,
      }
    );
  }, [deliveries]);

  if (!deliveries) {
    return <Spinner />;
  }

  return (
    <div className="delivery-page">
      <header className="delivery-page-header">
        <div>
          <span>Delivery operations</span>
          <h1>Deliveries</h1>
          <p>
            Track every shipment from packing to final delivery.
          </p>
        </div>

        <button
          type="button"
          className="delivery-refresh-button"
          onClick={() => loadDeliveries(true)}
          disabled={refreshing}
        >
          <RefreshCw
            size={17}
            className={refreshing ? "delivery-spin" : ""}
          />
          Refresh
        </button>
      </header>

      <section className="delivery-summary-grid">
        <article>
          <div className="delivery-summary-icon blue">
            <Truck size={20} />
          </div>
          <span>Total deliveries</span>
          <strong>{summary.total}</strong>
        </article>

        <article>
          <div className="delivery-summary-icon orange">
            <Clock3 size={20} />
          </div>
          <span>Active workflow</span>
          <strong>{summary.active}</strong>
        </article>

        <article>
          <div className="delivery-summary-icon purple">
            <MapPin size={20} />
          </div>
          <span>Out for delivery</span>
          <strong>{summary.onRoad}</strong>
        </article>

        <article>
          <div className="delivery-summary-icon green">
            <CheckCircle2 size={20} />
          </div>
          <span>Delivered</span>
          <strong>{summary.delivered}</strong>
        </article>
      </section>

      <section className="delivery-list-panel">
        <div className="delivery-toolbar">
          <div className="delivery-search">
            <Search size={18} />

            <input
              type="search"
              value={search}
              placeholder="Search delivery, order, retailer, driver or address..."
              onChange={(event) =>
                setSearch(event.target.value)
              }
            />
          </div>

          <div className="delivery-toolbar-actions">
            <div className="delivery-filter">
              <Filter size={17} />

              <select
                value={statusFilter}
                onChange={(event) =>
                  setStatusFilter(event.target.value)
                }
              >
                {deliveryStatusOptions.map((status) => (
                  <option value={status} key={status}>
                    {status === "all"
                      ? "All statuses"
                      : readable(status)}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              className="delivery-sort-button"
              onClick={() =>
                setSortDirection((current) =>
                  current === "desc" ? "asc" : "desc"
                )
              }
            >
              <ArrowDownUp size={17} />
              {sortDirection === "desc"
                ? "Newest first"
                : "Oldest first"}
            </button>
          </div>
        </div>

        {error && (
          <div className="delivery-alert">{error}</div>
        )}

        <div className="delivery-results-info">
          Showing{" "}
          <strong>{filteredDeliveries.length}</strong> of{" "}
          <strong>{deliveries.length}</strong> deliveries
        </div>

        {filteredDeliveries.length ? (
          <div className="delivery-card-list">
            {filteredDeliveries.map((delivery) => (
              <button
                type="button"
                className="delivery-list-card"
                key={delivery.id}
                onClick={() =>
                  navigate(
                    `/wholesaler/deliveries/${delivery.id}`
                  )
                }
              >
                <div className="delivery-card-main">
                  <div className="delivery-card-icon">
                    <Truck size={20} />
                  </div>

                  <div>
                    <span className="delivery-card-label">
                      Delivery
                    </span>

                    <strong>
                      {delivery.delivery_no ||
                        `DEL-${delivery.id}`}
                    </strong>

                    <small>
                      Order{" "}
                      {delivery.order_no ||
                        delivery.order_id ||
                        "—"}
                    </small>
                  </div>
                </div>

                <div className="delivery-card-field">
                  <Store size={15} />
                  <span>
                    <small>Retailer</small>
                    <strong>
                      {delivery.retailer_name ||
                        delivery.business_name ||
                        "Retailer"}
                    </strong>
                  </span>
                </div>

                <div className="delivery-card-field">
                  <MapPin size={15} />
                  <span>
                    <small>Destination</small>
                    <strong>
                      {delivery.delivery_address ||
                        "No address"}
                    </strong>
                  </span>
                </div>

                <div className="delivery-card-field">
                  <UserRound size={15} />
                  <span>
                    <small>Driver</small>
                    <strong>
                      {delivery.driver_name ||
                        "Not assigned"}
                    </strong>
                  </span>
                </div>

                <div className="delivery-card-field">
                  <CalendarDays size={15} />
                  <span>
                    <small>Created</small>
                    <strong>
                      {formatDate(delivery.created_at)}
                    </strong>
                  </span>
                </div>

                <Badge
                  tone={getDeliveryTone(
                    delivery.status
                  )}
                >
                  {readable(delivery.status || "pending")}
                </Badge>
              </button>
            ))}
          </div>
        ) : (
          <div className="delivery-empty">
            <Empty />
            <h3>No deliveries found</h3>
            <p>
              Deliveries matching the current search or
              filter will appear here.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}