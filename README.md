# NARA Image Scraper

A web application for downloading images from the National Archives (NARA) catalog. Built with Flask backend and Next.js frontend.

## Features

- Download image ranges from any NARA catalog record
- **Multiple page ranges** - Download non-contiguous sections (e.g., pages 1-20 and 400-420)
- Real-time progress tracking for each range
- ZIP archive download (per range)
- PDF compilation (per range or combined)
- Background job processing
- Rate limiting with Redis support
- Docker support for easy deployment

## Quick Start

> **New to this?** See [BEGINNER.md](BEGINNER.md) for a step-by-step guide with detailed instructions.

### Using Docker (Recommended)

```bash
docker-compose up --build
```

Then open http://localhost:3000 in your browser.

### Manual Setup

#### Backend

```bash
cd backend
pip install -r requirements.txt
python app.py
```

The API will be available at http://localhost:5001

#### Frontend

```bash
cd frontend
npm install
npm run dev
```

The app will be available at http://localhost:3000

## CLI Usage

The downloader can also be used directly from the command line:

```bash
cd backend
python downloader.py https://catalog.archives.gov/id/178788901 ./output 1 10
```

Arguments:
- `catalog_url`: Full NARA catalog URL
- `output_dir`: Directory to save images
- `start_page`: First page to download (1-indexed)
- `end_page`: Last page to download (inclusive)

## API Reference

### Create Download Job

```bash
curl -X POST http://localhost:5001/jobs \
  -H "Content-Type: application/json" \
  -d '{
    "catalog_url": "https://catalog.archives.gov/id/178788901",
    "start_page": 1,
    "end_page": 10
  }'
```

Response:
```json
{
  "job_id": "550e8400-e29b-41d4-a716-446655440000",
  "status_url": "/jobs/550e8400-e29b-41d4-a716-446655440000"
}
```

### Get Job Status

```bash
curl http://localhost:5001/jobs/{job_id}
```

Response:
```json
{
  "job_id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "running",
  "pages_done": 5,
  "pages_total": 10,
  "message": "Downloaded 0005.jpg",
  "zip_available": false,
  "pdf_available": false
}
```

### Download Results

```bash
# Download ZIP
curl -O http://localhost:5001/jobs/{job_id}/download.zip

# Download PDF (if available)
curl -O http://localhost:5001/jobs/{job_id}/download.pdf
```

### Create Batch Job (Multiple Ranges)

```bash
curl -X POST http://localhost:5001/jobs/batch \
  -H "Content-Type: application/json" \
  -d '{
    "catalog_url": "https://catalog.archives.gov/id/178788901",
    "ranges": [
      {"start_page": 1, "end_page": 20},
      {"start_page": 400, "end_page": 420}
    ]
  }'
```

Response:
```json
{
  "batch_id": "550e8400-e29b-41d4-a716-446655440000",
  "jobs": [
    {"job_id": "...", "start_page": 1, "end_page": 20, "status_url": "/jobs/..."},
    {"job_id": "...", "start_page": 400, "end_page": 420, "status_url": "/jobs/..."}
  ],
  "status_url": "/batch/550e8400-e29b-41d4-a716-446655440000"
}
```

### Get Batch Status

```bash
curl http://localhost:5001/batch/{batch_id}
```

Response:
```json
{
  "batch_id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "completed",
  "jobs": [
    {"job_id": "...", "status": "completed", "zip_available": true, "pdf_available": true, ...},
    {"job_id": "...", "status": "completed", "zip_available": true, "pdf_available": true, ...}
  ],
  "combined_pdf_available": true
}
```

### Download Combined PDF (All Ranges)

```bash
curl -O http://localhost:5001/batch/{batch_id}/download.pdf
```

This downloads a single PDF containing all images from all ranges in order.

## Environment Variables

### Frontend

| Variable | Default | Description |
|----------|---------|-------------|
| `NEXT_PUBLIC_API_BASE_URL` | `http://localhost:5001` | Backend API URL |

### Backend

| Variable | Default | Description |
|----------|---------|-------------|
| `FLASK_ENV` | `development` | Flask environment |
| `REDIS_URL` | (none) | Redis URL for rate limiting storage (e.g., `redis://localhost:6379/0`). Falls back to in-memory if not set. |
| `PROXY_FIX_X_FOR` | `1` | Number of reverse proxies setting X-Forwarded-For |
| `PROXY_FIX_X_PROTO` | `1` | Number of reverse proxies setting X-Forwarded-Proto |
| `PROXY_FIX_X_HOST` | `0` | Number of reverse proxies setting X-Forwarded-Host |
| `PROXY_FIX_X_PREFIX` | `0` | Number of reverse proxies setting X-Forwarded-Prefix |
| `RATE_LIMIT_DEFAULT` | `200 per hour` | Default rate limit for all endpoints |
| `RATE_LIMIT_JOBS_CREATE` | `5 per hour` | Rate limit for POST /jobs |
| `RATE_LIMIT_JOBS_CREATE_BURST` | `2 per minute` | Burst limit for POST /jobs |
| `RATE_LIMIT_JOBS_BATCH` | `3 per hour` | Rate limit for POST /jobs/batch |
| `RATE_LIMIT_JOBS_STATUS` | `60 per minute` | Rate limit for GET /jobs/<id> and GET /batch/<id> |
| `RATE_LIMIT_JOBS_DOWNLOAD` | `10 per minute` | Rate limit for download endpoints |

