import { lazy, Suspense } from 'react';
import {
  Navigate,
  Route,
  Routes,
} from "react-router-dom";

import Layout from "./components/Layout";
import ProtectedRoute from "./components/ProtectedRoute";

const Login = lazy(() => import('./pages/Login'));
const Register = lazy(() => import('./pages/Register'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const DataPage = lazy(() => import('./pages/DataPage'));
const Profile = lazy(() => import('./pages/Profile'));
const NewOrder = lazy(() => import('./pages/NewOrder'));
const RetailerOrderDetails = lazy(() => import('./pages/RetailerOrderDetails'));
const WholesalerOrderDetails = lazy(() => import('./pages/WholesalerOrderDetails'));
const RetailerInvoiceDetails = lazy(() => import('./pages/RetailerInvoiceDetails'));
const Catalog = lazy(() => import('./pages/Catalog'));
const ProductForm = lazy(() => import('./pages/ProductForm'));
const CatalogOrders = lazy(() => import('./pages/CatalogOrders'));
const CatalogEnquiries = lazy(() => import('./pages/CatalogEnquiries'));
const PublicCatalog = lazy(() => import('./pages/PublicCatalog'));
const EnquiryQuote = lazy(() => import('./pages/EnquiryQuote'));
const AdminRequests = lazy(() => import('./pages/AdminRequests'));
const AddRetailer = lazy(() => import('./pages/AddRetailer'));
const AddRetailerFromEnquiry = lazy(() => import('./pages/AddRetailerFromEnquiry'));
const RetailerDetails = lazy(() => import('./pages/RetailerDetails'));
const DeliveryList = lazy(() => import('./pages/DeliveryList'));
const DeliveryDetails = lazy(() => import('./pages/DeliveryDetails'));
const InvoiceDetails = lazy(() => import('./pages/InvoiceDetails'));
const PaymentList = lazy(() => import('./pages/PaymentList'));
const RecordPayment = lazy(() => import('./pages/RecordPayment'));
const PaymentDetails = lazy(() => import('./pages/PaymentDetails'));
const RetailerWholesalers = lazy(() => import('./pages/RetailerWholesalers'));
const RetailerConnectedWholesalers = lazy(() => import('./pages/RetailerConnectedWholesalers'));
const RetailerWholesalerRequests = lazy(() => import('./pages/RetailerWholesalerRequests'));
const WholesalerRetailerRequests = lazy(() => import('./pages/WholesalerRetailerRequests'));
const CommerceIntelligence = lazy(() => import('./pages/CommerceIntelligence'));
export default function App() {
  return (
    <Suspense fallback={<main role="status" style={{ padding: 32 }}>Loading...</main>}>
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />

      <Route
        path="/catalog/:slug"
        element={<PublicCatalog />}
      />
      <Route path="/quote/:token" element={<EnquiryQuote />} />

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
        <Route path="/retailer/intelligence" element={<CommerceIntelligence />} />
      </Route>

      <Route
        element={
          <ProtectedRoute allowedRoles={["wholesaler"]}>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route path="/wholesaler" element={<Dashboard />} />
        <Route path="/wholesaler/orders/:id" element={<WholesalerOrderDetails />} />

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
        <Route path="/wholesaler/intelligence" element={<CommerceIntelligence />} />
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
    </Suspense>
  );
}
