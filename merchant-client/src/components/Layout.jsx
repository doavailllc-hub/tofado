import { useEffect, useMemo, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  Bell,
  ChevronDown,
  FileText,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  Search,
  ShieldCheck,
  ShoppingCart,
  Store,
  Truck,
  Users,
  Wallet,
  X,
} from "lucide-react";

import { useAuth } from "../context/AuthContext";
import logo from "../assets/tofado-logo.png";
import "./Layout.css";

const menus = {
  retailer: [
    { label: "Dashboard", path: "/retailer", icon: LayoutDashboard, color: "blue", end: true },
    { label: "New purchase list", path: "/retailer/new-order", icon: ShoppingCart, color: "amber" },
    { label: "My orders", path: "/retailer/orders", icon: Package, color: "purple" },
    { label: "Invoices & payments", path: "/retailer/invoices", icon: FileText, color: "pink" },
    { label: "Shop profile", path: "/retailer/profile", icon: Store, color: "green" },
  ],
  wholesaler: [
    {
      label: "Dashboard",
      path: "/wholesaler",
      icon: LayoutDashboard,
      color: "blue",
      end: true,
    },
    {
      label: "Products",
      icon: Package,
      color: "purple",
      children: [
        {
          label: "Product catalog",
          path: "/wholesaler/catalog",
          end: true,
        },
        {
          label: "Enquiries",
          path: "/wholesaler/enquiries",
        },
      ],
    },
    {
      label: "Retailers",
      path: "/wholesaler/retailers",
      icon: Users,
      color: "green",
    },
    {
      label: "Orders",
      path: "/wholesaler/catalog-orders",
      icon: ShoppingCart,
      color: "amber",
    },
    {
      label: "Deliveries",
      path: "/wholesaler/deliveries",
      icon: Truck,
      color: "cyan",
    },
    {
      label: "Invoices",
      path: "/wholesaler/invoices",
      icon: FileText,
      color: "pink",
    },
    {
      label: "Payments",
      path: "/wholesaler/payments",
      icon: Wallet,
      color: "green",
    },
    {
      label: "Business profile",
      path: "/wholesaler/profile",
      icon: Store,
      color: "purple",
    },
  ],
  admin: [
    { label: "Dashboard", path: "/admin", icon: LayoutDashboard, color: "blue", end: true },
    { label: "Verification requests", path: "/admin/applications", icon: ShieldCheck, color: "amber" },
    { label: "Merchants & shops", path: "/admin/users", icon: Users, color: "green" },
    { label: "All orders", path: "/admin/orders", icon: ShoppingCart, color: "purple" },
    { label: "Invoices & payments", path: "/admin/finance", icon: FileText, color: "pink" },
  ],
};

const roleMeta = {
  retailer: { label: "Retailer", workspace: "Retail procurement", profile: "/retailer/profile" },
  wholesaler: { label: "Wholesaler", workspace: "Wholesale workspace", profile: "/wholesaler/profile" },
  admin: { label: "Administrator", workspace: "Marketplace management", profile: "/admin/users" },
};

function getInitials(value) {
  return (
    String(value || "Tofado Merchant")
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join("") || "TM"
  );
}

