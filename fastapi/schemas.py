# schemas.py
# ---------------------------------------------------------------------------
# Pydantic models describe the JSON that goes in and out of the API.
# FastAPI uses them to validate requests automatically (returning 422 with a
# clear message when data is wrong) and to draw the Swagger documentation.
# ---------------------------------------------------------------------------
from datetime import datetime
from typing import Literal
from pydantic import BaseModel, ConfigDict, EmailStr, Field


# ---------- [R1] accounts ----------
class RegisterIn(BaseModel):
    full_name: str = Field(min_length=2, max_length=100)
    email: EmailStr  # must look like a real email address
    password: str = Field(min_length=8)
    role: Literal["member", "beneficiary"] = "beneficiary"  # admin cannot self-register


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class UpdateMeIn(BaseModel):
    full_name: str | None = Field(default=None, min_length=2, max_length=100)
    password: str | None = Field(default=None, min_length=8)


class UserOut(BaseModel):
    # from_attributes lets Pydantic read SQLAlchemy objects directly.
    # password_hash is not listed, so it is never returned to the client.
    model_config = ConfigDict(from_attributes=True)
    id: int
    full_name: str
    email: str
    role: str
    token_balance: int


# ---------- [R3] tools ----------
class ToolIn(BaseModel):
    name: str = Field(min_length=2, max_length=100)
    category: str = "Hand Tools"
    description: str = ""
    condition: Literal["Like New", "Good", "Well Loved"] = "Good"
    token_cost: int = Field(default=1, gt=0)


class ToolOut(ToolIn):
    model_config = ConfigDict(from_attributes=True)
    id: int
    owner_id: int
    status: str


# ---------- [R2] transactions ----------
class BorrowingOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    tool_id: int
    borrower_id: int
    lender_id: int
    tokens_spent: int
    status: str
    accepted_at: datetime | None = None
    due_date: datetime | None = None
    returned_at: datetime | None = None
