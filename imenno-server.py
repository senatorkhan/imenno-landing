"""Serve the «Именно» prototype and save local waitlist requests."""

import argparse
from contextlib import closing
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
import os
from pathlib import Path
import re
import sqlite3


DIRECTORY = Path(__file__).resolve().parent
WAITLIST_URL = "/api/waitlist"
MAX_REQUEST_BYTES = 4096
LOCAL_ATOM = r"[a-z0-9!#$%&'*+/=?^_`{|}~-]+"
DOMAIN_LABEL = r"[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?"
EMAIL = re.compile(
    rf"{LOCAL_ATOM}(?:\.{LOCAL_ATOM})*@{DOMAIN_LABEL}(?:\.{DOMAIN_LABEL})+",
    re.ASCII | re.IGNORECASE,
)
WAITLIST_META = b'<meta name="imenno-waitlist" content="/api/waitlist">'


def prepare_database(database):
    database.parent.mkdir(parents=True, exist_ok=True)
    with closing(sqlite3.connect(database)) as connection, connection:
        connection.execute(
            """CREATE TABLE IF NOT EXISTS waitlist (
                email TEXT NOT NULL COLLATE NOCASE UNIQUE,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            )"""
        )


def save_email(database, email):
    with closing(sqlite3.connect(database)) as connection, connection:
        connection.execute(
            "INSERT INTO waitlist (email) VALUES (?) ON CONFLICT(email) DO NOTHING",
            (email,),
        )


def read_email(body):
    try:
        data = json.loads(body)
    except (ValueError, RecursionError):
        return None
    email = data.get("email") if isinstance(data, dict) else None
    if not isinstance(email, str):
        return None
    email = email.strip()
    if len(email) <= 254 and EMAIL.fullmatch(email) and email.index("@") <= 64:
        return email
    return None


class WaitlistHandler(BaseHTTPRequestHandler):
    timeout = 10

    def reply(self, status, content_type, content):
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(content)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        if self.command != "HEAD":
            self.wfile.write(content)

    def reply_json(self, status, **data):
        self.reply(status, "application/json; charset=utf-8", json.dumps(data).encode())

    def do_GET(self):
        if self.path.split("?", 1)[0] not in ("/", "/index.html", "/imenno-hero.html"):
            self.reply_json(404, ok=False, error="not_found")
            return
        try:
            html = (DIRECTORY / "index.html").read_bytes()
        except OSError:
            self.reply_json(500, ok=False, error="page_unavailable")
            return
        html = html.replace(b"</head>", b"  " + WAITLIST_META + b"\n</head>", 1)
        self.reply(200, "text/html; charset=utf-8", html)

    do_HEAD = do_GET

    def do_POST(self):
        if self.path != WAITLIST_URL:
            self.reply_json(404, ok=False, error="not_found")
            return
        try:
            length = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            length = 0
        if length > MAX_REQUEST_BYTES:
            self.reply_json(413, ok=False, error="request_too_large")
            return
        if length < 1 or self.headers.get_content_type() != "application/json":
            self.reply_json(400, ok=False, error="invalid_request")
            return
        email = read_email(self.rfile.read(length))
        if email is None:
            self.reply_json(400, ok=False, error="invalid_email")
            return
        try:
            save_email(self.server.database, email)
        except sqlite3.Error:
            self.reply_json(500, ok=False, error="storage_unavailable")
            return
        self.reply_json(200, ok=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--port", type=int, default=5818, help="Local HTTP port")
    parser.add_argument(
        "--database",
        type=Path,
        default=DIRECTORY / ".imenno-waitlist.sqlite3",
        help="SQLite path (default: .imenno-waitlist.sqlite3 beside the server)",
    )
    args = parser.parse_args()
    database = args.database.expanduser().resolve()
    os.umask(0o077)
    with ThreadingHTTPServer(("127.0.0.1", args.port), WaitlistHandler) as server:
        prepare_database(database)
        server.database = database
        print(f"Именно → http://127.0.0.1:{server.server_port}/", flush=True)
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            pass


if __name__ == "__main__":
    main()
