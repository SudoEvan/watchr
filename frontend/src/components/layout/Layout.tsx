import { Outlet, Link, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Film, LogOut, User } from "lucide-react";

export default function Layout() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const handleLogout = () => {
    localStorage.removeItem("watchr_token");
    queryClient.clear();
    navigate("/login");
  };

  return (
    <div className="min-h-screen" style={{ backgroundColor: "var(--bg-primary)" }}>
      {/* Header */}
      <header
        className="sticky top-0 z-50 border-b"
        style={{
          backgroundColor: "var(--bg-secondary)",
          borderColor: "var(--border)",
        }}
      >
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4">
          <Link to="/" className="flex items-center gap-2 text-lg font-bold" style={{ color: "var(--accent-primary)" }}>
            <Film size={24} />
            Watchr
          </Link>
          <div className="flex items-center gap-3">
            <button
              className="rounded-lg p-2 transition-colors hover:opacity-80"
              style={{ color: "var(--text-secondary)" }}
              title="Profile"
            >
              <User size={20} />
            </button>
            <button
              onClick={handleLogout}
              className="rounded-lg p-2 transition-colors hover:opacity-80"
              style={{ color: "var(--text-secondary)" }}
              title="Logout"
            >
              <LogOut size={20} />
            </button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="mx-auto max-w-7xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
