import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Building2,
  CheckCircle2,
  ImagePlus,
  LoaderCircle,
  Package,
  Save,
  Tag,
  Wallet,
} from "lucide-react";

import api from "../services/api";
import { Spinner } from "../components/UI";
import "./ProductForm.css";

const initialForm = {
  name: "",
  sku: "",
  brand: "",
  category_name: "",
  description: "",
  image_url: "",
  image_key: "",
  unit: "piece",
  pack_size: "",
  minimum_order: 1,
  price_mode: "fixed",
  price: "",
  stock_quantity: "",
  is_active: true,
};

const units = [
  "piece",
  "carton",
  "box",
  "bag",
  "case",
  "kg",
  "pack",
  "bottle",
  "tray",
  "bundle",
];

export default function ProductForm() {
  const { id } = useParams();
  const navigate = useNavigate();

  const editing = Boolean(id);

  const [form, setForm] = useState(initialForm);
  const [loading, setLoading] = useState(editing);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!editing) {
      return;
    }

    let active = true;

    async function loadProduct() {
      try {
        setError("");

        const response = await api.get(
          `/wholesaler/catalog/products/${id}`
        );

        if (active) {
          setForm({
            ...initialForm,
            ...response.data,
            price_mode:
              response.data?.price_mode === "quote"
                ? "quote"
                : "fixed",
            price: response.data?.price ?? "",
            is_active: Boolean(response.data?.is_active),
          });
        }
      } catch (requestError) {
        if (active) {
          setError(
            requestError.response?.data?.message ||
              "Unable to load the product."
          );
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadProduct();

    return () => {
      active = false;
    };
  }, [editing, id]);

  const previewPrice = useMemo(() => {
    if (form.price_mode === "quote") {
      return "Price on request";
    }

    const value = Number(form.price || 0);

    return Number.isFinite(value)
      ? `SAR ${value.toFixed(2)}`
      : "SAR 0.00";
  }, [form.price, form.price_mode]);

  const updateField = (key, value) => {
    setError("");
    setMessage("");

    setForm((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const submit = async (event) => {
    event.preventDefault();

    if (!form.name.trim()) {
      setError("Product name is required.");
      return;
    }

    if (
      form.price_mode === "fixed" &&
      (form.price === "" || Number(form.price) < 0)
    ) {
      setError("Enter a valid product price.");
      return;
    }

    if (Number(form.minimum_order) < 1) {
      setError("Minimum order must be at least 1.");
      return;
    }

    try {
      setSaving(true);
      setError("");
      setMessage("");

      const payload = {
        name: form.name.trim(),
        sku: form.sku.trim() || null,
        brand: form.brand.trim() || null,
        category_name:
          form.category_name.trim() || null,
        description:
          form.description.trim() || null,
        image_url: form.image_url.trim() || null,
        image_key: form.image_key?.trim() || null,
        unit: form.unit,
        pack_size: form.pack_size.trim() || null,
        minimum_order: Number(
          form.minimum_order || 1
        ),
        price_mode: form.price_mode,
        price:
          form.price_mode === "quote"
            ? null
            : Number(form.price || 0),
        stock_quantity:
          form.stock_quantity === ""
            ? null
            : Number(form.stock_quantity),
        is_active: Boolean(form.is_active),
      };

      if (editing) {
        await api.put(
          `/wholesaler/catalog/products/${id}`,
          payload
        );

        setMessage("Product updated successfully.");
      } else {
        await api.post(
          "/wholesaler/catalog/products",
          payload
        );

        navigate("/wholesaler/catalog");
      }
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          "Unable to save the product."
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <Spinner />;
  }

  return (
    <div className="product-form-page">
      <section className="product-form-heading">
        <div>
          <Link
            className="product-form-back"
            to="/wholesaler/catalog"
          >
            <ArrowLeft size={17} />
            Back to catalog
          </Link>

          <span className="product-form-eyebrow">
            {editing
              ? "Edit catalog product"
              : "New catalog product"}
          </span>

          <h1>
            {editing
              ? "Edit product"
              : "Add product"}
          </h1>

          <p>
            Add product information, choose how pricing is displayed, manage stock, and preview the public listing.
          </p>
        </div>

        <div className="product-form-heading-icon">
          <Package size={28} />
        </div>
      </section>

      <form
        className="product-form-layout"
        onSubmit={submit}
      >
        <div className="product-form-main">
          <section className="product-form-card">
            <div className="product-form-card-header">
              <div className="product-form-card-icon blue">
                <Building2 size={21} />
              </div>

              <div>
                <span>Basic details</span>
                <h2>Product information</h2>
                <p>
                  Use a clear product name and correct packing
                  details.
                </p>
              </div>
            </div>

            <div className="product-form-grid">
              <label className="product-form-field full">
                <span>Product name</span>

                <input
                  required
                  value={form.name}
                  placeholder="Example: Premium Basmati Rice 5 kg"
                  onChange={(event) =>
                    updateField(
                      "name",
                      event.target.value
                    )
                  }
                />
              </label>

              <label className="product-form-field">
                <span>SKU</span>

                <input
                  value={form.sku}
                  placeholder="Example: RICE-5001"
                  onChange={(event) =>
                    updateField(
                      "sku",
                      event.target.value
                    )
                  }
                />
              </label>

              <label className="product-form-field">
                <span>Brand</span>

                <input
                  value={form.brand}
                  placeholder="Example: India Gate"
                  onChange={(event) =>
                    updateField(
                      "brand",
                      event.target.value
                    )
                  }
                />
              </label>

              <label className="product-form-field">
                <span>Category</span>

                <div className="product-form-control-icon">
                  <Tag size={17} />

                  <input
                    value={form.category_name}
                    placeholder="Example: Rice & Grains"
                    onChange={(event) =>
                      updateField(
                        "category_name",
                        event.target.value
                      )
                    }
                  />
                </div>
              </label>

              <label className="product-form-field">
                <span>Pack size</span>

                <input
                  value={form.pack_size}
                  placeholder="Example: 4 × 5 kg"
                  onChange={(event) =>
                    updateField(
                      "pack_size",
                      event.target.value
                    )
                  }
                />
              </label>

              <label className="product-form-field full">
                <span>Description</span>

                <textarea
                  rows="5"
                  value={form.description}
                  placeholder="Describe the quality, origin, packing, and important product details."
                  onChange={(event) =>
                    updateField(
                      "description",
                      event.target.value
                    )
                  }
                />
              </label>
            </div>
          </section>

          <section className="product-form-card">
            <div className="product-form-card-header">
              <div className="product-form-card-icon green">
                <Wallet size={21} />
              </div>

              <div>
                <span>Commercial details</span>
                <h2>Pricing and quantity</h2>
                <p>
                  Choose whether to show a fixed price or ask
                  customers to request a quotation.
                </p>
              </div>
            </div>

            <div className="product-form-grid three">
              <label className="product-form-field">
                <span>Selling unit</span>

                <select
                  value={form.unit}
                  onChange={(event) =>
                    updateField(
                      "unit",
                      event.target.value
                    )
                  }
                >
                  {units.map((unit) => (
                    <option
                      value={unit}
                      key={unit}
                    >
                      {unit}
                    </option>
                  ))}
                </select>
              </label>

              <label className="product-form-field">
                <span>Price display</span>

                <select
                  value={form.price_mode}
                  onChange={(event) =>
                    updateField(
                      "price_mode",
                      event.target.value
                    )
                  }
                >
                  <option value="fixed">
                    Show product price
                  </option>

                  <option value="quote">
                    Price on request
                  </option>
                </select>

                <small className="product-form-help">
                  Choose “Price on request” when the selling
                  price should not be shown publicly.
                </small>
              </label>

              {form.price_mode === "fixed" && (
                <label className="product-form-field">
                  <span>Unit price (SAR)</span>

                  <input
                    required
                    min="0"
                    step="0.01"
                    type="number"
                    value={form.price}
                    placeholder="0.00"
                    onChange={(event) =>
                      updateField(
                        "price",
                        event.target.value
                      )
                    }
                  />
                </label>
              )}

              <label className="product-form-field">
                <span>Minimum order</span>

                <input
                  required
                  min="1"
                  step="1"
                  type="number"
                  value={form.minimum_order}
                  onChange={(event) =>
                    updateField(
                      "minimum_order",
                      event.target.value
                    )
                  }
                />
              </label>

              <label className="product-form-field">
                <span>Stock quantity</span>

                <input
                  min="0"
                  step="1"
                  type="number"
                  value={form.stock_quantity}
                  placeholder="Optional"
                  onChange={(event) =>
                    updateField(
                      "stock_quantity",
                      event.target.value
                    )
                  }
                />
              </label>

              <label className="product-publish-field">
                <span>
                  <strong>Publish product</strong>

                  <small>
                    Show this product in the public catalog.
                  </small>
                </span>

                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={(event) =>
                    updateField(
                      "is_active",
                      event.target.checked
                    )
                  }
                />
              </label>
            </div>
          </section>

          <section className="product-form-card">
            <div className="product-form-card-header">
              <div className="product-form-card-icon orange">
                <ImagePlus size={21} />
              </div>

              <div>
                <span>Product image</span>
                <h2>Image URL</h2>
                <p>
                  Use a clear image with a white or simple
                  background.
                </p>
              </div>
            </div>

            <label className="product-form-field">
              <span>Image URL</span>

              <input
                type="url"
                value={form.image_url}
                placeholder="https://example.com/product-image.jpg"
                onChange={(event) =>
                  updateField(
                    "image_url",
                    event.target.value
                  )
                }
              />
            </label>
          </section>

          {error && (
            <div className="product-form-alert error">
              {error}
            </div>
          )}

          {message && (
            <div className="product-form-alert success">
              <CheckCircle2 size={18} />
              {message}
            </div>
          )}

          <div className="product-form-actions">
            <Link to="/wholesaler/catalog">
              Cancel
            </Link>

            <button
              type="submit"
              disabled={saving}
            >
              {saving ? (
                <>
                  <LoaderCircle
                    size={18}
                    className="product-form-spin"
                  />

                  Saving...
                </>
              ) : (
                <>
                  <Save size={18} />

                  {editing
                    ? "Update product"
                    : "Create product"}
                </>
              )}
            </button>
          </div>
        </div>

        <aside className="product-preview-card">
          <span className="product-form-eyebrow">
            Live preview
          </span>

          <div className="product-preview-image">
            {form.image_url ? (
              <img
                src={form.image_url}
                alt={form.name || "Product"}
                onError={(event) => {
                  event.currentTarget.style.display =
                    "none";
                }}
              />
            ) : (
              <ImagePlus size={38} />
            )}
          </div>

          <span className="product-preview-category">
            {form.category_name || "Grocery"}
          </span>

          <h2>{form.name || "Product name"}</h2>

          <p>
            {[form.brand, form.pack_size]
              .filter(Boolean)
              .join(" · ") ||
              "Brand and pack size"}
          </p>

          <div
            className={`product-preview-price ${
              form.price_mode === "quote"
                ? "price-on-request"
                : ""
            }`}
          >
            <strong>{previewPrice}</strong>

            <small>
              {form.price_mode === "quote"
                ? "Contact merchant for quotation"
                : `per ${form.unit}`}
            </small>
          </div>

          <div className="product-preview-meta">
            <span>Minimum order</span>

            <strong>
              {form.minimum_order || 1}{" "}
              {form.unit}
            </strong>
          </div>

          <div className="product-preview-status">
            <span
              className={
                form.is_active
                  ? "active"
                  : "hidden"
              }
            />

            {form.is_active
              ? "Published"
              : "Hidden"}
          </div>
        </aside>
      </form>
    </div>
  );
}