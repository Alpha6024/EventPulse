import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import {
  createBrowserRouter,
  RouterProvider,
} from "react-router-dom";

import "./index.css";
import LoginPage from "./components/LoginPage";
import AdminDashboard from "./components/AdminDashboard";
import OrganizerDashboard from "./components/OrganizerDashboard";
import StudentDashboard from "./components/StudentDashboard";

const router = createBrowserRouter([
  {
    path: "/",
    element: <LoginPage />,
  },
  {
    path: "/admin",
    element: <AdminDashboard />,
  },
  {
    path: "/organizer",
    element: <OrganizerDashboard />,
  },
  {
    path: "/student",
    element: <StudentDashboard />,
  },
]);

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>
);
