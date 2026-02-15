"""
Flask backend for NARA Image Scraper.

Endpoints:
- POST /jobs - Create a new download job
- GET /jobs/<job_id> - Get job status
- GET /jobs/<job_id>/download.zip - Download completed ZIP archive
- GET /jobs/<job_id>/download.pdf - Download completed PDF (if available)
"""

import os
import json
import uuid
import zipfile
import threading
from datetime import datetime
from flask import Flask, request, jsonify, send_file, g
from flask_cors import CORS
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from werkzeug.middleware.proxy_fix import ProxyFix

from downloader import download_range

app = Flask(__name__)

# ============================================================================
# Reverse Proxy Configuration
# ============================================================================
# When deployed behind a reverse proxy (Render, Fly, Railway, nginx), the
# proxy sets X-Forwarded-For headers. ProxyFix extracts the real client IP.
# Configure via environment variables:
#   PROXY_FIX_X_FOR=1    - Number of proxies setting X-Forwarded-For
#   PROXY_FIX_X_PROTO=1  - Number of proxies setting X-Forwarded-Proto
#   PROXY_FIX_X_HOST=1   - Number of proxies setting X-Forwarded-Host
#   PROXY_FIX_X_PREFIX=1 - Number of proxies setting X-Forwarded-Prefix
proxy_x_for = int(os.environ.get("PROXY_FIX_X_FOR", "1"))
proxy_x_proto = int(os.environ.get("PROXY_FIX_X_PROTO", "1"))
proxy_x_host = int(os.environ.get("PROXY_FIX_X_HOST", "0"))
proxy_x_prefix = int(os.environ.get("PROXY_FIX_X_PREFIX", "0"))

if proxy_x_for > 0:
    app.wsgi_app = ProxyFix(
        app.wsgi_app,
        x_for=proxy_x_for,
        x_proto=proxy_x_proto,
        x_host=proxy_x_host,
        x_prefix=proxy_x_prefix
    )

CORS(app)

# ============================================================================
# Rate Limiting Configuration
# ============================================================================
# Storage backend: Redis if REDIS_URL is set, otherwise in-memory
# Limits can be customized via environment variables:
#   RATE_LIMIT_DEFAULT          - Default limit for all endpoints (e.g., "200 per hour")
#   RATE_LIMIT_JOBS_CREATE      - POST /jobs limit (e.g., "5 per hour")
#   RATE_LIMIT_JOBS_CREATE_BURST- POST /jobs burst limit (e.g., "2 per minute")
#   RATE_LIMIT_JOBS_STATUS      - GET /jobs/<id> limit (e.g., "60 per minute")
#   RATE_LIMIT_JOBS_DOWNLOAD    - Download endpoints limit (e.g., "10 per minute")

REDIS_URL = os.environ.get("REDIS_URL")

if REDIS_URL:
    storage_uri = REDIS_URL
else:
    storage_uri = "memory://"


def get_real_ip():
    """Get the real client IP address, respecting X-Forwarded-For."""
    return get_remote_address()


# Rate limit configuration from environment
DEFAULT_LIMIT = os.environ.get("RATE_LIMIT_DEFAULT", "200 per hour")
JOBS_CREATE_LIMIT = os.environ.get("RATE_LIMIT_JOBS_CREATE", "5 per hour")
JOBS_CREATE_BURST = os.environ.get("RATE_LIMIT_JOBS_CREATE_BURST", "2 per minute")
JOBS_STATUS_LIMIT = os.environ.get("RATE_LIMIT_JOBS_STATUS", "60 per minute")
JOBS_DOWNLOAD_LIMIT = os.environ.get("RATE_LIMIT_JOBS_DOWNLOAD", "10 per minute")

limiter = Limiter(
    key_func=get_real_ip,
    app=app,
    storage_uri=storage_uri,
    default_limits=[DEFAULT_LIMIT],
    strategy="fixed-window"
)


@app.errorhandler(429)
def rate_limit_exceeded(e):
    """Handle rate limit exceeded errors with JSON response."""
    retry_after = e.description if hasattr(e, 'description') else None

    # Try to extract retry_after from the rate limit info
    retry_after_seconds = None
    if hasattr(e, 'retry_after'):
        retry_after_seconds = int(e.retry_after)
    elif retry_after and 'Retry-After' in str(retry_after):
        # Fallback parsing if needed
        try:
            retry_after_seconds = int(str(retry_after).split()[-1])
        except (ValueError, IndexError):
            pass

    response = jsonify({
        "error": "rate_limited",
        "message": "Too many requests. Please slow down.",
        "retry_after_seconds": retry_after_seconds
    })
    response.status_code = 429

    if retry_after_seconds:
        response.headers["Retry-After"] = str(retry_after_seconds)

    return response