## Project Structure

```
nara-image-scraper/
├── README.md
├── BEGINNER.md             # Step-by-step beginner guide
├── docker-compose.yml
├── backend/
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── app.py              # Flask API server
│   ├── downloader.py       # Core download logic
│   ├── cleanup.py          # Job cleanup utility
│   └── jobs/               # Runtime job storage
└── frontend/
    ├── Dockerfile
    ├── package.json
    ├── next.config.js
    ├── tailwind.config.js
    └── src/app/
        ├── layout.tsx
        └── page.tsx
```

## Cleanup

Old job folders can be cleaned up using the cleanup utility:

```bash
cd backend

# Preview what would be deleted (24 hour TTL)
python cleanup.py --dry-run

# Delete jobs older than 12 hours
python cleanup.py --ttl 12

# Delete jobs older than 24 hours (default)
python cleanup.py
```

## Rate Limiting

The API includes rate limiting to protect against abuse. Limits are applied per client IP address.

### Default Limits

| Endpoint | Limit | Description |
|----------|-------|-------------|
| `POST /jobs` | 5/hour + 2/minute burst | Strict limit on single job creation |
| `POST /jobs/batch` | 3/hour | Strict limit on batch job creation |
| `GET /jobs/<id>` | 60/minute | Moderate limit for status polling |
| `GET /batch/<id>` | 60/minute | Moderate limit for batch status polling |
| `GET /jobs/<id>/download.zip` | 10/minute | Moderate limit for downloads |
| `GET /jobs/<id>/download.pdf` | 10/minute | Moderate limit for downloads |
| `GET /batch/<id>/download.pdf` | 10/minute | Moderate limit for combined PDF |
| All other endpoints | 200/hour | Default global limit |
| `GET /health` | Unlimited | Health check exempt from limits |

### Rate Limit Response

When a rate limit is exceeded, the API returns HTTP 429:

```json
{
  "error": "rate_limited",
  "message": "Too many requests. Please slow down.",
  "retry_after_seconds": 60
}
```

The `Retry-After` header is also included when available.

### Storage Backends

**Production (with Redis):**

```bash
# Set REDIS_URL to use Redis for distributed rate limiting
export REDIS_URL=redis://localhost:6379/0
python app.py
```

When using Docker Compose, Redis is automatically configured.

**Local Development (without Redis):**

```bash
# No REDIS_URL = in-memory storage (single process only)
python app.py
```

In-memory storage works fine for local development but doesn't persist across restarts or work with multiple processes.

### Customizing Limits

Override limits via environment variables:

```bash
# Stricter limits for production
export RATE_LIMIT_DEFAULT="100 per hour"
export RATE_LIMIT_JOBS_CREATE="3 per hour"
export RATE_LIMIT_JOBS_CREATE_BURST="1 per minute"
export RATE_LIMIT_JOBS_STATUS="30 per minute"
export RATE_LIMIT_JOBS_DOWNLOAD="5 per minute"

# Or in docker-compose.yml
environment:
  - RATE_LIMIT_JOBS_CREATE=10 per hour
```

### Reverse Proxy Configuration

When deployed behind a reverse proxy (Render, Fly, Railway, nginx), configure ProxyFix to correctly identify client IPs:

```bash
# Default: trust 1 proxy setting X-Forwarded-For
export PROXY_FIX_X_FOR=1

# If behind 2 proxies (e.g., CDN + load balancer)
export PROXY_FIX_X_FOR=2
```

## Deployment

### Backend (Render, Railway, etc.)

1. Create a new web service pointing to the `backend` directory
2. Set build command: `pip install -r requirements.txt`
3. Set start command: `python app.py`
4. Deploy

### Frontend (Vercel)

1. Import the repository
2. Set root directory to `frontend`
3. Add environment variable: `NEXT_PUBLIC_API_BASE_URL=https://your-backend-url.com`
4. Deploy

## Limitations

- Maximum 800 total pages per request (across all ranges in a batch)
- Maximum 10 ranges per batch request
- Jobs are stored locally and may be cleaned up after 24 hours
- PDF generation requires the `img2pdf` library

## License

MIT
