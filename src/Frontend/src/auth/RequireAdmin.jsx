import { Navigate } from "react-router-dom";

export default function RequireAdmin({ children }) {
  const u = JSON.parse(sessionStorage.getItem("user") || "{}");
  if (u?.role !== "admin") return <Navigate to="/dashboard" replace />;
  return children;
}
