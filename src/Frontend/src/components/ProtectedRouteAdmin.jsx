import { Navigate } from "react-router-dom";

export default function ProtectedRouteAdmin({ children }) {
  const user = JSON.parse(sessionStorage.getItem("user") || "{}");
  if (!user?.token) return <Navigate to="/login?role=admin" replace />;
  if (user?.role !== "admin") return <Navigate to="/dashboard" replace />;
  return children;
}