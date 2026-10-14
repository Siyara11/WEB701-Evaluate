from fastapi import FastAPI, HTTPException, Depends
from pydantic import BaseModel, Field
from auth import (hash_password, verify_password, create_token,
                  get_current_user, users)

app = FastAPI(title="Community Food Donation API")

# ---------- REQ 3: foods store ----------
class FoodIn(BaseModel):
    name: str = Field(min_length=2, max_length=100)
    quantity: int = Field(gt=0)
    tokens: int = Field(default=1, gt=0)

foods = [{"id": 1, "name": "Rice pack", "quantity": 10, "tokens": 1}]

@app.get("/foods")
def list_foods():
    return foods

@app.post("/foods", status_code=201)
def create_food(item: FoodIn):
    record = {"id": len(foods) + 1, **item.model_dump()}
    foods.append(record)
    return record

# ---------- REQ 1: JWT auth ----------
class UserIn(BaseModel):
    email: str
    password: str
    role: str = "beneficiary"

@app.post("/register", status_code=201)
def register(user: UserIn):
    if any(u["email"] == user.email for u in users):
        raise HTTPException(400, "Email already exists")
    record = {"id": len(users) + 1, "email": user.email,
              "hashed_password": hash_password(user.password),
              "role": user.role}
    users.append(record)
    return {"message": "Registered", "email": user.email, "role": user.role}

@app.post("/login")
def login(user: UserIn):
    existing = next((u for u in users if u["email"] == user.email), None)
    if not existing or not verify_password(user.password, existing["hashed_password"]):
        raise HTTPException(400, "Invalid credentials")
    token = create_token(existing["id"], existing["role"])
    return {"token": token, "role": existing["role"], "email": existing["email"]}

@app.get("/me")
def me(current=Depends(get_current_user)):
    return current

# ---------- REQ 2: Accept token ----------
@app.post("/transactions/accept/{food_id}")
def accept_token(food_id: int, current=Depends(get_current_user)):
    food = next((f for f in foods if f["id"] == food_id), None)
    if not food:
        raise HTTPException(404, "Food not found")
    if food["quantity"] <= 0:
        raise HTTPException(400, "Out of stock")
    food["quantity"] -= 1
    return {"message": "Token accepted", "food": food, "acceptedBy": current["sub"]}