#!/usr/bin/env python3
"""
Deploy webhook listener — runs on the Linux server.

Listens for a POST /deploy from GitHub Actions, verifies the shared
HMAC-SHA256 secret, then:
  1. git pull origin main
  2. docker compose up --build -d

Environment variables (set in the systemd EnvironmentFile):
  WEBHOOK_SECRET   — shared secret, must match DEPLOY_WEBHOOK_SECRET in GitHub
  REPO_DIR         — absolute path to the gamify repo on this server
  WEBHOOK_PORT     — port to listen on (default: 9000)
"""

import hashlib
import hmac
import logging
import os
import subprocess
import threading
from http.server import BaseHTTPRequestHandler, HTTPServer

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

WEBHOOK_SECRET: str = os.environ.get("WEBHOOK_SECRET", "")
REPO_DIR: str = os.environ.get("REPO_DIR", "")
PORT: int = int(os.environ.get("WEBHOOK_PORT", "9000"))

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
log = logging.getLogger("webhook")

# Prevents two deploys from running at the same time if pushes arrive close together.
_deploy_lock = threading.Lock()

# ---------------------------------------------------------------------------
# Signature check
# ---------------------------------------------------------------------------

def _verify(body: bytes, header_sig: str) -> bool:
    mac = hmac.new(WEBHOOK_SECRET.encode("utf-8"), body, digestmod=hashlib.sha256)
    expected = "sha256=" + mac.hexdigest()
    return hmac.compare_digest(expected, header_sig)

# ---------------------------------------------------------------------------
# Deploy logic
# ---------------------------------------------------------------------------

def _run(cmd: list[str]) -> bool:
    log.info("$ %s", " ".join(cmd))
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.stdout.strip():
        for line in result.stdout.strip().splitlines():
            log.info("  %s", line)
    if result.stderr.strip():
        for line in result.stderr.strip().splitlines():
            log.warning("  %s", line)
    if result.returncode != 0:
        log.error("Command exited %d", result.returncode)
    return result.returncode == 0


def deploy() -> None:
    if not _deploy_lock.acquire(blocking=False):
        log.warning("Deploy already in progress — skipping this trigger")
        return

    try:
        log.info("=== Deploy started ===")

        if not _run(["git", "-C", REPO_DIR, "pull", "origin", "main"]):
            log.error("git pull failed — aborting deploy")
            return

        compose_file = os.path.join(REPO_DIR, "docker-compose.yml")
        if not _run([
            "docker", "compose",
            "-f", compose_file,
            "up", "--build", "-d",
        ]):
            log.error("docker compose up failed")
            return

        log.info("=== Deploy complete ===")

    finally:
        _deploy_lock.release()

# ---------------------------------------------------------------------------
# HTTP handler
# ---------------------------------------------------------------------------

class _Handler(BaseHTTPRequestHandler):
    def do_POST(self) -> None:  # noqa: N802
        if self.path != "/deploy":
            self._respond(404, b"Not found\n")
            return

        length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(length)

        sig = self.headers.get("X-Deploy-Signature", "")
        if not _verify(body, sig):
            log.warning("Rejected — bad or missing signature (from %s)", self.client_address[0])
            self._respond(401, b"Unauthorized\n")
            return

        log.info("Accepted deploy trigger from %s", self.client_address[0])
        self._respond(202, b"Deploy triggered\n")

        # Run in background so the HTTP response is returned immediately.
        threading.Thread(target=deploy, daemon=True).start()

    def _respond(self, code: int, body: bytes) -> None:
        self.send_response(code)
        self.send_header("Content-Type", "text/plain")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, *_):  # suppress the built-in per-request stdout line
        pass


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    if not WEBHOOK_SECRET:
        log.error("WEBHOOK_SECRET is not set — refusing to start")
        raise SystemExit(1)
    if not REPO_DIR:
        log.error("REPO_DIR is not set — refusing to start")
        raise SystemExit(1)
    if not os.path.isdir(REPO_DIR):
        log.error("REPO_DIR %r does not exist", REPO_DIR)
        raise SystemExit(1)

    server = HTTPServer(("0.0.0.0", PORT), _Handler)
    log.info("Deploy webhook listening on port %d (repo: %s)", PORT, REPO_DIR)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        log.info("Shutting down")
