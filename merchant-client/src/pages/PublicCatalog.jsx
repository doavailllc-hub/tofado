import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import {
  ArrowLeft,
  BadgeCheck,
  Building2,
  CheckCircle2,
  Globe2,
  Mail,
  MapPin,
  MessageSquare,
  Minus,
  Package,
  Phone,
  Plus,
  Search,
  Send,
  ShoppingCart,
  Store,
  Trash2,
  UserPlus,
  X,
} from "lucide-react";

import api from "../services/api";
import { Spinner } from "../components/UI";
import tofadoLogo from "../assets/tofado-logo.png";
import "./PublicCatalog.css";

const initialCustomer = {
  customer_name: "",
  business_name: "",
  phone: "",
  email: "",
  delivery_address: "",
  required_date: "",
  notes: "",
};

const initialEnquiry = {
  customer_name: "",
  business_name: "",
  phone: "",
  email: "",
  quantity: 1,
  message: "",
};

function isPriceOnRequest(product) {
  return product?.price_mode === "quote";
}

function formatCurrency(value) {
  return `INR ${Number(value || 0).toFixed(2)}`;
}

export default function PublicCatalog() {
  const { slug } = useParams();

  const [catalog, setCatalog] = useState(null);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");

  const [cart, setCart] = useState([]);
  const [modal, setModal] = useState(null);
  const [selectedProduct, setSelectedProduct] = useState(null);

  const [customer, setCustomer] = useState(initialCustomer);
  const [enquiry, setEnquiry] = useState(initialEnquiry);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    let active = true;

    const loadCatalog = async () => {
      try {
        setLoading(true);
        setError("");

        const response = await api.get(`/public/catalog/${slug}`);
        const payload = response.data || {};

        if (!active) return;

        setCatalog(payload.catalog || payload);
        setProducts(
          Array.isArray(payload.products)
            ? payload.products
            : []
        );
      } catch (requestError) {
        console.error(
          "LOAD PUBLIC CATALOG ERROR:",
          requestError
        );

        if (!active) return;

        setCatalog(null);
        setProducts([]);

        setError(
          requestError.response?.data?.message ||
            "This catalog is currently unavailable."
        );
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    loadCatalog();

    return () => {
      active = false;
    };
  }, [slug]);

  const categories = useMemo(() => {
    const categoryNames = products
      .map((product) => product.category_name)
      .filter(Boolean);

    return ["all", ...new Set(categoryNames)];
  }, [products]);

  const filteredProducts = useMemo(() => {
    const value = search.trim().toLowerCase();

    return products.filter((product) => {
      const matchesSearch =
        !value ||
        [
          product.name,
          product.brand,
          product.description,
          product.category_name,
          product.sku,
        ].some((field) =>
          String(field || "")
            .toLowerCase()
            .includes(value)
        );

      const matchesCategory =
        category === "all" ||
        product.category_name === category;

      return matchesSearch && matchesCategory;
    });
  }, [products, search, category]);

  const cartCount = useMemo(
    () =>
      cart.reduce(
        (total, item) =>
          total + Number(item.quantity || 0),
        0
      ),
    [cart]
  );

  const cartTotal = useMemo(
    () =>
      cart.reduce(
        (total, item) =>
          total +
          Number(item.price || 0) *
            Number(item.quantity || 0),
        0
      ),
    [cart]
  );

  const businessName =
    catalog?.business_name ||
    catalog?.catalog_title ||
    catalog?.title ||
    "Verified wholesaler";

  const businessCategory =
    catalog?.business_category ||
    catalog?.shop_type ||
    "Wholesale supplier";

  const addToCart = (product) => {
    if (isPriceOnRequest(product)) {
      openEnquiryModal(product);
      return;
    }

    const minimum = Number(product.minimum_order || 1);

    setSuccess("");
    setError("");

    setCart((current) => {
      const existing = current.find(
        (item) => item.id === product.id
      );

      if (existing) {
        return current.map((item) =>
          item.id === product.id
            ? {
                ...item,
                quantity:
                  Number(item.quantity) + minimum,
              }
            : item
        );
      }

      return [
        ...current,
        {
          ...product,
          quantity: minimum,
        },
      ];
    });
  };

  const increaseQuantity = (productId) => {
    setCart((current) =>
      current.map((item) =>
        item.id === productId
          ? {
              ...item,
              quantity: Number(item.quantity) + 1,
            }
          : item
      )
    );
  };

  const decreaseQuantity = (productId) => {
    setCart((current) =>
      current.map((item) => {
        if (item.id !== productId) {
          return item;
        }

        const minimum = Number(item.minimum_order || 1);

        return {
          ...item,
          quantity: Math.max(
            minimum,
            Number(item.quantity) - 1
          ),
        };
      })
    );
  };

  const removeFromCart = (productId) => {
    setCart((current) =>
      current.filter((item) => item.id !== productId)
    );
  };

  const openOrderModal = () => {
    setError("");
    setSuccess("");
    setModal("order");
  };

  const openEnquiryModal = (product) => {
    const quoteProduct = isPriceOnRequest(product);

    setSelectedProduct(product);
    setEnquiry({
      ...initialEnquiry,
      quantity: Number(product.minimum_order || 1),
      message: quoteProduct
        ? `Please send me your best price for ${product.name || "this product"}.`
        : "",
    });
    setError("");
    setSuccess("");
    setModal("enquiry");
  };

  const openBusinessRequestModal = () => {
    setSelectedProduct(null);
    setEnquiry({
      ...initialEnquiry,
      quantity: 1,
      message: `I would like to request a business connection with ${businessName}. Please contact me to discuss pricing, supply terms and ordering.`,
    });
    setError("");
    setSuccess("");
    setModal("business-request");
  };

  const closeModal = () => {
    setModal(null);
    setSelectedProduct(null);
    setError("");
  };

  const submitOrder = async (event) => {
    event.preventDefault();

    if (!cart.length) {
      setError(
        "Add at least one product before sending the order."
      );
      return;
    }

    try {
      setSubmitting(true);
      setError("");

      await api.post(`/public/catalog/${slug}/orders`, {
        ...customer,
        items: cart.map((item) => ({
          product_id: item.id,
          quantity: Number(item.quantity),
        })),
      });

      setCart([]);
      setCustomer(initialCustomer);
      setModal(null);
      setSuccess(
        "Your order has been sent successfully. The merchant will contact you shortly."
      );
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          "Unable to send the order."
      );
    } finally {
      setSubmitting(false);
    }
  };

  const submitEnquiry = async (event) => {
    event.preventDefault();

    try {
      setSubmitting(true);
      setError("");

      await api.post(
        `/public/catalog/${slug}/enquiries`,
        {
          ...enquiry,
          product_id: selectedProduct?.id || null,
          quantity: Number(enquiry.quantity || 1),
        }
      );

      const wasBusinessRequest =
        modal === "business-request";

      setEnquiry(initialEnquiry);
      setSelectedProduct(null);
      setModal(null);
      setSuccess(
        wasBusinessRequest
          ? "Your business request has been sent. The wholesaler can contact you to continue the conversation."
          : "Your enquiry has been sent successfully. The merchant will contact you shortly."
      );
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          (modal === "business-request"
            ? "Unable to send the business request."
            : "Unable to send the enquiry.")
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <Spinner />;
  }

  if (!catalog) {
    return (
      <div className="public-catalog-unavailable">
        <div>
          <Package size={40} />
        </div>
        <h1>Storefront unavailable</h1>
        <p>{error || "This storefront could not be found."}</p>
        <a href="https://tofado.com">
          <ArrowLeft size={15} />
          Back to Tofado Marketplace
        </a>
      </div>
    );
  }

  return (
    <div className="public-catalog-page">
      <header className="public-store-topbar">
        <div className="public-store-topbar-inner">
          <a
            href="https://tofado.com"
            className="public-store-brand"
            aria-label="Tofado Marketplace"
          >
            <img src={tofadoLogo} alt="Tofado" />
          </a>

          <div className="public-store-topbar-search">
            <Search size={16} />
            <input
              type="search"
              placeholder="Search this storefront"
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
            />
          </div>

          <div className="public-store-topbar-actions">
            <a
              href="https://tofado.com"
              className="public-store-marketplace-link"
            >
              <Store size={15} />
              Marketplace
            </a>

            <button
              type="button"
              className="public-store-cart-button"
              onClick={openOrderModal}
            >
              <ShoppingCart size={16} />
              Cart
              <strong>{cartCount}</strong>
            </button>
          </div>
        </div>
      </header>

      <main className="public-store-main">
        <section className="public-profile-card">
          <div className="public-profile-cover">
            {catalog.cover_image_url ? (
              <img
                src={catalog.cover_image_url}
                alt={`${businessName} cover`}
              />
            ) : (
              <div className="public-profile-cover-fallback">
                <Building2 size={34} />
                <span>Wholesale storefront</span>
              </div>
            )}
          </div>

          <div className="public-profile-body">
            <div className="public-profile-avatar">
              {catalog.logo_url ? (
                <img
                  src={catalog.logo_url}
                  alt={businessName}
                />
              ) : (
                <Store size={34} />
              )}
            </div>

            <div className="public-profile-copy">
              <div className="public-profile-title-row">
                <h1>{businessName}</h1>

                <span className="public-profile-verified">
                  <BadgeCheck size={15} />
                  Verified wholesaler
                </span>
              </div>

              <p className="public-profile-category">
                {businessCategory}
              </p>

              <div className="public-profile-meta">
                {catalog.location && (
                  <span>
                    <MapPin size={14} />
                    {catalog.location}
                  </span>
                )}

                <span>
                  <Package size={14} />
                  {products.length} products
                </span>

                {catalog.website && (
                  <a
                    href={catalog.website}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <Globe2 size={14} />
                    Website
                  </a>
                )}
              </div>
            </div>

            <div className="public-profile-actions">
              <button
                type="button"
                className="public-request-business"
                onClick={openBusinessRequestModal}
              >
                <UserPlus size={16} />
                Request business
              </button>

              {catalog.phone && (
                <a
                  href={`tel:${catalog.phone}`}
                  className="public-profile-contact"
                >
                  <Phone size={16} />
                  Contact
                </a>
              )}
            </div>
          </div>

          <div className="public-profile-nav">
            <button
              type="button"
              className="active"
              onClick={() =>
                document
                  .getElementById("public-products")
                  ?.scrollIntoView({
                    behavior: "smooth",
                  })
              }
            >
              Products
            </button>

            <button
              type="button"
              onClick={() =>
                document
                  .getElementById("public-about")
                  ?.scrollIntoView({
                    behavior: "smooth",
                  })
              }
            >
              About
            </button>
          </div>
        </section>

        {success && (
          <div className="public-catalog-alert success">
            <CheckCircle2 size={17} />
            <span>{success}</span>
          </div>
        )}

        {error && !modal && (
          <div className="public-catalog-alert error">
            {error}
          </div>
        )}

        <section
          className="public-store-content-grid"
          id="public-products"
        >
          <div className="public-products-column">
            <div className="public-store-section-heading">
              <div>
                <span>STORE CATALOG</span>
                <h2>Wholesale products</h2>
                <p>
                  Browse products from {businessName}.
                </p>
              </div>

              <small>
                {filteredProducts.length} of {products.length}
              </small>
            </div>

            {categories.length > 1 && (
              <div className="public-category-tabs">
                {categories.map((item) => (
                  <button
                    type="button"
                    key={item}
                    className={
                      category === item ? "active" : ""
                    }
                    onClick={() => setCategory(item)}
                  >
                    {item === "all"
                      ? "All products"
                      : item}
                  </button>
                ))}
              </div>
            )}

            {filteredProducts.length ? (
              <div className="public-product-grid">
                {filteredProducts.map((product) => (
                  <article
                    className="public-product-card"
                    key={product.id}
                  >
                    <div className="public-product-image">
                      {product.image_url ? (
                        <img
                          src={product.image_url}
                          alt={product.name}
                        />
                      ) : (
                        <Package size={34} />
                      )}

                      {product.stock_quantity !== null &&
                        product.stock_quantity !==
                          undefined && (
                          <span
                            className={
                              Number(
                                product.stock_quantity
                              ) > 0
                                ? "in-stock"
                                : "out-of-stock"
                            }
                          >
                            {Number(
                              product.stock_quantity
                            ) > 0
                              ? "In stock"
                              : "Out of stock"}
                          </span>
                        )}
                    </div>

                    <div className="public-product-content">
                      <span>
                        {product.category_name ||
                          "Wholesale"}
                      </span>

                      <h3>{product.name}</h3>

                      <p>
                        {[product.brand, product.pack_size]
                          .filter(Boolean)
                          .join(" · ") ||
                          product.description ||
                          "Wholesale product"}
                      </p>

                      <div
                        className={`public-product-price ${
                          isPriceOnRequest(product)
                            ? "price-on-request"
                            : ""
                        }`}
                      >
                        {isPriceOnRequest(product) ? (
                          <>
                            <strong>
                              Price on request
                            </strong>
                            <small>
                              Ask the wholesaler for pricing
                            </small>
                          </>
                        ) : (
                          <>
                            <strong>
                              {formatCurrency(
                                product.price
                              )}
                            </strong>
                            <small>
                              per {product.unit || "piece"}
                            </small>
                          </>
                        )}
                      </div>

                      <div className="public-product-minimum">
                        <span>Minimum order</span>
                        <strong>
                          {product.minimum_order || 1}{" "}
                          {product.unit || "piece"}
                        </strong>
                      </div>

                      <div className="public-product-actions">
                        {isPriceOnRequest(product) ? (
                          <button
                            type="button"
                            className="request-price-button"
                            onClick={() =>
                              openEnquiryModal(product)
                            }
                          >
                            <MessageSquare size={15} />
                            Request price
                          </button>
                        ) : (
                          <>
                            <button
                              type="button"
                              className="order-button"
                              disabled={
                                Number(
                                  product.stock_quantity
                                ) === 0
                              }
                              onClick={() =>
                                addToCart(product)
                              }
                            >
                              <ShoppingCart size={15} />
                              Add to cart
                            </button>

                            <button
                              type="button"
                              className="enquiry-button"
                              onClick={() =>
                                openEnquiryModal(product)
                              }
                            >
                              <MessageSquare size={15} />
                              Enquiry
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="public-products-empty">
                <Package size={30} />
                <h3>
                  {products.length
                    ? "No matching products"
                    : "Products coming soon"}
                </h3>
                <p>
                  {products.length
                    ? "Try another search or category."
                    : `${businessName} has not published products yet. You can still send a business request.`}
                </p>

                {!products.length && (
                  <button
                    type="button"
                    onClick={openBusinessRequestModal}
                  >
                    <UserPlus size={15} />
                    Request business
                  </button>
                )}
              </div>
            )}
          </div>

          <aside
            className="public-store-about-card"
            id="public-about"
          >
            <span>ABOUT BUSINESS</span>
            <h2>{businessName}</h2>

            <p>
              {catalog.catalog_description ||
                catalog.description ||
                "Verified wholesale business on Tofado Marketplace. Contact this supplier for product availability, pricing and trade terms."}
            </p>

            <div className="public-store-about-list">
              <div>
                <BadgeCheck size={16} />
                <span>
                  <strong>Verified supplier</strong>
                  <small>
                    Approved business on Tofado
                  </small>
                </span>
              </div>

              {catalog.location && (
                <div>
                  <MapPin size={16} />
                  <span>
                    <strong>Location</strong>
                    <small>{catalog.location}</small>
                  </span>
                </div>
              )}

              {catalog.phone && (
                <div>
                  <Phone size={16} />
                  <span>
                    <strong>Phone</strong>
                    <small>{catalog.phone}</small>
                  </span>
                </div>
              )}
            </div>

            <button
              type="button"
              className="public-store-about-request"
              onClick={openBusinessRequestModal}
            >
              <UserPlus size={16} />
              Request to do business
            </button>
          </aside>
        </section>
      </main>

      {cart.length > 0 && (
        <button
          type="button"
          className="public-floating-cart"
          onClick={openOrderModal}
        >
          <ShoppingCart size={18} />
          <span>
            <strong>{cartCount} items</strong>
            <small>{formatCurrency(cartTotal)}</small>
          </span>
          <b>View cart</b>
        </button>
      )}

      {modal === "order" && (
        <div
          className="public-modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeModal();
            }
          }}
        >
          <div className="public-modal public-order-modal">
            <div className="public-modal-header">
              <div>
                <span>DIRECT ORDER</span>
                <h2>Complete your order</h2>
              </div>

              <button
                type="button"
                onClick={closeModal}
                aria-label="Close"
              >
                <X size={19} />
              </button>
            </div>

            <div className="public-cart-items">
              {cart.length ? (
                cart.map((item) => (
                  <article
                    className="public-cart-item"
                    key={item.id}
                  >
                    <div className="public-cart-item-image">
                      {item.image_url ? (
                        <img
                          src={item.image_url}
                          alt={item.name}
                        />
                      ) : (
                        <Package size={20} />
                      )}
                    </div>

                    <div className="public-cart-item-copy">
                      <strong>{item.name}</strong>
                      <span>
                        {formatCurrency(item.price)} per{" "}
                        {item.unit}
                      </span>
                    </div>

                    <div className="public-cart-quantity">
                      <button
                        type="button"
                        onClick={() =>
                          decreaseQuantity(item.id)
                        }
                      >
                        <Minus size={14} />
                      </button>

                      <strong>{item.quantity}</strong>

                      <button
                        type="button"
                        onClick={() =>
                          increaseQuantity(item.id)
                        }
                      >
                        <Plus size={14} />
                      </button>
                    </div>

                    <strong className="public-cart-line-total">
                      {formatCurrency(
                        Number(item.price || 0) *
                          Number(item.quantity || 0)
                      )}
                    </strong>

                    <button
                      type="button"
                      className="public-cart-remove"
                      onClick={() =>
                        removeFromCart(item.id)
                      }
                    >
                      <Trash2 size={15} />
                    </button>
                  </article>
                ))
              ) : (
                <div className="public-cart-empty">
                  <ShoppingCart size={28} />
                  <p>Your cart is empty.</p>
                </div>
              )}
            </div>

            <div className="public-cart-total">
              <span>Estimated total</span>
              <strong>
                {formatCurrency(cartTotal)}
              </strong>
            </div>

            <form
              className="public-catalog-form"
              onSubmit={submitOrder}
            >
              <label>
                <span>Your name</span>
                <input
                  required
                  value={customer.customer_name}
                  placeholder="Enter your full name"
                  onChange={(event) =>
                    setCustomer({
                      ...customer,
                      customer_name:
                        event.target.value,
                    })
                  }
                />
              </label>

              <label>
                <span>Shop or business name</span>
                <input
                  value={customer.business_name}
                  placeholder="Optional"
                  onChange={(event) =>
                    setCustomer({
                      ...customer,
                      business_name:
                        event.target.value,
                    })
                  }
                />
              </label>

              <label>
                <span>Phone number</span>
                <input
                  required
                  type="tel"
                  value={customer.phone}
                  placeholder="+966 5X XXX XXXX"
                  onChange={(event) =>
                    setCustomer({
                      ...customer,
                      phone: event.target.value,
                    })
                  }
                />
              </label>

              <label>
                <span>Email address</span>
                <input
                  type="email"
                  value={customer.email}
                  placeholder="Optional"
                  onChange={(event) =>
                    setCustomer({
                      ...customer,
                      email: event.target.value,
                    })
                  }
                />
              </label>

              <label className="full">
                <span>Delivery address</span>
                <textarea
                  required
                  rows="3"
                  value={customer.delivery_address}
                  placeholder="Building, street, district and city"
                  onChange={(event) =>
                    setCustomer({
                      ...customer,
                      delivery_address:
                        event.target.value,
                    })
                  }
                />
              </label>

              <label>
                <span>Required date</span>
                <input
                  type="date"
                  value={customer.required_date}
                  onChange={(event) =>
                    setCustomer({
                      ...customer,
                      required_date:
                        event.target.value,
                    })
                  }
                />
              </label>

              <label className="full">
                <span>Order notes</span>
                <textarea
                  rows="3"
                  value={customer.notes}
                  placeholder="Add delivery instructions or preferred brands"
                  onChange={(event) =>
                    setCustomer({
                      ...customer,
                      notes: event.target.value,
                    })
                  }
                />
              </label>

              {error && (
                <div className="public-form-error full">
                  {error}
                </div>
              )}

              <button
                type="submit"
                className="public-form-submit full"
                disabled={submitting || !cart.length}
              >
                <Send size={16} />
                {submitting
                  ? "Sending order..."
                  : "Send order"}
              </button>
            </form>
          </div>
        </div>
      )}

      {(modal === "enquiry" ||
        modal === "business-request") && (
        <div
          className="public-modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeModal();
            }
          }}
        >
          <div className="public-modal">
            <div className="public-modal-header">
              <div>
                <span>
                  {modal === "business-request"
                    ? "BUSINESS REQUEST"
                    : "PRODUCT ENQUIRY"}
                </span>

                <h2>
                  {modal === "business-request"
                    ? `Request to do business with ${businessName}`
                    : isPriceOnRequest(selectedProduct)
                      ? `Request price — ${
                          selectedProduct?.name ||
                          "Product"
                        }`
                      : selectedProduct?.name ||
                        "Send enquiry"}
                </h2>

                {modal === "business-request" && (
                  <p>
                    Introduce your business and the wholesaler
                    can contact you to discuss supply terms.
                  </p>
                )}
              </div>

              <button
                type="button"
                onClick={closeModal}
                aria-label="Close"
              >
                <X size={19} />
              </button>
            </div>

            <form
              className="public-catalog-form"
              onSubmit={submitEnquiry}
            >
              <label>
                <span>Your name</span>
                <input
                  required
                  value={enquiry.customer_name}
                  placeholder="Enter your full name"
                  onChange={(event) =>
                    setEnquiry({
                      ...enquiry,
                      customer_name:
                        event.target.value,
                    })
                  }
                />
              </label>

              <label>
                <span>Business name</span>
                <input
                  required={
                    modal === "business-request"
                  }
                  value={enquiry.business_name}
                  placeholder={
                    modal === "business-request"
                      ? "Your business name"
                      : "Optional"
                  }
                  onChange={(event) =>
                    setEnquiry({
                      ...enquiry,
                      business_name:
                        event.target.value,
                    })
                  }
                />
              </label>

              <label>
                <span>Phone number</span>
                <input
                  required
                  type="tel"
                  value={enquiry.phone}
                  placeholder="+966 5X XXX XXXX"
                  onChange={(event) =>
                    setEnquiry({
                      ...enquiry,
                      phone: event.target.value,
                    })
                  }
                />
              </label>

              <label>
                <span>Email address</span>
                <input
                  type="email"
                  value={enquiry.email}
                  placeholder="Optional"
                  onChange={(event) =>
                    setEnquiry({
                      ...enquiry,
                      email: event.target.value,
                    })
                  }
                />
              </label>

              {modal !== "business-request" && (
                <label>
                  <span>Required quantity</span>
                  <input
                    min="1"
                    type="number"
                    value={enquiry.quantity}
                    onChange={(event) =>
                      setEnquiry({
                        ...enquiry,
                        quantity:
                          event.target.value,
                      })
                    }
                  />
                </label>
              )}

              <label className="full">
                <span>
                  {modal === "business-request"
                    ? "Business request message"
                    : isPriceOnRequest(
                          selectedProduct
                        )
                      ? "Price request message"
                      : "Enquiry message"}
                </span>

                <textarea
                  required
                  rows="5"
                  value={enquiry.message}
                  placeholder={
                    modal === "business-request"
                      ? "Tell the wholesaler what products, volumes or trade terms you are interested in."
                      : isPriceOnRequest(
                            selectedProduct
                          )
                        ? "Ask for your required quantity, best price, delivery terms, or availability"
                        : "Ask about pricing, availability, delivery or product details"
                  }
                  onChange={(event) =>
                    setEnquiry({
                      ...enquiry,
                      message: event.target.value,
                    })
                  }
                />
              </label>

              {error && (
                <div className="public-form-error full">
                  {error}
                </div>
              )}

              <button
                type="submit"
                className="public-form-submit full"
                disabled={submitting}
              >
                <Send size={16} />

                {submitting
                  ? modal === "business-request"
                    ? "Sending request..."
                    : "Sending enquiry..."
                  : modal === "business-request"
                    ? "Send business request"
                    : isPriceOnRequest(
                          selectedProduct
                        )
                      ? "Request price"
                      : "Send enquiry"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}