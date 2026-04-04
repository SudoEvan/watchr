import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Plus, Search, Eye, EyeOff, Trash2, Play, Square, Check, Settings, LayoutGrid, List } from "lucide-react";
import WatchlistSettings from "../components/WatchlistSettings";
import RatingModal from "../components/RatingModal";
import StarRating from "../components/StarRating";
import client from "../api/client";
import type { WatchList, WatchItem, TMDBSearchResponse, TMDBSearchResult } from "../types";

const DESC_LIMIT = 120;

function ListViewItem({
  item,
  watchlistId,
  canEdit,
  showWatched,
  isRewatch,
  onMarkWatched,
  onStartWatching,
  onStopWatching,
  onRemove,
  isPending,
}: {
  item: WatchItem;
  watchlistId: string;
  canEdit: boolean;
  showWatched: boolean;
  isRewatch: boolean;
  onMarkWatched: () => void;
  onStartWatching: () => void;
  onStopWatching: () => void;
  onRemove: () => void;
  isPending: { markWatched: boolean; startWatching: boolean; stopWatching: boolean };
}) {
  const [expanded, setExpanded] = useState(false);
  const overview = item.overview ?? "";
  const isLong = overview.length > DESC_LIMIT;
  const displayText = expanded || !isLong ? overview : overview.slice(0, DESC_LIMIT) + "...";

  return (
    <div
      className="group flex gap-4 rounded-xl border p-3 transition-all hover:shadow-md"
      style={{ backgroundColor: "var(--bg-secondary)", borderColor: "var(--border)" }}
    >
      <Link to={`/watchlists/${watchlistId}/items/${item.id}`} className="flex-shrink-0">
        {item.poster_path ? (
          <img
            src={`https://image.tmdb.org/t/p/w200${item.poster_path}`}
            alt={item.title}
            className="h-20 w-14 rounded-lg object-cover"
          />
        ) : (
          <div
            className="flex h-20 w-14 items-center justify-center rounded-lg"
            style={{ backgroundColor: "var(--bg-surface)" }}
          >
            <span className="text-xl" style={{ color: "var(--text-secondary)" }}>?</span>
          </div>
        )}
      </Link>
      <div className="flex flex-1 flex-col justify-center gap-1">
        <div className="flex items-start justify-between">
          <div>
            <Link
              to={`/watchlists/${watchlistId}/items/${item.id}`}
              className="text-sm font-semibold transition-opacity hover:opacity-80"
              style={{ color: "var(--text-primary)" }}
            >
              {item.title}
            </Link>
            <div className="mt-0.5 flex items-center gap-2 text-xs" style={{ color: "var(--text-secondary)" }}>
              <span>
                {item.media_type === "movie" ? "Movie" : "TV"}
                {item.release_year ? ` · ${item.release_year}` : ""}
              </span>
              {item.currently_watching && (
                <span
                  className="rounded-full px-2 py-0.5 text-xs font-medium text-white"
                  style={{ backgroundColor: "var(--accent-secondary)" }}
                >
                  Watching
                </span>
              )}
              {item.last_watched && <span>Watched {item.last_watched}</span>}
              {item.rating != null && <StarRating value={item.rating} readonly size={12} />}
            </div>
          </div>
          <div className="flex flex-shrink-0 items-center gap-2">
            {(!showWatched || isRewatch) && canEdit && (
              <>
                {item.media_type === "movie" ? (
                  <button
                    onClick={onMarkWatched}
                    disabled={isPending.markWatched}
                    className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-opacity hover:opacity-80"
                    style={{ borderColor: "var(--border)", color: "var(--accent-primary)" }}
                  >
                    <Check size={12} />
                    Watched
                  </button>
                ) : item.currently_watching ? (
                  <button
                    onClick={onStopWatching}
                    disabled={isPending.stopWatching}
                    className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-opacity hover:opacity-80"
                    style={{ borderColor: "var(--accent-secondary)", color: "var(--accent-secondary)" }}
                  >
                    <Square size={12} />
                    Stop
                  </button>
                ) : (
                  <button
                    onClick={onStartWatching}
                    disabled={isPending.startWatching}
                    className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-opacity hover:opacity-80"
                    style={{ borderColor: "var(--border)", color: "var(--accent-primary)" }}
                  >
                    <Play size={12} />
                    Start
                  </button>
                )}
              </>
            )}
            {canEdit && (
              <button
                onClick={onRemove}
                className="rounded p-1.5 opacity-0 transition-opacity group-hover:opacity-100"
                style={{ color: "var(--text-secondary)" }}
              >
                <Trash2 size={14} />
              </button>
            )}
          </div>
        </div>
        {overview && (
          <p className="text-xs leading-relaxed" style={{ color: "var(--text-secondary)" }}>
            {displayText}
            {isLong && (
              <button
                onClick={() => setExpanded(!expanded)}
                className="ml-1 font-medium"
                style={{ color: "var(--accent-secondary)" }}
              >
                {expanded ? "Show less" : "Show more"}
              </button>
            )}
          </p>
        )}
      </div>
    </div>
  );
}

