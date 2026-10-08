import hashlib
import hmac
import logging
import os
import re
from datetime import date, datetime, timezone

import jwt
import mysql.connector
from dotenv import load_dotenv
from flask import Flask, jsonify, request
from werkzeug.exceptions import BadRequest

load_dotenv()

EMAIL_PATTERN = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")
PASSWORD_MIN_LENGTH = 8
PASSWORD_SYMBOL_PATTERN = re.compile(r"[^A-Za-z0-9\s]")


def password_policy_error(password):
    missing = []
    if len(password) < PASSWORD_MIN_LENGTH:
        missing.append("length")
    if not re.search(r"[A-Za-z]", password):
        missing.append("a letter")
    if not re.search(r"\d", password):
        missing.append("a number")
    if not PASSWORD_SYMBOL_PATTERN.search(password):
        missing.append("a special character (!@#$%)")
    if not missing:
        return None
    if missing[0] == "length":
        return f"Use at least {PASSWORD_MIN_LENGTH} characters."
    if len(missing) == 1:
        return f"Include {missing[0]}."
    return f"Include {', '.join(missing[:-1])} and {missing[-1]}."


def hash_password(password):
    salt = os.urandom(16)
    derived = hashlib.scrypt(
        password.encode("utf-8"), salt=salt, n=2**14, r=8, p=1, dklen=64
    )
    return f"scrypt${salt.hex()}${derived.hex()}"


def verify_password(password, stored):
    try:
        scheme, salt_hex, hash_hex = str(stored or "").split("$")
        if scheme != "scrypt":
            return False
        salt = bytes.fromhex(salt_hex)
        expected = bytes.fromhex(hash_hex)
        if not salt or not expected:
            return False
        actual = hashlib.scrypt(
            password.encode("utf-8"), salt=salt, n=2**14, r=8, p=1,
            dklen=len(expected),
        )
        return hmac.compare_digest(expected, actual)
    except (ValueError, TypeError):
        return False


def token_secret():
    return os.getenv("AUTH_TOKEN_SECRET") or "jurisflow-development-only-secret-change-me"


def sign_token(user_id):
    now = datetime.now(timezone.utc)
    ttl = int(os.getenv("AUTH_TOKEN_TTL", str(7 * 24 * 60 * 60)))
    return jwt.encode(
        {"sub": user_id, "iat": now, "exp": now.timestamp() + ttl},
        token_secret(),
        algorithm="HS256",
    )


def token_from_request():
    header = request.headers.get("Authorization", "")
    match = re.match(r"^Bearer\s+(.+)$", header, re.IGNORECASE)
    if not match:
        return None
    try:
        return jwt.decode(
            match.group(1).strip(), token_secret(), algorithms=["HS256"],
            options={"verify_sub": False},
        )
    except jwt.InvalidTokenError:
        return None


def public_user(row):
    created_at = row.get("created_at")
    if isinstance(created_at, (date, datetime)):
        created_at = created_at.isoformat()[:10]
    elif created_at:
        created_at = str(created_at)[:10]
    else:
        created_at = date.today().isoformat()

    user = {
        "id": row["id"],
        "name": row["name"],
        "email": row["email"],
        "role": row["role"],
        "createdAt": created_at,
    }
    for source, target in (("phone", "phone"), ("specialization", "specialization"),
                           ("bar_number", "barNumber")):
        if row.get(source):
            user[target] = row[source]
    return user


def create_app(connect=None):
    app = Flask(__name__)
    app.config["MAX_CONTENT_LENGTH"] = 100 * 1024
    connector = connect or (lambda: mysql.connector.connect(
        host=os.getenv("DB_HOST", "127.0.0.1"),
        port=int(os.getenv("DB_PORT", "3306")),
        user=os.getenv("DB_USER", "root"),
        password=os.getenv("DB_PASSWORD", ""),
        database=os.getenv("DB_NAME", "jurisflow"),
    ))

    def query(sql, params=(), *, fetch="one", commit=False):
        connection = connector()
        cursor = connection.cursor(dictionary=True)
        try:
            cursor.execute(sql, params)
            if commit:
                connection.commit()
            if fetch == "none":
                return cursor.lastrowid
            if fetch == "all":
                return cursor.fetchall()
            return cursor.fetchone()
        finally:
            cursor.close()
            connection.close()

    @app.get("/api/health")
    def health():
        row = query("SELECT COUNT(*) AS total FROM users")
        target = (f"{os.getenv('DB_HOST', '127.0.0.1')}:"
                  f"{os.getenv('DB_PORT', '3306')}/{os.getenv('DB_NAME', 'jurisflow')}")
        return jsonify(ok=True, database=target, users=int(row["total"]))

    @app.post("/api/auth/register")
    def register():
        body = request.get_json(silent=False) or {}
        name = str(body.get("name") or "").strip()
        email = str(body.get("email") or "").strip().lower()
        password = str(body.get("password") or "")
        phone = str(body.get("phone") or "").strip()

        if not name or not email or not password:
            return jsonify(error="Name, email and password are required"), 400
        if len(name) < 2:
            return jsonify(error="Please enter your full name."), 400
        if not EMAIL_PATTERN.fullmatch(email):
            return jsonify(error="Please enter a valid email address"), 400
        password_error = password_policy_error(password)
        if password_error:
            return jsonify(error=password_error), 400

        try:
            user_id = query(
                "INSERT INTO users (name, email, phone, password_hash, role, created_at) "
                "VALUES (%s, %s, %s, %s, 'user', NOW())",
                (name, email, phone or None, hash_password(password)),
                fetch="none", commit=True,
            )
        except mysql.connector.IntegrityError as error:
            if error.errno == 1062:
                return jsonify(error="An account with this email already exists"), 409
            raise

        row = query("SELECT * FROM users WHERE id = %s", (user_id,))
        user = public_user(row)
        return jsonify(user=user, token=sign_token(user["id"])), 201

    @app.post("/api/auth/login")
    def login():
        body = request.get_json(silent=False) or {}
        email = str(body.get("email") or "").strip().lower()
        password = str(body.get("password") or "")
        row = query("SELECT * FROM users WHERE email = %s LIMIT 1", (email,))
        if not row or not verify_password(password, row.get("password_hash")):
            return jsonify(error="Invalid credentials"), 401
        user = public_user(row)
        return jsonify(user=user, token=sign_token(user["id"]))

    @app.post("/api/auth/logout")
    def logout():
        return jsonify(success=True)

    @app.get("/api/auth/me")
    def current_user():
        payload = token_from_request()
        if not payload or not isinstance(payload.get("sub"), int):
            return jsonify(error="Not authenticated"), 401
        row = query("SELECT * FROM users WHERE id = %s LIMIT 1", (payload["sub"],))
        if not row:
            return jsonify(error="Not authenticated"), 401
        return jsonify(public_user(row))

    @app.errorhandler(BadRequest)
    def invalid_json(_error):
        return jsonify(error="Invalid JSON body"), 400

    @app.errorhandler(Exception)
    def handle_error(error):
        logging.exception("[api] request failed: %s", error)
        if isinstance(error, mysql.connector.Error) and error.errno in (2002, 2003, 2055):
            return jsonify(error="Database unavailable - is MySQL running?"), 503
        return jsonify(error="Database error"), 500

    return app


app = create_app()