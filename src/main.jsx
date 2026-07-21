import React from "react";
import ReactDOM from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import App from "./App.jsx";
import Login from "./Login.jsx";
import ProtectedRoute from "./ProtectedRoute.jsx";
import DashboardLayout from "./DashboardLayout.jsx";
import InventoryPage from "./InventoryPage.jsx";
import RequirementOrderPage from "./RequirementOrderPage.jsx";
import ProductionOrderPage from "./ProductionOrderPage.jsx";
import ProductionOrderDetailEditPage from "./ProductionOrderDetailEditPage.jsx";
import VendorPage from "./VendorPage.jsx";
import MaterialPage from "./MaterialPage.jsx";
import PurchaseRequisitionPage from "./PurchaseRequisitionPage.jsx";
import TracePage from "./TracePage_v2.jsx";
import UserPage from "./UserPage.jsx";
import "./index.css";
import DeliveryNotePage from "./DeliveryNotePage.jsx";

const router = createBrowserRouter([
  {
    path: "/",
    element: <App />,
    children: [
      {
        path: "login",
        element: <Login />,
      },
      {
        path: "/",
        element: <ProtectedRoute />,
        children: [
          {
            path: "/",
            element: <DashboardLayout />,
            children: [
              { index: true, element: <InventoryPage /> },
              { path: "requirement", element: <RequirementOrderPage /> },
              { path: "production", element: <ProductionOrderPage /> },
              {
                path: "production/:production_order_id",
                element: <ProductionOrderDetailEditPage />,
              },
              {
                path: "delivery-notes",
                element: <DeliveryNotePage />,
              },
              { path: "vendors", element: <VendorPage /> },
              { path: "materials", element: <MaterialPage /> },
              {
                path: "purchase-requisitions",
                element: <PurchaseRequisitionPage />,
              },
              {
                path: "trace",
                element: <TracePage />,
              },
              {
                path: "users",
                element: <UserPage />,
              },
              {
                path: "*",
                element: (
                  <div className="p-6 text-red-500 font-bold">
                    找不到頁面 404
                  </div>
                ),
              },
            ],
          },
        ],
      },
    ],
  },
]);

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>,
);
