import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import {
  CheckCircle2,
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
  X,
} from "lucide-react";

import api from "../services/api";
import { Spinner } from "../components/UI";
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

    const response = await api.get(
      `/public/catalog/${slug}`
    );

    const payload = response.data || {};

    setCatalog(
      payload.catalog ||
      payload
    );

    setProducts(
      Array.isArray(payload.products)
        ? payload.products
        : []
    );
  } catch (requestError) {S
    console.error(
      "LOAD PUBLIC CATALOG ERROR:",
      requestError
    );

    setCatalog(null);
    setProducts([]);

    setError(
      requestError.response?.data?.message ||
      "This catalog is currently unavailable."
    );
  } finally {
    setLoading(false);
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
        (total, item) => total + Number(item.quantity || 0),
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

  const closeModal = () => {
    setModal(null);
    setSelectedProduct(null);
    setError("");
  };

  const submitOrder = async (event) => {
    event.preventDefault();

    if (!cart.length) {
      setError("Add at least one product before sending the order.");
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

      setEnquiry(initialEnquiry);
      setSelectedProduct(null);
      setModal(null);
      setSuccess(
        "Your enquiry has been sent successfully. The merchant will contact you shortly."
      );
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          "Unable to send the enquiry."
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

        <h1>Catalog unavailable</h1>
        <p>{error || "This catalog could not be found."}</p>
      </div>
    );
  }

  return (
    <div className="public-catalog-page">
      <header className="public-catalog-header">
        <div className="public-catalog-brand">
          <div className="public-catalog-logo">
            {catalog.logo_url ? (
              <img
                src={catalog.logo_url}
                alt={catalog.catalog_title || catalog.title || catalog.business_name}
              />
            ) : (
              <Store size={25} />
            )}
          </div>

          <div>
            <span>Wholesale catalog</span>

            <h1>
              {catalog.catalog_title ||
                catalog.title ||
                catalog.business_name ||
                "Product Catalog"}
            </h1>
          </div>
        </div>

        <div className="public-catalog-contact">
          {catalog.phone && (
            <a href={`tel:${catalog.phone}`}>
              <Phone size={17} />
              {catalog.phone}
            </a>
          )}

          {catalog.location && (
            <span>
              <MapPin size={17} />
              {catalog.location}
            </span>
          )}

          <button
            type="button"
            className="public-cart-button"
            onClick={openOrderModal}
          >
            <ShoppingCart size={18} />
            Cart

            <strong>{cartCount}</strong>
          </button>
        </div>
      </header>

      <main>
        <section className="public-catalog-hero">
          <div className="public-catalog-hero-copy">
            <span>Wholesale products</span>

            <h2>
              {catalog.catalog_title ||
                catalog.title ||
                `Shop wholesale products from ${
                  catalog.business_name || "this verified merchant"
                }.`}
            </h2>

            <p>
              {catalog.catalog_description ||
                "Browse available products, place a direct order, or send an enquiry for pricing and availability."}
            </p>

            <div className="public-catalog-hero-actions">
              <button
                type="button"
                onClick={() => {
                  document
                    .getElementById("public-products")
                    ?.scrollIntoView({
                      behavior: "smooth",
                    });
                }}
              >
                <Package size={18} />
                Browse products
              </button>

              {catalog.phone && (
                <a href={`tel:${catalog.phone}`}>
                  <Phone size={18} />
                  Contact merchant
                </a>
              )}
            </div>
          </div>

          <div className="public-catalog-hero-visual">
            {catalog.cover_image_url ? (
              <img
                src={catalog.cover_image_url}
                alt={catalog.catalog_title || catalog.title || "Catalog storefront"}
              />
            ) : (
              <div className="public-catalog-cover-placeholder">
                <Store size={54} />
                <span>
                  {catalog.business_name ||
                    catalog.title ||
                    "Verified merchant"}
                </span>
              </div>
            )}
          </div>
        </section>

        <section className="public-catalog-toolbar">
          <div className="public-catalog-search">
            <Search size={19} />

            <input
              type="search"
              placeholder="Search products, brands or categories..."
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
            />
          </div>

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
        </section>

        {success && (
          <div className="public-catalog-alert success">
            <CheckCircle2 size={19} />
            <span>{success}</span>
          </div>
        )}

        {error && !modal && (
          <div className="public-catalog-alert error">
            {error}
          </div>
        )}

        <section
          className="public-products-section"
          id="public-products"
        >
          <div className="public-products-heading">
            <div>
              <span>Available products</span>
              <h2>Product catalog</h2>
            </div>

            <p>
              Showing {filteredProducts.length} of{" "}
              {products.length} products
            </p>
          </div>

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
                      <Package size={40} />
                    )}

                    {product.stock_quantity !== null &&
                      product.stock_quantity !== undefined && (
                        <span
                          className={
                            Number(product.stock_quantity) >
                            0
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
                        "Grocery"}
                    </span>

                    <h3>{product.name}</h3>

                    <p>
                      {[product.brand, product.pack_size]
                        .filter(Boolean)
                        .join(" · ") ||
                        product.description ||
                        "Wholesale grocery product"}
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
                          <strong>Price on request</strong>
                          <small>
                            Contact the merchant for current wholesale pricing
                          </small>
                        </>
                      ) : (
                        <>
                          <strong>
                            INR{" "}
                            {Number(product.price || 0).toFixed(2)}
                          </strong>

                          <small>
                            per {product.unit || "piece"}
                          </small>
                        </>
                      )}
                    </div>

                    <div className="public-product-minimum">
                      Minimum order:{" "}
                      <strong>
                        {product.minimum_order || 1}{" "}
                        {product.unit || "piece"}
                      </strong>
                    </div>

                    <div
                      className={`public-product-actions ${
                        isPriceOnRequest(product)
                          ? "quote-actions"
                          : ""
                      }`}
                    >
                      {isPriceOnRequest(product) ? (
                        <button
                          type="button"
                          className="request-price-button"
                          onClick={() => openEnquiryModal(product)}
                        >
                          <MessageSquare size={17} />
                          Request price
                        </button>
                      ) : (
                        <>
                          <button
                            type="button"
                            className="order-button"
                            disabled={
                              Number(product.stock_quantity) === 0
                            }
                            onClick={() => addToCart(product)}
                          >
                            <ShoppingCart size={17} />
                            Order now
                          </button>

                          <button
                            type="button"
                            className="enquiry-button"
                            onClick={() => openEnquiryModal(product)}
                          >
                            <MessageSquare size={17} />
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
              <Package size={36} />
              <h3>No products found</h3>
              <p>
                Try a different search or category.
              </p>
            </div>
          )}
        </section>
      </main>

      {cart.length > 0 && (
        <button
          type="button"
          className="public-floating-cart"
          onClick={openOrderModal}
        >
          <ShoppingCart size={20} />

          <span>
            <strong>{cartCount} items</strong>
            <small>
            INR {cartTotal.toFixed(2)}
            </small>
          </span>

          <span>View cart</span>
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
                <span>Direct order</span>
                <h2>Complete your order</h2>
              </div>

              <button
                type="button"
                onClick={closeModal}
                aria-label="Close"
              >
                <X size={20} />
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
                        <Package size={22} />
                      )}
                    </div>

                    <div className="public-cart-item-copy">
                      <strong>{item.name}</strong>

                      <span>
                        INR{" "}
                        {Number(
                          item.price || 0
                        ).toFixed(2)}{" "}
                        per {item.unit}
                      </span>
                    </div>

                    <div className="public-cart-quantity">
                      <button
                        type="button"
                        onClick={() =>
                          decreaseQuantity(item.id)
                        }
                      >
                        <Minus size={15} />
                      </button>

                      <strong>{item.quantity}</strong>

                      <button
                        type="button"
                        onClick={() =>
                          increaseQuantity(item.id)
                        }
                      >
                        <Plus size={15} />
                      </button>
                    </div>

                    <strong className="public-cart-line-total">
                      INR{" "}
                      {(
                        Number(item.price || 0) *
                        Number(item.quantity || 0)
                      ).toFixed(2)}
                    </strong>

                    <button
                      type="button"
                      className="public-cart-remove"
                      onClick={() =>
                        removeFromCart(item.id)
                      }
                    >
                      <Trash2 size={17} />
                    </button>
                  </article>
                ))
              ) : (
                <div className="public-cart-empty">
                  <ShoppingCart size={30} />
                  <p>Your cart is empty.</p>
                </div>
              )}
            </div>

            <div className="public-cart-total">
              <span>Estimated total</span>

              <strong>
                INR {cartTotal.toFixed(2)}
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
                <Send size={18} />

                {submitting
                  ? "Sending order..."
                  : "Send order"}
              </button>
            </form>
          </div>
        </div>
      )}

      {modal === "enquiry" && (
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
                <span>Product enquiry</span>

                <h2>
                  {isPriceOnRequest(selectedProduct)
                    ? `Request price — ${
                        selectedProduct?.name || "Product"
                      }`
                    : selectedProduct?.name || "Send enquiry"}
                </h2>
              </div>

              <button
                type="button"
                onClick={closeModal}
                aria-label="Close"
              >
                <X size={20} />
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
                  value={enquiry.business_name}
                  placeholder="Optional"
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

              <label className="full">
                <span>
                  {isPriceOnRequest(selectedProduct)
                    ? "Price request message"
                    : "Enquiry message"}
                </span>

                <textarea
                  required
                  rows="5"
                  value={enquiry.message}
                  placeholder={
                    isPriceOnRequest(selectedProduct)
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
                <Send size={18} />

                {submitting
                  ? isPriceOnRequest(selectedProduct)
                    ? "Sending price request..."
                    : "Sending enquiry..."
                  : isPriceOnRequest(selectedProduct)
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