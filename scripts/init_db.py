import os
from pathlib import Path

import psycopg
from dotenv import load_dotenv


def resolve_database_url() -> str:
    load_dotenv()

    database_url = os.getenv("DATABASE_URL", "").strip()
    db_password = os.getenv("DB_PASSWORD", "").strip()

    # Backward-compatible fallback for malformed env like:
    # DB_PASSWORD=DATABASE_URL=postgresql://...
    if not database_url and db_password.startswith("DATABASE_URL="):
        database_url = db_password.split("DATABASE_URL=", 1)[1].strip()

    # Also accept DB_PASSWORD containing a full postgres URL.
    if not database_url and db_password.startswith("postgres"):
        database_url = db_password

    if not database_url:
        raise RuntimeError(
            "DATABASE_URL nao encontrado. Configure DATABASE_URL no .env "
            "ou informe uma URL postgres completa em DB_PASSWORD."
        )

    return database_url


def load_schema() -> str:
    schema_path = Path(__file__).with_name("schema.sql")
    if not schema_path.exists():
        raise RuntimeError(f"Arquivo de schema nao encontrado: {schema_path}")
    return schema_path.read_text(encoding="utf-8")


def main() -> None:
    database_url = resolve_database_url()
    schema_sql = load_schema()

    with psycopg.connect(database_url) as conn:
        with conn.cursor() as cur:
            cur.execute(schema_sql)
        conn.commit()

    print("Tabelas criadas/atualizadas com sucesso.")


if __name__ == "__main__":
    main()