JOBS_DIR = os.path.join(os.path.dirname(__file__), "jobs")
MAX_PAGES = 800


def get_job_path(job_id: str) -> str:
    """Get the path to a job folder."""
    return os.path.join(JOBS_DIR, job_id)


def get_status_path(job_id: str) -> str:
    """Get the path to a job's status.json file."""
    return os.path.join(get_job_path(job_id), "status.json")


def read_status(job_id: str) -> dict:
    """Read status.json for a job."""
    status_path = get_status_path(job_id)
    if not os.path.exists(status_path):
        return None
    with open(status_path, "r") as f:
        return json.load(f)


def write_status(job_id: str, status: dict):
    """Write status.json for a job."""
    status_path = get_status_path(job_id)
    with open(status_path, "w") as f:
        json.dump(status, f, indent=2)


def append_log(job_id: str, message: str):
    """Append a message to the job's log file."""
    log_path = os.path.join(get_job_path(job_id), "logs.txt")
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    with open(log_path, "a") as f:
        f.write(f"[{timestamp}] {message}\n")


def create_zip_archive(job_id: str) -> str:
    """Create a ZIP archive of downloaded images."""
    job_path = get_job_path(job_id)
    images_path = os.path.join(job_path, "images")
    zip_path = os.path.join(job_path, "archive.zip")

    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zf:
        for filename in sorted(os.listdir(images_path)):
            if filename.endswith(".jpg"):
                file_path = os.path.join(images_path, filename)
                zf.write(file_path, filename)

    return zip_path


def create_pdf(job_id: str) -> str:
    """Create a PDF from downloaded images (optional)."""
    try:
        import img2pdf
    except ImportError:
        return None

    job_path = get_job_path(job_id)
    images_path = os.path.join(job_path, "images")
    pdf_path = os.path.join(job_path, "archive.pdf")

    image_files = sorted([
        os.path.join(images_path, f)
        for f in os.listdir(images_path)
        if f.endswith(".jpg")
    ])

    if not image_files:
        return None

    with open(pdf_path, "wb") as f:
        f.write(img2pdf.convert(image_files))

    return pdf_path


def run_download_job(job_id: str, catalog_url: str, start_page: int, end_page: int):
    """Background thread function to run a download job."""
    job_path = get_job_path(job_id)
    images_path = os.path.join(job_path, "images")
    os.makedirs(images_path, exist_ok=True)

    # Update status to running
    status = read_status(job_id)
    status["status"] = "running"
    status["started_at"] = datetime.now().isoformat()
    write_status(job_id, status)
    append_log(job_id, "Job started")

    def progress_callback(pages_done: int, pages_total: int, message: str):
        status = read_status(job_id)
        status["pages_done"] = pages_done
        status["pages_total"] = pages_total
        status["message"] = message
        write_status(job_id, status)
        append_log(job_id, message)

    try:
        result = download_range(
            catalog_url=catalog_url,
            out_dir=images_path,
            start_page=start_page,
            end_page=end_page,
            progress_cb=progress_callback
        )

        # Create ZIP archive
        append_log(job_id, "Creating ZIP archive...")
        zip_path = create_zip_archive(job_id)

        # Try to create PDF (optional)
        pdf_available = False
        try:
            append_log(job_id, "Creating PDF...")
            pdf_path = create_pdf(job_id)
            pdf_available = pdf_path is not None
        except Exception as e:
            append_log(job_id, f"PDF creation failed: {str(e)}")

        # Update final status
        status = read_status(job_id)
        status["status"] = "completed"
        status["completed_at"] = datetime.now().isoformat()
        status["result"] = result
        status["zip_available"] = True
        status["pdf_available"] = pdf_available
        write_status(job_id, status)
        append_log(job_id, "Job completed")

    except Exception as e:
        status = read_status(job_id)
        status["status"] = "failed"
        status["error"] = str(e)
        status["completed_at"] = datetime.now().isoformat()
        write_status(job_id, status)
        append_log(job_id, f"Job failed: {str(e)}")


