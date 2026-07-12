from collections.abc import Generator

from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session, sessionmaker

from .config import settings
from .models import Base

engine = create_engine(
    settings.DATABASE_URL,
    pool_size=5,
    max_overflow=10,
    echo=False,
    pool_pre_ping=True,
)

SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db() -> None:
    """Create tables if they don't exist. Skip if DB is unreachable."""
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        Base.metadata.create_all(bind=engine)
    except Exception as e:
        print(f"Warning: Could not connect to database: {e}")
        print("Server will start but DB-dependent routes will fail.")
