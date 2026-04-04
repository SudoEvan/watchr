# Watchr — Data Model

## Entity Relationship Diagram

```text
┌──────────┐       ┌──────────────────┐       ┌─────────────┐
│   User   │──1:N──│ WatchListAccess  │──N:1──│  WatchList   │
└──────────┘       └──────────────────┘       └──────┬───────┘
     │                                                │
     │  1:N  ┌──────────────────┐                    │ 1:N
     └───────│ WatchListFavorite│────────N:1──────────┘
             └──────────────────┘                    │
                                              ┌──────▼───────┐
                                              │  WatchItem    │
                                              └──────┬───────┘
                                                     │ 1:N
                                              ┌──────▼───────┐
                                              │ WatchRecord   │
                                              └──────────────┘
```

## Tables

### `users`

| Column             | Type         | Constraints               | Notes                        |
|--------------------|--------------|---------------------------|------------------------------|
| `id`               | UUID (str)   | PK                        | Generated server-side        |
| `username`         | VARCHAR(50)  | UNIQUE, NOT NULL          | Login identifier             |
| `email`            | VARCHAR(255) | UNIQUE, NOT NULL          |                              |
| `hashed_password`  | VARCHAR(255) | NOT NULL                  | bcrypt hash                  |
| `display_name`     | VARCHAR(100) | NOT NULL                  | Shown in UI                  |
| `theme_preference` | VARCHAR(10)  | NOT NULL, DEFAULT 'dark'  | 'dark' or 'light'           |
| `created_at`       | DATETIME     | NOT NULL                  | UTC timestamp                |
| `updated_at`       | DATETIME     | NOT NULL                  | UTC timestamp                |

### `watchlists`

| Column        | Type         | Constraints               | Notes                                      |
|---------------|--------------|---------------------------|--------------------------------------------|
| `id`          | UUID (str)   | PK                        |                                            |
| `name`        | VARCHAR(200) | NOT NULL                  | List display name                          |
| `description` | TEXT         | NULLABLE                  |                                            |
| `is_rewatch`  | BOOLEAN      | NOT NULL, DEFAULT FALSE   | True = loop mode, False = archive mode     |
| `created_at`  | DATETIME     | NOT NULL                  |                                            |
| `updated_at`  | DATETIME     | NOT NULL                  |                                            |

### `watchlist_access`

Controls ownership and sharing. Every watchlist has at least one `owner` row.

| Column         | Type         | Constraints                     | Notes                          |
|----------------|--------------|---------------------------------|--------------------------------|
| `id`           | UUID (str)   | PK                              |                                |
| `watchlist_id` | UUID (str)   | FK → watchlists.id, NOT NULL    |                                |
| `user_id`      | UUID (str)   | FK → users.id, NOT NULL         |                                |
| `role`         | VARCHAR(20)  | NOT NULL                        | `owner`, `manager`, or `viewer`|
| `created_at`   | DATETIME     | NOT NULL                        |                                |

**Unique constraint**: `(watchlist_id, user_id)` — one role per user per list.

**Access rules**:

- `owner` — full control, can share, transfer ownership, delete list
- `manager` — add/remove items, mark watched, but cannot delete list or change sharing
- `viewer` — read-only access

### `watchlist_favorites`

| Column         | Type       | Constraints                   | Notes |
|----------------|------------|-------------------------------|-------|
| `id`           | UUID (str) | PK                            |       |
| `watchlist_id` | UUID (str) | FK → watchlists.id, NOT NULL  |       |
| `user_id`      | UUID (str) | FK → users.id, NOT NULL       |       |
| `created_at`   | DATETIME   | NOT NULL                      |       |

**Unique constraint**: `(watchlist_id, user_id)`.

### `watch_items`

Represents a movie or TV show added to a watchlist. Stores denormalized TMDB metadata for offline display.

| Column          | Type          | Constraints                   | Notes                              |
|-----------------|---------------|-------------------------------|------------------------------------|
| `id`            | UUID (str)    | PK                            |                                    |
| `watchlist_id`  | UUID (str)    | FK → watchlists.id, NOT NULL  |                                    |
| `tmdb_id`       | INTEGER       | NOT NULL                      | TMDB movie or TV show ID           |
| `media_type`    | VARCHAR(10)   | NOT NULL                      | `movie` or `tv`                    |
| `title`         | VARCHAR(500)  | NOT NULL                      | Denormalized from TMDB             |
| `poster_path`   | VARCHAR(500)  | NULLABLE                      | TMDB poster image path             |
| `overview`      | TEXT          | NULLABLE                      | Short synopsis                     |
| `release_year`  | INTEGER       | NULLABLE                      |                                    |
| `added_by`      | UUID (str)    | FK → users.id, NOT NULL       | Who added the item                 |
| `sort_order`    | INTEGER       | NOT NULL, DEFAULT 0           | Manual ordering within the list    |
| `created_at`    | DATETIME      | NOT NULL                      |                                    |

**Unique constraint**: `(watchlist_id, tmdb_id)` — no duplicate entries per list.

### `watch_records`

Each time a user watches (or re-watches) an item, a record is created.

| Column         | Type       | Constraints                    | Notes                        |
|----------------|------------|--------------------------------|------------------------------|
| `id`           | UUID (str) | PK                             |                              |
| `watch_item_id`| UUID (str) | FK → watch_items.id, NOT NULL  |                              |
| `user_id`      | UUID (str) | FK → users.id, NOT NULL        | Who watched it               |
| `start_date`   | DATE       | NULLABLE                       | When they started watching   |
| `end_date`     | DATE       | NULLABLE                       | When they finished           |
| `notes`        | TEXT       | NULLABLE                       | Optional per-watch notes     |
| `created_at`   | DATETIME   | NOT NULL                       |                              |

## Behavioral Rules

### Re-watch Lists (`is_rewatch = True`)

When a watch record with an `end_date` is created for an item:

- The item **stays** in the active list.
- Sorting: items are ordered by `latest watch_record.end_date ASC` (least recently watched first).
- Items never watched float to the top.

### Standard Lists (`is_rewatch = False`)

When a watch record with an `end_date` is created for an item:

- The item moves to the **"Watched"** view (a filtered view, not a separate list).
- The "Watched" view shows items sorted by `end_date DESC` (most recently watched first).
- The active view shows only unwatched items.

### Naive Recommendations

The `/api/v1/recommend` endpoint returns the **top 3 items per list** using this logic:

```text
For each watchlist the user has access to:
  1. Filter to items with no end_date (unwatched) OR (if is_rewatch) all items.
  2. Sort by latest watch_record.end_date ASC NULLS FIRST.
  3. Take the top 3.
```

This gives a "you haven't watched these in the longest time" recommendation without any ML.

### Ownership Transfer

```text
POST /api/v1/watchlists/{id}/transfer
Body: { "new_owner_id": "..." }
```

- Only the current `owner` can transfer.
- The old owner becomes a `manager` (not removed).
- The new user becomes the `owner`.
