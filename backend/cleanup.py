"""
TTL cleanup utility for expired job folders.

Run periodically (e.g., via cron) to remove old jobs.
"""

import os
import shutil
import json
import argparse
from datetime import datetime, timedelta

JOBS_DIR = os.path.join(os.path.dirname(__file__), "jobs")
DEFAULT_TTL_HOURS = 24


def get_job_age(job_path: str) -> timedelta:
    """Get the age of a job based on its status.json."""
    status_path = os.path.join(job_path, "status.json")

    if not os.path.exists(status_path):
        # No status file, use folder modification time
        mtime = os.path.getmtime(job_path)
        created = datetime.fromtimestamp(mtime)
    else:
        with open(status_path, "r") as f:
            status = json.load(f)

        # Use completed_at if available, otherwise created_at
        timestamp = status.get("completed_at") or status.get("created_at")
        if timestamp:
            created = datetime.fromisoformat(timestamp)
        else:
            mtime = os.path.getmtime(status_path)
            created = datetime.fromtimestamp(mtime)

    return datetime.now() - created


def cleanup_jobs(ttl_hours: int = DEFAULT_TTL_HOURS, dry_run: bool = False) -> list:
    """
    Remove jobs older than TTL.

    Args:
        ttl_hours: Maximum age in hours before a job is removed
        dry_run: If True, don't actually delete, just report

    Returns:
        List of removed job IDs
    """
    if not os.path.exists(JOBS_DIR):
        print("Jobs directory does not exist")
        return []

    removed = []
    ttl = timedelta(hours=ttl_hours)

    for job_id in os.listdir(JOBS_DIR):
        job_path = os.path.join(JOBS_DIR, job_id)

        if not os.path.isdir(job_path):
            continue

        try:
            age = get_job_age(job_path)

            if age > ttl:
                if dry_run:
                    print(f"Would remove: {job_id} (age: {age})")
                else:
                    shutil.rmtree(job_path)
                    print(f"Removed: {job_id} (age: {age})")
                removed.append(job_id)
            else:
                print(f"Keeping: {job_id} (age: {age})")

        except Exception as e:
            print(f"Error processing {job_id}: {e}")

    return removed


def main():
    parser = argparse.ArgumentParser(description="Clean up expired NARA download jobs")
    parser.add_argument(
        "--ttl",
        type=int,
        default=DEFAULT_TTL_HOURS,
        help=f"TTL in hours (default: {DEFAULT_TTL_HOURS})"
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Don't actually delete, just show what would be removed"
    )

    args = parser.parse_args()

    print(f"Cleaning up jobs older than {args.ttl} hours...")
    if args.dry_run:
        print("(DRY RUN - no files will be deleted)")
    print()

    removed = cleanup_jobs(ttl_hours=args.ttl, dry_run=args.dry_run)

    print()
    print(f"Total {'would remove' if args.dry_run else 'removed'}: {len(removed)} jobs")


if __name__ == "__main__":
    main()
