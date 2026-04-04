/* Watchr shared TypeScript types. */

export interface User {
  id: string;
  username: string;
  email: string;
  display_name: string;
  theme_preference: "dark" | "light";
  created_at: string;
}

export interface WatchList {
  id: string;
  name: string;
  description: string | null;
  is_rewatch: boolean;
  created_at: string;
  updated_at: string;
  role: "owner" | "manager" | "viewer" | null;
  is_favorite: boolean;
  item_count: number;
}

export interface WatchItem {
  id: string;
  watchlist_id: string;
  tmdb_id: number;
  media_type: "movie" | "tv";
  title: string;
  poster_path: string | null;
  overview: string | null;
  release_year: number | null;
  added_by: string;
  sort_order: number;
  created_at: string;
  last_watched: string | null;
  watch_count: number;
  currently_watching: boolean;
  active_record_id: string | null;
  rating: number | null;
  rated_by: string | null;
}

export interface WatchRecord {
  id: string;
  watch_item_id: string;
  user_id: string;
  start_date: string | null;
  end_date: string | null;
  notes: string | null;
  created_at: string;
}

export interface WatchListAccess {
  id: string;
  watchlist_id: string;
  user_id: string;
  role: "owner" | "manager" | "viewer";
  user_display_name: string | null;
  created_at: string;
}

export interface Recommendation {
  watchlist_id: string;
  watchlist_name: string;
  items: WatchItem[];
}

export interface Token {
  access_token: string;
  token_type: string;
}

export interface TMDBSearchResult {
  id: number;
  media_type: "movie" | "tv";
  title?: string;
  name?: string;
  poster_path: string | null;
  poster_url: string | null;
  overview: string;
  release_date?: string;
  first_air_date?: string;
}

export interface TMDBSearchResponse {
  page: number;
  total_pages: number;
  total_results: number;
  results: TMDBSearchResult[];
}
