import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Boxes,
  Check,
  CircleDollarSign,
  ClipboardCheck,
  Copy,
  Edit3,
  ExternalLink,
  Eye,
  EyeOff,
  ImagePlus,
  Info,
  LoaderCircle,
  Mail,
  MessageCircle,
  Package,
  Plus,
  RefreshCw,
  Save,
  Search,
  Share2,
  Trash2,
  UploadCloud,
  X,
} from "lucide-react";

import api from "../services/api";
import { Badge, Empty, Spinner } from "../components/UI";
import "./ProductWizard-Fullscreen.css";
import "./Catalog-Storefront-V2.css";

const PRODUCT_CATEGORIES = [
  "Rice & Grains",
  "Flour & Baking",
  "Cooking Oil",
  "Pulses & Legumes",
  "Spices & Seasoning",
  "Beverages",
  "Dairy Products",
  "Frozen Foods",
  "Canned Foods",
  "Snacks & Confectionery",
  "Fresh Produce",
  "Meat & Poultry",
  "Cleaning & Household",
  "Personal Care",
  "Other",
];

const SELLING_UNITS = [
  "piece",
  "pack",
  "box",
  "carton",
  "case",
  "bag",
  "bottle",
  "can",
  "jar",
  "tray",
  "bundle",
  "kg",
  "gram",
  "litre",
];

const EMPTY_PRODUCT = {
  id: null,
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
  price: "",
  compare_price: "",
  stock_quantity: "",
  low_stock_level: 5,
  is_active: true,
};

function normalizeProduct(product = {}) {
  return {
    ...EMPTY_PRODUCT,
    ...product,
    id: product.id || null,
    price: product.price ?? "",
    compare_price: product.compare_price ?? "",
    stock_quantity: product.stock_quantity ?? "",
    minimum_order: product.minimum_order || 1,
    low_stock_level: product.low_stock_level ?? 5,
    is_active: Boolean(product.is_active),
  };
}

