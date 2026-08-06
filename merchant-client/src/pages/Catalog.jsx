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
  Store,
  Trash2,
  UploadCloud,
  X,
} from "lucide-react";

import api from "../services/api";
import { Badge, Empty, Spinner } from "../components/UI";
import "./Catalog.css";

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
  price_mode: "fixed",
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
    id: product.id ?? product.product_id ?? null,
    price_mode: product.price_mode === "quote" ? "quote" : "fixed",
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
  const coverInputRef = useRef(null);

  const [products, setProducts] = useState(null);
  const [catalog, setCatalog] = useState(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [copied, setCopied] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [processingId, setProcessingId] = useState(null);
  const [error, setError] = useState("");

  const [coverEditorOpen, setCoverEditorOpen] = useState(false);
  const [coverForm, setCoverForm] = useState({
    catalog_title: "",
    catalog_description: "",
    cover_image_url: "",
  });
  const [savingCoverSettings, setSavingCoverSettings] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [removingCover, setRemovingCover] = useState(false);

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
    if (!coverEditorOpen) return undefined;

    const closeOnEscape = (event) => {
      if (
        event.key === "Escape" &&
        !savingCoverSettings &&
        !uploadingCover &&
        !removingCover
      ) {
        setCoverEditorOpen(false);
      }
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);

    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [
    coverEditorOpen,
    savingCoverSettings,
    uploadingCover,
    removingCover,
  ]);

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
  if (!catalog?.slug) return "";

  const baseUrl =
    import.meta.env.VITE_PUBLIC_CATALOG_URL ||
    window.location.origin;

  return `${baseUrl.replace(/\/+$/, "")}/catalog/${catalog.slug}`;
}, [catalog?.slug]);
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

  const openCoverEditor = () => {
    setError("");
    setCoverForm({
      catalog_title:
        catalog?.catalog_title ||
        catalog?.title ||
        `${catalog?.business_name || "Wholesale"} Product Catalog`,
      catalog_description: catalog?.catalog_description || "",
      cover_image_url: catalog?.cover_image_url || "",
    });
    setCoverEditorOpen(true);
  };

  const closeCoverEditor = () => {
    if (savingCoverSettings || uploadingCover || removingCover) return;
    setCoverEditorOpen(false);
    setError("");
  };

  const updateCoverField = (key, value) => {
    setError("");
    setCoverForm((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const uploadCoverImage = async (file) => {
    if (!file) return;

    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];

    if (!allowedTypes.includes(file.type)) {
      setError("Use a JPG, PNG, or WEBP cover image.");
      return;
    }

    if (file.size > 6 * 1024 * 1024) {
      setError("Cover image must be smaller than 6 MB.");
      return;
    }

    try {
      setUploadingCover(true);
      setError("");

      const formData = new FormData();
      formData.append("image", file);

      const response = await api.post(
        "/wholesaler/catalog/cover-image",
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        }
      );

      const imageUrl = response.data.cover_image_url;

      setCoverForm((current) => ({
        ...current,
        cover_image_url: imageUrl,
      }));

      setCatalog((current) => ({
        ...current,
        cover_image_url: imageUrl,
      }));
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          "Unable to upload catalog cover image."
      );
    } finally {
      setUploadingCover(false);
      if (coverInputRef.current) {
        coverInputRef.current.value = "";
      }
    }
  };

  const removeCoverImage = async () => {
    if (!coverForm.cover_image_url) return;

    try {
      setRemovingCover(true);
      setError("");

      await api.delete("/wholesaler/catalog/cover-image");

      setCoverForm((current) => ({
        ...current,
        cover_image_url: "",
      }));

      setCatalog((current) => ({
        ...current,
        cover_image_url: null,
      }));
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          "Unable to remove catalog cover image."
      );
    } finally {
      setRemovingCover(false);
    }
  };

  const saveCoverSettings = async (event) => {
    event.preventDefault();

    const title = coverForm.catalog_title.trim();
    const description = coverForm.catalog_description.trim();

    if (!title) {
      setError("Enter the catalog title.");
      return;
    }

    if (title.length > 180) {
      setError("Catalog title must be 180 characters or fewer.");
      return;
    }

    if (description.length > 500) {
      setError("Catalog description must be 500 characters or fewer.");
      return;
    }

    try {
      setSavingCoverSettings(true);
      setError("");

      const response = await api.put(
        "/wholesaler/catalog/settings",
        {
          catalog_title: title,
          catalog_description: description,
        }
      );

      setCatalog((current) => ({
        ...current,
        ...(response.data.catalog || {}),
        catalog_title: title,
        catalog_description: description,
        cover_image_url: coverForm.cover_image_url || null,
      }));

      setCoverEditorOpen(false);
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          "Unable to save storefront settings."
      );
    } finally {
      setSavingCoverSettings(false);
    }
  };

  const openCreate = () => {
    setError("");
    setEditorStep(1);
    setProductForm({ ...EMPTY_PRODUCT });
    setEditorOpen(true);
  };

  const openEdit = (product) => {
    const normalized = normalizeProduct(product);

    if (!normalized.id) {
      setError(
        "Unable to edit this product because its ID is missing. Refresh the catalog and try again."
      );
      return;
    }

    setError("");
    setEditorStep(1);
    setProductForm(normalized);
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
        productForm.price_mode === "fixed" &&
        (productForm.price === "" || Number(productForm.price) < 0)
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

    if (
      productForm.price_mode === "fixed" &&
      (productForm.price === "" || Number(productForm.price) < 0)
    ) {
      setError("Enter a valid product price.");
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
        price_mode: productForm.price_mode,
        price:
          productForm.price_mode === "quote"
            ? null
            : Number(productForm.price || 0),
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

        const updatedProduct = normalizeProduct(
          response.data?.product || response.data
        );

        setProducts((current) =>
          current.map((item) =>
            Number(item.id) === Number(productForm.id)
              ? updatedProduct
              : item
          )
        );
      } else {
        const response = await api.post(
          "/wholesaler/catalog/products",
          payload
        );

        const createdProduct = normalizeProduct(
          response.data?.product || response.data
        );

        setProducts((current) => [createdProduct, ...current]);
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

        <div className="catalog-heading-actions">

          <button
            type="button"
            className="catalog-primary-button"
            onClick={openCreate}
          >
            <Plus size={18} />
            Add product
          </button>
        </div>
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

      <section className="catalog-storefront-manager">
        <div className="catalog-storefront-preview">
          <div
            className={`catalog-storefront-thumbnail ${
              catalog?.cover_image_url ? "has-image" : ""
            }`}
            style={
              catalog?.cover_image_url
                ? {
                    backgroundImage: `linear-gradient(135deg, rgba(8, 20, 38, 0.76), rgba(8, 20, 38, 0.2)), url(${catalog.cover_image_url})`,
                  }
                : undefined
            }
          >
            {!catalog?.cover_image_url && <Store size={26} />}
          </div>

          <div className="catalog-storefront-copy">
            <span>Storefront appearance</span>

            <h2>
              {catalog?.catalog_title ||
                catalog?.title ||
                `${catalog?.business_name || "Wholesale"} Product Catalog`}
            </h2>

            <p>
              {catalog?.catalog_description ||
                "Customize the public store title, introduction, and cover image shown to your retail customers."}
            </p>

            <div className="catalog-storefront-status">
              <span>
                <Eye size={14} />
                Public store published
              </span>

              <span>
                <Package size={14} />
                {stats.published} visible products
              </span>
            </div>
          </div>
        </div>

        <div className="catalog-storefront-actions">
          <button
            type="button"
            className="catalog-storefront-customize"
            onClick={openCoverEditor}
          >
            <Edit3 size={17} />
            Customize storefront
          </button>

          {publicUrl && (
            <a
              href={publicUrl}
              target="_blank"
              rel="noreferrer"
              className="catalog-storefront-preview-button"
            >
              <ExternalLink size={17} />
              Preview store
            </a>
          )}
        </div>
      </section>

      <section className="catalog-share-panel">
        <div className="catalog-share-icon">
          <Share2 size={23} />
        </div>

        <div className="catalog-share-copy">
          <span>Public catalog</span>

          <h2>
            {catalog?.catalog_title ||
              catalog?.title ||
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

                    <div
                      className={`merchant-product-price ${
                        product.price_mode === "quote"
                          ? "quote-price"
                          : ""
                      }`}
                    >
                      <strong>
                        {product.price_mode === "quote"
                          ? "Price on request"
                          : `SAR ${formatMoney(product.price)}`}
                      </strong>
                      <small>
                        {product.price_mode === "quote"
                          ? "Contact merchant for quotation"
                          : `per ${product.unit || "piece"}`}
                      </small>
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

      {coverEditorOpen && (
        <div className="catalog-cover-overlay">
          <section
            className="catalog-cover-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="catalog-cover-title"
          >
            <header className="catalog-cover-dialog-header">
              <div>
                <span>Public storefront</span>
                <h2 id="catalog-cover-title">Customize public storefront</h2>
                <p>
                  Design the public store your retail customers will see.
                </p>
              </div>

              <button
                type="button"
                aria-label="Close catalog cover settings"
                disabled={
                  savingCoverSettings || uploadingCover || removingCover
                }
                onClick={closeCoverEditor}
              >
                <X size={20} />
              </button>
            </header>

            <form
              className="catalog-cover-dialog-body"
              onSubmit={saveCoverSettings}
            >
              <div className="catalog-cover-upload-column">
                <div
                  className={`catalog-cover-image-preview ${
                    coverForm.cover_image_url ? "has-image" : ""
                  }`}
                  style={
                    coverForm.cover_image_url
                      ? {
                          backgroundImage: `linear-gradient(90deg, rgba(8, 20, 38, 0.72), rgba(8, 20, 38, 0.18)), url(${coverForm.cover_image_url})`,
                        }
                      : undefined
                  }
                >
                  {!coverForm.cover_image_url && (
                    <div>
                      <ImagePlus size={38} />
                      <strong>No cover image</strong>
                      <span>Recommended size: 1600 × 600 px</span>
                    </div>
                  )}

                  {coverForm.cover_image_url && (
                    <div className="catalog-cover-preview-copy">
                      <small>Wholesale catalog</small>
                      <strong>
                        {coverForm.catalog_title || "Catalog title"}
                      </strong>
                    </div>
                  )}
                </div>

                <input
                  ref={coverInputRef}
                  type="file"
                  hidden
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(event) =>
                    uploadCoverImage(event.target.files?.[0])
                  }
                />

                <div className="catalog-cover-image-actions">
                  <button
                    type="button"
                    disabled={uploadingCover || removingCover}
                    onClick={() => coverInputRef.current?.click()}
                  >
                    {uploadingCover ? (
                      <>
                        <LoaderCircle size={17} className="catalog-spin" />
                        Uploading...
                      </>
                    ) : (
                      <>
                        <UploadCloud size={17} />
                        {coverForm.cover_image_url
                          ? "Change image"
                          : "Upload cover"}
                      </>
                    )}
                  </button>

                  {coverForm.cover_image_url && (
                    <button
                      type="button"
                      className="danger"
                      disabled={uploadingCover || removingCover}
                      onClick={removeCoverImage}
                    >
                      {removingCover ? (
                        <LoaderCircle size={17} className="catalog-spin" />
                      ) : (
                        <Trash2 size={17} />
                      )}
                      Remove
                    </button>
                  )}
                </div>

                <small className="catalog-cover-upload-help">
                  JPG, PNG, or WEBP. Maximum 6 MB. Use a wide landscape image.
                </small>
              </div>

              <div className="catalog-cover-fields">
                <label>
                  <span>Catalog title *</span>
                  <input
                    autoFocus
                    required
                    maxLength={180}
                    value={coverForm.catalog_title}
                    placeholder="Nasa Marketing Wholesale Catalog"
                    onChange={(event) =>
                      updateCoverField(
                        "catalog_title",
                        event.target.value
                      )
                    }
                  />
                  <small>
                    {coverForm.catalog_title.length}/180 characters
                  </small>
                </label>

                <label>
                  <span>Catalog description</span>
                  <textarea
                    rows={7}
                    maxLength={500}
                    value={coverForm.catalog_description}
                    placeholder="Introduce your business, product range, delivery area, or wholesale benefits."
                    onChange={(event) =>
                      updateCoverField(
                        "catalog_description",
                        event.target.value
                      )
                    }
                  />
                  <small>
                    {coverForm.catalog_description.length}/500 characters
                  </small>
                </label>

                {error && (
                  <div className="catalog-alert error">{error}</div>
                )}
              </div>

              <footer className="catalog-cover-dialog-footer">
                <button
                  type="button"
                  disabled={
                    savingCoverSettings || uploadingCover || removingCover
                  }
                  onClick={closeCoverEditor}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="primary"
                  disabled={
                    savingCoverSettings || uploadingCover || removingCover
                  }
                >
                  {savingCoverSettings ? (
                    <>
                      <LoaderCircle size={17} className="catalog-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save size={17} />
                      Save storefront
                    </>
                  )}
                </button>
              </footer>
            </form>
          </section>
        </div>
      )}

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
                          <span>Price display</span>

                          <select
                            value={productForm.price_mode}
                            onChange={(event) =>
                              updateProductField(
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

                          <small>
                            Select Price on request when the
                            public selling price is private.
                          </small>
                        </label>

                        {productForm.price_mode === "fixed" && (
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
                        )}

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
                                {productForm.price_mode === "quote"
                                  ? "Price on request"
                                  : `SAR ${formatMoney(
                                      productForm.price
                                    )}`}
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