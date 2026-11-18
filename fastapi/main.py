# main.py
# ---------------------------------------------------------------------------
# FastAPI prototype for the Nelson Community Tool Shed.
# Run:  uvicorn main:app --reload --port 8000     then open http://localhost:8000/docs
#  [R1] /api/auth/register, /api/auth/login, /api/auth/me (GET + PUT)
#  [R2] /api/tools/{id}/borrow, /api/borrowings/{id}/accept|decline|return
#  [R3] /api/tools (GET, POST, PUT, DELETE) stored in a SQL database
# ---------------------------------------------------------------------------
from contextlib import asynccontextmanager
from datetime import datetime, timedelta

from fastapi import FastAPI, Depends, HTTPException
from sqlalchemy import select, update, or_
from sqlalchemy.orm import Session

from database import Base, engine, get_db, SessionLocal
from models import User, Tool, Borrowing
from schemas import RegisterIn, LoginIn, UpdateMeIn, UserOut, ToolIn, ToolOut, BorrowingOut
from auth import hash_password, verify_password, create_token, get_current_user, require_role

LOAN_DAYS = 7


def seed():
    """[R3] Insert demo data the first time the database is empty (password: Password123)."""
    with SessionLocal() as db:
        if db.scalar(select(User).limit(1)):
            return
        member = User(full_name="Aroha Member", email="member@toolshed.nz",
                      password_hash=hash_password("Password123"), role="member")
        db.add_all([member, User(full_name="Ben Beneficiary", email="beneficiary@toolshed.nz",
                                 password_hash=hash_password("Password123"), role="beneficiary")])
        db.flush()  # gives member an id so the tools can reference it
        db.add_all([
            Tool(owner_id=member.id, name="Cordless Drill", category="Power Tools", condition="Good"),
            Tool(owner_id=member.id, name="Garden Spade", category="Garden", condition="Well Loved"),
        ])
        db.commit()


@asynccontextmanager
async def lifespan(_app: FastAPI):
    # On start-up: create any missing tables (CREATE TABLE IF NOT EXISTS) and seed
    Base.metadata.create_all(bind=engine)
    seed()
    yield


app = FastAPI(title="Nelson Community Tool Shed API (FastAPI)", lifespan=lifespan)


# ======================= [R1] ACCOUNTS (JWT) =======================
@app.post("/api/auth/register", response_model=UserOut, status_code=201)
def register(body: RegisterIn, db: Session = Depends(get_db)):
    # Pydantic has already validated the body (email format, password length, role)
    if db.scalar(select(User).where(User.email == body.email.lower())):
        raise HTTPException(409, "Email already registered")
    user = User(full_name=body.full_name, email=body.email.lower(),
                password_hash=hash_password(body.password), role=body.role)
    db.add(user)      # INSERT INTO users ...
    db.commit()       # save permanently
    db.refresh(user)  # reload to get the new id
    return user


@app.post("/api/auth/login")
def login(body: LoginIn, db: Session = Depends(get_db)):
    user = db.scalar(select(User).where(User.email == body.email.lower()))
    # Same error for unknown email and wrong password, so emails cannot be guessed
    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(401, "Invalid email or password")
    return {"token": create_token(user), "user": UserOut.model_validate(user)}


@app.get("/api/auth/me", response_model=UserOut)
def read_me(me: User = Depends(get_current_user)):
    # get_current_user verified the JWT and loaded the user from the database
    return me


@app.put("/api/auth/me", response_model=UserOut)
def update_me(body: UpdateMeIn, me: User = Depends(get_current_user), db: Session = Depends(get_db)):
    # The user can only change their own row: the id comes from the token
    me = db.merge(me)
    if body.full_name:
        me.full_name = body.full_name
    if body.password:
        me.password_hash = hash_password(body.password)
    db.commit()
    db.refresh(me)
    return me


# ======================= [R3] TOOLS (database) =======================
@app.get("/api/tools", response_model=list[ToolOut])
def list_tools(q: str | None = None, category: str | None = None, db: Session = Depends(get_db)):
    stmt = select(Tool).order_by(Tool.created_at.desc())
    if q:
        stmt = stmt.where(Tool.name.ilike(f"%{q}%"))  # parameterised - safe from SQL injection
    if category:
        stmt = stmt.where(Tool.category == category)
    return db.scalars(stmt).all()


@app.get("/api/tools/{tool_id}", response_model=ToolOut)
def get_tool(tool_id: int, db: Session = Depends(get_db)):
    tool = db.get(Tool, tool_id)
    if not tool:
        raise HTTPException(404, "Tool not found")
    return tool


@app.post("/api/tools", response_model=ToolOut, status_code=201)
def create_tool(body: ToolIn, me: User = Depends(require_role("member")), db: Session = Depends(get_db)):
    # owner_id comes from the JWT, never from the request body
    tool = Tool(owner_id=me.id, **body.model_dump())
    db.add(tool)
    db.commit()
    db.refresh(tool)
    return tool


