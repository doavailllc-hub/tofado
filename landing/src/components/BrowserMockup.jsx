import {
  BarChart3,
  Boxes,
  CreditCard,
  PackageCheck,
  Search,
  ShoppingCart,
  Store,
  Truck,
  Users,
} from "lucide-react";

export default function BrowserMockup() {
  return (
    <div className="browser-mockup">
      <div className="browser-bar">
        <div className="browser-dots"><span /><span /><span /></div>
        <div className="browser-address">merchant.tofado.com</div>
      </div>

      <div className="app-preview">
        <aside>
          <div className="preview-logo">T</div>
          {[BarChart3, Boxes, Users, ShoppingCart, Truck, CreditCard].map((Icon, index) => (
            <div className={index === 3 ? "preview-nav active" : "preview-nav"} key={index}>
              <Icon size={16} />
            </div>
          ))}
        </aside>

        <section>
          <div className="preview-header">
            <div>
              <small>TOFADO MERCHANT</small>
              <strong>Wholesale workspace</strong>
            </div>
            <div className="preview-search"><Search size={14} /> Search workspace</div>
          </div>

          <div className="preview-content">
            <div className="preview-title">
              <div>
                <small>Sales operations</small>
                <h3>Orders</h3>
              </div>
              <button>+ New order</button>
            </div>

            <div className="preview-stats">
              <article><Store size={18} /><span><small>Total orders</small><strong>248</strong></span></article>
              <article><PackageCheck size={18} /><span><small>In progress</small><strong>36</strong></span></article>
              <article><Truck size={18} /><span><small>Delivered</small><strong>192</strong></span></article>
              <article><CreditCard size={18} /><span><small>Order value</small><strong>INR 184K</strong></span></article>
            </div>

            <div className="preview-table">
              {[
                ["CO-82490012", "Fresh Basket", "SAR 6,240", "Confirmed"],
                ["CO-82490011", "Metro Mart", "SAR 3,800", "Packed"],
                ["CO-82490010", "Green Store", "SAR 12,500", "Delivered"],
              ].map((row) => (
                <div key={row[0]}>
                  <span><ShoppingCart size={15} /></span>
                  <strong>{row[0]}</strong>
                  <small>{row[1]}</small>
                  <b>{row[2]}</b>
                  <em>{row[3]}</em>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
