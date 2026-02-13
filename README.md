# NARA Image Scraper

A web application for downloading images from the National Archives (NARA) catalog. Built with Flask backend and Next.js frontend.

## Features

- Download image ranges from any NARA catalog record
- Real-time progress tracking
- ZIP archive download
- PDF compilation (optional)
- Background job processing
- Docker support for easy deployment

## Quick Start

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

## Environment Variables

### Frontend

| Variable | Default | Description |
|----------|---------|-------------|
| `NEXT_PUBLIC_API_BASE_URL` | `http://localhost:5001` | Backend API URL |

### Backend

| Variable | Default | Description |
|----------|---------|-------------|
| `FLASK_ENV` | `development` | Flask environment |

## Project Structure

```
nara-image-scraper/
├── README.md
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

- Maximum 800 pages per request
- Jobs are stored locally and may be cleaned up after 24 hours
- PDF generation requires the `img2pdf` library

## License

MIT