function formatMoney(value) {
  return Number(value || 0).toLocaleString("en-SA", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export default function Catalog() {
  const imageInputRef = useRef(null);

  const [products, setProducts] = useState(null);
  const [catalog, setCatalog] = useState(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [copied, setCopied] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [processingId, setProcessingId] = useState(null);
  const [error, setError] = useState("");

  const [editorOpen, setEditorOpen] = useState(false);
  const [editorStep, setEditorStep] = useState(1);
  const [productForm, setProductForm] = useState(EMPTY_PRODUCT);
  const [savingProduct, setSavingProduct] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);

  const load = async (showRefreshing = false) => {
    try {
      if (showRefreshing) setRefreshing(true);
      setError("");

      const [productsResponse, catalogResponse] = await Promise.all([
        api.get("/wholesaler/catalog/products"),
        api.get("/wholesaler/catalog"),
      ]);

      setProducts(productsResponse.data || []);
      setCatalog(catalogResponse.data || null);
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          "Unable to load product catalog."
      );
      setProducts([]);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (!editorOpen) return undefined;

    const closeOnEscape = (event) => {
      if (
        event.key === "Escape" &&
        !savingProduct &&
        !uploadingImage
      ) {
        closeEditor();
      }
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);

    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [editorOpen, savingProduct, uploadingImage]);

  const publicUrl = useMemo(() => {
    if (catalog?.public_url) return catalog.public_url;
    if (catalog?.slug) {
      return `${window.location.origin}/catalog/${catalog.slug}`;
    }
    return "";
  }, [catalog]);

  const categories = useMemo(() => {
    const values = new Set(PRODUCT_CATEGORIES);

    (products || []).forEach((product) => {
      if (product.category_name) values.add(product.category_name);
    });

    return Array.from(values);
  }, [products]);

  const stats = useMemo(() => {
    const rows = products || [];

    return {
      total: rows.length,
      published: rows.filter((item) => item.is_active).length,
      hidden: rows.filter((item) => !item.is_active).length,
      lowStock: rows.filter(
        (item) =>
          item.stock_quantity !== null &&
          Number(item.stock_quantity) <=
            Number(item.low_stock_level || 5)
      ).length,
    };
  }, [products]);

  const filteredProducts = useMemo(() => {
    if (!products) return [];

    const value = search.trim().toLowerCase();

    return products.filter((product) => {
      const matchesSearch =
        !value ||
        [
          product.name,
          product.category_name,
          product.brand,
          product.sku,
          product.pack_size,
        ].some((field) =>
          String(field || "").toLowerCase().includes(value)
        );

      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "published" && product.is_active) ||
        (statusFilter === "hidden" && !product.is_active) ||
        (statusFilter === "low-stock" &&
          product.stock_quantity !== null &&
          Number(product.stock_quantity) <=
            Number(product.low_stock_level || 5));

      const matchesCategory =
        categoryFilter === "all" ||
        product.category_name === categoryFilter;

      return matchesSearch && matchesStatus && matchesCategory;
    });
  }, [products, search, statusFilter, categoryFilter]);

  const openCreate = () => {
    setError("");
    setEditorStep(1);
    setProductForm({ ...EMPTY_PRODUCT });
    setEditorOpen(true);
  };

  const openEdit = (product) => {
    setError("");
    setEditorStep(1);
    setProductForm(normalizeProduct(product));
    setEditorOpen(true);
  };

  const closeEditor = () => {
    if (savingProduct || uploadingImage) return;

    setEditorOpen(false);
    setEditorStep(1);
    setProductForm({ ...EMPTY_PRODUCT });
    setError("");
  };

  const updateProductField = (key, value) => {
    setError("");
    setProductForm((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const uploadImage = async (file) => {
    if (!file) return;

    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];

    if (!allowedTypes.includes(file.type)) {
      setError("Use a JPG, PNG, or WEBP product image.");
      return;
    }

    if (file.size > 6 * 1024 * 1024) {
      setError("Product image must be smaller than 6 MB.");
      return;
    }

    try {
      setUploadingImage(true);
      setError("");

      const data = new FormData();
      data.append("image", file);

      const response = await api.post(
        "/wholesaler/catalog/product-image",
        data,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        }
      );

      updateProductField("image_url", response.data.image_url);
      updateProductField("image_key", response.data.image_key);
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          "Unable to upload product image."
      );
    } finally {
      setUploadingImage(false);
      if (imageInputRef.current) {
        imageInputRef.current.value = "";
      }
    }
  };

  const validateEditorStep = (step) => {
    setError("");

    if (step === 1) {
      if (!productForm.name.trim()) {
        setError("Enter the product name.");
        return false;
      }

      if (!productForm.category_name) {
        setError("Select a product category.");
        return false;
      }
    }

    if (step === 2) {
      if (!productForm.unit) {
        setError("Select the selling unit.");
        return false;
      }

      if (
        productForm.price === "" ||
        Number(productForm.price) < 0
      ) {
        setError("Enter a valid product price.");
        return false;
      }

      if (Number(productForm.minimum_order) < 1) {
        setError("Minimum order must be at least 1.");
        return false;
      }

      if (
        productForm.compare_price !== "" &&
        Number(productForm.compare_price) < 0
      ) {
        setError("Compare price cannot be negative.");
        return false;
      }
    }

    if (step === 3) {
      if (
        productForm.stock_quantity !== "" &&
        Number(productForm.stock_quantity) < 0
      ) {
        setError("Stock quantity cannot be negative.");
        return false;
      }

      if (Number(productForm.low_stock_level) < 0) {
        setError("Low-stock level cannot be negative.");
        return false;
      }
    }

    return true;
  };

  const nextEditorStep = () => {
    if (!validateEditorStep(editorStep)) return;
    setEditorStep((current) => Math.min(current + 1, 4));
  };

  const previousEditorStep = () => {
    setError("");
    setEditorStep((current) => Math.max(current - 1, 1));
  };

  const saveProduct = async (event) => {
    event.preventDefault();

    if (!productForm.name.trim()) {
      setError("Product name is required.");
      return;
    }

    if (!productForm.category_name) {
      setError("Select a product category.");
      return;
    }

    if (Number(productForm.price) < 0) {
      setError("Price cannot be negative.");
      return;
    }

    if (Number(productForm.minimum_order) < 1) {
      setError("Minimum order must be at least 1.");
      return;
    }

    try {
      setSavingProduct(true);
      setError("");

      const payload = {
        name: productForm.name.trim(),
        sku: productForm.sku.trim() || null,
        brand: productForm.brand.trim() || null,
        category_name: productForm.category_name,
        description: productForm.description.trim() || null,
        image_url: productForm.image_url || null,
        image_key: productForm.image_key || null,
        unit: productForm.unit,
        pack_size: productForm.pack_size.trim() || null,
        minimum_order: Number(productForm.minimum_order || 1),
        price: Number(productForm.price || 0),
        compare_price:
          productForm.compare_price === ""
            ? null
            : Number(productForm.compare_price),
        stock_quantity:
          productForm.stock_quantity === ""
            ? null
            : Number(productForm.stock_quantity),
        low_stock_level: Number(productForm.low_stock_level || 5),
        is_active: Boolean(productForm.is_active),
      };

      if (productForm.id) {
        const response = await api.put(
          `/wholesaler/catalog/products/${productForm.id}`,
          payload
        );

        setProducts((current) =>
          current.map((item) =>
            item.id === productForm.id ? response.data : item
          )
        );
      } else {
        const response = await api.post(
          "/wholesaler/catalog/products",
          payload
        );

        setProducts((current) => [response.data, ...current]);
      }

      setEditorOpen(false);
      setProductForm(EMPTY_PRODUCT);
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          "Unable to save product."
      );
    } finally {
      setSavingProduct(false);
    }
  };

  const toggleProduct = async (product) => {
    try {
      setProcessingId(product.id);
      setError("");

      const response = await api.patch(
        `/wholesaler/catalog/products/${product.id}/status`,
        {
          is_active: !product.is_active,
        }
      );

      setProducts((current) =>
        current.map((item) =>
          item.id === product.id ? response.data : item
        )
      );
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          "Unable to update product visibility."
      );
    } finally {
      setProcessingId(null);
    }
  };

  const deleteProduct = async (product) => {
    if (
      !window.confirm(
        `Delete "${product.name}" from your catalog?`
      )
    ) {
      return;
    }

    try {
      setProcessingId(product.id);
      setError("");

      await api.delete(
        `/wholesaler/catalog/products/${product.id}`
      );

      setProducts((current) =>
        current.filter((item) => item.id !== product.id)
      );
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          "Unable to delete this product."
      );
    } finally {
      setProcessingId(null);
    }
  };

  const copyCatalogLink = async () => {
    if (!publicUrl) return;

    try {
      await navigator.clipboard.writeText(publicUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setError("Unable to copy the catalog link.");
    }
  };

  const shareCatalogWhatsApp = () => {
    if (!publicUrl) return;

    const title =
      catalog?.title ||
      catalog?.business_name ||
      "Wholesale Product Catalog";

    const message = encodeURIComponent(
      `${title}\nBrowse products and place your order here:\n${publicUrl}`
    );

    window.open(`https://wa.me/?text=${message}`, "_blank", "noopener,noreferrer");
  };

  const shareCatalogEmail = () => {
    if (!publicUrl) return;

    const title =
      catalog?.title ||
      catalog?.business_name ||
      "Wholesale Product Catalog";

    const subject = encodeURIComponent(title);
    const body = encodeURIComponent(
      `Hello,\n\nPlease view our wholesale product catalog using the link below:\n${publicUrl}\n\nYou can browse products, send an enquiry, or place an order directly.`
    );

    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  };

  const shareCatalog = async () => {
    if (!publicUrl) return;

    try {
      if (navigator.share) {
        await navigator.share({
          title:
            catalog?.title ||
            catalog?.business_name ||
            "Product catalog",
          text: "View our wholesale product catalog.",
          url: publicUrl,
        });
        return;
      }

      await copyCatalogLink();
    } catch (shareError) {
      if (shareError?.name !== "AbortError") {
        setError("Unable to share the catalog.");
      }
    }
  };

  if (!products) return <Spinner />;

  return (
    <div className="catalog-page catalog-v2">
      <section className="catalog-page-heading">
        <div>
          <span className="catalog-eyebrow">
            Merchant products
          </span>

          <h1>Product catalog</h1>

          <p>
            Manage products, pricing, stock, and your public
            wholesale catalog.
          </p>
        </div>

        <button
          type="button"
          className="catalog-primary-button"
          onClick={openCreate}
        >
          <Plus size={18} />
          Add product
        </button>
      </section>

      <section className="catalog-summary-grid">
        <article>
          <span>Total products</span>
          <strong>{stats.total}</strong>
        </article>

        <article>
          <span>Published</span>
          <strong>{stats.published}</strong>
        </article>

        <article>
          <span>Hidden</span>
          <strong>{stats.hidden}</strong>
        </article>

        <article>
          <span>Low stock</span>
          <strong>{stats.lowStock}</strong>
        </article>
      </section>

      <section className="catalog-share-panel">
        <div className="catalog-share-icon">
          <Share2 size={23} />
        </div>

        <div className="catalog-share-copy">
          <span>Public catalog</span>

          <h2>
            {catalog?.title ||
              catalog?.business_name ||
              "Your wholesale product catalog"}
          </h2>

          <p>
            Share this link with retailers so they can browse your
            available products.
          </p>

          <div className="catalog-link-box">
            <input
              readOnly
              value={
                publicUrl ||
                "Your public link will appear here"
              }
              aria-label="Public catalog link"
            />

            <button
              type="button"
              disabled={!publicUrl}
              onClick={copyCatalogLink}
            >
              {copied ? <Check size={17} /> : <Copy size={17} />}
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
        </div>

        <div className="catalog-share-buttons">
          <button
            type="button"
            className="catalog-share-whatsapp"
            disabled={!publicUrl}
            onClick={shareCatalogWhatsApp}
          >
            <MessageCircle size={17} />
            WhatsApp
          </button>

          <button
            type="button"
            className="catalog-share-email"
            disabled={!publicUrl}
            onClick={shareCatalogEmail}
          >
            <Mail size={17} />
            Email
          </button>

          <button
            type="button"
            disabled={!publicUrl}
            onClick={shareCatalog}
          >
            <Share2 size={17} />
            More
          </button>

          {publicUrl && (
            <a
              href={publicUrl}
              target="_blank"
              rel="noreferrer"
              className="catalog-open-store"
            >
              <ExternalLink size={17} />
              View store
            </a>
          )}
        </div>
      </section>

      <section className="catalog-product-panel">
        <div className="catalog-toolbar catalog-toolbar-v2">
          <div>
            <h2>Products</h2>
            <p>{filteredProducts.length} products shown</p>
          </div>

          <div className="catalog-toolbar-actions">
            <div className="catalog-search">
              <Search size={17} />

              <input
                type="search"
                placeholder="Search name, SKU, brand..."
                value={search}
                onChange={(event) =>
                  setSearch(event.target.value)
                }
              />
            </div>

            <select
              value={categoryFilter}
              onChange={(event) =>
                setCategoryFilter(event.target.value)
              }
              aria-label="Filter by category"
            >
              <option value="all">All categories</option>
              {categories.map((category) => (
                <option value={category} key={category}>
                  {category}
                </option>
              ))}
            </select>

            <select
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(event.target.value)
              }
              aria-label="Filter by status"
            >
              <option value="all">All statuses</option>
              <option value="published">Published</option>
              <option value="hidden">Hidden</option>
              <option value="low-stock">Low stock</option>
            </select>

            <button
              type="button"
              className="catalog-refresh-button"
              disabled={refreshing}
              onClick={() => load(true)}
            >
              <RefreshCw
                size={16}
                className={refreshing ? "catalog-spin" : ""}
              />
              Refresh
            </button>
          </div>
        </div>

        {error && !editorOpen && (
          <div className="catalog-alert error">{error}</div>
        )}

        {filteredProducts.length ? (
          <div className="merchant-product-grid">
            {filteredProducts.map((product) => {
              const lowStock =
                product.stock_quantity !== null &&
                Number(product.stock_quantity) <=
                  Number(product.low_stock_level || 5);

              return (
                <article
                  className="merchant-product-card"
                  key={product.id}
                >
                  <div className="merchant-product-image">
                    {product.image_url ? (
                      <img
                        src={product.image_url}
                        alt={product.name}
                        loading="lazy"
                      />
                    ) : (
                      <Package size={34} />
                    )}

                    <Badge
                      tone={
                        product.is_active ? "success" : "neutral"
                      }
                    >
                      {product.is_active ? "Published" : "Hidden"}
                    </Badge>
                  </div>

                  <div className="merchant-product-body">
                    <span>
                      {product.category_name || "Other"}
                    </span>

                    <h3 title={product.name}>{product.name}</h3>

                    <p>
                      {[product.brand, product.pack_size]
                        .filter(Boolean)
                        .join(" · ") ||
                        "General wholesale product"}
                    </p>

                    <div className="merchant-product-price">
                      <strong>
                        SAR {formatMoney(product.price)}
                      </strong>
                      <small>per {product.unit || "piece"}</small>
                    </div>

                    <div className="merchant-product-details">
                      <span>
                        Stock
                        <br />
                        <strong className={lowStock ? "low-stock" : ""}>
                          {product.stock_quantity === null
                            ? "Not tracked"
                            : product.stock_quantity}
                        </strong>
                      </span>

                      <span>
                        Minimum
                        <br />
                        <strong>
                          {product.minimum_order || 1}{" "}
                          {product.unit || "piece"}
                        </strong>
                      </span>

                      <span>
                        SKU
                        <br />
                        <strong>{product.sku || "—"}</strong>
                      </span>
                    </div>
                  </div>

                  <div className="merchant-product-actions">
                    <button
                      type="button"
                      onClick={() => openEdit(product)}
                    >
                      <Edit3 size={16} />
                      Edit
                    </button>

                    <button
                      type="button"
                      disabled={processingId === product.id}
                      onClick={() => toggleProduct(product)}
                    >
                      {product.is_active ? (
                        <EyeOff size={16} />
                      ) : (
                        <Eye size={16} />
                      )}
                      {product.is_active ? "Hide" : "Publish"}
                    </button>

                    <button
                      type="button"
                      className="danger"
                      disabled={processingId === product.id}
                      aria-label={`Delete ${product.name}`}
                      onClick={() => deleteProduct(product)}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="catalog-empty-wrap">
            <Empty />
            <h3>
              {products.length
                ? "No matching products"
                : "Your catalog is empty"}
            </h3>
            <p>
              {products.length
                ? "Change the search or filters."
                : "Add your first wholesale product."}
            </p>

            {!products.length && (
              <button
                type="button"
                className="catalog-primary-button"
                onClick={openCreate}
              >
                <Plus size={17} />
                Add first product
              </button>
            )}
          </div>
        )}
      </section>

      {editorOpen && (
        <div className="product-wizard-overlay">
          <section
            className="product-wizard"
            role="dialog"
            aria-modal="true"
            aria-labelledby="product-wizard-title"
          >
            <header className="product-wizard-header">
              <div className="product-wizard-header-copy">
                <span>
                  {productForm.id
                    ? "Edit catalog product"
                    : "New catalog product"}
                </span>

                <h2 id="product-wizard-title">
                  {productForm.id
                    ? "Update product"
                    : "Add a new product"}
                </h2>

                <p>
                  Complete the product setup in four simple steps.
                </p>
              </div>

              <button
                type="button"
                className="product-wizard-close"
                aria-label="Close product editor"
                disabled={savingProduct || uploadingImage}
                onClick={closeEditor}
              >
                <X size={20} />
              </button>
            </header>

            <div className="product-wizard-layout">
              <aside className="product-wizard-sidebar">
                {[
                  {
                    number: 1,
                    title: "Basic information",
                    text: "Name, SKU, brand and category",
                    icon: Info,
                  },
                  {
                    number: 2,
                    title: "Pricing and package",
                    text: "Unit, pack size and wholesale price",
                    icon: CircleDollarSign,
                  },
                  {
                    number: 3,
                    title: "Inventory and details",
                    text: "Stock, alerts and description",
                    icon: Boxes,
                  },
                  {
                    number: 4,
                    title: "Media and review",
                    text: "Image, visibility and final check",
                    icon: ClipboardCheck,
                  },
                ].map((step) => {
                  const StepIcon = step.icon;
                  const active = editorStep === step.number;
                  const completed = editorStep > step.number;

                  return (
                    <button
                      type="button"
                      key={step.number}
                      className={`product-wizard-step ${
                        active ? "active" : ""
                      } ${completed ? "completed" : ""}`}
                      onClick={() => {
                        if (
                          step.number < editorStep ||
                          validateEditorStep(editorStep)
                        ) {
                          setEditorStep(step.number);
                        }
                      }}
                    >
                      <span className="product-wizard-step-icon">
                        {completed ? (
                          <Check size={17} />
                        ) : (
                          <StepIcon size={18} />
                        )}
                      </span>

                      <span className="product-wizard-step-copy">
                        <strong>
                          Step {step.number}: {step.title}
                        </strong>
                        <small>{step.text}</small>
                      </span>
                    </button>
                  );
                })}
              </aside>

              <form
                className="product-wizard-form"
                onSubmit={saveProduct}
              >
                <div className="product-wizard-progress-mobile">
                  <span>Step {editorStep} of 4</span>
                  <div>
                    <i
                      style={{
                        width: `${(editorStep / 4) * 100}%`,
                      }}
                    />
                  </div>
                </div>

                <div className="product-wizard-content">
                  {editorStep === 1 && (
                    <div className="product-wizard-section">
                      <div className="product-wizard-section-heading">
                        <span className="product-wizard-section-icon blue">
                          <Info size={21} />
                        </span>
                        <div>
                          <h3>Basic product information</h3>
                          <p>
                            Enter the information retailers will use
                            to identify this product.
                          </p>
                        </div>
                      </div>

                      <div className="product-wizard-grid">
                        <label className="full">
                          <span>Product name *</span>
                          <input
                            autoFocus
                            required
                            value={productForm.name}
                            placeholder="Premium Basmati Rice 5 kg"
                            onChange={(event) =>
                              updateProductField(
                                "name",
                                event.target.value
                              )
                            }
                          />
                          <small>
                            Use a clear product name including size
                            or variation.
                          </small>
                        </label>

                        <label>
                          <span>SKU</span>
                          <input
                            value={productForm.sku}
                            placeholder="RICE-5001"
                            onChange={(event) =>
                              updateProductField(
                                "sku",
                                event.target.value
                              )
                            }
                          />
                        </label>

                        <label>
                          <span>Brand</span>
                          <input
                            value={productForm.brand}
                            placeholder="India Gate"
                            onChange={(event) =>
                              updateProductField(
                                "brand",
                                event.target.value
                              )
                            }
                          />
                        </label>

                        <label className="full">
                          <span>Category *</span>
                          <select
                            required
                            value={productForm.category_name}
                            onChange={(event) =>
                              updateProductField(
                                "category_name",
                                event.target.value
                              )
                            }
                          >
                            <option value="">
                              Select product category
                            </option>
                            {PRODUCT_CATEGORIES.map((category) => (
                              <option
                                value={category}
                                key={category}
                              >
                                {category}
                              </option>
                            ))}
                          </select>
                        </label>
                      </div>
                    </div>
                  )}

                  {editorStep === 2 && (
                    <div className="product-wizard-section">
                      <div className="product-wizard-section-heading">
                        <span className="product-wizard-section-icon orange">
                          <CircleDollarSign size={21} />
                        </span>
                        <div>
                          <h3>Packaging and pricing</h3>
                          <p>
                            Configure how the product is packed,
                            sold, and priced.
                          </p>
                        </div>
                      </div>

                      <div className="product-wizard-grid">
                        <label>
                          <span>Selling unit *</span>
                          <select
                            value={productForm.unit}
                            onChange={(event) =>
                              updateProductField(
                                "unit",
                                event.target.value
                              )
                            }
                          >
                            {SELLING_UNITS.map((unit) => (
                              <option value={unit} key={unit}>
                                {unit}
                              </option>
                            ))}
                          </select>
                        </label>

                        <label>
                          <span>Pack size</span>
                          <input
                            value={productForm.pack_size}
                            placeholder="4 × 5 kg"
                            onChange={(event) =>
                              updateProductField(
                                "pack_size",
                                event.target.value
                              )
                            }
                          />
                        </label>

                        <label>
                          <span>Wholesale price (SAR) *</span>
                          <input
                            required
                            type="number"
                            min="0"
                            step="0.01"
                            value={productForm.price}
                            placeholder="0.00"
                            onChange={(event) =>
                              updateProductField(
                                "price",
                                event.target.value
                              )
                            }
                          />
                        </label>

                        <label>
                          <span>Compare price</span>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={productForm.compare_price}
                            placeholder="Optional"
                            onChange={(event) =>
                              updateProductField(
                                "compare_price",
                                event.target.value
                              )
                            }
                          />
                        </label>

                        <label className="full">
                          <span>Minimum order quantity</span>
                          <input
                            type="number"
                            min="1"
                            step="1"
                            value={productForm.minimum_order}
                            onChange={(event) =>
                              updateProductField(
                                "minimum_order",
                                event.target.value
                              )
                            }
                          />
                          <small>
                            The smallest quantity a retailer can order.
                          </small>
                        </label>
                      </div>
                    </div>
                  )}

                  {editorStep === 3 && (
                    <div className="product-wizard-section">
                      <div className="product-wizard-section-heading">
                        <span className="product-wizard-section-icon green">
                          <Boxes size={21} />
                        </span>
                        <div>
                          <h3>Inventory and product details</h3>
                          <p>
                            Track availability and provide useful
                            product information.
                          </p>
                        </div>
                      </div>

                      <div className="product-wizard-grid">
                        <label>
                          <span>Stock quantity</span>
                          <input
                            type="number"
                            min="0"
                            step="1"
                            value={productForm.stock_quantity}
                            placeholder="Leave empty if not tracked"
                            onChange={(event) =>
                              updateProductField(
                                "stock_quantity",
                                event.target.value
                              )
                            }
                          />
                        </label>

                        <label>
                          <span>Low-stock alert level</span>
                          <input
                            type="number"
                            min="0"
                            step="1"
                            value={productForm.low_stock_level}
                            onChange={(event) =>
                              updateProductField(
                                "low_stock_level",
                                event.target.value
                              )
                            }
                          />
                        </label>

                        <label className="full">
                          <span>Product description</span>
                          <textarea
                            rows="7"
                            maxLength="1000"
                            value={productForm.description}
                            placeholder="Describe quality, origin, packaging, ingredients, storage, and other important information."
                            onChange={(event) =>
                              updateProductField(
                                "description",
                                event.target.value
                              )
                            }
                          />
                          <small>
                            {productForm.description.length}/1000 characters
                          </small>
                        </label>
                      </div>
                    </div>
                  )}

                  {editorStep === 4 && (
                    <div className="product-wizard-section">
                      <div className="product-wizard-section-heading">
                        <span className="product-wizard-section-icon purple">
                          <ClipboardCheck size={21} />
                        </span>
                        <div>
                          <h3>Product media and review</h3>
                          <p>
                            Upload the product image and verify
                            everything before saving.
                          </p>
                        </div>
                      </div>

                      <div className="product-wizard-review-layout">
                        <div className="product-wizard-image-card">
                          <div className="product-wizard-image-preview">
                            {productForm.image_url ? (
                              <img
                                src={productForm.image_url}
                                alt="Product preview"
                              />
                            ) : (
                              <>
                                <ImagePlus size={35} />
                                <span>No image uploaded</span>
                              </>
                            )}
                          </div>

                          <input
                            ref={imageInputRef}
                            type="file"
                            hidden
                            accept="image/jpeg,image/png,image/webp"
                            onChange={(event) =>
                              uploadImage(event.target.files?.[0])
                            }
                          />

                          <button
                            type="button"
                            disabled={uploadingImage}
                            onClick={() =>
                              imageInputRef.current?.click()
                            }
                          >
                            {uploadingImage ? (
                              <>
                                <LoaderCircle
                                  size={17}
                                  className="catalog-spin"
                                />
                                Uploading...
                              </>
                            ) : (
                              <>
                                <UploadCloud size={17} />
                                {productForm.image_url
                                  ? "Change image"
                                  : "Upload image"}
                              </>
                            )}
                          </button>

                          <small>
                            JPG, PNG, or WEBP. Maximum 6 MB.
                          </small>
                        </div>

                        <div className="product-wizard-review-card">
                          <span>Product preview</span>
                          <h4>
                            {productForm.name || "Untitled product"}
                          </h4>
                          <p>
                            {[
                              productForm.brand,
                              productForm.category_name,
                              productForm.pack_size,
                            ]
                              .filter(Boolean)
                              .join(" · ") ||
                              "Product information not completed"}
                          </p>

                          <dl>
                            <div>
                              <dt>Selling price</dt>
                              <dd>
                                SAR {formatMoney(productForm.price)}
                              </dd>
                            </div>
                            <div>
                              <dt>Selling unit</dt>
                              <dd>{productForm.unit || "—"}</dd>
                            </div>
                            <div>
                              <dt>Minimum order</dt>
                              <dd>{productForm.minimum_order || 1}</dd>
                            </div>
                            <div>
                              <dt>Available stock</dt>
                              <dd>
                                {productForm.stock_quantity === ""
                                  ? "Not tracked"
                                  : productForm.stock_quantity}
                              </dd>
                            </div>
                            <div>
                              <dt>SKU</dt>
                              <dd>{productForm.sku || "—"}</dd>
                            </div>
                          </dl>

                          <label className="product-wizard-publish">
                            <span>
                              <strong>Publish product</strong>
                              <small>
                                Make this product visible in the public catalog.
                              </small>
                            </span>

                            <input
                              type="checkbox"
                              checked={productForm.is_active}
                              onChange={(event) =>
                                updateProductField(
                                  "is_active",
                                  event.target.checked
                                )
                              }
                            />
                          </label>
                        </div>
                      </div>
                    </div>
                  )}

                  {error && (
                    <div className="catalog-alert error">
                      {error}
                    </div>
                  )}
                </div>

                <footer className="product-wizard-footer">
                  <button
                    type="button"
                    className="product-wizard-cancel"
                    disabled={savingProduct || uploadingImage}
                    onClick={closeEditor}
                  >
                    Cancel
                  </button>

                  <div>
                    {editorStep > 1 && (
                      <button
                        type="button"
                        className="product-wizard-back"
                        disabled={savingProduct || uploadingImage}
                        onClick={previousEditorStep}
                      >
                        <ArrowLeft size={17} />
                        Back
                      </button>
                    )}

                    {editorStep < 4 ? (
                      <button
                        type="button"
                        className="product-wizard-next"
                        onClick={nextEditorStep}
                      >
                        Continue
                        <ArrowRight size={17} />
                      </button>
                    ) : (
                      <button
                        type="submit"
                        className="product-wizard-save"
                        disabled={savingProduct || uploadingImage}
                      >
                        {savingProduct ? (
                          <>
                            <LoaderCircle
                              size={17}
                              className="catalog-spin"
                            />
                            Saving product...
                          </>
                        ) : (
                          <>
                            <Save size={17} />
                            {productForm.id
                              ? "Save changes"
                              : "Add product"}
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </footer>
              </form>
            </div>
          </section>
        </div>
      )}

    </div>
  );
}
