"""
NARA Image Downloader - Refactored for web service integration.

Can be used as:
1. A library with download_range() function
2. CLI: python downloader.py <catalog_url> <output_dir> <start_page> <end_page>
"""

import os
import time
import requests
import pathlib
import sys
import re
from typing import Callable, Optional

UA = "Mozilla/5.0 (compatible; nara-downloader/1.0)"


def fetch_json(url: str) -> dict:
    """Fetch JSON from URL with appropriate headers."""
    r = requests.get(
        url,
        headers={"User-Agent": UA, "Accept": "application/json"},
        timeout=30
    )
    r.raise_for_status()
    return r.json()


def download_file(url: str, path: str) -> bool:
    """Download a file from URL to path."""
    r = requests.get(
        url,
        headers={"User-Agent": UA},
        stream=True,
        timeout=120
    )
    if r.status_code != 200:
        return False
    with open(path, "wb") as f:
        for chunk in r.iter_content(1024 * 256):
            f.write(chunk)
    return True


def extract_naid(catalog_url: str) -> Optional[str]:
    """Extract NAID from catalog URL like https://catalog.archives.gov/id/{naid}"""
    match = re.search(r'/id/(\d+)', catalog_url)
    if match:
        return match.group(1)
    return None


def download_range(
    catalog_url: str,
    out_dir: str,
    start_page: int,
    end_page: int,
    progress_cb: Optional[Callable[[int, int, str], None]] = None
) -> dict:
    """
    Download a range of images from a NARA catalog record.

    Args:
        catalog_url: Full URL to NARA catalog page (e.g., https://catalog.archives.gov/id/178788901)
        out_dir: Directory to save downloaded images
        start_page: First page to download (1-indexed)
        end_page: Last page to download (1-indexed, inclusive)
        progress_cb: Optional callback function(pages_done, pages_total, message)

    Returns:
        dict with keys: success, total_available, downloaded, errors, skipped
    """
    result = {
        "success": False,
        "total_available": 0,
        "downloaded": 0,
        "skipped": 0,
        "errors": []
    }

    def log(msg: str, pages_done: int = 0, pages_total: int = 0):
        if progress_cb:
            progress_cb(pages_done, pages_total, msg)

    # Extract NAID from URL
    naid = extract_naid(catalog_url)
    if not naid:
        result["errors"].append("Could not extract NAID from URL")
        log("Error: Could not extract NAID from URL")
        return result

    log(f"Fetching record {naid} from NARA API...")

    # Fetch record metadata
    api_url = f"https://catalog.archives.gov/proxy/records/search?naId={naid}"
    try:
        data = fetch_json(api_url)
    except requests.RequestException as e:
        result["errors"].append(f"Failed to fetch record: {str(e)}")
        log(f"Error: Failed to fetch record: {str(e)}")
        return result

    hits = data.get("body", {}).get("hits", {}).get("hits", [])
    if not hits:
        result["errors"].append("No record found")
        log("Error: No record found")
        return result

    record = hits[0]["_source"]["record"]
    digital_objects = record.get("digitalObjects", [])
    total = len(digital_objects)
    result["total_available"] = total

    log(f"Found {total} images in record")

    if total == 0:
        result["errors"].append("No digital objects in record")
        return result

    # Adjust end_page if it exceeds total
    actual_end = min(end_page, total)
    if end_page > total:
        log(f"Warning: Requested end page {end_page} exceeds total {total}, using {total}")

    # Validate page range
    if start_page < 1:
        start_page = 1
    if start_page > total:
        result["errors"].append(f"Start page {start_page} exceeds total pages {total}")
        return result

    # Create output directory
    pathlib.Path(out_dir).mkdir(parents=True, exist_ok=True)

    pages_to_download = actual_end - start_page + 1
    pages_done = 0

    log(f"Downloading pages {start_page} to {actual_end}...", pages_done, pages_to_download)

    for page_num in range(start_page, actual_end + 1):
        obj = digital_objects[page_num - 1]  # 1-indexed to 0-indexed

        img_url = obj.get("objectUrl")
        if not img_url:
            result["errors"].append(f"No URL for page {page_num}")
            log(f"No URL for page {page_num}", pages_done, pages_to_download)
            continue

        original_filename = obj.get("objectFilename", f"{page_num:04d}.jpg")
        filename = f"{page_num:04d}.jpg"
        path = os.path.join(out_dir, filename)

        if os.path.exists(path):
            result["skipped"] += 1
            pages_done += 1
            log(f"Skipped existing {filename}", pages_done, pages_to_download)
            continue

        if download_file(img_url, path):
            result["downloaded"] += 1
            pages_done += 1
            log(f"Downloaded {filename} ({original_filename})", pages_done, pages_to_download)
        else:
            result["errors"].append(f"Failed to download page {page_num}")
            pages_done += 1
            log(f"Failed to download {filename}", pages_done, pages_to_download)

        time.sleep(0.1)  # polite delay

    result["success"] = len(result["errors"]) == 0
    log("Download complete!", pages_done, pages_to_download)

    return result


def main():
    """CLI entry point."""
    if len(sys.argv) < 5:
        print("Usage:")
        print("  python downloader.py <catalog_url> <output_dir> <start_page> <end_page>")
        print()
        print("Example:")
        print("  python downloader.py https://catalog.archives.gov/id/178788901 ./output 1 10")
        sys.exit(1)

    catalog_url = sys.argv[1]
    out_dir = sys.argv[2]
    start_page = int(sys.argv[3])
    end_page = int(sys.argv[4])

    def print_progress(done: int, total: int, msg: str):
        print(f"[{done}/{total}] {msg}")

    result = download_range(catalog_url, out_dir, start_page, end_page, print_progress)

    print()
    print("=" * 40)
    print(f"Total available: {result['total_available']}")
    print(f"Downloaded: {result['downloaded']}")
    print(f"Skipped: {result['skipped']}")
    print(f"Errors: {len(result['errors'])}")
    if result["errors"]:
        for err in result["errors"]:
            print(f"  - {err}")


if __name__ == "__main__":
    main()
