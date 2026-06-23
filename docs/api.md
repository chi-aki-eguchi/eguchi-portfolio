# API Endpoints

All endpoints are under `/api`. Responses are JSON unless otherwise noted.
Error responses use `{ error: string }`.

## Public

| Method | Path | Description |
| --- | --- | --- |
| GET | `/api/health` | Health check. Returns `{ status: "ok", build: string }` |
| GET | `/api/settings` | Site settings (theme, labels, feature flags) |
| GET | `/api/categories` | Published categories, sorted |
| GET | `/api/photos` | Published photos, sorted by gallerySortOrder setting |
| GET | `/api/photos?all=1` | All non-deleted photos (admin session required, otherwise same as above) |
| GET | `/api/hero-photos` | Hero carousel photos (published + non-deleted only) |
| GET | `/api/series` | Published series with cover URLs |
| GET | `/api/series/:slug` | Single published series + its photos |
| GET | `/api/pricing` | Published pricing plans |
| GET | `/api/note-posts` | note.com RSS posts (cached, when enabled) |
| GET | `/api/images/*` | Image proxy with optional resize (`?w=`, `?q=`) |

### Image proxy

`GET /api/images/:key?w=800&q=85`

- `w`: width in px (50-3200, omit for original)
- `q`: quality 10-100 (default 90)
- Format negotiation: set `IMAGE_FORMAT_NEGOTIATION=1` env to enable AVIF/WebP via Accept header
- Allowed key prefixes: `photos/`, `hero/`, `profile/`, `fonts/`
- Responses are cached with `Cache-Control: public, max-age=31536000, immutable`

## Auth

| Method | Path | Description |
| --- | --- | --- |
| POST | `/api/admin/login` | Login with `{ password }`. Sets httpOnly session cookie. Rate-limited: 10 attempts per IP per 15 min window |
| POST | `/api/admin/logout` | Clears session cookie |
| GET | `/api/admin/me` | Returns `{ authenticated: boolean }` |

## Admin (session required)

All admin endpoints require a valid session cookie (set by `/admin/login`).
Unauthorized requests receive `401 { error: "Unauthorized" }`.

### Settings

| Method | Path | Description |
| --- | --- | --- |
| POST | `/api/admin/settings` | Update settings. Body: `{ key: value, ... }`. Keys > 100 chars or values > 50KB are rejected (413) |

### Photos

| Method | Path | Description |
| --- | --- | --- |
| POST | `/api/admin/upload` | Upload image (multipart `file`). Returns `{ url, key, size, width, height, fileHash, shotAt, exifCamera, exifLens }`. Duplicates return `{ duplicate: true, fileHash }`. Max 60MB, image MIME only |
| POST | `/api/admin/photos` | Create photo record. Body: `{ filename, url, title?, meta?, category?, camera?, lens?, filmType?, width?, height?, fileHash?, shotAt? }` |
| PATCH | `/api/admin/photos/:id` | Update photo fields |
| DELETE | `/api/admin/photos/:id` | Soft-delete (move to trash) |
| POST | `/api/admin/photos/:id/restore` | Restore from trash |
| DELETE | `/api/admin/photos/:id/purge` | Permanent delete (removes from storage if no other reference) |
| POST | `/api/admin/photos/:id/duplicate` | Duplicate photo record (shares storage object) |
| GET | `/api/admin/photos/trash` | List trashed photos. Auto-purges items older than 30 days |
| POST | `/api/admin/photos/reorder` | Reorder photos. Body: `{ ids: number[] }` |
| POST | `/api/admin/photos/batch` | Batch operation. Body: `{ ids, operation, value? }`. Operations: publish, unpublish, category, camera, lens, filmType, size, series, feature, unfeature |

### Hero Photos

| Method | Path | Description |
| --- | --- | --- |
| GET | `/api/admin/hero-photos` | List hero photo assignments |
| POST | `/api/admin/hero-photos` | Add photo to hero. Body: `{ photoId }`. Idempotent |
| DELETE | `/api/admin/hero-photos/:id` | Remove photo from hero (by photoId) |
| POST | `/api/admin/hero-photos/cleanup` | Remove dangling references. Body: `{ photoIds }` |
| POST | `/api/admin/hero-photos/reorder` | Reorder hero photos. Body: `{ photoIds }` |

### Categories

| Method | Path | Description |
| --- | --- | --- |
| POST | `/api/admin/categories` | Create category. Body: `{ slug, label }` |
| DELETE | `/api/admin/categories/:id` | Delete category (reassigns photos to uncategorized) |
| POST | `/api/admin/categories/reorder` | Reorder. Body: `{ ids }` |

### Series

| Method | Path | Description |
| --- | --- | --- |
| GET | `/api/admin/series` | List all series (including drafts) |
| POST | `/api/admin/series` | Create series. Body: `{ slug, title?, subtitle?, statement?, coverPhotoId?, isPublished? }` |
| PATCH | `/api/admin/series/:id` | Update series fields |
| DELETE | `/api/admin/series/:id` | Delete series (detaches photos) |
| POST | `/api/admin/series/reorder` | Reorder. Body: `{ ids }` |

### Pricing

| Method | Path | Description |
| --- | --- | --- |
| GET | `/api/admin/pricing` | List all pricing plans |
| POST | `/api/admin/pricing` | Create plan. Body: `{ title?, price?, description?, features?, note?, isPublished? }` |
| PATCH | `/api/admin/pricing/:id` | Update plan |
| DELETE | `/api/admin/pricing/:id` | Delete plan |
| POST | `/api/admin/pricing/reorder` | Reorder. Body: `{ ids }` |

### Uploads

| Method | Path | Description |
| --- | --- | --- |
| POST | `/api/admin/upload` | Photo upload (see Photos above) |
| POST | `/api/admin/hero/upload` | Hero image upload. Same limits as photo upload |
| POST | `/api/admin/profile/upload` | Profile photo upload. Same limits |
| POST | `/api/admin/fonts/upload` | Custom font upload. Max 2MB, woff2/woff/ttf/otf only |

## Non-API Routes

These are served by `server.ts`, not Hono:

| Path | Description |
| --- | --- |
| `/sitemap.xml` | Dynamic XML sitemap with image entries |
| `/robots.txt` | Robots with sitemap reference |
| `/*` | SPA with server-side OGP injection |
