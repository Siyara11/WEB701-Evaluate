# models.py
# ---------------------------------------------------------------------------
# [R3] SQLAlchemy table definitions. These follow the relational design from
# Milestone One: users, tools and borrowings, linked by foreign keys.
# SQLAlchemy creates the tables automatically on start-up (see main.py).
# ---------------------------------------------------------------------------
from datetime import datetime
from sqlalchemy import String, Integer, ForeignKey, DateTime, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from database import Base


class User(Base):
    __tablename__ = "users"
    id: Mapped[int] = mapped_column(primary_key=True)
    full_name: Mapped[str] = mapped_column(String(100))
    email: Mapped[str] = mapped_column(String(150), unique=True, index=True)  # unique login
    password_hash: Mapped[str] = mapped_column(String(255))  # bcrypt hash, never plain text
    role: Mapped[str] = mapped_column(String(20), default="beneficiary")  # member | beneficiary
    token_balance: Mapped[int] = mapped_column(Integer, default=5)  # starting tokens
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class Tool(Base):
    __tablename__ = "tools"
    id: Mapped[int] = mapped_column(primary_key=True)
    owner_id: Mapped[int] = mapped_column(ForeignKey("users.id"))  # member who listed it
    name: Mapped[str] = mapped_column(String(100))
    category: Mapped[str] = mapped_column(String(50), default="Hand Tools")
    description: Mapped[str] = mapped_column(Text, default="")
    condition: Mapped[str] = mapped_column(String(20), default="Good")
    status: Mapped[str] = mapped_column(String(20), default="available")
    token_cost: Mapped[int] = mapped_column(Integer, default=1)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    owner: Mapped[User] = relationship()  # lets us read tool.owner.full_name (a JOIN)


class Borrowing(Base):
    """[R2] One token transaction: pending -> active (token accepted) -> returned."""
    __tablename__ = "borrowings"
    id: Mapped[int] = mapped_column(primary_key=True)
    tool_id: Mapped[int] = mapped_column(ForeignKey("tools.id"))
    borrower_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    lender_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    tokens_spent: Mapped[int] = mapped_column(Integer, default=1)
    status: Mapped[str] = mapped_column(String(20), default="pending")
    accepted_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    due_date: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    returned_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
