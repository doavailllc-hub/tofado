import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  BadgeCheck,
  Boxes,
  ChevronLeft,
  ChevronRight,
  MapPin,
  Package,
  Search,
  ShoppingCart,
  Store,
  TrendingUp,
} from "lucide-react";
import "./MarketplaceHomeFlipkart.css";

const rawApi =
  import.meta.env.VITE_API_URL ||
  import.meta.env.VITE_MERCHANT_API_URL ||
  "http://localhost:5000/api";

const cleanApi = rawApi.replace(/\/+$/, "");
const apiBase = cleanApi.endsWith("/api") ? cleanApi : `${cleanApi}/api`;

const merchantAppUrl =
  import.meta.env.VITE_MERCHANT_APP_URL || "http://localhost:5173/login";

const merchantBaseUrl = merchantAppUrl
  .replace(/\/login\/?$/, "")
  .replace(/\/+$/, "");

const fallbackCategories = [
  "Grocery",
  "Food & Beverage",
  "Pharmacy",
  "Restaurant Supplies",
  "Hotel Supplies",
  "Construction",
  "Industrial",
  "Electronics",
];

const categoryIcons = ["🛒", "🥤", "💊", "🍽️", "🏨", "🏗️", "🏭", "💻", "📦", "🧴"];

function storeUrl(slug) {
  return `${merchantBaseUrl}/catalog/${encodeURIComponent(slug)}`;
}

