import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import {
  ArrowDownUp,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  FileText,
  Filter,
  MapPin,
  MessageSquarePlus,
  PackageCheck,
  Plus,
  RefreshCw,
  Search,
  ShoppingCart,
  Store,
  Truck,
  Users,
  Wallet,
} from "lucide-react";

import api from "../services/api";
import {
  Badge,
  Empty,
  Spinner,
  statusTone,
} from "../components/UI";

import "./DataPage-Google.css";

const configs = {
  "retailer-orders": {
    title: "My orders",
    subtitle:
      "Track every grocery purchase list sent to wholesale dealers.",
    eyebrow: "Retail procurement",
    url: "/retailer/orders",
    cols: [
      "order_no",
      "wholesaler_name",
      "created_at",
      "status",
      "total_amount",
    ],
    icon: ShoppingCart,
    accent: "green",
    searchFields: ["order_no", "wholesaler_name", "status"],
  },

  "retailer-invoices": {
    title: "Invoices & payments",
    subtitle:
      "Review purchase invoices, due dates, paid amounts, and outstanding balances.",
    eyebrow: "Retail finance",
    url: "/retailer/invoices",
    cols: [
      "invoice_no",
      "wholesaler_name",
      "order_no",
      "total_amount",
      "paid_amount",
      "due_date",
      "status",
    ],
    icon: FileText,
    accent: "green",
    searchFields: [
      "invoice_no",
      "wholesaler_name",
      "order_no",
      "status",
    ],
  },

  "wholesaler-retailers": {
    title: "Retailers",
    subtitle:
      "Verified retail shops connected to your wholesale business.",
    eyebrow: "Retailer network",
    url: "/wholesaler/retailers",
    cols: [
      "business_name",
      "name",
      "phone",
      "location",
      "orders_count",
      "outstanding",
    ],
    icon: Store,
    accent: "orange",
    searchFields: ["business_name", "name", "phone", "location"],
  },

  "wholesaler-orders": {
    title: "Purchase orders",
    subtitle:
      "Review, confirm, pack, dispatch, and deliver retailer grocery requirements.",
    eyebrow: "Wholesale fulfilment",
    url: "/wholesaler/orders",
    cols: [
      "order_no",
      "retailer_name",
      "created_at",
      "required_date",
      "status",
      "total_amount",
    ],
    actions: true,
    icon: PackageCheck,
    accent: "orange",
    searchFields: ["order_no", "retailer_name", "status"],
  },

  "wholesaler-deliveries": {
    title: "Deliveries",
    subtitle:
      "Track packed, dispatched, and completed grocery deliveries.",
    eyebrow: "Delivery operations",
    url: "/wholesaler/deliveries",
    cols: [
      "order_no",
      "retailer_name",
      "delivery_address",
      "status",
      "delivered_at",
    ],
    icon: Truck,
    accent: "orange",
    searchFields: [
      "order_no",
      "retailer_name",
      "delivery_address",
      "status",
    ],
  },

  "wholesaler-invoices": {
    title: "Invoices",
    subtitle:
      "Review purchase bills, paid values, and pending retailer invoices.",
    eyebrow: "Wholesale finance",
    url: "/wholesaler/invoices",
    cols: [
      "invoice_no",
      "retailer_name",
      "order_no",
      "total_amount",
      "paid_amount",
      "due_date",
      "status",
    ],
    icon: FileText,
    accent: "orange",
    searchFields: [
      "invoice_no",
      "retailer_name",
      "order_no",
      "status",
    ],
  },

  "wholesaler-payments": {
    title: "Payments",
    subtitle:
      "Monitor collections, payment methods, references, and outstanding values.",
    eyebrow: "Collections",
    url: "/wholesaler/payments",
    cols: [
      "payment_no",
      "retailer_name",
      "invoice_no",
      "amount",
      "method",
      "paid_at",
      "status",
    ],
    icon: Wallet,
    accent: "orange",
    searchFields: [
      "payment_no",
      "retailer_name",
      "invoice_no",
      "method",
      "status",
    ],
  },

  "admin-users": {
    title: "Merchants & shops",
    subtitle:
      "View all approved retailers and wholesale businesses in Tofado.",
    eyebrow: "Merchant management",
    url: "/admin/users",
    cols: [
      "business_name",
      "role",
      "name",
      "phone",
      "location",
      "status",
      "created_at",
    ],
    icon: Users,
    accent: "blue",
    searchFields: [
      "business_name",
      "role",
      "name",
      "phone",
      "location",
      "status",
    ],
  },

  "admin-orders": {
    title: "All orders",
    subtitle:
      "Monitor purchase-order activity across the complete marketplace.",
    eyebrow: "Marketplace orders",
    url: "/admin/orders",
    cols: [
      "order_no",
      "retailer_name",
      "wholesaler_name",
      "status",
      "total_amount",
      "created_at",
    ],
    icon: ShoppingCart,
    accent: "blue",
    searchFields: [
      "order_no",
      "retailer_name",
      "wholesaler_name",
      "status",
    ],
  },

  "admin-finance": {
    title: "Invoices & payments",
    subtitle:
      "Review financial activity across all verified merchants.",
    eyebrow: "Marketplace finance",
    url: "/admin/finance",
    cols: [
      "invoice_no",
      "retailer_name",
      "wholesaler_name",
      "total_amount",
      "paid_amount",
      "status",
      "due_date",
    ],
    icon: CircleDollarSign,
    accent: "blue",
    searchFields: [
      "invoice_no",
      "retailer_name",
      "wholesaler_name",
      "status",
    ],
  },
};

