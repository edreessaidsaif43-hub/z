#!/usr/bin/env python3
import json
import os
import re
import secrets
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Lock
from urllib.parse import urlparse

BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"
DATA_FILE = DATA_DIR / "portfolios.json"
INDEX_FILE = BASE_DIR / "index.html"
STORE_LOCK = Lock()
MAX_BODY_BYTES = 25 * 1024 * 1024


def ensure_store():
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    if not DATA_FILE.exists():
        DATA_FILE.write_text("{}", encoding="utf-8")


def load_store():
    ensure_store()
    try:
        return json.loads(DATA_FILE.read_text(encoding="utf-8"))
    except Exception:
        return {}


def save_store(data):
    ensure_store()
    DATA_FILE.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


def generate_short_id(existing):
    while True:
        candidate = re.sub(r"[^A-Za-z0-9]", "", secrets.token_urlsafe(6))[:10]
        if candidate and candidate not in existing:
            return candidate


class PortfolioHandler(BaseHTTPRequestHandler):
    server_version = "EnjazyPortfolio/1.0"

    def _send_json(self, payload, status=HTTPStatus.OK):
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _send_html(self, html_text, status=HTTPStatus.OK):
        body = html_text.encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _send_not_found(self):
        self._send_json({"error": "not_found"}, status=HTTPStatus.NOT_FOUND)

    def _parse_json_body(self):
        length = int(self.headers.get("Content-Length", "0"))
        if length <= 0:
            return None
        if length > MAX_BODY_BYTES:
            return "payload_too_large"
        raw = self.rfile.read(length)
        try:
            return json.loads(raw.decode("utf-8"))
        except Exception:
            return None

    def _origin(self):
        host = self.headers.get("Host", "localhost:8000")
        proto = "http"
        return f"{proto}://{host}"

    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path

        if path == "/" or path == "/index.html":
            self._send_html(INDEX_FILE.read_text(encoding="utf-8"))
            return

        if path == "/health":
            self._send_json({"status": "ok"})
            return

        if re.match(r"^/share/[A-Za-z0-9]+$", path):
            self._send_html(INDEX_FILE.read_text(encoding="utf-8"))
            return

        api_match = re.match(r"^/api/portfolios/([A-Za-z0-9]+)$", path)
        if api_match:
            short_id = api_match.group(1)
            with STORE_LOCK:
                store = load_store()
            record = store.get(short_id)
            if not record:
                self._send_not_found()
                return
            self._send_json(record)
            return

        self._send_not_found()

    def do_POST(self):
        parsed = urlparse(self.path)
        if parsed.path != "/api/portfolios":
            self._send_not_found()
            return

        body = self._parse_json_body()
        if body == "payload_too_large":
            self._send_json({"error": "payload_too_large"}, status=HTTPStatus.REQUEST_ENTITY_TOO_LARGE)
            return
        if not body or not isinstance(body, dict):
            self._send_json({"error": "invalid_payload"}, status=HTTPStatus.BAD_REQUEST)
            return

        profile = body.get("profile") or {}
        entries = body.get("entries") or []
        if not isinstance(profile, dict) or not isinstance(entries, list):
            self._send_json({"error": "invalid_payload"}, status=HTTPStatus.BAD_REQUEST)
            return

        profile.pop("password", None)
        payload = {
            "profile": profile,
            "entries": entries,
            "generatedAt": body.get("generatedAt")
        }

        with STORE_LOCK:
            store = load_store()
            short_id = generate_short_id(store.keys())
            store[short_id] = payload
            save_store(store)

        self._send_json(
            {
                "id": short_id,
                "url": f"{self._origin()}/share/{short_id}"
            },
            status=HTTPStatus.CREATED
        )


def run():
    port = int(os.environ.get("PORT", "8000"))
    server = ThreadingHTTPServer(("0.0.0.0", port), PortfolioHandler)
    print(f"Enjazy server running on http://localhost:{port}")
    server.serve_forever()


if __name__ == "__main__":
    run()
