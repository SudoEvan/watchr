import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Film, Tv, LayoutGrid } from "lucide-react";
import StarRating from "../components/StarRating";
import client from "../api/client";
import type { WatchHistoryItem } from "../types";

type MediaFilter = "all" | "movie" | "tv";

export default function WatchHistory() {
  const [filter, setFilter] = useState<MediaFilter>("all");

  const { data: items = [], isLoading } = useQuery<WatchHistoryItem[]>({
    queryKey: ["watch-history", filter],
    queryFn: async () => {
      const params = filter !== "all" ? `?media_type=${filter}` : "";
      return (await client.get(`/users/me/history${params}`)).data;
    },
  });

  const filterButtons: { value: MediaFilter; label: string; icon: React.ReactNode }[] = [
    { value: "all", label: "All", icon: <LayoutGrid size={14} /> },
    { value: "movie", label: "Movies", icon: <Film size={14} /> },
    { value: "tv", label: "TV Shows", icon: <Tv size={14} /> },
  ];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20" style={{ color: "var(--text-secondary)" }}>
        Loading...
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>
          Watch History
        </h1>
        <div className="flex gap-1 rounded-lg border p-1" style={{ borderColor: "var(--border)" }}>
          {filterButtons.map((fb) => (
            <button
              key={fb.value}
              onClick={() => setFilter(fb.value)}
              className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors"
              style={{
                backgroundColor: filter === fb.value ? "var(--accent-primary)" : "transparent",
                color: filter === fb.value ? "#fff" : "var(--text-secondary)",
              }}
            >
              {fb.icon}
              {fb.label}
            </button>
          ))}
        </div>
      </div>

      {items.length === 0 ? (
        <div
          className="flex flex-col items-center justify-center rounded-xl border py-20"
          style={{ backgroundColor: "var(--bg-secondary)", borderColor: "var(--border)" }}
        >
          <Film size={48} style={{ color: "var(--text-secondary)" }} className="mb-4" />
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
            {filter === "all"
              ? "Nothing watched yet. Start watching something!"
              : `No ${filter === "movie" ? "movies" : "TV shows"} watched yet.`}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {items.map((item) => (
            <div
              key={item.tmdb_id}
              className="group relative overflow-hidden rounded-xl border transition-all hover:shadow-lg"
              style={{ backgroundColor: "var(--bg-secondary)", borderColor: "var(--border)" }}
            >
              {item.currently_watching && (
                <div
                  className="absolute left-1.5 top-1.5 z-10 rounded-full px-2 py-0.5 text-[10px] font-medium text-white"
                  style={{ backgroundColor: "var(--accent-secondary)" }}
                >
                  Watching
                </div>
              )}
              {item.poster_path ? (
                <img
                  src={`https://image.tmdb.org/t/p/w300${item.poster_path}`}
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
              <div className="p-2.5">
                <p
                  className="text-xs font-semibold line-clamp-2 leading-tight"
                  style={{ color: "var(--text-primary)" }}
                >
                  {item.title}
                </p>
                <div className="mt-1 flex items-center gap-2 text-[10px]" style={{ color: "var(--text-secondary)" }}>
                  <span>{item.media_type === "movie" ? "Movie" : "TV"}</span>
                  {item.release_year && <span>· {item.release_year}</span>}
                  {item.watch_count > 0 && (
                    <span>
                      · {item.watch_count}×
                    </span>
                  )}
                </div>
                {item.last_watched && (
                  <p className="mt-0.5 text-[10px]" style={{ color: "var(--text-secondary)" }}>
                    Last: {item.last_watched}
                  </p>
                )}
                {item.rating != null && item.rating > 0 && (
                  <div className="mt-1">
                    <StarRating value={item.rating} size={12} readonly />
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