@app.route("/jobs", methods=["POST"])
@limiter.limit(JOBS_CREATE_LIMIT)
@limiter.limit(JOBS_CREATE_BURST)
def create_job():
    """Create a new download job."""
    data = request.get_json()

    if not data:
        return jsonify({"error": "Request body required"}), 400

    catalog_url = data.get("catalog_url", "").strip()
    start_page = data.get("start_page", 1)
    end_page = data.get("end_page", 100)

    # Validate URL
    if not catalog_url:
        return jsonify({"error": "catalog_url is required"}), 400
    if "catalog.archives.gov" not in catalog_url:
        return jsonify({"error": "URL must be from catalog.archives.gov"}), 400

    # Validate page range
    try:
        start_page = int(start_page)
        end_page = int(end_page)
    except (TypeError, ValueError):
        return jsonify({"error": "start_page and end_page must be integers"}), 400

    if start_page < 1:
        return jsonify({"error": "start_page must be at least 1"}), 400
    if end_page < start_page:
        return jsonify({"error": "end_page must be >= start_page"}), 400
    if end_page - start_page + 1 > MAX_PAGES:
        return jsonify({"error": f"Maximum {MAX_PAGES} pages per request"}), 400

    # Create job
    job_id = str(uuid.uuid4())
    job_path = get_job_path(job_id)
    os.makedirs(job_path, exist_ok=True)

    # Initialize status
    status = {
        "job_id": job_id,
        "status": "queued",
        "catalog_url": catalog_url,
        "start_page": start_page,
        "end_page": end_page,
        "pages_done": 0,
        "pages_total": end_page - start_page + 1,
        "message": "Queued",
        "created_at": datetime.now().isoformat(),
        "zip_available": False,
        "pdf_available": False
    }
    write_status(job_id, status)
    append_log(job_id, f"Job created: {catalog_url} pages {start_page}-{end_page}")

    # Start background thread
    thread = threading.Thread(
        target=run_download_job,
        args=(job_id, catalog_url, start_page, end_page),
        daemon=True
    )
    thread.start()

    return jsonify({
        "job_id": job_id,
        "status_url": f"/jobs/{job_id}"
    }), 201


@app.route("/jobs/<job_id>", methods=["GET"])
@limiter.limit(JOBS_STATUS_LIMIT)
def get_job_status(job_id: str):
    """Get the status of a job."""
    status = read_status(job_id)
    if status is None:
        return jsonify({"error": "Job not found"}), 404
    return jsonify(status)


@app.route("/jobs/<job_id>/download.zip", methods=["GET"])
@limiter.limit(JOBS_DOWNLOAD_LIMIT)
def download_zip(job_id: str):
    """Download the ZIP archive for a completed job."""
    status = read_status(job_id)
    if status is None:
        return jsonify({"error": "Job not found"}), 404

    if status["status"] != "completed":
        return jsonify({"error": "Job not completed"}), 400

    zip_path = os.path.join(get_job_path(job_id), "archive.zip")
    if not os.path.exists(zip_path):
        return jsonify({"error": "ZIP file not found"}), 404

    return send_file(
        zip_path,
        as_attachment=True,
        download_name=f"nara-{job_id[:8]}.zip",
        mimetype="application/zip"
    )


@app.route("/jobs/<job_id>/download.pdf", methods=["GET"])
@limiter.limit(JOBS_DOWNLOAD_LIMIT)
def download_pdf(job_id: str):
    """Download the PDF for a completed job."""
    status = read_status(job_id)
    if status is None:
        return jsonify({"error": "Job not found"}), 404

    if status["status"] != "completed":
        return jsonify({"error": "Job not completed"}), 400

    if not status.get("pdf_available"):
        return jsonify({"error": "PDF not available"}), 404

    pdf_path = os.path.join(get_job_path(job_id), "archive.pdf")
    if not os.path.exists(pdf_path):
        return jsonify({"error": "PDF file not found"}), 404

    return send_file(
        pdf_path,
        as_attachment=True,
        download_name=f"nara-{job_id[:8]}.pdf",
        mimetype="application/pdf"
    )


@app.route("/health", methods=["GET"])
@limiter.exempt
def health_check():
    """Health check endpoint."""
    return jsonify({"status": "ok"})


if __name__ == "__main__":
    os.makedirs(JOBS_DIR, exist_ok=True)
    app.run(host="0.0.0.0", port=5001, debug=True)
