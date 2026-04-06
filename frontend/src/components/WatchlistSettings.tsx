import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { X, UserPlus, Trash2, RefreshCw } from "lucide-react";
import ConfirmModal from "./ConfirmModal";
import client from "../api/client";
import type { WatchList, WatchListAccess, User } from "../types";

interface Props {
  watchlist: WatchList;
  onClose: () => void;
}

export default function WatchlistSettings({ watchlist, onClose }: Props) {
  const queryClient = useQueryClient();
  const [name, setName] = useState(watchlist.name);
  const [description, setDescription] = useState(watchlist.description ?? "");
  const [isRewatch, setIsRewatch] = useState(watchlist.is_rewatch);
  const [shareQuery, setShareQuery] = useState("");
  const [userResults, setUserResults] = useState<User[]>([]);
  const [searching, setSearching] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [confirmRevokeUserId, setConfirmRevokeUserId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    const changed =
      name !== watchlist.name ||
      description !== (watchlist.description ?? "") ||
      isRewatch !== watchlist.is_rewatch;
    setDirty(changed);
  }, [name, description, isRewatch, watchlist]);

  const { data: accessList = [] } = useQuery<WatchListAccess[]>({
    queryKey: ["watchlist-access", watchlist.id],
    queryFn: async () => (await client.get(`/watchlists/${watchlist.id}/access`)).data,
  });

  const updateWatchlist = useMutation({
    mutationFn: async () => {
      return (
        await client.patch(`/watchlists/${watchlist.id}`, {
          name: name.trim(),
          description: description.trim() || null,
          is_rewatch: isRewatch,
        })
      ).data;
    },
    onSuccess: () => {
      setDirty(false);
      queryClient.invalidateQueries({ queryKey: ["watchlist", watchlist.id] });
      queryClient.invalidateQueries({ queryKey: ["watchlists"] });
    },
  });

  const shareWith = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: string }) => {
      return (
        await client.post(`/watchlists/${watchlist.id}/access`, {
          user_id: userId,
          role,
        })
      ).data;
    },
    onSuccess: () => {
      setShareQuery("");
      setUserResults([]);
      queryClient.invalidateQueries({ queryKey: ["watchlist-access", watchlist.id] });
    },
  });

  const revokeAccess = useMutation({
    mutationFn: async (userId: string) => {
      await client.delete(`/watchlists/${watchlist.id}/access/${userId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["watchlist-access", watchlist.id] });
    },
  });

  const deleteWatchlist = useMutation({
    mutationFn: async () => {
      await client.delete(`/watchlists/${watchlist.id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["watchlists"] });
      onClose();
      window.location.href = "/";
    },
  });

  const searchUsers = async () => {
    if (!shareQuery.trim()) return;
    setSearching(true);
    try {
      const resp = await client.get<User[]>("/users/search", {
        params: { q: shareQuery },
      });
      setUserResults(resp.data);
    } finally {
      setSearching(false);
    }
  };

  const isOwner = watchlist.role === "owner";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="w-full max-w-lg overflow-hidden rounded-2xl border shadow-2xl"
        style={{ backgroundColor: "var(--bg-primary)", borderColor: "var(--border)" }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between border-b px-6 py-4"
          style={{ borderColor: "var(--border)" }}
        >
          <h2 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
            List Settings
          </h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 transition-opacity hover:opacity-70"
            style={{ color: "var(--text-secondary)" }}
          >
            <X size={18} />
          </button>
        </div>

        <div className="max-h-[70vh] overflow-y-auto px-6 py-4">
          {/* Edit section */}
          <section className="mb-6">
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide" style={{ color: "var(--text-secondary)" }}>
              Details
            </h3>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
                  Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-lg border px-3 py-2 text-sm outline-none"
                  style={{
                    backgroundColor: "var(--bg-surface)",
                    borderColor: "var(--border)",
                    color: "var(--text-primary)",
                  }}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
                  Description
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                  className="w-full resize-none rounded-lg border px-3 py-2 text-sm outline-none"
                  style={{
                    backgroundColor: "var(--bg-surface)",
                    borderColor: "var(--border)",
                    color: "var(--text-primary)",
                  }}
                />
              </div>
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  checked={isRewatch}
                  onChange={(e) => setIsRewatch(e.target.checked)}
                  className="h-4 w-4 rounded"
                />
                <span className="text-sm" style={{ color: "var(--text-primary)" }}>
                  Re-watch list
                </span>
                <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
                  (allow re-watching items)
                </span>
              </label>
              {dirty && (
                <button
                  onClick={() => updateWatchlist.mutate()}
                  disabled={updateWatchlist.isPending || !name.trim()}
                  className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
                  style={{ backgroundColor: "var(--accent-primary)" }}
                >
                  {updateWatchlist.isPending && <RefreshCw size={12} className="animate-spin" />}
                  Save Changes
                </button>
              )}
            </div>
          </section>

          {/* Sharing section */}
          <section className="mb-6">
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide" style={{ color: "var(--text-secondary)" }}>
              Sharing
            </h3>

            {/* Current members */}
            <div className="mb-3 space-y-2">
              {accessList.map((access) => (
                <div
                  key={access.id}
                  className="flex items-center justify-between rounded-lg border px-3 py-2"
                  style={{ borderColor: "var(--border)" }}
                >
                  <div>
                    <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                      {access.user_display_name ?? access.user_id}
                    </span>
                    <span
                      className="ml-2 rounded-full px-2 py-0.5 text-xs font-medium"
                      style={{
                        backgroundColor: access.role === "owner" ? "var(--accent-primary)" : "var(--bg-surface)",
                        color: access.role === "owner" ? "#fff" : "var(--text-secondary)",
                      }}
                    >
                      {access.role}
                    </span>
                  </div>
                  {isOwner && access.role !== "owner" && (
                    <button
                      onClick={() => setConfirmRevokeUserId(access.user_id)}
                      className="rounded p-1 transition-opacity hover:opacity-70"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              ))}
            </div>

            {/* Add user */}
            {isOwner && (
              <div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Search by username..."
                    value={shareQuery}
                    onChange={(e) => setShareQuery(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && searchUsers()}
                    className="flex-1 rounded-lg border px-3 py-2 text-sm outline-none"
                    style={{
                      backgroundColor: "var(--bg-surface)",
                      borderColor: "var(--border)",
                      color: "var(--text-primary)",
                    }}
                  />
                  <button
                    onClick={searchUsers}
                    disabled={searching}
                    className="rounded-lg px-3 py-2 text-sm text-white"
                    style={{ backgroundColor: "var(--accent-secondary)" }}
                  >
                    <UserPlus size={14} />
                  </button>
                </div>
                {userResults.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {userResults.map((user) => {
                      const alreadyShared = accessList.some((a) => a.user_id === user.id);
                      return (
                        <div
                          key={user.id}
                          className="flex items-center justify-between rounded-lg border px-3 py-2"
                          style={{ borderColor: "var(--border)" }}
                        >
                          <div>
                            <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                              {user.display_name}
                            </span>
                            <span className="ml-1 text-xs" style={{ color: "var(--text-secondary)" }}>
                              @{user.username}
                            </span>
                          </div>
                          {alreadyShared ? (
                            <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
                              Already shared
                            </span>
                          ) : (
                            <div className="flex gap-1">
                              <button
                                onClick={() => shareWith.mutate({ userId: user.id, role: "viewer" })}
                                disabled={shareWith.isPending}
                                className="rounded-lg border px-2 py-1 text-xs font-medium transition-opacity hover:opacity-80"
                                style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
                              >
                                Viewer
                              </button>
                              <button
                                onClick={() => shareWith.mutate({ userId: user.id, role: "watcher" })}
                                disabled={shareWith.isPending}
                                className="rounded-lg border px-2 py-1 text-xs font-medium transition-opacity hover:opacity-80"
                                style={{ borderColor: "var(--accent-secondary)", color: "var(--accent-secondary)" }}
                              >
                                Watcher
                              </button>
                              <button
                                onClick={() => shareWith.mutate({ userId: user.id, role: "manager" })}
                                disabled={shareWith.isPending}
                                className="rounded-lg px-2 py-1 text-xs font-medium text-white transition-opacity hover:opacity-80"
                                style={{ backgroundColor: "var(--accent-primary)" }}
                              >
                                Manager
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </section>

          {/* Danger zone */}
          {isOwner && (
            <section>
              <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide" style={{ color: "#ef4444" }}>
                Danger Zone
              </h3>
              <button
                onClick={() => setConfirmDelete(true)}
                disabled={deleteWatchlist.isPending}
                className="rounded-lg border border-red-500 px-4 py-2 text-sm font-medium text-red-500 transition-opacity hover:opacity-80"
              >
                Delete Watchlist
              </button>
            </section>
          )}
        </div>
      </div>
      {confirmRevokeUserId && (
        <ConfirmModal
          title="Remove User"
          message={`Remove ${accessList.find((a) => a.user_id === confirmRevokeUserId)?.user_display_name ?? "this user"} from the list?`}
          confirmLabel="Remove"
          destructive
          onConfirm={() => {
            revokeAccess.mutate(confirmRevokeUserId);
            setConfirmRevokeUserId(null);
          }}
          onCancel={() => setConfirmRevokeUserId(null)}
        />
      )}
      {confirmDelete && (
        <ConfirmModal
          title="Delete Watchlist"
          message={`Permanently delete "${watchlist.name}"? This cannot be undone.`}
          confirmLabel="Delete"
          destructive
          onConfirm={() => {
            deleteWatchlist.mutate();
            setConfirmDelete(false);
          }}
          onCancel={() => setConfirmDelete(false)}
        />
      )}
    </div>
  );
}
