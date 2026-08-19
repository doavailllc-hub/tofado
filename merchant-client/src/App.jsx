import {
  Navigate,
  Route,
  Routes,
} from "react-router-dom";

import Layout from "./components/Layout";
import ProtectedRoute from "./components/ProtectedRoute";

import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import DataPage from "./pages/DataPage";
import Profile from "./pages/Profile";
import NewOrder from "./pages/NewOrder";
import RetailerOrderDetails from "./pages/RetailerOrderDetails";
import RetailerInvoiceDetails from "./pages/RetailerInvoiceDetails";
import Catalog from "./pages/Catalog";
import ProductForm from "./pages/ProductForm";
import CatalogOrders from "./pages/CatalogOrders";
import CatalogEnquiries from "./pages/CatalogEnquiries";
import PublicCatalog from "./pages/PublicCatalog";
import AdminRequests from "./pages/AdminRequests";
import AddRetailer from "./pages/AddRetailer";
import AddRetailerFromEnquiry from "./pages/AddRetailerFromEnquiry";
import RetailerDetails from "./pages/RetailerDetails";
import DeliveryList from "./pages/DeliveryList";
import DeliveryDetails from "./pages/DeliveryDetails";
import InvoiceDetails from "./pages/InvoiceDetails";
import PaymentList from "./pages/PaymentList";
import RecordPayment from "./pages/RecordPayment";
import PaymentDetails from "./pages/PaymentDetails";
import RetailerWholesalers from "./pages/RetailerWholesalers";
import RetailerConnectedWholesalers from "./pages/RetailerConnectedWholesalers";
import RetailerWholesalerRequests from "./pages/RetailerWholesalerRequests";
import WholesalerRetailerRequests from "./pages/WholesalerRetailerRequests";
export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />

      <Route
        path="/catalog/:slug"
        element={<PublicCatalog />}
      />

      <Route
        element={
          <ProtectedRoute allowedRoles={["retailer"]}>
            <Layout />
          </ProtectedRoute>
        }
      >
  
        <Route path="/retailer" element={<Dashboard />} />
        <Route
          path="/retailer/new-order"
          element={<NewOrder />}
        />
        <Route
          path="/retailer/orders"
          element={<DataPage type="retailer-orders" />}
        />
        <Route
          path="/retailer/invoices"
          element={<DataPage type="retailer-invoices" />}
        />
        <Route
          path="/retailer/invoices/:id"
          element={<RetailerInvoiceDetails />}
        />
        <Route
          path="/retailer/wholesalers"
          element={<RetailerConnectedWholesalers />}
        />

        <Route
          path="/retailer/wholesalers/find"
          element={<RetailerWholesalers />}
        />

        <Route
          path="/retailer/wholesaler-requests"
          element={<RetailerWholesalerRequests />}
        />
<Route
  path="/retailer/orders/new"
  element={<NewOrder />}
/>
        <Route
  path="/retailer/orders/:id"
  element={<RetailerOrderDetails />}
/>
        <Route
          path="/retailer/profile"
          element={<Profile />}
        />
      </Route>

      <Route
        element={
          <ProtectedRoute allowedRoles={["wholesaler"]}>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route path="/wholesaler" element={<Dashboard />} />

        <Route
          path="/wholesaler/catalog"
          element={<Catalog />}
        />

        <Route
          path="/wholesaler/catalog/new"
          element={<ProductForm />}
        />
<Route
  path="/wholesaler/invoices/:id"
  element={<InvoiceDetails />}
/>
        <Route
          path="/wholesaler/catalog/:id/edit"
          element={<ProductForm />}
        />

        <Route
          path="/wholesaler/catalog-orders"
          element={<CatalogOrders />}
        />

        <Route
          path="/wholesaler/enquiries"
          element={<CatalogEnquiries />}
        />
<Route
  path="/wholesaler/deliveries"
  element={<DeliveryList />}
/>

<Route
  path="/wholesaler/deliveries/:id"
  element={<DeliveryDetails />}
/>
        <Route
          path="/wholesaler/retailers"
          element={
            <DataPage type="wholesaler-retailers" />
          }
        />
      <Route
  path="/wholesaler/retailers/new"
  element={<AddRetailer />}
/>

<Route
  path="/wholesaler/retailers/from-enquiry"
  element={<AddRetailerFromEnquiry />}
/>
        <Route
          path="/wholesaler/orders"
          element={
            <DataPage type="wholesaler-orders" />
          }
        />

        <Route
          path="/wholesaler/deliveries"
          element={
            <DataPage type="wholesaler-deliveries" />
          }
        />

        <Route
          path="/wholesaler/invoices"
          element={
            <DataPage type="wholesaler-invoices" />
          }
        />
<Route
  path="/wholesaler/retailers/:id"
  element={<RetailerDetails />}
/>
        <Route
  path="/wholesaler/payments"
  element={<PaymentList />}
/>
<Route
  path="/wholesaler/retailer-requests"
  element={<WholesalerRetailerRequests />}
/>
<Route
  path="/wholesaler/payments/new"
  element={<RecordPayment />}
/>

<Route
  path="/wholesaler/payments/:id"
  element={<PaymentDetails />}
/>

        <Route
          path="/wholesaler/profile"
          element={<Profile />}
        />
      </Route>

      <Route
        element={
          <ProtectedRoute allowedRoles={["admin"]}>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route path="/admin" element={<Dashboard />} />

        <Route
          path="/admin/applications"
          element={<AdminRequests />}
        />

        <Route
          path="/admin/users"
          element={<DataPage type="admin-users" />}
        />

        <Route
          path="/admin/orders"
          element={<DataPage type="admin-orders" />}
        />

        <Route
          path="/admin/finance"
          element={<DataPage type="admin-finance" />}
        />
      </Route>

      <Route
        path="/"
        element={<Navigate to="/login" replace />}
      />

      <Route
        path="*"
        element={<Navigate to="/login" replace />}
      />
    </Routes>
  );
}