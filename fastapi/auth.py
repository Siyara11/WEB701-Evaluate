# auth.py
# ---------------------------------------------------------------------------
# [R1][R2] Password hashing and JWT helpers for the FastAPI prototype.
#   hash_password / verify_password - bcrypt, so plain passwords are never stored
#   create_token                    - signs a JWT holding the user id and role
#   get_current_user                - dependency that protects a route: it reads
#                                     "Authorization: Bearer <token>", verifies
#                                     it and loads the user from the database
#   require_role("member")          - dependency that also checks the role
# ---------------------------------------------------------------------------
import os
from datetime import datetime, timedelta, timezone

import bcrypt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt, JWTError
from sqlalchemy.orm import Session

from database import get_db
from models import User

SECRET_KEY = os.getenv("JWT_SECRET", "dev-only-secret-change-me")
ALGORITHM = "HS256"

# HTTPBearer adds the "Authorize" button to Swagger UI (/docs), where the
# token can be pasted once and then sent with every protected request.
security = HTTPBearer()


def hash_password(password: str) -> str:
    # bcrypt only uses the first 72 bytes; gensalt() adds a random salt
    return bcrypt.hashpw(password.encode("utf-8")[:72], bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode("utf-8")[:72], hashed.encode("utf-8"))
    except ValueError:
        return False


def create_token(user: User) -> str:
    # "sub" (subject) is the standard JWT claim for the user id; "exp" makes it expire
    payload = {
        "sub": str(user.id),
        "role": user.role,
        "exp": datetime.now(timezone.utc) + timedelta(hours=1),
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db),
) -> User:
    """Runs before any route that declares Depends(get_current_user)."""
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError:
        # bad signature or expired -> 401
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid or expired token")
    user = db.get(User, int(payload["sub"]))  # look the user up by primary key
    if not user:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "User no longer exists")
    return user


def require_role(*roles: str):
    """Role-based access control, e.g. Depends(require_role("member"))."""
    def checker(user: User = Depends(get_current_user)) -> User:
        if user.role not in roles:
            raise HTTPException(status.HTTP_403_FORBIDDEN, f"Only {' or '.join(roles)} accounts can do this")
        return user
    return checker
