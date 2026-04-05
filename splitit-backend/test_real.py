import requests

headers = {"Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhxaXZtZm15dmJramJ3emlmbGJtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTIzODIxNywiZXhwIjoyMDkwODE0MjE3fQ.lsx18eOqsS_vbIsJWjrOsHnI3-PgG-UEtAkNDumJBB8"}
try:
    print("Dashboard:")
    res = requests.get("http://localhost:8000/api/users/me/dashboard-summary", headers=headers)
    print(res.status_code, res.text[:200])
except Exception as e:
    print(e)

try:
    print("\nGroups:")
    res = requests.get("http://localhost:8000/api/groups", headers=headers)
    print(res.status_code, res.text[:200])
except Exception as e:
    print(e)
    
try:
    print("\nExpenses:")
    res = requests.get("http://localhost:8000/api/expenses", headers=headers)
    print(res.status_code, res.text[:200])
except Exception as e:
    print(e)
