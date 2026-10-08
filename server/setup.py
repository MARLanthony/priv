import os
import re
from pathlib import Path

import mysql.connector

from .app import hash_password


DEMO_USER = {
    "id": 1,
    "name": "Admin User",
    "email": "admin@firm.com",
    "phone": "(555) 100-0001",
    "role": "system_admin",
}


def statements_from(sql):
    source = "\n".join(
        line for line in sql.splitlines() if not line.strip().startswith("--")
    )
    return [statement.strip() for statement in source.split(";") if statement.strip()]


def main():
    database = os.getenv("DB_NAME", "jurisflow")
    if not re.fullmatch(r"[A-Za-z0-9_]+", database):
        raise ValueError("DB_NAME may contain only letters, digits and underscores")

    connection = mysql.connector.connect(
        host=os.getenv("DB_HOST", "127.0.0.1"),
        port=int(os.getenv("DB_PORT", "3306")),
        user=os.getenv("DB_USER", "root"),
        password=os.getenv("DB_PASSWORD", ""),
    )
    cursor = connection.cursor(dictionary=True)
    try:
        cursor.execute(
            f"CREATE DATABASE IF NOT EXISTS `{database}` "
            "CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"
        )
        cursor.execute(f"USE `{database}`")
        if "--reset" in os.sys.argv:
            cursor.execute("DROP TABLE IF EXISTS users")

        schema = Path(__file__).with_name("schema.sql").read_text(encoding="utf-8")
        for statement in statements_from(schema):
            cursor.execute(statement)

        cursor.execute(
            "INSERT INTO users "
            "(id, name, email, phone, password_hash, role, specialization, bar_number) "
            "VALUES (%s, %s, %s, %s, %s, %s, %s, %s) "
            "ON DUPLICATE KEY UPDATE name = VALUES(name), phone = VALUES(phone), "
            "role = VALUES(role), specialization = VALUES(specialization), "
            "bar_number = VALUES(bar_number)",
            (
                DEMO_USER["id"], DEMO_USER["name"], DEMO_USER["email"],
                DEMO_USER["phone"], hash_password("password123"),
                DEMO_USER["role"], None, None,
            ),
        )
        connection.commit()
        cursor.execute("SELECT COUNT(*) AS total FROM users")
        total = cursor.fetchone()["total"]
        print(f"[db] schema ready -> {database}; {total} account(s) total")
        print("[db] demo admin: admin@firm.com / password123")
        print("[db] start the API with: npm run api")
    finally:
        cursor.close()
        connection.close()


if __name__ == "__main__":
    main()