function money(product) {
  if (String(product?.price_mode || "").toLowerCase() === "quote") {
    return "Price on request";
  }

  const value = Number(product?.price || 0);
  if (!value) return "Contact supplier";

  return `SAR ${value.toLocaleString("en-SA", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function SupplierCard({ supplier }) {
  return (
    <a
      href={storeUrl(supplier.catalog_slug)}
      className="fk-supplier-card"
    >
      <div className="fk-supplier-image">
        {supplier.cover_image_url ? (
          <img
            src={supplier.cover_image_url}
            alt={supplier.business_name}
          />
        ) : (
          <div className="fk-supplier-placeholder">
            <Store size={38} />
          </div>
        )}
      </div>

      <div className="fk-supplier-body">
        <div className="fk-supplier-title-row">
          <div className="fk-supplier-logo">
            {supplier.logo_url ? (
              <img
                src={supplier.logo_url}
                alt={supplier.business_name}
              />
            ) : (
              <Store size={18} />
            )}
          </div>

          <div>
            <h3>{supplier.business_name}</h3>
            <span>
              <BadgeCheck size={13} />
              Verified wholesaler
            </span>
          </div>
        </div>

        <p>
          <MapPin size={13} />
          {supplier.location || "Business location"}
        </p>

        <div className="fk-supplier-footer">
          <span>
            <Package size={14} />
            {Number(supplier.product_count || 0).toLocaleString()} products
          </span>

          <strong>
            View store
            <ChevronRight size={14} />
          </strong>
        </div>
      </div>
    </a>
  );
}

function ProductCard({ product }) {
  return (
    <a
      href={`${storeUrl(product.catalog_slug)}?product=${product.id}`}
      className="fk-product-card"
    >
      <div className="fk-product-image">
        {product.image_url ? (
          <img src={product.image_url} alt={product.name} />
        ) : (
          <Package size={34} />
        )}
      </div>

      <div className="fk-product-info">
        <span>{product.category_name || "Wholesale"}</span>
        <h3>{product.name}</h3>
        <p>{product.business_name}</p>
        <strong>{money(product)}</strong>
      </div>
    </a>
  );
}

export default function Home() {
  const [home, setHome] = useState({
    stats: {},
    categories: [],
    featured_wholesalers: [],
    trending_wholesalers: [],
    new_wholesalers: [],
    popular_products: [],
  });

  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState("");
  const [query, setQuery] = useState("");
  const [location, setLocation] = useState("");
  const [results, setResults] = useState([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadHome() {
      try {
        setLoading(true);
        setApiError("");

        const response = await fetch(`${apiBase}/public/marketplace/home`);

        if (!response.ok) throw new Error("Marketplace API unavailable.");

        const data = await response.json();

        if (!active) return;

        setHome({
          stats: data.stats || {},
          categories: Array.isArray(data.categories) ? data.categories : [],
          featured_wholesalers: Array.isArray(data.featured_wholesalers)
            ? data.featured_wholesalers
            : [],
          trending_wholesalers: Array.isArray(data.trending_wholesalers)
            ? data.trending_wholesalers
            : [],
          new_wholesalers: Array.isArray(data.new_wholesalers)
            ? data.new_wholesalers
            : [],
          popular_products: Array.isArray(data.popular_products)
            ? data.popular_products
            : [],
        });
      } catch (error) {
        console.error(error);
        if (active) {
          setApiError("Live marketplace data is unavailable right now.");
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    loadHome();

    return () => {
      active = false;
    };
  }, []);

  const categories = useMemo(() => {
    const real = home.categories.map((item) => item?.name).filter(Boolean);
    return real.length ? real.slice(0, 10) : fallbackCategories;
  }, [home.categories]);

  async function searchMarketplace(event, category = "") {
    if (event) event.preventDefault();

    try {
      setSearching(true);
      setHasSearched(true);

      const params = new URLSearchParams();

      if (query.trim()) params.set("q", query.trim());
      if (location.trim()) params.set("location", location.trim());
      if (category) params.set("category", category);
      params.set("sort", "featured");
      params.set("limit", "24");

      const response = await fetch(
        `${apiBase}/public/marketplace/wholesalers?${params.toString()}`
      );

      if (!response.ok) throw new Error("Search failed");

      const data = await response.json();

      setResults(
        Array.isArray(data.wholesalers) ? data.wholesalers : []
      );

      setTimeout(() => {
        document
          .getElementById("market-search-results")
          ?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 40);
    } catch (error) {
      console.error(error);
      setResults([]);
    } finally {
      setSearching(false);
    }
  }

  const wholesalers =
    home.featured_wholesalers.length > 0
      ? home.featured_wholesalers
      : home.trending_wholesalers;

  return (
    <div className="fk-home">
      <section className="fk-top-search">
        <div className="fk-top-search-shell">
          <div className="fk-market-brand">
            <Store size={23} />
            <div>
              <strong>Tofado Marketplace</strong>
              <span>Wholesale made simple</span>
            </div>
          </div>

          <form onSubmit={searchMarketplace} className="fk-search-bar">
            <Search size={20} />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search for wholesalers, products, brands and more"
            />

            <div className="fk-location-input">
              <MapPin size={16} />
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Location"
              />
            </div>

            <button type="submit">
              Search
            </button>
          </form>
        </div>
      </section>

      <section className="fk-category-strip">
        <div className="fk-category-scroll">
          {categories.map((item, index) => (
            <button
              type="button"
              key={item}
              onClick={() => searchMarketplace(null, item)}
            >
              <div>{categoryIcons[index % categoryIcons.length]}</div>
              <span>{item}</span>
            </button>
          ))}
        </div>
      </section>

      <main className="fk-page-shell">
        <section className="fk-banner">
          <div className="fk-banner-copy">
            <span>TOFADO BUSINESS MARKETPLACE</span>
            <h1>Discover wholesale deals from verified suppliers.</h1>
            <p>
              Browse real catalogs, compare products, connect with
              wholesalers and order directly for your business.
            </p>

            <button
              type="button"
              onClick={() => searchMarketplace(null, "")}
            >
              Explore wholesalers
              <ArrowRight size={18} />
            </button>
          </div>

          <div className="fk-banner-art">
            <div className="fk-banner-card card-one">
              <Store size={28} />
              <span>Verified suppliers</span>
            </div>

            <div className="fk-banner-card card-two">
              <ShoppingCart size={28} />
              <span>Direct ordering</span>
            </div>

            <div className="fk-banner-card card-three">
              <Boxes size={28} />
              <span>Wholesale products</span>
            </div>
          </div>
        </section>

        {apiError && (
          <div className="fk-api-warning">{apiError}</div>
        )}

        {hasSearched && (
          <section
            className="fk-market-section"
            id="market-search-results"
          >
            <div className="fk-section-header">
              <div>
                <h2>Search results</h2>
                <p>Wholesalers matching your search</p>
              </div>
            </div>

            {searching ? (
              <div className="fk-empty-box">Searching...</div>
            ) : results.length ? (
              <div className="fk-supplier-grid">
                {results.map((supplier) => (
                  <SupplierCard
                    key={supplier.id}
                    supplier={supplier}
                  />
                ))}
              </div>
            ) : (
              <div className="fk-empty-box">
                No wholesalers found. Try another search.
              </div>
            )}
          </section>
        )}

        <section className="fk-market-section">
          <div className="fk-section-header">
            <div>
              <h2>Top wholesalers</h2>
              <p>Verified suppliers recommended for your business</p>
            </div>

            <button
              type="button"
              onClick={() => searchMarketplace(null, "")}
            >
              View all
              <ArrowRight size={16} />
            </button>
          </div>

          <div className="fk-supplier-grid">
            {wholesalers.slice(0, 8).map((supplier) => (
              <SupplierCard key={supplier.id} supplier={supplier} />
            ))}
          </div>
        </section>

        <section className="fk-deal-strip">
          <div>
            <TrendingUp size={23} />
            <span>
              <strong>Trending suppliers</strong>
              Based on current marketplace activity
            </span>
          </div>

          <div className="fk-trending-row">
            {home.trending_wholesalers.slice(0, 5).map((supplier) => (
              <a
                key={supplier.id}
                href={storeUrl(supplier.catalog_slug)}
              >
                <div>
                  {supplier.logo_url ? (
                    <img
                      src={supplier.logo_url}
                      alt={supplier.business_name}
                    />
                  ) : (
                    <Store size={18} />
                  )}
                </div>

                <span>{supplier.business_name}</span>
              </a>
            ))}
          </div>
        </section>

        <section className="fk-market-section">
          <div className="fk-section-header">
            <div>
              <h2>Best wholesale products</h2>
              <p>Popular products from verified Tofado suppliers</p>
            </div>

            <button type="button">
              View all
              <ArrowRight size={16} />
            </button>
          </div>

          <div className="fk-product-grid">
            {home.popular_products.slice(0, 10).map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </section>

        <section className="fk-promo-row">
          <article>
            <div>
              <span>For Retailers</span>
              <h3>Find suppliers for your store</h3>
              <p>
                Search wholesalers, request a business connection and
                purchase directly.
              </p>
              <a href={`${merchantBaseUrl}/login`}>
                Retailer login
                <ArrowRight size={16} />
              </a>
            </div>
            <ShoppingCart size={72} />
          </article>

          <article>
            <div>
              <span>For Wholesalers</span>
              <h3>Sell to more retailers</h3>
              <p>
                Publish your catalog and start receiving direct B2B
                orders.
              </p>
              <a href={`${merchantBaseUrl}/apply`}>
                Join Tofado
                <ArrowRight size={16} />
              </a>
            </div>
            <Store size={72} />
          </article>
        </section>

        <section className="fk-market-section">
          <div className="fk-section-header">
            <div>
              <h2>New wholesalers</h2>
              <p>Recently joined suppliers on Tofado</p>
            </div>
          </div>

          <div className="fk-new-grid">
            {home.new_wholesalers.slice(0, 6).map((supplier) => (
              <a
                href={storeUrl(supplier.catalog_slug)}
                key={supplier.id}
              >
                <div className="fk-new-logo">
                  {supplier.logo_url ? (
                    <img
                      src={supplier.logo_url}
                      alt={supplier.business_name}
                    />
                  ) : (
                    <Store size={20} />
                  )}
                </div>

                <div>
                  <strong>{supplier.business_name}</strong>
                  <span>{supplier.location || "Verified supplier"}</span>
                </div>

                <ChevronRight size={18} />
              </a>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}