export default function Layout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [openMenu, setOpenMenu] = useState("Products");

  const role = roleMeta[user?.role] || roleMeta.admin;
  const items = menus[user?.role] || [];
  const accountInitials = useMemo(
    () => getInitials(user?.business_name || user?.name),
    [user?.business_name, user?.name]
  );

  const companyLogo = user?.logo_url || user?.business_logo_url || "";

  useEffect(() => {
    const activeGroup = items.find(
      (item) =>
        item.children &&
        item.children.some((child) =>
          child.end ? location.pathname === child.path : location.pathname.startsWith(child.path)
        )
    );
    if (activeGroup) setOpenMenu(activeGroup.label);
    setSidebarOpen(false);
    setProfileOpen(false);
  }, [location.pathname, items]);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        setSidebarOpen(false);
        setProfileOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const signOut = () => {
    logout();
    navigate("/login", { replace: true });
  };

  return (
    <div className="tf-shell">
      {sidebarOpen && (
        <button
          type="button"
          className="tf-sidebar-overlay"
          onClick={() => setSidebarOpen(false)}
          aria-label="Close navigation"
        />
      )}

      <aside className={`tf-sidebar ${sidebarOpen ? "open" : ""}`} aria-label="Main navigation">
        <div className="tf-sidebar-brand">
          <NavLink
            to={`/${user?.role}`}
            className="tf-brand-link"
            aria-label="Go to dashboard"
          >
            <span className="tf-brand-logo-wrap">
              <img src={logo} alt="Tofado Merchant" />
            </span>

            <span className="tf-brand-copy">
              <strong>Tofado</strong>
              <small>Merchant workspace</small>
            </span>
          </NavLink>
          <button
            type="button"
            className="tf-icon-button tf-sidebar-close"
            onClick={() => setSidebarOpen(false)}
            aria-label="Close sidebar"
          >
            <X size={20} />
          </button>
        </div>

        <div className="tf-business-card">
          <div className="tf-business-avatar">
            {companyLogo ? (
              <img
                src={companyLogo}
                alt={user?.business_name || "Company logo"}
              />
            ) : (
              accountInitials
            )}
          </div>
          <div className="tf-business-details">
            <strong>{user?.business_name || user?.name || "Tofado Merchant"}</strong>
            <span>{role.workspace}</span>
          </div>
          <span className="tf-business-status" title="Verified and active" />
        </div>

        <div className="tf-sidebar-label">Workspace</div>

        <nav className="tf-navigation">
          {items.map((item) => {
            const Icon = item.icon;
            if (!item.children) {
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  end={Boolean(item.end)}
                  className={({ isActive }) => `tf-nav-link ${isActive ? "active" : ""}`}
                >
                  <span className={`tf-nav-icon ${item.color || "purple"}`}>
                    <Icon size={18} strokeWidth={2} />
                  </span>
                  <span className="tf-nav-label">{item.label}</span>
                </NavLink>
              );
            }

            const isOpen = openMenu === item.label;
            const hasActiveChild = item.children.some((child) =>
              child.end ? location.pathname === child.path : location.pathname.startsWith(child.path)
            );

            return (
              <div className="tf-nav-group" key={item.label}>
                <button
                  type="button"
                  className={`tf-nav-link tf-nav-parent ${hasActiveChild ? "active" : ""}`}
                  onClick={() => setOpenMenu(isOpen ? "" : item.label)}
                  aria-expanded={isOpen}
                >
                  <span className={`tf-nav-icon ${item.color || "purple"}`}>
                    <Icon size={18} strokeWidth={2} />
                  </span>
                  <span className="tf-nav-label">{item.label}</span>
                  <ChevronDown size={16} className={isOpen ? "rotate" : ""} />
                </button>
                {isOpen && (
                  <div className="tf-submenu">
                    {item.children.map((child) => (
                      <NavLink
                        key={child.path}
                        to={child.path}
                        end={Boolean(child.end)}
                        className={({ isActive }) => `tf-submenu-link ${isActive ? "active" : ""}`}
                      >
                        <span className="tf-submenu-dot" />
                        {child.label}
                      </NavLink>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        <div className="tf-sidebar-spacer" />
        <div className="tf-verified-card">
          <div className="tf-verified-icon"><ShieldCheck size={18} /></div>
          <div>
            <strong>Verified marketplace</strong>
            <p>Secure B2B purchasing between approved businesses.</p>
          </div>
        </div>
        <button type="button" className="tf-signout" onClick={signOut}>
          <LogOut size={18} />
          Sign out
        </button>
      </aside>

      <main className="tf-main">
        <header className="tf-topbar">
          <div className="tf-topbar-left">
            <button
              type="button"
              className="tf-icon-button tf-mobile-menu"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open navigation"
            >
              <Menu size={20} />
            </button>
            <div className="tf-topbar-brand">
              <span className="tf-topbar-logo">
                <img src={logo} alt="Tofado" />
              </span>

              <div className="tf-topbar-heading">
                <span>Tofado Merchant</span>
                <strong>{role.workspace}</strong>
              </div>
            </div>
          </div>

          <div className="tf-global-search">
            <Search size={17} />
            <input type="search" placeholder="Search your workspace" aria-label="Search workspace" />
            <kbd>Ctrl K</kbd>
          </div>

          <div className="tf-topbar-actions">
            <button type="button" className="tf-icon-button tf-notification" aria-label="Notifications">
              <Bell size={19} />
              <span className="tf-notification-dot" />
            </button>
            <div className="tf-profile-wrap">
              <button
                type="button"
                className="tf-profile-button"
                onClick={() => setProfileOpen((value) => !value)}
                aria-expanded={profileOpen}
              >
                <span className="tf-profile-avatar">
                  {companyLogo ? (
                    <img
                      src={companyLogo}
                      alt={user?.business_name || "Company logo"}
                    />
                  ) : (
                    accountInitials
                  )}
                </span>
                <span className="tf-profile-details">
                  <strong>{user?.name || "Merchant User"}</strong>
                  <small>{role.label}</small>
                </span>
                <ChevronDown size={16} className={profileOpen ? "tf-profile-chevron-open" : ""} />
              </button>

              {profileOpen && (
                <div className="tf-profile-menu" role="menu">
                  <div className="tf-profile-menu-header">
                    <strong>{user?.name || "Merchant User"}</strong>
                    <span>{user?.email || "—"}</span>
                  </div>
                  <button type="button" onClick={() => navigate(role.profile)}>
                    <Store size={17} />
                    Business profile
                  </button>
                  <button type="button" className="tf-profile-signout" onClick={signOut}>
                    <LogOut size={17} />
                    Sign out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <section className="tf-content"><Outlet /></section>
      </main>
    </div>
  );
}