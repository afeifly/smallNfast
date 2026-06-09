from datetime import datetime, timedelta
from typing import Optional
from jose import jwt
from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError
import bcrypt
from app.core.config import settings

ph = PasswordHasher()

def verify_password(plain_password: str, hashed_password: str) -> bool:
    if hashed_password.startswith("$argon2"):
        try:
            return ph.verify(hashed_password, plain_password)
        except VerifyMismatchError:
            return False
    elif hashed_password.startswith("$2"):
        # Handle Bcrypt
        try:
            return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))
        except ValueError:
            return False
    return False

def get_password_hash(password: str) -> str:
    return ph.hash(password)

def needs_rehash(hashed_password: str) -> bool:
    return not hashed_password.startswith("$argon2")

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt
