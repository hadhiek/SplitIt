import requests
import json

headers = {"Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhxaXZtZm15dmJramJ3emlmbGJtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTIzODIxNywiZXhwIjoyMDkwODE0MjE3fQ.lsx18eOqsS_vbIsJWjrOsHnI3-PgG-UEtAkNDumJBB8"}

try:
    res = requests.get("http://localhost:8000/api/users/me/dashboard-summary", headers=headers)
    print("STATUS:", res.status_code)
    print("BODY:", res.text)
except Exception as e:
    print("ERROR:", e)
