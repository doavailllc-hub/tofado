import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Building2,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  CirclePlus,
  ClipboardList,
  MapPin,
  PackagePlus,
  Plus,
  Send,
  ShoppingBasket,
  Store,
  Trash2,
} from "lucide-react";

import api from "../services/api";

const createEmptyItem = () => ({
  product_name: "",
  quantity: 1,
  unit: "carton",
  notes: "",
});

const units = [
  "carton",
  "bag",
  "case",
  "piece",
  "kg",
  "box",
  "bundle",
  "bottle",
  "pack",
  "tray",
];

export default function NewOrder() {
  const navigate = useNavigate();

  const [wholesalers, setWholesalers] = useState([]);
  const [loadingDealers, setLoadingDealers] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    wholesaler_id: "",
    delivery_address: "",
    required_date: "",
    notes: "",
    items: [createEmptyItem()],
  });

  useEffect(() => {
    let active = true;

    async function loadWholesalers() {
      try {
        const response = await api.get("/retailer/wholesalers");

        if (active) {
          setWholesalers(response.data || []);
        }
      } catch (requestError) {
        if (active) {
          setError(
            requestError.response?.data?.message ||
              "Could not load wholesale dealers."
          );
        }
      } finally {
        if (active) {
          setLoadingDealers(false);
        }
      }
    }

    loadWholesalers();

    return () => {
      active = false;
    };
  }, []);

  const selectedWholesaler = useMemo(
    () =>
      wholesalers.find(
        (dealer) => String(dealer.id) === String(form.wholesaler_id)
      ),
    [wholesalers, form.wholesaler_id]
  );

  const totalQuantity = useMemo(
    () =>
      form.items.reduce(
        (total, item) => total + Number(item.quantity || 0),
        0
      ),
    [form.items]
  );

  const completedItems = useMemo(
    () =>
      form.items.filter((item) => item.product_name.trim()).length,
    [form.items]
  );

  const updateForm = (key, value) => {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const updateItem = (index, key, value) => {
    setForm((current) => ({
      ...current,
      items: current.items.map((item, itemIndex) =>
        itemIndex === index
          ? {
              ...item,
              [key]: value,
            }
          : item
      ),
    }));
  };

  const addItem = () => {
    setForm((current) => ({
      ...current,
      items: [...current.items, createEmptyItem()],
    }));
  };

  const removeItem = (index) => {
    if (form.items.length === 1) return;

    setForm((current) => ({
      ...current,
      items: current.items.filter(
        (_, itemIndex) => itemIndex !== index
      ),
    }));
  };

  const duplicateItem = (index) => {
    setForm((current) => {
      const selectedItem = current.items[index];

      return {
        ...current,
        items: [
          ...current.items.slice(0, index + 1),
          { ...selectedItem },
          ...current.items.slice(index + 1),
        ],
      };
    });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    setError("");

    const validItems = form.items.filter(
      (item) =>
        item.product_name.trim() &&
        Number(item.quantity) > 0
    );

    if (!form.wholesaler_id) {
      setError("Please select a wholesale dealer.");
      return;
    }

    if (!form.delivery_address.trim()) {
      setError("Please enter the delivery address.");
      return;
    }

    if (!validItems.length) {
      setError("Please add at least one grocery item.");
      return;
    }

    try {
      setSubmitting(true);

      await api.post("/retailer/orders", {
        ...form,
        items: validItems.map((item) => ({
          ...item,
          product_name: item.product_name.trim(),
          quantity: Number(item.quantity),
          notes: item.notes.trim(),
        })),
      });

      navigate("/retailer/orders");
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          "Could not send purchase list."
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="new-order-page">
      <section className="new-order-heading">
        <button
          type="button"
          className="new-order-back"
          onClick={() => navigate("/retailer")}
        >
          <ArrowLeft size={18} />
          Back to dashboard
        </button>

        <div className="new-order-title-row">
          <div>
            <span className="new-order-eyebrow">
              Retail procurement
            </span>

            <h1>Create purchase list</h1>

            <p>
              Add grocery requirements and send them directly to a
              verified wholesale dealer.
            </p>
          </div>

          <div className="new-order-title-icon">
            <ShoppingBasket size={28} />
          </div>
        </div>
      </section>

      <form className="new-order-layout" onSubmit={handleSubmit}>
        <div className="new-order-main-column">
          <section className="new-order-card">
            <div className="new-order-card-header">
              <div className="new-order-card-icon dealer">
                <Building2 size={21} />
              </div>

              <div>
                <span>Step 1</span>
                <h2>Wholesale dealer</h2>
                <p>
                  Choose the verified wholesaler receiving this list.
                </p>
              </div>
            </div>

            <div className="new-order-field-grid">
              <label className="new-order-field">
                <span>Wholesale dealer</span>

                <div className="new-order-control with-icon">
                  <Store size={18} />

                  <select
                    required
                    value={form.wholesaler_id}
                    disabled={loadingDealers}
                    onChange={(event) =>
                      updateForm(
                        "wholesaler_id",
                        event.target.value
                      )
                    }
                  >
                    <option value="">
                      {loadingDealers
                        ? "Loading dealers..."
                        : "Select wholesale dealer"}
                    </option>

                    {wholesalers.map((dealer) => (
                      <option value={dealer.id} key={dealer.id}>
                        {dealer.business_name} — {dealer.location}
                      </option>
                    ))}
                  </select>

                  <ChevronDown size={17} />
                </div>
              </label>

              <label className="new-order-field">
                <span>Required delivery date</span>

                <div className="new-order-control with-icon">
                  <CalendarDays size={18} />

                  <input
                    type="date"
                    min={new Date().toISOString().split("T")[0]}
                    value={form.required_date}
                    onChange={(event) =>
                      updateForm(
                        "required_date",
                        event.target.value
                      )
                    }
                  />
                </div>
              </label>

              <label className="new-order-field full">
                <span>Delivery address</span>

                <div className="new-order-control textarea-control">
                  <MapPin size={18} />

                  <textarea
                    required
                    rows="3"
                    placeholder="Enter shop address, building, street and nearby landmark"
                    value={form.delivery_address}
                    onChange={(event) =>
                      updateForm(
                        "delivery_address",
                        event.target.value
                      )
                    }
                  />
                </div>
              </label>
            </div>

            {selectedWholesaler && (
              <div className="selected-dealer-card">
                <div className="selected-dealer-icon">
                  <CheckCircle2 size={22} />
                </div>

                <div>
                  <span>Selected verified dealer</span>
                  <strong>
                    {selectedWholesaler.business_name}
                  </strong>
                  <small>
                    {selectedWholesaler.location}
                    {selectedWholesaler.phone
                      ? ` · ${selectedWholesaler.phone}`
                      : ""}
                  </small>
                </div>
              </div>
            )}
          </section>

          <section className="new-order-card items-card">
            <div className="new-order-card-header items-header">
              <div className="new-order-card-heading">
                <div className="new-order-card-icon items">
                  <PackagePlus size={21} />
                </div>

                <div>
                  <span>Step 2</span>
                  <h2>Grocery items</h2>
                  <p>
                    Add every product, quantity, unit and packing
                    preference.
                  </p>
                </div>
              </div>

              <button
                type="button"
                className="new-order-add-button"
                onClick={addItem}
              >
                <Plus size={18} />
                Add item
              </button>
            </div>

            <div className="purchase-items-list">
              {form.items.map((item, index) => (
                <article className="purchase-item-card" key={index}>
                  <div className="purchase-item-number">
                    {String(index + 1).padStart(2, "0")}
                  </div>

                  <div className="purchase-item-fields">
                    <label className="new-order-field product-field">
                      <span>Product name</span>

                      <input
                        required
                        placeholder="Example: Basmati rice 5 kg"
                        value={item.product_name}
                        onChange={(event) =>
                          updateItem(
                            index,
                            "product_name",
                            event.target.value
                          )
                        }
                      />
                    </label>

                    <label className="new-order-field quantity-field">
                      <span>Quantity</span>

                      <input
                        required
                        type="number"
                        min="1"
                        step="1"
                        value={item.quantity}
                        onChange={(event) =>
                          updateItem(
                            index,
                            "quantity",
                            event.target.value
                          )
                        }
                      />
                    </label>

                    <label className="new-order-field unit-field">
                      <span>Unit</span>

                      <select
                        value={item.unit}
                        onChange={(event) =>
                          updateItem(
                            index,
                            "unit",
                            event.target.value
                          )
                        }
                      >
                        {units.map((unit) => (
                          <option value={unit} key={unit}>
                            {unit}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="new-order-field notes-field">
                      <span>Brand or packing notes</span>

                      <input
                        placeholder="Example: India Gate, 4 × 5 kg"
                        value={item.notes}
                        onChange={(event) =>
                          updateItem(
                            index,
                            "notes",
                            event.target.value
                          )
                        }
                      />
                    </label>
                  </div>

                  <div className="purchase-item-actions">
                    <button
                      type="button"
                      className="purchase-item-action duplicate"
                      title="Duplicate item"
                      onClick={() => duplicateItem(index)}
                    >
                      <CirclePlus size={18} />
                    </button>

                    <button
                      type="button"
                      className="purchase-item-action remove"
                      title="Remove item"
                      disabled={form.items.length === 1}
                      onClick={() => removeItem(index)}
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </article>
              ))}
            </div>

            <button
              type="button"
              className="new-order-add-another"
              onClick={addItem}
            >
              <Plus size={18} />
              Add another grocery item
            </button>
          </section>

          <section className="new-order-card">
            <div className="new-order-card-header">
              <div className="new-order-card-icon notes">
                <ClipboardList size={21} />
              </div>

              <div>
                <span>Step 3</span>
                <h2>Additional instructions</h2>
                <p>
                  Add delivery timing, preferred brands, or special
                  conditions.
                </p>
              </div>
            </div>

            <label className="new-order-field">
              <span>Order notes</span>

              <textarea
                rows="4"
                placeholder="Example: Please call before dispatch. Do not substitute brands without approval."
                value={form.notes}
                onChange={(event) =>
                  updateForm("notes", event.target.value)
                }
              />
            </label>
          </section>

          {error && (
            <div className="new-order-error">
              <span>!</span>
              <div>
                <strong>Unable to send purchase list</strong>
                <p>{error}</p>
              </div>
            </div>
          )}
        </div>

        <aside className="new-order-summary-column">
          <div className="new-order-summary-card">
            <span className="summary-eyebrow">Order summary</span>
            <h2>Purchase list overview</h2>

            <div className="summary-stat-list">
              <div>
                <span>Grocery items</span>
                <strong>{completedItems}</strong>
              </div>

              <div>
                <span>Total quantity</span>
                <strong>{totalQuantity}</strong>
              </div>

              <div>
                <span>Wholesale dealer</span>
                <strong>
                  {selectedWholesaler
                    ? selectedWholesaler.business_name
                    : "Not selected"}
                </strong>
              </div>

              <div>
                <span>Required date</span>
                <strong>
                  {form.required_date || "Not specified"}
                </strong>
              </div>
            </div>

            <div className="summary-divider" />

            <div className="summary-info">
              <CheckCircle2 size={18} />
              <p>
                The wholesaler will review your list, confirm
                availability, and update the order status.
              </p>
            </div>

            <button
              type="submit"
              className="new-order-submit"
              disabled={submitting}
            >
              {submitting ? (
                <>
                  <span className="button-spinner" />
                  Sending list...
                </>
              ) : (
                <>
                  <Send size={18} />
                  Send purchase list
                </>
              )}
            </button>

            <button
              type="button"
              className="new-order-cancel"
              onClick={() => navigate("/retailer/orders")}
            >
              Cancel
            </button>
          </div>
        </aside>
      </form>
    </div>
  );
}