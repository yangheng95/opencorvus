"""Cooperative local receiver; one durable effect/receipt transaction."""
import argparse
from contextlib import contextmanager
import json
import math
import os
import re
import socket
import sqlite3
import sys
import threading
import time
import urllib.parse
import uuid
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer


FIELDS = {"tenant", "event_id", "kind", "amount_minor", "reverses"}
IDENTITY = re.compile(r"[A-Za-z0-9][A-Za-z0-9._-]{0,63}\Z")
DEFAULT_READ_TIMEOUT_SECONDS = 20
MAX_READ_TIMEOUT_SECONDS = 60


class Invalid(ValueError):
    pass


def identity(value):
    return isinstance(value, str) and IDENTITY.fullmatch(value) is not None


def validate(data):
    if not isinstance(data, dict) or set(data) != FIELDS:
        raise Invalid("fields")
    for key in ("tenant", "event_id"):
        if not identity(data[key]):
            raise Invalid(key)
    if type(data["amount_minor"]) is not int or not 1 <= abs(data["amount_minor"]) <= 10**12:
        raise Invalid("amount_minor")
    kind, amount, parent = data["kind"], data["amount_minor"], data["reverses"]
    if kind == "post" and amount > 0 and parent is None:
        return data
    if kind == "reversal" and amount < 0 and identity(parent):
        return data
    raise Invalid("kind_or_reverses")


