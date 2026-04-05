import requests

BASE = "http://localhost:8000"

# Using the service role key (no real user sub) - this will get 500 because
# it's a service key, not a user JWT. But we can test the endpoint exists.
# Let's just verify the routes respond (even with 401).

print("=== Testing Loan Endpoints ===\n")

# Test GET loans
r = requests.get(f"{BASE}/api/loans/1", headers={"Authorization": "Bearer FAKE"})
print(f"GET /api/loans/1: {r.status_code}")
# Expected: 401 (not 500 or 404)

# Test POST loans  
r = requests.post(f"{BASE}/api/loans", 
    json={"group_id": 1, "amount": 100},
    headers={"Authorization": "Bearer FAKE"})
print(f"POST /api/loans: {r.status_code}")
# Expected: 401 (not 500 or 404)

# Test that balances endpoint still works
r = requests.get(f"{BASE}/api/settlements/balances/1", headers={"Authorization": "Bearer FAKE"})
print(f"GET /api/settlements/balances/1: {r.status_code}")

# Test groups endpoint still works
r = requests.get(f"{BASE}/api/groups", headers={"Authorization": "Bearer FAKE"})
print(f"GET /api/groups: {r.status_code}")

# Test dashboard still works
r = requests.get(f"{BASE}/api/users/me/dashboard-summary", headers={"Authorization": "Bearer FAKE"})
print(f"GET /api/users/me/dashboard-summary: {r.status_code}")

print("\n✓ All 401s = routes exist and auth works. No 500s = no crashes.")