export default function WatchlistDetail() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<TMDBSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [showWatched, setShowWatched] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [ratingItemId, setRatingItemId] = useState<string | null>(null);

  const { data: watchlist } = useQuery<WatchList>({
    queryKey: ["watchlist", id],
    queryFn: async () => (await client.get(`/watchlists/${id}`)).data,
  });

  const isRewatch = watchlist?.is_rewatch ?? false;

  const { data: items = [], isLoading } = useQuery<WatchItem[]>({
    queryKey: ["watchlist-items", id, showWatched, isRewatch],
    queryFn: async () => {
      const params = isRewatch ? {} : showWatched ? { watched: true } : { watched: false };
      return (await client.get(`/watchlists/${id}/items`, { params })).data;
    },
  });

  const addItem = useMutation({
    mutationFn: async (result: TMDBSearchResult) => {
      return (
        await client.post(`/watchlists/${id}/items`, {
          tmdb_id: result.id,
          media_type: result.media_type,
          title: result.title ?? result.name ?? "Unknown",
          poster_path: result.poster_path,
          overview: result.overview,
          release_year: result.release_date
            ? parseInt(result.release_date.slice(0, 4))
            : result.first_air_date
              ? parseInt(result.first_air_date.slice(0, 4))
              : null,
        })
      ).data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["watchlist-items", id] });
      queryClient.invalidateQueries({ queryKey: ["watchlist", id] });
      setShowSearch(false);
      setSearchQuery("");
      setSearchResults([]);
    },
  });

  const removeItem = useMutation({
    mutationFn: async (itemId: string) => {
      await client.delete(`/watchlists/${id}/items/${itemId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["watchlist-items", id] });
      queryClient.invalidateQueries({ queryKey: ["watchlist", id] });
    },
  });

  const markWatched = useMutation({
    mutationFn: async (itemId: string) => {
      const today = new Date().toISOString().slice(0, 10);
      return (
        await client.post(`/watchlists/${id}/items/${itemId}/records`, {
          start_date: today,
          end_date: today,
        })
      ).data;
    },
    onSuccess: (_data, itemId) => {
      const item = items.find((i) => i.id === itemId);
      if (item && item.watch_count === 0 && !item.rating) {
        setRatingItemId(itemId);
      }
      queryClient.invalidateQueries({ queryKey: ["watchlist-items", id] });
    },
  });

  const startWatching = useMutation({
    mutationFn: async (itemId: string) => {
      const today = new Date().toISOString().slice(0, 10);
      return (
        await client.post(`/watchlists/${id}/items/${itemId}/records`, {
          start_date: today,
        })
      ).data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["watchlist-items", id] });
    },
  });

  const stopWatching = useMutation({
    mutationFn: async ({ itemId, recordId }: { itemId: string; recordId: string }) => {
      const today = new Date().toISOString().slice(0, 10);
      return (
        await client.patch(`/watchlists/${id}/items/${itemId}/records/${recordId}`, {
          end_date: today,
        })
      ).data;
    },
    onSuccess: (_data, { itemId }) => {
      const item = items.find((i) => i.id === itemId);
      if (item && item.watch_count === 0 && !item.rating) {
        setRatingItemId(itemId);
      }
      queryClient.invalidateQueries({ queryKey: ["watchlist-items", id] });
    },
  });

  const submitRating = useMutation({
    mutationFn: async ({ itemId, rating }: { itemId: string; rating: number }) => {
      return (await client.patch(`/watchlists/${id}/items/${itemId}/rating`, { rating })).data;
    },
    onSuccess: () => {
      setRatingItemId(null);
      queryClient.invalidateQueries({ queryKey: ["watchlist-items", id] });
    },
  });

  const ratingItem = ratingItemId ? items.find((i) => i.id === ratingItemId) : null;

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    try {
      const resp = await client.get<TMDBSearchResponse>("/search", {
        params: { q: searchQuery },
      });
      setSearchResults(resp.data.results);
    } finally {
      setSearching(false);
    }
  };

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <Link
          to="/"
          className="mb-3 inline-flex items-center gap-1 text-sm transition-opacity hover:opacity-80"
          style={{ color: "var(--accent-secondary)" }}
        >
          <ArrowLeft size={14} />
          Back to lists
        </Link>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>
              {watchlist?.name ?? "Loading..."}
            </h1>
            {watchlist?.description && (
              <p className="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>
                {watchlist.description}
              </p>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setViewMode(viewMode === "grid" ? "list" : "grid")}
              className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-opacity hover:opacity-80"
              style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
            >
              {viewMode === "grid" ? <List size={14} /> : <LayoutGrid size={14} />}
            </button>
            {!isRewatch && (
              <button
                onClick={() => setShowWatched(!showWatched)}
                className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-opacity hover:opacity-80"
                style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
              >
                {showWatched ? <EyeOff size={14} /> : <Eye size={14} />}
                {showWatched ? "Show Unwatched" : "Show Watched"}
              </button>
            )}
            {(watchlist?.role === "owner" || watchlist?.role === "manager") && (
              <>
                <button
                  onClick={() => setShowSettings(true)}
                  className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-opacity hover:opacity-80"
                  style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
                >
                  <Settings size={14} />
                </button>
                <button
                  onClick={() => setShowSearch(!showSearch)}
                  className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
                  style={{ backgroundColor: "var(--accent-primary)" }}
                >
                  <Plus size={14} />
                  Add
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* TMDB Search */}
      {showSearch && (
        <div
          className="mb-6 rounded-xl border p-4"
          style={{ backgroundColor: "var(--bg-secondary)", borderColor: "var(--border)" }}
        >
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Search movies & TV shows..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              className="flex-1 rounded-lg border px-3 py-2 text-sm outline-none"
              style={{
                backgroundColor: "var(--bg-surface)",
                borderColor: "var(--border)",
                color: "var(--text-primary)",
              }}
            />
            <button
              onClick={handleSearch}
              disabled={searching}
              className="rounded-lg px-4 py-2 text-sm text-white"
              style={{ backgroundColor: "var(--accent-secondary)" }}
            >
              <Search size={14} />
            </button>
          </div>
          {searchResults.length > 0 && (
            <div className="mt-3 grid gap-2">
              {searchResults.slice(0, 8).map((result) => (
                <div
                  key={`${result.media_type}-${result.id}`}
                  className="flex items-center justify-between rounded-lg border p-3"
                  style={{ borderColor: "var(--border)" }}
                >
                  <div className="flex items-center gap-3">
                    {result.poster_url ? (
                      <img src={result.poster_url} alt="" className="h-12 w-8 rounded object-cover" />
                    ) : (
                      <div className="flex h-12 w-8 items-center justify-center rounded" style={{ backgroundColor: "var(--bg-surface)" }}>
                        <Search size={12} style={{ color: "var(--text-secondary)" }} />
                      </div>
                    )}
                    <div>
                      <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                        {result.title ?? result.name}
                      </p>
                      <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
                        {result.media_type === "movie" ? "Movie" : "TV"} &middot;{" "}
                        {(result.release_date ?? result.first_air_date ?? "").slice(0, 4)}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => addItem.mutate(result)}
                    disabled={addItem.isPending}
                    className="rounded-lg px-3 py-1 text-xs font-medium text-white"
                    style={{ backgroundColor: "var(--accent-primary)" }}
                  >
                    Add
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Items list */}
      {isLoading ? (
        <div className="py-10 text-center" style={{ color: "var(--text-secondary)" }}>
          Loading items...
        </div>
      ) : items.length === 0 ? (
        <div
          className="flex flex-col items-center justify-center rounded-xl border py-16"
          style={{ backgroundColor: "var(--bg-secondary)", borderColor: "var(--border)" }}
        >
          <p className="mb-2 text-base font-medium" style={{ color: "var(--text-primary)" }}>
            {showWatched ? "No watched items yet" : "No items in this list"}
          </p>
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
            {showWatched ? "Mark items as watched to see them here." : "Search and add movies or TV shows above."}
          </p>
        </div>
      ) : (
        <>
          {/* Grid view */}
          {viewMode === "grid" ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {items.map((item) => {
                const canEdit = watchlist?.role === "owner" || watchlist?.role === "manager";
                return (
                  <div
                    key={item.id}
                    className="group relative overflow-hidden rounded-xl border transition-all hover:shadow-lg"
                    style={{ backgroundColor: "var(--bg-secondary)", borderColor: "var(--border)" }}
                  >
                    {canEdit && (
                      <button
                        onClick={() => {
                          if (window.confirm(`Remove "${item.title}" from this list?`)) {
                            removeItem.mutate(item.id);
                          }
                        }}
                        className="absolute right-2 top-2 z-10 rounded-full p-1.5 opacity-0 transition-opacity group-hover:opacity-100"
                        style={{ backgroundColor: "rgba(0,0,0,0.6)", color: "#fff" }}
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                    {item.currently_watching && (
                      <div
                        className="absolute left-2 top-2 z-10 rounded-full px-2 py-0.5 text-xs font-medium text-white"
                        style={{ backgroundColor: "var(--accent-secondary)" }}
                      >
                        Watching
                      </div>
                    )}
                    <Link to={`/watchlists/${id}/items/${item.id}`}>
                      {item.poster_path ? (
                        <img
                          src={`https://image.tmdb.org/t/p/w500${item.poster_path}`}
                          alt={item.title}
                          className="aspect-[2/3] w-full object-cover"
                        />
                      ) : (
                        <div
                          className="flex aspect-[2/3] w-full items-center justify-center"
                          style={{ backgroundColor: "var(--bg-surface)" }}
                        >
                          <span className="text-4xl" style={{ color: "var(--text-secondary)" }}>?</span>
                        </div>
                      )}
                    </Link>
                    <div className="p-3">
                      <h3 className="text-sm font-semibold line-clamp-1" style={{ color: "var(--text-primary)" }}>
                        {item.title}
                      </h3>
                      <div className="mt-1 flex items-center justify-between text-xs" style={{ color: "var(--text-secondary)" }}>
                        <span>
                          {item.media_type === "movie" ? "Movie" : "TV"}
                          {item.release_year ? ` · ${item.release_year}` : ""}
                        </span>
                        {item.last_watched && <span>Watched {item.last_watched}</span>}
                      </div>
                      {item.rating != null && (
                        <div className="mt-1">
                          <StarRating value={item.rating} readonly size={14} />
                        </div>
                      )}
                      {(!showWatched || isRewatch) && canEdit && (
                        <div className="mt-2">
                          {item.media_type === "movie" ? (
                            <button
                              onClick={() => markWatched.mutate(item.id)}
                              disabled={markWatched.isPending}
                              className="flex w-full items-center justify-center gap-1.5 rounded-lg border py-1.5 text-xs font-medium transition-opacity hover:opacity-80"
                              style={{ borderColor: "var(--border)", color: "var(--accent-primary)" }}
                            >
                              <Check size={12} />
                              Mark Watched
                            </button>
                          ) : item.currently_watching ? (
                            <button
                              onClick={() =>
                                item.active_record_id &&
                                stopWatching.mutate({ itemId: item.id, recordId: item.active_record_id })
                              }
                              disabled={stopWatching.isPending}
                              className="flex w-full items-center justify-center gap-1.5 rounded-lg border py-1.5 text-xs font-medium transition-opacity hover:opacity-80"
                              style={{ borderColor: "var(--accent-secondary)", color: "var(--accent-secondary)" }}
                            >
                              <Square size={12} />
                              Stop Watching
                            </button>
                          ) : (
                            <button
                              onClick={() => startWatching.mutate(item.id)}
                              disabled={startWatching.isPending}
                              className="flex w-full items-center justify-center gap-1.5 rounded-lg border py-1.5 text-xs font-medium transition-opacity hover:opacity-80"
                              style={{ borderColor: "var(--border)", color: "var(--accent-primary)" }}
                            >
                              <Play size={12} />
                              Start Watching
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* List view */
            <div className="flex flex-col gap-2">
              {items.map((item) => {
                const canEdit = watchlist?.role === "owner" || watchlist?.role === "manager";
                return (
                  <ListViewItem
                    key={item.id}
                    item={item}
                    watchlistId={id!}
                    canEdit={canEdit}
                    showWatched={showWatched}
                    isRewatch={isRewatch}
                    onMarkWatched={() => markWatched.mutate(item.id)}
                    onStartWatching={() => startWatching.mutate(item.id)}
                    onStopWatching={() =>
                      item.active_record_id &&
                      stopWatching.mutate({ itemId: item.id, recordId: item.active_record_id })
                    }
                    onRemove={() => {
                      if (window.confirm(`Remove "${item.title}" from this list?`)) {
                        removeItem.mutate(item.id);
                      }
                    }}
                    isPending={{
                      markWatched: markWatched.isPending,
                      startWatching: startWatching.isPending,
                      stopWatching: stopWatching.isPending,
                    }}
                  />
                );
              })}
            </div>
          )}
        </>
      )}
      {/* Settings modal */}
      {showSettings && watchlist && (
        <WatchlistSettings watchlist={watchlist} onClose={() => setShowSettings(false)} />
      )}
      {/* Rating modal — shown on first watch */}
      {ratingItem && (
        <RatingModal
          title={ratingItem.title}
          onSubmit={(rating) => submitRating.mutate({ itemId: ratingItem.id, rating })}
          onSkip={() => setRatingItemId(null)}
        />
      )}
    </div>
  );
}
