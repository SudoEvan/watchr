import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Star, StarOff, List, RefreshCw, Play, Square } from "lucide-react";
import client from "../api/client";
import type { WatchList, CurrentlyWatching } from "../types";

export default function Dashboard() {
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newRewatch, setNewRewatch] = useState(false);

  const { data: watchlists = [], isLoading } = useQuery<WatchList[]>({
    queryKey: ["watchlists"],
    queryFn: async () => (await client.get("/watchlists")).data,
  });

  const { data: currentlyWatching = [] } = useQuery<CurrentlyWatching[]>({
    queryKey: ["currently-watching"],
    queryFn: async () => (await client.get("/users/me/watching")).data,
  });

  const stopWatching = useMutation({
    mutationFn: async (tmdbId: number) => {
      await client.delete(`/users/me/watching/${tmdbId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["currently-watching"] });
      queryClient.invalidateQueries({ queryKey: ["watchlist-items"] });
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      return (
        await client.post("/watchlists", {
          name: newName,
          description: newDesc || null,
          is_rewatch: newRewatch,
        })
      ).data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["watchlists"] });
      setShowCreate(false);
      setNewName("");
      setNewDesc("");
      setNewRewatch(false);
    },
  });

  const toggleFavorite = useMutation({
    mutationFn: async ({ id, isFavorite }: { id: string; isFavorite: boolean }) => {
      if (isFavorite) {
        await client.delete(`/watchlists/${id}/favorite`);
      } else {
        await client.post(`/watchlists/${id}/favorite`);
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["watchlists"] }),
  });

  const favorites = watchlists.filter((wl) => wl.is_favorite);
  const others = watchlists.filter((wl) => !wl.is_favorite);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20" style={{ color: "var(--text-secondary)" }}>
        Loading...
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>
          My Watchlists
        </h1>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
          style={{ backgroundColor: "var(--accent-primary)" }}
        >
          <Plus size={16} />
          New List
        </button>
      </div>

      {/* Create modal */}
      {showCreate && (
        <div
          className="mb-6 rounded-xl border p-6"
          style={{
            backgroundColor: "var(--bg-secondary)",
            borderColor: "var(--border)",
          }}
        >
          <h2 className="mb-4 text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
            Create Watchlist
          </h2>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              createMutation.mutate();
            }}
            className="flex flex-col gap-3"
          >
            <input
              type="text"
              placeholder="List name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              required
              className="rounded-lg border px-4 py-2 text-sm outline-none"
              style={{
                backgroundColor: "var(--bg-surface)",
                borderColor: "var(--border)",
                color: "var(--text-primary)",
              }}
            />
            <textarea
              placeholder="Description (optional)"
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              rows={2}
              className="rounded-lg border px-4 py-2 text-sm outline-none"
              style={{
                backgroundColor: "var(--bg-surface)",
                borderColor: "var(--border)",
                color: "var(--text-primary)",
              }}
            />
            <label className="flex items-center gap-2 text-sm" style={{ color: "var(--text-secondary)" }}>
              <input
                type="checkbox"
                checked={newRewatch}
                onChange={(e) => setNewRewatch(e.target.checked)}
                className="rounded"
              />
              Re-watch list (items loop instead of archiving)
            </label>
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={createMutation.isPending}
                className="rounded-lg px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
                style={{ backgroundColor: "var(--accent-primary)" }}
              >
                Create
              </button>
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                className="rounded-lg border px-4 py-2 text-sm transition-opacity hover:opacity-80"
                style={{
                  borderColor: "var(--border)",
                  color: "var(--text-secondary)",
                }}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Currently Watching */}
      {currentlyWatching.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide" style={{ color: "var(--text-secondary)" }}>
            <Play size={14} />
            Currently Watching
          </h2>
          <div className="flex gap-4 overflow-x-auto pb-2">
            {currentlyWatching.map((cw) => (
              <div
                key={cw.tmdb_id}
                className="group relative flex-shrink-0 w-36 overflow-hidden rounded-xl border transition-all hover:shadow-lg"
                style={{ backgroundColor: "var(--bg-secondary)", borderColor: "var(--border)" }}
              >
                <button
                  onClick={() => stopWatching.mutate(cw.tmdb_id)}
                  disabled={stopWatching.isPending}
                  className="absolute right-1.5 top-1.5 z-10 rounded-full p-1.5 opacity-0 transition-opacity group-hover:opacity-100"
                  style={{ backgroundColor: "rgba(0,0,0,0.6)", color: "#fff" }}
                  title="Stop watching"
                >
                  <Square size={12} />
                </button>
                <div
                  className="absolute left-1.5 top-1.5 z-10 rounded-full px-2 py-0.5 text-[10px] font-medium text-white"
                  style={{ backgroundColor: "var(--accent-secondary)" }}
                >
                  Watching
                </div>
                {cw.poster_path ? (
                  <img
                    src={`https://image.tmdb.org/t/p/w300${cw.poster_path}`}
                    alt={cw.title}
                    className="h-52 w-full object-cover"
                  />
                ) : (
                  <div
                    className="flex h-52 w-full items-center justify-center"
                    style={{ backgroundColor: "var(--bg-surface)" }}
                  >
                    <span className="text-3xl" style={{ color: "var(--text-secondary)" }}>?</span>
                  </div>
                )}
                <div className="p-2">
                  <p className="text-xs font-medium line-clamp-2" style={{ color: "var(--text-primary)" }}>
                    {cw.title}
                  </p>
                  <p className="mt-0.5 text-[10px]" style={{ color: "var(--text-secondary)" }}>
                    {cw.media_type === "movie" ? "Movie" : "TV Show"}
                    {cw.started_at && ` · Since ${cw.started_at}`}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Empty state */}
      {watchlists.length === 0 && !showCreate && (
        <div
          className="flex flex-col items-center justify-center rounded-xl border py-20"
          style={{
            backgroundColor: "var(--bg-secondary)",
            borderColor: "var(--border)",
          }}
        >
          <List size={48} style={{ color: "var(--text-secondary)" }} className="mb-4" />
          <p className="mb-2 text-lg font-medium" style={{ color: "var(--text-primary)" }}>
            No watchlists yet
          </p>
          <p className="mb-6 text-sm" style={{ color: "var(--text-secondary)" }}>
            Create your first watchlist to start tracking what to watch.
          </p>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
            style={{ backgroundColor: "var(--accent-primary)" }}
          >
            <Plus size={16} />
            Create Watchlist
          </button>
        </div>
      )}

      {/* Favorites */}
      {favorites.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide" style={{ color: "var(--text-secondary)" }}>
            <Star size={14} />
            Favorites
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {favorites.map((wl) => (
              <WatchListCard
                key={wl.id}
                watchlist={wl}
                onToggleFavorite={() => toggleFavorite.mutate({ id: wl.id, isFavorite: wl.is_favorite })}
              />
            ))}
          </div>
        </section>
      )}

      {/* All lists */}
      {others.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide" style={{ color: "var(--text-secondary)" }}>
            All Lists
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {others.map((wl) => (
              <WatchListCard
                key={wl.id}
                watchlist={wl}
                onToggleFavorite={() => toggleFavorite.mutate({ id: wl.id, isFavorite: wl.is_favorite })}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function WatchListCard({
  watchlist,
  onToggleFavorite,
}: {
  watchlist: WatchList;
  onToggleFavorite: () => void;
}) {
  return (
    <div
      className="group relative rounded-xl border p-5 transition-all hover:shadow-lg"
      style={{
        backgroundColor: "var(--bg-secondary)",
        borderColor: "var(--border)",
      }}
    >
      <button
        onClick={(e) => {
          e.preventDefault();
          onToggleFavorite();
        }}
        className="absolute right-4 top-4 transition-opacity hover:opacity-80"
        style={{ color: watchlist.is_favorite ? "var(--accent-primary)" : "var(--text-secondary)" }}
      >
        {watchlist.is_favorite ? <Star size={18} fill="currentColor" /> : <StarOff size={18} />}
      </button>

      <Link to={`/watchlists/${watchlist.id}`}>
        <div className="flex items-center gap-2 mb-2">
          {watchlist.is_rewatch && (
            <RefreshCw size={14} style={{ color: "var(--accent-secondary)" }} aria-label="Re-watch list" />
          )}
          <h3 className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>
            {watchlist.name}
          </h3>
        </div>
        {watchlist.description && (
          <p className="mb-3 text-sm line-clamp-2" style={{ color: "var(--text-secondary)" }}>
            {watchlist.description}
          </p>
        )}
        <div className="flex items-center justify-between text-xs" style={{ color: "var(--text-secondary)" }}>
          <span>{watchlist.item_count} items</span>
          <span className="rounded-full border px-2 py-0.5" style={{ borderColor: "var(--border)" }}>
            {watchlist.role}
          </span>
        </div>
      </Link>
    </div>
  );
}
