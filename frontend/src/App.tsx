import { Routes, Route, Navigate } from "react-router-dom";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import WatchHistory from "./pages/WatchHistory";
import WatchlistDetail from "./pages/WatchlistDetail";
import ItemDetail from "./pages/ItemDetail";
import Layout from "./components/layout/Layout";

function isAuthenticated(): boolean {
  return !!localStorage.getItem("watchr_token");
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  if (!isAuthenticated()) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="history" element={<WatchHistory />} />
        <Route path="watchlists/:id" element={<WatchlistDetail />} />
        <Route path="watchlists/:watchlistId/items/:itemId" element={<ItemDetail />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
