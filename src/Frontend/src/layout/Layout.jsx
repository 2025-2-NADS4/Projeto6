// src/layout/Layout.jsx
import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";

export default function Layout() {
  return (
    <div className="shell">
      <Sidebar />
      <main className="content">
        <Outlet />
      </main>
    </div>
  );
}
