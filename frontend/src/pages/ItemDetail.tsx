import { useState, useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ChevronUp, ChevronDown, Pencil, Check, X, Trash2 } from "lucide-react";
import StarRating from "../components/StarRating";
import client from "../api/client";
import type { WatchItem, WatchRecord } from "../types";

type SortField = "end_date" | "start_date";
type SortDir = "asc" | "desc";

export default function ItemDetail() {
  const { watchlistId, itemId } = useParams<{ watchlistId: string; itemId: string }>();
  const queryClient = useQueryClient();
  const [sortField, setSortField] = useState<SortField>("end_date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editStart, setEditStart] = useState("");
  const [editEnd, setEditEnd] = useState("");

  const { data: items = [] } = useQuery<WatchItem[]>({
    queryKey: ["watchlist-items-all", watchlistId],
    queryFn: async () => (await client.get(`/watchlists/${watchlistId}/items`)).data,
  });

  const item = items.find((i) => i.id === itemId);

  const { data: records = [] } = useQuery<WatchRecord[]>({
    queryKey: ["watch-records", watchlistId, itemId],
    queryFn: async () =>
      (await client.get(`/watchlists/${watchlistId}/items/${itemId}/records`)).data,
    enabled: !!itemId,
  });

  const isMovie = item?.media_type === "movie";

  const updateRecord = useMutation({
    mutationFn: async ({ recordId, start_date, end_date }: { recordId: string; start_date: string | null; end_date: string | null }) => {
      const body: Record<string, string | null> = {};
      if (start_date !== null) body.start_date = start_date;
      if (end_date !== null) body.end_date = end_date;
      return (
        await client.patch(`/watchlists/${watchlistId}/items/${itemId}/records/${recordId}`, body)
      ).data;
    },
    onSuccess: () => {
      setEditingId(null);
      queryClient.invalidateQueries({ queryKey: ["watch-records", watchlistId, itemId] });
      queryClient.invalidateQueries({ queryKey: ["watchlist-items", watchlistId] });
      queryClient.invalidateQueries({ queryKey: ["watchlist-items-all", watchlistId] });
    },
  });

  const updateRating = useMutation({
    mutationFn: async (rating: number) => {
      return (await client.patch(`/watchlists/${watchlistId}/items/${itemId}/rating`, { rating })).data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["watchlist-items", watchlistId] });
      queryClient.invalidateQueries({ queryKey: ["watchlist-items-all", watchlistId] });
    },
  });

  const deleteRecord = useMutation({
    mutationFn: async (recordId: string) => {
      await client.delete(`/watchlists/${watchlistId}/items/${itemId}/records/${recordId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["watch-records", watchlistId, itemId] });
      queryClient.invalidateQueries({ queryKey: ["watchlist-items", watchlistId] });
      queryClient.invalidateQueries({ queryKey: ["watchlist-items-all", watchlistId] });
    },
  });

  const startEditing = (record: WatchRecord) => {
    setEditingId(record.id);
    setEditStart(record.start_date ?? "");
    setEditEnd(record.end_date ?? "");
  };

  const saveEdit = (recordId: string) => {
    updateRecord.mutate({
      recordId,
      start_date: isMovie ? null : editStart || null,
      end_date: editEnd || null,
    });
  };

  const sortedRecords = useMemo(() => {
    return [...records].sort((a, b) => {
      const aVal = a[sortField] ?? "";
      const bVal = b[sortField] ?? "";
      if (aVal < bVal) return sortDir === "asc" ? -1 : 1;
      if (aVal > bVal) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
  }, [records, sortField, sortDir]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("desc");
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null;
    return sortDir === "asc" ? <ChevronUp size={14} /> : <ChevronDown size={14} />;
  };

  const dateInputStyle = {
    backgroundColor: "var(--bg-surface)",
    borderColor: "var(--border)",
    color: "var(--text-primary)",
  };

  if (!item) {
    return (
      <div className="py-10 text-center" style={{ color: "var(--text-secondary)" }}>
        Loading...
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl">
      <Link
        to={`/watchlists/${watchlistId}`}
        className="mb-4 inline-flex items-center gap-1 text-sm transition-opacity hover:opacity-80"
        style={{ color: "var(--accent-secondary)" }}
      >
        <ArrowLeft size={14} />
        Back to list
      </Link>

      <div className="flex gap-6">
        {/* Poster */}
        {item.poster_path ? (
          <img
            src={`https://image.tmdb.org/t/p/w500${item.poster_path}`}
            alt={item.title}
            className="h-72 w-48 flex-shrink-0 rounded-xl object-cover"
          />
        ) : (
          <div
            className="flex h-72 w-48 flex-shrink-0 items-center justify-center rounded-xl"
            style={{ backgroundColor: "var(--bg-surface)" }}
          >
            <span className="text-5xl" style={{ color: "var(--text-secondary)" }}>?</span>
          </div>
        )}

        {/* Details */}
        <div className="flex-1">
          <h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>
            {item.title}
          </h1>
          <div className="mt-1 flex items-center gap-2 text-sm" style={{ color: "var(--text-secondary)" }}>
            <span className="rounded-full border px-2 py-0.5 text-xs" style={{ borderColor: "var(--border)" }}>
              {isMovie ? "Movie" : "TV Show"}
            </span>
            {item.release_year && <span>{item.release_year}</span>}
            <span>·</span>
            <span>Watched {item.watch_count}x</span>
            {item.currently_watching && (
              <span
                className="rounded-full px-2 py-0.5 text-xs font-medium text-white"
                style={{ backgroundColor: "var(--accent-secondary)" }}
              >
                Currently Watching
              </span>
            )}
          </div>

          {/* Rating */}
          <div className="mt-3">
            <span className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>Your Rating</span>
            <div className="mt-1">
              <StarRating
                value={item.rating ?? 0}
                onChange={(v) => updateRating.mutate(v)}
                size={22}
              />
            </div>
          </div>

          {item.overview && (
            <p className="mt-4 text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>
              {item.overview}
            </p>
          )}
        </div>
      </div>

      {/* Watch history table */}
      <div className="mt-8">
        <h2 className="mb-4 text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
          Watch History
        </h2>
        {records.length === 0 ? (
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
            No watch records yet.
          </p>
        ) : (
          <div
            className="overflow-hidden rounded-xl border"
            style={{ borderColor: "var(--border)" }}
          >
            <table className="w-full text-sm">
              <thead>
                <tr style={{ backgroundColor: "var(--bg-surface)" }}>
                  <th className="px-4 py-3 text-left font-medium" style={{ color: "var(--text-secondary)" }}>
                    #
                  </th>
                  {!isMovie && (
                    <th
                      className="cursor-pointer select-none px-4 py-3 text-left font-medium transition-opacity hover:opacity-80"
                      style={{ color: "var(--text-secondary)" }}
                      onClick={() => toggleSort("start_date")}
                    >
                      <span className="inline-flex items-center gap-1">
                        Started <SortIcon field="start_date" />
                      </span>
                    </th>
                  )}
                  <th
                    className="cursor-pointer select-none px-4 py-3 text-left font-medium transition-opacity hover:opacity-80"
                    style={{ color: "var(--text-secondary)" }}
                    onClick={() => toggleSort("end_date")}
                  >
                    <span className="inline-flex items-center gap-1">
                      {isMovie ? "Watched" : "Finished"} <SortIcon field="end_date" />
                    </span>
                  </th>
                  <th className="px-4 py-3 text-left font-medium" style={{ color: "var(--text-secondary)" }}>
                    Notes
                  </th>
                  <th className="w-16 px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {sortedRecords.map((record, idx) => {
                  const editing = editingId === record.id;
                  return (
                    <tr
                      key={record.id}
                      className="group border-t"
                      style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-secondary)" }}
                    >
                      <td className="px-4 py-3" style={{ color: "var(--text-secondary)" }}>
                        {idx + 1}
                      </td>
                      {!isMovie && (
                        <td className="px-4 py-3" style={{ color: "var(--text-primary)" }}>
                          {editing ? (
                            <input
                              type="date"
                              value={editStart}
                              onChange={(e) => setEditStart(e.target.value)}
                              className="rounded border px-2 py-1 text-xs outline-none"
                              style={dateInputStyle}
                            />
                          ) : (
                            record.start_date ?? "—"
                          )}
                        </td>
                      )}
                      <td className="px-4 py-3" style={{ color: "var(--text-primary)" }}>
                        {editing ? (
                          <input
                            type="date"
                            value={editEnd}
                            onChange={(e) => setEditEnd(e.target.value)}
                            className="rounded border px-2 py-1 text-xs outline-none"
                            style={dateInputStyle}
                          />
                        ) : record.end_date ? (
                          record.end_date
                        ) : (
                          <span
                            className="rounded-full px-2 py-0.5 text-xs font-medium text-white"
                            style={{ backgroundColor: "var(--accent-secondary)" }}
                          >
                            In Progress
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3" style={{ color: "var(--text-secondary)" }}>
                        {record.notes ?? "—"}
                      </td>
                      <td className="px-4 py-3">
                        {editing ? (
                          <div className="flex gap-1">
                            <button
                              onClick={() => saveEdit(record.id)}
                              disabled={updateRecord.isPending}
                              className="rounded p-1 transition-opacity hover:opacity-70"
                              style={{ color: "var(--accent-primary)" }}
                            >
                              <Check size={14} />
                            </button>
                            <button
                              onClick={() => setEditingId(null)}
                              className="rounded p-1 transition-opacity hover:opacity-70"
                              style={{ color: "var(--text-secondary)" }}
                            >
                              <X size={14} />
                            </button>
                          </div>
                        ) : (
                          <div className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                            <button
                              onClick={() => startEditing(record)}
                              className="rounded p-1 hover:opacity-70"
                              style={{ color: "var(--text-secondary)" }}
                            >
                              <Pencil size={14} />
                            </button>
                            <button
                              onClick={() => {
                                if (window.confirm("Remove this watch record?")) {
                                  deleteRecord.mutate(record.id);
                                }
                              }}
                              className="rounded p-1 hover:opacity-70"
                              style={{ color: "#ef4444" }}
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
