import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Building2,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  MapPin,
  PackageCheck,
  Phone,
  RefreshCw,
  Route,
  Store,
  Truck,
  UserRound,
} from "lucide-react";

import api from "../services/api";
import {
  Badge,
  Spinner,
  statusTone,
} from "../components/UI";
import "./DeliveryManagement.css";

const trackingSteps = [
  {
    id: "pending",
    label: "Delivery created",
    description:
      "The delivery record was created and is awaiting preparation.",
    icon: ClipboardCheck,
  },
  {
    id: "packed",
    label: "Order packed",
    description:
      "Products were checked, packed, and prepared for dispatch.",
    icon: PackageCheck,
  },
  {
    id: "ready",
    label: "Ready for dispatch",
    description:
      "The shipment is ready and waiting for driver assignment.",
    icon: Store,
  },
  {
    id: "dispatched",
    label: "Dispatched",
    description:
      "The shipment left the warehouse and started its journey.",
    icon: Truck,
  },
  {
    id: "out_for_delivery",
    label: "Out for delivery",
    description:
      "The driver is travelling to the retailer location.",
    icon: Route,
  },
  {
    id: "delivered",
    label: "Delivered",
    description:
      "The shipment was delivered and the workflow is complete.",
    icon: CheckCircle2,
  },
];

const statusRank = {
  pending: 0,
  packed: 1,
  ready: 2,
  dispatched: 3,
  out_for_delivery: 4,
  delivered: 5,
  cancelled: -1,
};