@app.put("/api/tools/{tool_id}", response_model=ToolOut)
def update_tool(tool_id: int, body: ToolIn, me: User = Depends(require_role("member")), db: Session = Depends(get_db)):
    tool = db.get(Tool, tool_id)
    if not tool or tool.owner_id != me.id:
        raise HTTPException(404, "Tool not found or not yours")
    for key, value in body.model_dump().items():
        setattr(tool, key, value)
    db.commit()
    db.refresh(tool)
    return tool


@app.delete("/api/tools/{tool_id}")
def delete_tool(tool_id: int, me: User = Depends(require_role("member")), db: Session = Depends(get_db)):
    tool = db.get(Tool, tool_id)
    if not tool or tool.owner_id != me.id or tool.status != "available":
        raise HTTPException(404, "Tool not found, not yours, or on loan")
    db.delete(tool)
    db.commit()
    return {"message": "Tool removed"}


# ======================= [R2] TOKEN TRANSACTIONS =======================
@app.post("/api/tools/{tool_id}/borrow", response_model=BorrowingOut, status_code=201)
def borrow(tool_id: int, me: User = Depends(require_role("beneficiary")), db: Session = Depends(get_db)):
    """A beneficiary offers tokens for a tool. Tokens move only when the member accepts."""
    tool = db.get(Tool, tool_id)
    if not tool:
        raise HTTPException(404, "Tool not found")
    if me.token_balance < tool.token_cost:
        raise HTTPException(400, "Not enough tokens")
    # Conditional UPDATE: only succeeds if the tool is still available (prevents double booking)
    result = db.execute(update(Tool).where(Tool.id == tool_id, Tool.status == "available").values(status="requested"))
    if result.rowcount == 0:
        raise HTTPException(409, "Tool is not available")
    b = Borrowing(tool_id=tool.id, borrower_id=me.id, lender_id=tool.owner_id, tokens_spent=tool.token_cost)
    db.add(b)
    db.commit()  # the status change and the new borrowing are saved together
    db.refresh(b)
    return b


@app.get("/api/borrowings", response_model=list[BorrowingOut])
def my_borrowings(me: User = Depends(get_current_user), db: Session = Depends(get_db)):
    stmt = select(Borrowing).where(or_(Borrowing.borrower_id == me.id, Borrowing.lender_id == me.id))
    return db.scalars(stmt.order_by(Borrowing.created_at.desc())).all()


def own_borrowing(db: Session, borrowing_id: int, member: User, status: str) -> Borrowing:
    b = db.get(Borrowing, borrowing_id)
    if not b or b.lender_id != member.id or b.status != status:
        raise HTTPException(404, f"No {status} transaction with this id for your tools")
    return b


@app.post("/api/borrowings/{borrowing_id}/accept")
def accept_token(borrowing_id: int, me: User = Depends(require_role("member")), db: Session = Depends(get_db)):
    """The member accepts the token: move tokens and lend the tool in ONE database transaction."""
    b = own_borrowing(db, borrowing_id, me, "pending")
    # 1. Subtract from the beneficiary only if they still have enough (never negative)
    taken = db.execute(
        update(User).where(User.id == b.borrower_id, User.token_balance >= b.tokens_spent)
        .values(token_balance=User.token_balance - b.tokens_spent)
    )
    if taken.rowcount == 0:
        db.rollback()
        raise HTTPException(400, "Beneficiary no longer has enough tokens")
    # 2. Credit the member, 3. mark the tool borrowed, 4. activate the transaction
    db.execute(update(User).where(User.id == me.id).values(token_balance=User.token_balance + b.tokens_spent))
    db.execute(update(Tool).where(Tool.id == b.tool_id).values(status="borrowed"))
    b.status = "active"
    b.accepted_at = datetime.utcnow()
    b.due_date = b.accepted_at + timedelta(days=LOAN_DAYS)
    db.commit()  # all four changes succeed or fail together (atomic)
    db.refresh(b)
    borrower = db.get(User, b.borrower_id)
    return {"message": "Token accepted", "transaction": BorrowingOut.model_validate(b),
            "borrower_token_balance": borrower.token_balance}


@app.post("/api/borrowings/{borrowing_id}/decline")
def decline(borrowing_id: int, me: User = Depends(require_role("member")), db: Session = Depends(get_db)):
    b = own_borrowing(db, borrowing_id, me, "pending")
    b.status = "declined"
    db.execute(update(Tool).where(Tool.id == b.tool_id).values(status="available"))
    db.commit()
    return {"message": "Request declined"}


@app.post("/api/borrowings/{borrowing_id}/return")
def confirm_return(borrowing_id: int, me: User = Depends(require_role("member")), db: Session = Depends(get_db)):
    b = own_borrowing(db, borrowing_id, me, "active")
    b.status = "returned"
    b.returned_at = datetime.utcnow()
    db.execute(update(Tool).where(Tool.id == b.tool_id).values(status="available"))
    db.commit()
    return {"message": "Tool returned and available again"}
