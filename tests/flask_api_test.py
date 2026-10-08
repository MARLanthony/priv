import unittest
from datetime import datetime

from server.app import create_app, hash_password


class FakeDatabase:
    def __init__(self):
        self.users = {}
        self.next_id = 1

    def connect(self):
        return FakeConnection(self)


class FakeConnection:
    def __init__(self, database):
        self.database = database

    def cursor(self, dictionary=False):
        return FakeCursor(self.database)

    def commit(self):
        pass

    def close(self):
        pass


class FakeCursor:
    def __init__(self, database):
        self.database = database
        self.result = None
        self.lastrowid = None

    def execute(self, sql, params=()):
        if sql.startswith("INSERT INTO users"):
            name, email, phone, password_hash = params
            if any(user["email"] == email for user in self.database.users.values()):
                import mysql.connector
                raise mysql.connector.IntegrityError(msg="duplicate", errno=1062)
            self.lastrowid = self.database.next_id
            self.database.next_id += 1
            self.database.users[self.lastrowid] = {
                "id": self.lastrowid, "name": name, "email": email, "phone": phone,
                "password_hash": password_hash, "role": "user",
                "created_at": datetime(2026, 1, 2),
            }
        elif "COUNT(*)" in sql:
            self.result = {"total": len(self.database.users)}
        elif "WHERE email" in sql:
            self.result = next(
                (user for user in self.database.users.values() if user["email"] == params[0]),
                None,
            )
        elif "WHERE id" in sql:
            self.result = self.database.users.get(params[0])

    def fetchone(self):
        return self.result

    def fetchall(self):
        return self.result or []

    def close(self):
        pass


class FlaskApiTest(unittest.TestCase):
    def setUp(self):
        self.database = FakeDatabase()
        self.client = create_app(self.database.connect).test_client()

    def test_registration_login_and_bearer_session(self):
        response = self.client.post("/api/auth/register", json={
            "name": "Test Client", "email": "Client@example.com",
            "password": "Str0ng!Pass", "phone": "555-0100", "role": "system_admin",
        })
        self.assertEqual(response.status_code, 201)
        created = response.get_json()
        self.assertEqual(created["user"]["role"], "user")
        self.assertEqual(created["user"]["email"], "client@example.com")
        self.assertNotIn("password_hash", created["user"])

        duplicate = self.client.post("/api/auth/register", json={
            "name": "Other Client", "email": "client@example.com", "password": "Str0ng!Pass",
        })
        self.assertEqual(duplicate.status_code, 409)

        login = self.client.post("/api/auth/login", json={
            "email": "CLIENT@example.com", "password": "Str0ng!Pass",
        })
        self.assertEqual(login.status_code, 200)
        me = self.client.get("/api/auth/me", headers={
            "Authorization": f"Bearer {created['token']}",
        })
        self.assertEqual(me.status_code, 200)
        self.assertEqual(me.get_json()["id"], created["user"]["id"])

    def test_rejects_invalid_password_and_unauthenticated_me(self):
        response = self.client.post("/api/auth/register", json={
            "name": "Test Client", "email": "client@example.com", "password": "password123",
        })
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.get_json()["error"], "Include a special character (!@#$%).")
        self.assertEqual(self.client.get("/api/auth/me").status_code, 401)

    def test_health_and_logout(self):
        health = self.client.get("/api/health")
        self.assertTrue(health.get_json()["ok"])
        self.assertEqual(health.get_json()["users"], 0)
        self.assertEqual(self.client.post("/api/auth/logout").get_json(), {"success": True})

    def test_scrypt_hash_matches_existing_format(self):
        stored = hash_password("Str0ng!Pass")
        self.assertRegex(stored, r"^scrypt\$[0-9a-f]+\$[0-9a-f]+$")


if __name__ == "__main__":
    unittest.main()