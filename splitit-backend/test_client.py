import asyncio
from fastapi.testclient import TestClient
from main import app
from core.security import get_current_user_id

def override_get_current_user_id():
    return "a682214b-3b72-43bf-8ad9-a67bb290ac11"

app.dependency_overrides[get_current_user_id] = override_get_current_user_id

client = TestClient(app)

print("Starting Groups Fetch...")
g_res = client.get("/api/groups")
print("Groups Status:", g_res.status_code)

print("Starting Expenses Fetch...")
e_res = client.get("/api/expenses")
print("Expenses Status:", e_res.status_code)