const statusOptions = [
  "pending",
  "confirmed",
  "packed",
  "dispatched",
  "delivered",
  "cancelled",
];

const label = (value) =>
  value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());

function isDateKey(key) {
  return (
    key.includes("date") ||
    key.endsWith("_at") ||
    key === "created_at"
  );
}

function isAmountKey(key) {
  return (
    key.includes("amount") ||
    key === "outstanding" ||
    key === "order_value"
  );
}

function formatDate(value) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("en-SA", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function formatValue(key, value) {
  if (value === null || value === undefined || value === "") {
    return "—";
  }

  if (isAmountKey(key)) {
    return `SAR ${Number(value).toLocaleString("en-SA", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }

  if (isDateKey(key)) {
    return formatDate(value);
  }

  if (key === "role") {
    return label(String(value));
  }

  return value;
}

function getPrimaryValue(row, type) {
  if (type.includes("orders")) {
    return row.order_no;
  }

  if (type.includes("invoices") || type === "admin-finance") {
    return row.invoice_no;
  }

  if (type.includes("payments")) {
    return row.payment_no;
  }

  if (type.includes("retailers") || type === "admin-users") {
    return row.business_name;
  }

  if (type.includes("deliveries")) {
    return row.order_no;
  }

  return row.id;
}

function getSecondaryValue(row, type) {
  if (type === "retailer-orders") {
    return row.wholesaler_name;
  }

  if (type.includes("wholesaler")) {
    return row.retailer_name || row.business_name;
  }

  if (type.includes("admin")) {
    return (
      row.retailer_name ||
      row.wholesaler_name ||
      row.name ||
      row.role
    );
  }

  return row.order_no || row.name || row.location;
}

function getRowIcon(type) {
  if (type.includes("retailers") || type === "admin-users") {
    return Store;
  }

  if (type.includes("payments") || type.includes("finance")) {
    return Wallet;
  }

  if (type.includes("invoices")) {
    return FileText;
  }

  if (type.includes("deliveries")) {
    return Truck;
  }

  return ShoppingCart;
}

export default function DataPage({ type }) {
  const navigate = useNavigate();
  const config = configs[type];

  const [rows, setRows] = useState(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortDirection, setSortDirection] = useState("desc");
  const [refreshing, setRefreshing] = useState(false);
  const [updatingId, setUpdatingId] = useState(null);
  const [error, setError] = useState("");
const openRow = (row) => {
  if (!row?.id) return;

  switch (type) {
    case "wholesaler-retailers":
      navigate(`/wholesaler/retailers/${row.id}`);
      break;

    case "wholesaler-invoices":
      navigate(`/wholesaler/invoices/${row.id}`);
      break;

    case "wholesaler-deliveries":
      navigate(`/wholesaler/deliveries/${row.id}`);
      break;

    case "wholesaler-payments":
      navigate(`/wholesaler/payments/${row.id}`);
      break;

    default:
      break;
  }
};
  const load = async (showRefresh = false) => {
    try {
      if (showRefresh) {
        setRefreshing(true);
      }

      setError("");

      const response = await api.get(config.url);
      setRows(response.data || []);
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          "Unable to load this information."
      );
      setRows([]);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    setRows(null);
    setSearch("");
    setStatusFilter("all");
    load();
  }, [type]);

  const updateStatus = async (id, status) => {
    try {
      setUpdatingId(id);

      await api.patch(`/wholesaler/orders/${id}/status`, {
        status,
      });

      setRows((currentRows) =>
        currentRows.map((row) =>
          row.id === id
            ? {
                ...row,
                status,
              }
            : row
        )
      );
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          "Unable to update order status."
      );
    } finally {
      setUpdatingId(null);
    }
  };

  const filteredRows = useMemo(() => {
    if (!rows) return [];

    const normalizedSearch = search.trim().toLowerCase();

    const result = rows.filter((row) => {
      const matchesSearch =
        !normalizedSearch ||
        config.searchFields.some((field) =>
          String(row[field] || "")
            .toLowerCase()
            .includes(normalizedSearch)
        );

      const matchesStatus =
        statusFilter === "all" ||
        String(row.status || "").toLowerCase() === statusFilter;

      return matchesSearch && matchesStatus;
    });

    return [...result].sort((first, second) => {
      const firstValue =
        first.created_at ||
        first.paid_at ||
        first.due_date ||
        first.id;

      const secondValue =
        second.created_at ||
        second.paid_at ||
        second.due_date ||
        second.id;

      if (sortDirection === "asc") {
        return String(firstValue).localeCompare(
          String(secondValue)
        );
      }

      return String(secondValue).localeCompare(
        String(firstValue)
      );
    });
  }, [
    rows,
    search,
    statusFilter,
    sortDirection,
    config.searchFields,
  ]);

  const summary = useMemo(() => {
    if (!rows) {
      return {
        total: 0,
        pending: 0,
        completed: 0,
        value: 0,
      };
    }

    return rows.reduce(
      (result, row) => {
        result.total += 1;

        if (
          ["pending", "confirmed", "packed", "dispatched"].includes(
            row.status
          )
        ) {
          result.pending += 1;
        }

        if (
          ["delivered", "paid", "completed", "active"].includes(
            row.status
          )
        ) {
          result.completed += 1;
        }

        const amount =
          row.total_amount ||
          row.amount ||
          row.outstanding ||
          0;

        result.value += Number(amount) || 0;

        return result;
      },
      {
        total: 0,
        pending: 0,
        completed: 0,
        value: 0,
      }
    );
  }, [rows]);

  if (!config) {
    return (
      <div className="data-page-error">
        <h2>Page configuration not found</h2>
      </div>
    );
  }

  if (!rows) {
    return <Spinner />;
  }

  const HeaderIcon = config.icon;
  const RowIcon = getRowIcon(type);

  return (
    <div className={`merchant-data-page data-accent-${config.accent}`}>
     <section className="data-page-header">
  <div className="data-page-header-copy">
    <span className="data-page-eyebrow">
      {config.eyebrow}
    </span>

    <h1>{config.title}</h1>
    <p>{config.subtitle}</p>
  </div>

  {type === "wholesaler-retailers" ? (
    <div className="retailer-header-actions">
      <button
        type="button"
        className="retailer-secondary-action"
        onClick={() =>
          navigate("/wholesaler/retailers/from-enquiry")
        }
      >
        <MessageSquarePlus size={17} />
        Add from enquiry
      </button>

      <button
        type="button"
        className="retailer-primary-action"
        onClick={() =>
          navigate("/wholesaler/retailers/new")
        }
      >
        <Plus size={17} />
        Add retailer
      </button>
    </div>
  ) : (
    <div className="data-page-header-icon">
      <HeaderIcon size={28} />
    </div>
  )}
</section>

      <section className="data-summary-grid">
        <article className="data-summary-card summary-total">
          <div className="data-summary-icon">
            <FileText size={20} />
          </div>

          <div>
            <span>Total records</span>
            <strong>{summary.total}</strong>
          </div>
        </article>

        <article className="data-summary-card summary-pending">
          <div className="data-summary-icon">
            <Clock3 size={20} />
          </div>

          <div>
            <span>Pending activity</span>
            <strong>{summary.pending}</strong>
          </div>
        </article>

        <article className="data-summary-card summary-completed">
          <div className="data-summary-icon">
            <CheckCircle2 size={20} />
          </div>

          <div>
            <span>Completed</span>
            <strong>{summary.completed}</strong>
          </div>
        </article>

        <article className="data-summary-card summary-value">
          <div className="data-summary-icon">
            <Wallet size={20} />
          </div>

          <div>
            <span>Recorded value</span>
            <strong>
              SAR{" "}
              {summary.value.toLocaleString("en-SA", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </strong>
          </div>
        </article>
      </section>

      <section className="data-page-panel">
        <div className="data-toolbar">
          <div className="data-search">
            <Search size={18} />

            <input
              type="search"
              placeholder={`Search ${config.title.toLowerCase()}...`}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>

          <div className="data-toolbar-actions">
            <div className="data-filter-select">
              <Filter size={17} />

              <select
                value={statusFilter}
                onChange={(event) =>
                  setStatusFilter(event.target.value)
                }
              >
                <option value="all">All statuses</option>
                <option value="pending">Pending</option>
                <option value="confirmed">Confirmed</option>
                <option value="packed">Packed</option>
                <option value="dispatched">Dispatched</option>
                <option value="delivered">Delivered</option>
                <option value="paid">Paid</option>
                <option value="active">Active</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>

            <button
              type="button"
              className="data-toolbar-button"
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

            <button
              type="button"
              className="data-refresh-button"
              onClick={() => load(true)}
              disabled={refreshing}
            >
              <RefreshCw
                size={17}
                className={refreshing ? "refresh-spin" : ""}
              />
              Refresh
            </button>
          </div>
        </div>

        {error && (
          <div className="data-page-alert">
            <span>!</span>
            <p>{error}</p>
          </div>
        )}

        <div className="data-results-info">
          <span>
            Showing <strong>{filteredRows.length}</strong> of{" "}
            <strong>{rows.length}</strong> records
          </span>
        </div>

        {filteredRows.length ? (
          <>
            <div className="data-desktop-table">
              <div className="table-wrap">
                <table className="professional-data-table">
                  <thead>
                    <tr>
                      {config.cols.map((column) => (
                        <th key={column}>{label(column)}</th>
                      ))}

                      {config.actions && <th>Update status</th>}
                    </tr>
                  </thead>

                  <tbody>
                    {filteredRows.map((row) => (
                 <tr
  key={`${type}-${row.id}`}
className={
  [
    "wholesaler-retailers",
    "wholesaler-invoices",
    "wholesaler-payments",
    "wholesaler-deliveries",
  ].includes(type)
    ? "data-clickable-row"
    : ""
}
  onClick={() => openRow(row)}
>
                        {config.cols.map((column, columnIndex) => (
                          <td key={column}>
                            {columnIndex === 0 ? (
                              <div className="data-primary-cell">
                                <div className="data-row-icon">
                                  <RowIcon size={17} />
                                </div>

                                <div>
                                  <strong>
                                    {formatValue(
                                      column,
                                      row[column]
                                    )}
                                  </strong>

                                  <small>
                                    {getSecondaryValue(row, type) ||
                                      "Tofado Merchant"}
                                  </small>
                                </div>
                              </div>
                            ) : column === "status" ? (
                              <Badge
                                tone={statusTone(row[column])}
                              >
                                {row[column]}
                              </Badge>
                            ) : column === "delivery_address" ? (
                              <span className="data-address">
                                <MapPin size={15} />
                                {formatValue(
                                  column,
                                  row[column]
                                )}
                              </span>
                            ) : (
                              <span
                                className={
                                  isAmountKey(column)
                                    ? "data-amount"
                                    : isDateKey(column)
                                      ? "data-date"
                                      : ""
                                }
                              >
                                {formatValue(
                                  column,
                                  row[column]
                                )}
                              </span>
                            )}
                          </td>
                        ))}

                        {config.actions && (
                          <td>
                            <div className="status-update-control">
                              <select
                                value={row.status}
                                disabled={updatingId === row.id}
                                onChange={(event) =>
                                  updateStatus(
                                    row.id,
                                    event.target.value
                                  )
                                }
                              >
                                {statusOptions.map((status) => (
                                  <option
                                    value={status}
                                    key={status}
                                  >
                                    {label(status)}
                                  </option>
                                ))}
                              </select>

                              {updatingId === row.id && (
                                <span className="status-loading-dot" />
                              )}
                            </div>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="data-mobile-list">
              {filteredRows.map((row) => (
    <article
  className={
    type === "wholesaler-retailers" ||
    type === "wholesaler-invoices"
      ? "data-mobile-card data-clickable-row"
      : "data-mobile-card"
  }
  key={`mobile-${type}-${row.id}`}
  onClick={() => openRow(row)}
>
                  <div className="data-mobile-card-header">
                    <div className="data-mobile-title">
                      <div className="data-row-icon">
                        <RowIcon size={18} />
                      </div>

                      <div>
                        <strong>
                          {getPrimaryValue(row, type) || "Record"}
                        </strong>
                        <span>
                          {getSecondaryValue(row, type) || "—"}
                        </span>
                      </div>
                    </div>

                    {row.status && (
                      <Badge tone={statusTone(row.status)}>
                        {row.status}
                      </Badge>
                    )}
                  </div>

                  <div className="data-mobile-fields">
                    {config.cols
                      .filter(
                        (column) =>
                          column !== "status" &&
                          formatValue(column, row[column]) !==
                            getPrimaryValue(row, type)
                      )
                      .map((column) => (
                        <div key={column}>
                          <span>{label(column)}</span>
                          <strong>
                            {formatValue(column, row[column])}
                          </strong>
                        </div>
                      ))}
                  </div>

                  {config.actions && (
                    <div className="data-mobile-action">
                      <label>Update order status</label>

                      <select
                        value={row.status}
                        disabled={updatingId === row.id}
                        onChange={(event) =>
                          updateStatus(
                            row.id,
                            event.target.value
                          )
                        }
                      >
                        {statusOptions.map((status) => (
                          <option value={status} key={status}>
                            {label(status)}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </article>
              ))}
            </div>
          </>
        ) : (
          <div className="data-empty-wrap">
            <Empty />
            <p>No records match the current search or filter.</p>
          </div>
        )}
      </section>
    </div>
  );
}