function formatDate(value, includeTime = true) {
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

function getTrackingTime(delivery, stepId) {
  const mapping = {
    pending: delivery.created_at,
    packed: delivery.packed_at,
    ready: delivery.ready_at,
    dispatched: delivery.dispatched_at,
    out_for_delivery: delivery.out_for_delivery_at,
    delivered: delivery.delivered_at,
  };

  return mapping[stepId];
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

export default function DeliveryDetails() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [delivery, setDelivery] = useState(null);
  const [items, setItems] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const loadDelivery = useCallback(
    async (showRefresh = false) => {
      try {
        if (showRefresh) {
          setRefreshing(true);
        }

        setError("");

        const { data } = await api.get(
          `/wholesaler/deliveries/${id}`
        );

        const deliveryData =
          data?.delivery && typeof data.delivery === "object"
            ? data.delivery
            : data;

        setDelivery(deliveryData || null);

        setItems(
          Array.isArray(data?.items)
            ? data.items
            : Array.isArray(deliveryData?.items)
              ? deliveryData.items
              : []
        );
      } catch (requestError) {
        setError(
          requestError.response?.data?.message ||
            "Unable to load delivery details."
        );
      } finally {
        setRefreshing(false);
      }
    },
    [id]
  );

  useEffect(() => {
    loadDelivery();
  }, [loadDelivery]);

  const currentRank = useMemo(
    () =>
      statusRank[
        String(delivery?.status || "pending").toLowerCase()
      ] ?? 0,
    [delivery]
  );

  const progress = useMemo(() => {
    if (currentRank < 0) return 0;

    return Math.round(
      (currentRank /
        (trackingSteps.length - 1)) *
        100
    );
  }, [currentRank]);

  if (!delivery && !error) {
    return <Spinner />;
  }

  return (
    <div className="delivery-details-page">
      <header className="delivery-details-header">
        <button
          type="button"
          className="delivery-back-button"
          onClick={() =>
            navigate("/wholesaler/deliveries")
          }
        >
          <ArrowLeft size={18} />
          Deliveries
        </button>

        <div className="delivery-details-title-row">
          <div className="delivery-title-identity">
            <div className="delivery-title-icon">
              <Truck size={25} />
            </div>

            <div>
              <span>Delivery tracking</span>

              <div className="delivery-title-line">
                <h1>
                  {delivery?.delivery_no ||
                    `Delivery ${id}`}
                </h1>

                <Badge
                  tone={getDeliveryTone(
                    delivery?.status
                  )}
                >
                  {readable(
                    delivery?.status || "pending"
                  )}
                </Badge>
              </div>

              <p>
                Order{" "}
                {delivery?.order_no ||
                  delivery?.order_id ||
                  "—"}
                {delivery?.retailer_name
                  ? ` · ${delivery.retailer_name}`
                  : ""}
              </p>
            </div>
          </div>

          <button
            type="button"
            className="delivery-refresh-button"
            disabled={refreshing}
            onClick={() => loadDelivery(true)}
          >
            <RefreshCw
              size={17}
              className={refreshing ? "delivery-spin" : ""}
            />
            Refresh
          </button>
        </div>
      </header>

      {error && (
        <div className="delivery-alert">{error}</div>
      )}

      {delivery && (
        <>
          <section className="delivery-progress-card">
            <div className="delivery-progress-header">
              <div>
                <span>Delivery progress</span>
                <strong>{progress}% complete</strong>
              </div>

              <div>
                <small>Current status</small>
                <strong>
                  {readable(delivery.status)}
                </strong>
              </div>
            </div>

            <div className="delivery-progress-track">
              <div
                className="delivery-progress-fill"
                style={{ width: `${progress}%` }}
              />
            </div>
          </section>

          <section className="delivery-tracking-section">
            <div className="delivery-section-heading">
              <div>
                <Route size={20} />
              </div>

              <span>
                <strong>Shipment tracking</strong>
                <small>
                  Visual movement from preparation to final delivery
                </small>
              </span>
            </div>

            <div className="delivery-flowchart">
              {trackingSteps.map((step, index) => {
                const Icon = step.icon;
                const completed =
                  currentRank >= index &&
                  currentRank >= 0;
                const current =
                  currentRank === index &&
                  currentRank >= 0;

                return (
                  <div
                    className={
                      completed
                        ? current
                          ? "delivery-flow-step completed current"
                          : "delivery-flow-step completed"
                        : "delivery-flow-step"
                    }
                    key={step.id}
                  >
                    <div className="delivery-flow-marker">
                      <Icon size={19} />
                    </div>

                    {index < trackingSteps.length - 1 && (
                      <div className="delivery-flow-line" />
                    )}

                    <div className="delivery-flow-copy">
                      <small>Step {index + 1}</small>
                      <strong>{step.label}</strong>
                      <p>{step.description}</p>

                      <span>
                        {formatDate(
                          getTrackingTime(
                            delivery,
                            step.id
                          )
                        )}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="delivery-details-grid">
            <article className="delivery-info-card">
              <div className="delivery-section-heading compact">
                <div>
                  <Store size={19} />
                </div>

                <span>
                  <strong>Retailer details</strong>
                  <small>Delivery destination account</small>
                </span>
              </div>

              <InfoRow
                icon={Building2}
                label="Business"
                value={
                  delivery.business_name ||
                  delivery.retailer_name
                }
              />

              <InfoRow
                icon={UserRound}
                label="Contact person"
                value={delivery.contact_name}
              />

              <InfoRow
                icon={Phone}
                label="Phone"
                value={
                  delivery.contact_phone ||
                  delivery.retailer_phone
                }
              />

              <InfoRow
                icon={MapPin}
                label="Delivery address"
                value={delivery.delivery_address}
              />
            </article>

            <article className="delivery-info-card">
              <div className="delivery-section-heading compact">
                <div>
                  <Truck size={19} />
                </div>

                <span>
                  <strong>Transport details</strong>
                  <small>Driver and vehicle information</small>
                </span>
              </div>

              <InfoRow
                icon={UserRound}
                label="Driver"
                value={delivery.driver_name}
              />

              <InfoRow
                icon={Phone}
                label="Driver phone"
                value={delivery.driver_phone}
              />

              <InfoRow
                icon={Truck}
                label="Vehicle"
                value={delivery.vehicle_no}
              />

              <InfoRow
                icon={CalendarDays}
                label="Dispatch date"
                value={formatDate(
                  delivery.dispatched_at
                )}
              />
            </article>

            <article className="delivery-info-card">
              <div className="delivery-section-heading compact">
                <div>
                  <Clock3 size={19} />
                </div>

                <span>
                  <strong>Schedule</strong>
                  <small>Planned and completed timings</small>
                </span>
              </div>

              <InfoRow
                icon={CalendarDays}
                label="Created"
                value={formatDate(
                  delivery.created_at
                )}
              />

              <InfoRow
                icon={CalendarDays}
                label="Required date"
                value={formatDate(
                  delivery.required_date,
                  false
                )}
              />

              <InfoRow
                icon={Truck}
                label="Dispatched"
                value={formatDate(
                  delivery.dispatched_at
                )}
              />

              <InfoRow
                icon={CheckCircle2}
                label="Delivered"
                value={formatDate(
                  delivery.delivered_at
                )}
              />
            </article>

            <article className="delivery-info-card">
              <div className="delivery-section-heading compact">
                <div>
                  <ClipboardCheck size={19} />
                </div>

                <span>
                  <strong>Delivery instructions</strong>
                  <small>Notes and fulfilment remarks</small>
                </span>
              </div>

              <div className="delivery-notes">
                {delivery.notes ||
                  delivery.delivery_notes ||
                  "No delivery instructions have been added."}
              </div>
            </article>
          </section>

          <section className="delivery-items-section">
            <div className="delivery-section-heading">
              <div>
                <PackageCheck size={20} />
              </div>

              <span>
                <strong>Shipment items</strong>
                <small>
                  Products included in this delivery
                </small>
              </span>
            </div>

            {items.length ? (
              <div className="delivery-items-table-wrap">
                <table className="delivery-items-table">
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th>Quantity</th>
                      <th>Unit</th>
                      <th>Notes</th>
                    </tr>
                  </thead>

                  <tbody>
                    {items.map((item) => (
                      <tr key={item.id}>
                        <td>
                          {item.product_name ||
                            item.name ||
                            "Product"}
                        </td>
                        <td>{item.quantity || 0}</td>
                        <td>{item.unit || "—"}</td>
                        <td>{item.notes || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="delivery-items-empty">
                No shipment items were returned by the API.
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}

function InfoRow({ icon: Icon, label, value }) {
  return (
    <div className="delivery-info-row">
      <Icon size={16} />

      <span>
        <small>{label}</small>
        <strong>{value || "Not provided"}</strong>
      </span>
    </div>
  );
}
