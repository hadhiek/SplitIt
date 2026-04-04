import psycopg2

def get_connection():
    try:
        conn = psycopg2.connect(
            "postgresql://postgres:Lucagena_66@db.xqivmfmyvbkjbwziflbm.supabase.co:5432/postgres?sslmode=require"
        )
        print("✅ CONNECTED SUCCESSFULLY")
        return conn
    except Exception as e:
        print("❌ CONNECTION ERROR:", e)
        raise e