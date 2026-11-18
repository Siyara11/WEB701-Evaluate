# database.py
# ---------------------------------------------------------------------------
# [R3] Connects FastAPI to a real relational database with SQLAlchemy (an ORM).
# By default it uses SQLite, which stores everything in the file toolshed.db
# beside this script, so data survives a server restart. To use PostgreSQL
# instead, set an environment variable, for example:
#   DATABASE_URL=postgresql+psycopg2://user:password@localhost/toolshed
# No other code changes are needed, because SQLAlchemy hides the differences.
# ---------------------------------------------------------------------------
import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./toolshed.db")

# check_same_thread=False lets FastAPI's worker threads share the SQLite connection
connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}
engine = create_engine(DATABASE_URL, connect_args=connect_args)

# Each request gets its own Session (a unit of work / transaction)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


class Base(DeclarativeBase):
    """Parent class for all table models in models.py."""


def get_db():
    """FastAPI dependency: open a session for one request, always close it after."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
