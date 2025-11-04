## htmldocs Local API Server

This Bun-powered service exposes your local `@templates` collection through an HTTP API compatible with the hosted [htmldocs](https://htmldocs.com) endpoints. It renders the React templates directly from disk using the HTMLDocs renderer and Playwright to emit PDFs.

### Prerequisites

-   Bun 1.3+
-   Playwright browsers (`bun run init` or `bun x playwright install` in the `htmldocs` package) – already installed in the workspace.

### Installation

```sh
bun install
```

### Configuration

| Variable                 | Default                              | Description                                                          |
| ------------------------ | ------------------------------------ | -------------------------------------------------------------------- |
| `PORT`                   | `4000`                               | HTTP port for the API server                                         |
| `HTMDOCS_TEMPLATES_ROOT` | `../templates`                       | Absolute/relative path to the templates repo containing `documents/` |
| `HTMDOCS_DOCUMENTS_DIR`  | `<HTMDOCS_TEMPLATES_ROOT>/documents` | Override documents directory                                         |
| `HTMDOCS_API_KEY`        | _unset_                              | If provided, requests must include `Authorization: <value>` header   |

### Running the server

```sh
bun run dev
# or
bun run start
```

### Docker

#### Prerequisites

-   Docker and Docker Compose installed
-   Templates directory available on your host machine

#### Building the Docker image

```sh
docker build -t htmldocs-server .
```

#### Running with Docker

```sh
docker run -p 4000:4000 \
  -v /path/to/your/templates:/templates:ro \
  -e HTMDOCS_API_KEY=your-secret-key \
  htmldocs-server
```

Replace `/path/to/your/templates` with the absolute path to your templates directory on the host machine.

#### Using Docker Compose

The easiest way to run the server is using Docker Compose:

```sh
docker compose up
```

This will:

-   Build the image (if needed)
-   Mount the `../templates` directory as a read-only volume
-   Start the server on port 4000

You can customize the setup by editing `docker-compose.yml`:

-   Change the templates path in the `volumes` section
-   Set environment variables like `HTMDOCS_API_KEY`
-   Adjust the port mapping

#### Docker Configuration

The Docker image:

-   Uses Bun 1.3 as the base image
-   Includes all Playwright dependencies and Chromium browser
-   Mounts templates as a read-only volume at `/templates`
-   Defaults to port 4000 (configurable via `PORT` env var)

Templates are mounted as a volume, so changes to your templates on the host are immediately available without rebuilding the image.

### API

#### Generate Document PDF

```
POST /api/documents/:documentId
Content-Type: application/json
Authorization: <HTMDOCS_API_KEY> (optional)

{
  "props": { ... },
  "format": "pdf" | "base64" | "json",
  "size": "A4" | "8.5in 11in" | ...,
  "orientation": "portrait" | "landscape"
}
```

Example with defaults:

```sh
curl -X POST http://localhost:4000/api/documents/invoice \
  -H 'Content-Type: application/json' \
  -d '{
        "props": {
          "billedTo": {"name": "ACME", "address": "1 Main", "city": "NYC", "state": "NY", "zip": "10001", "phone": "555-0100"},
          "yourCompany": {"name": "You", "address": "99 Market", "city": "SF", "state": "CA", "zip": "94107", "taxId": "123", "phone": "555-9000", "email": "hello@example.com"},
          "services": [{"name": "Consulting", "quantity": 10, "rate": 200}]
        }
      }' \
  --output invoice.pdf
```

When `format` is `base64`, the response returns a JSON payload with the Base64-encoded PDF. With `format=json`, the response returns a temporary download URL (`/api/downloads/:token`) valid for five minutes.

### Health & Static Paths

-   `GET /health` – returns `ok` when the service is responsive.
-   `GET /static/*` – serves assets from `documents/static` (used during PDF rendering).

### Development Notes

-   Templates are compiled once at startup. Restart the server to pick up changes.
-   Tailwind and PostCSS settings are taken from the template project (via `tailwind.config.js` / `postcss.config.js`).
-   If you enable `HTMDOCS_API_KEY`, static resources and download URLs remain publicly accessible to allow the embedded Playwright browser to resolve assets; regenerate the PDFs within trusted environments if you need stricter controls.