def unique_object(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            raise Invalid("duplicate_json_key")
        result[key] = value
    return result


def finite_constant(value):
    raise Invalid("json_number")


def decode(raw):
    try:
        return validate(json.loads(raw, object_pairs_hook=unique_object, parse_constant=finite_constant))
    except (json.JSONDecodeError, UnicodeDecodeError, ValueError) as error:
        raise Invalid(str(error) if isinstance(error, Invalid) else "json") from error


@contextmanager
def connect(db):
    connection = sqlite3.connect(db, timeout=20, isolation_level=None)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA synchronous=FULL")
    try:
        yield connection
    finally:
        connection.close()


def initialize(db, drop):
    with connect(db) as connection:
        connection.executescript("""
        CREATE TABLE IF NOT EXISTS effects (
          tenant TEXT NOT NULL, event_id TEXT NOT NULL,
          kind TEXT NOT NULL, amount_minor INTEGER NOT NULL,
          reverses TEXT, receipt_id TEXT NOT NULL UNIQUE,
          PRIMARY KEY(tenant,event_id));
        CREATE TABLE IF NOT EXISTS requests (
          seq INTEGER PRIMARY KEY AUTOINCREMENT, method TEXT NOT NULL,
          tenant TEXT, event_id TEXT, status TEXT NOT NULL,
          receipt_id TEXT, dropped INTEGER NOT NULL);
        CREATE TABLE IF NOT EXISTS drop_once (
          tenant TEXT NOT NULL, event_id TEXT NOT NULL, consumed INTEGER NOT NULL,
          PRIMARY KEY(tenant,event_id));
        """)
        if drop:
            pieces = drop.split("/")
            if len(pieces) != 2 or not all(identity(p) for p in pieces):
                raise Invalid("drop_once")
            connection.execute("INSERT OR IGNORE INTO drop_once VALUES (?,?,0)", pieces)


def record(connection, method, tenant, event_id, status, receipt=None, dropped=False):
    connection.execute("INSERT INTO requests(method,tenant,event_id,status,receipt_id,dropped) VALUES (?,?,?,?,?,?)",
                       (method, tenant, event_id, status, receipt, int(dropped)))


def receipt(row):
    return {key: row[key] for key in ("receipt_id", "tenant", "event_id", "kind", "amount_minor", "reverses")}


def apply(db, data):
    """Static validation precedes identity; identity precedes dynamic checks."""
    validate(data)
    tenant, event_id = data["tenant"], data["event_id"]
    with connect(db) as connection:
        connection.execute("BEGIN IMMEDIATE")
        existing = connection.execute("SELECT * FROM effects WHERE tenant=? AND event_id=?", (tenant, event_id)).fetchone()
        if existing:
            same = all(existing[key] == data[key] for key in FIELDS)
            status = "replayed" if same else "idempotency_conflict"
            record(connection, "POST", tenant, event_id, status, existing["receipt_id"])
            connection.commit()
            return (200 if same else 409), {"status": status, "receipt": receipt(existing)}, False
        status = None
        if data["kind"] == "reversal":
            parent = connection.execute("SELECT * FROM effects WHERE tenant=? AND event_id=? AND kind='post'", (tenant, data["reverses"])).fetchone()
            if parent is None:
                status = "dependency_pending"
            else:
                # Python integer fold avoids bounded SQLite SUM overflow.
                prior = sum(row[0] for row in connection.execute("SELECT amount_minor FROM effects WHERE tenant=? AND reverses=? AND kind='reversal'", (tenant, data["reverses"])))
                if parent["amount_minor"] + prior + data["amount_minor"] < 0:
                    status = "reversal_exceeds_original"
        if status:
            record(connection, "POST", tenant, event_id, status)
            connection.commit()
            return 409, {"status": status}, False
        rid = str(uuid.uuid4())
        connection.execute("INSERT INTO effects VALUES (?,?,?,?,?,?)", (tenant, event_id, data["kind"], data["amount_minor"], data["reverses"], rid))
        fault = connection.execute("SELECT consumed FROM drop_once WHERE tenant=? AND event_id=?", (tenant, event_id)).fetchone()
        dropped = fault is not None and fault["consumed"] == 0
        if dropped:
            connection.execute("UPDATE drop_once SET consumed=1 WHERE tenant=? AND event_id=?", (tenant, event_id))
        record(connection, "POST", tenant, event_id, "applied", rid, dropped)
        row = connection.execute("SELECT * FROM effects WHERE tenant=? AND event_id=?", (tenant, event_id)).fetchone()
        connection.commit()
        return 201, {"status": "applied", "receipt": receipt(row)}, dropped


def query(db, tenant, event_id):
    with connect(db) as connection:
        connection.execute("BEGIN IMMEDIATE")
        row = connection.execute("SELECT * FROM effects WHERE tenant=? AND event_id=?", (tenant, event_id)).fetchone()
        status = "found" if row else "unknown"
        record(connection, "GET", tenant, event_id, status, row["receipt_id"] if row else None)
        connection.commit()
        return (200, {"status": status, "receipt": receipt(row)}) if row else (404, {"status": status})


def serve(db, drop=None, hold=None, read_timeout=DEFAULT_READ_TIMEOUT_SECONDS):
    if type(read_timeout) not in (int, float) or not math.isfinite(read_timeout) or not 0 < read_timeout <= MAX_READ_TIMEOUT_SECONDS:
        raise Invalid("read_timeout_seconds")
    held_identity = None
    if hold:
        pieces = hold.split("/")
        if len(pieces) != 2 or not all(identity(p) for p in pieces):
            raise Invalid("hold_once")
        held_identity = tuple(pieces)
    initialize(db, drop)
    held_release = threading.Event()
    held_lock = threading.Lock()
    held_claimed = False

    class Handler(BaseHTTPRequestHandler):
        timeout = read_timeout

        def setup(self):
            super().setup()
            self.read_expired = threading.Event()
            def expire_read():
                self.read_expired.set()
                try:
                    self.connection.shutdown(socket.SHUT_RD)
                except OSError:
                    pass
            self.read_timer = threading.Timer(read_timeout, expire_read)
            self.read_timer.daemon = True
            self.read_timer.start()

        def finish_read(self):
            self.read_timer.cancel()
            self.read_timer.join()
            return self.read_expired.is_set()

        def finish(self):
            self.finish_read()
            super().finish()

        def log_message(self, *args):
            pass

        def respond(self, code, data):
            body = json.dumps(data, ensure_ascii=False).encode("utf-8")
            self.send_response(code)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)

        def do_POST(self):
            nonlocal held_claimed
            if self.path != "/effects":
                self.respond(404, {"status": "route_unknown"})
                return
            try:
                length = int(self.headers.get("Content-Length", "-1"))
                if not 0 <= length <= 65536:
                    raise Invalid("body_length")
                raw = self.rfile.read(length)
                if self.finish_read():
                    self.respond(408, {"status": "request_timeout"})
                    return
                if len(raw) != length:
                    raise Invalid("body_length")
                data = decode(raw)
            except TimeoutError:
                self.finish_read()
                self.respond(408, {"status": "request_timeout"})
                return
            except (Invalid, ValueError) as error:
                self.respond(422, {"status": "invalid_request", "field": str(error)})
                return
            claimed = False
            with held_lock:
                if held_identity == (data["tenant"], data["event_id"]) and not held_claimed:
                    held_claimed = claimed = True
            if claimed:
                print(json.dumps({"status": "held_before_apply", "pid": os.getpid(), "identity": list(held_identity), "time_ns": time.time_ns()}), flush=True)
                held_release.wait()
            code, body, dropped = apply(db, data)
            if claimed:
                print(json.dumps({"status": "held_request_settled", "pid": os.getpid(), "identity": list(held_identity),
                                  "http_code": code, "response": body, "dropped": dropped, "time_ns": time.time_ns()}), flush=True)
            if dropped:
                self.close_connection = True
                self.connection.shutdown(socket.SHUT_RDWR)
                self.connection.close()
                return
            self.respond(code, body)

        def do_GET(self):
            if self.finish_read():
                self.respond(408, {"status": "request_timeout"})
                return
            parsed = urllib.parse.urlsplit(self.path)
            if parsed.path != "/effects":
                self.respond(404, {"status": "route_unknown"})
                return
            fields = urllib.parse.parse_qs(parsed.query, keep_blank_values=True)
            if set(fields) != {"tenant", "event_id"} or any(len(v) != 1 or not identity(v[0]) for v in fields.values()):
                self.respond(422, {"status": "invalid_request", "field": "query"})
                return
            self.respond(*query(db, fields["tenant"][0], fields["event_id"][0]))

    server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
    server.daemon_threads = False
    server.block_on_close = True
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    print(json.dumps({"status": "ready", "pid": os.getpid(), "url": f"http://127.0.0.1:{server.server_port}", "read_timeout_seconds": read_timeout}), flush=True)
    try:
        for line in sys.stdin:
            command = line.strip()
            if command == "stop":
                break
            if command == "release" and held_identity is not None and held_claimed and not held_release.is_set():
                print(json.dumps({"status": "hold_released", "pid": os.getpid(), "identity": list(held_identity), "time_ns": time.time_ns()}), flush=True)
                held_release.set()
            else:
                print(json.dumps({"status": "invalid_control", "allowed": ["release", "stop"]}), flush=True)
    finally:
        held_release.set()
        server.shutdown()
        server.server_close()
        thread.join()


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--db", required=True)
    parser.add_argument("--drop-once")
    parser.add_argument("--hold-once")
    parser.add_argument("--read-timeout-seconds", type=float, default=DEFAULT_READ_TIMEOUT_SECONDS)
    args = parser.parse_args()
    serve(args.db, args.drop_once, args.hold_once, args.read_timeout_seconds)
