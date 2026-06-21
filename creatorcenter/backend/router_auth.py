import time
import jwt
from fastapi import APIRouter, Response, Request, HTTPException
from pydantic import BaseModel
from backend.config import APP_PASSWORD, JWT_SECRET

router = APIRouter(prefix="/auth", tags=["auth"])

class LoginRequest(BaseModel):
    password: str

def verify_session(request: Request):
    token = request.cookies.get("session_token")
    if not token:
        raise HTTPException(status_code=401, detail="Unauthorized: No session token found")
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
        if payload.get("expires", 0) < time.time():
            raise HTTPException(status_code=401, detail="Unauthorized: Session expired")
        return payload
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Unauthorized: Invalid token")

@router.post("/login")
def login(req: LoginRequest, response: Response):
    if req.password != APP_PASSWORD:
        raise HTTPException(status_code=401, detail="Invalid password")
    
    # Issue a JWT session token valid for 7 days
    payload = {
        "authenticated": True,
        "expires": time.time() + (7 * 24 * 60 * 60)
    }
    token = jwt.encode(payload, JWT_SECRET, algorithm="HS256")
    
    response.set_cookie(
        key="session_token",
        value=token,
        httponly=True,
        max_age=7 * 24 * 60 * 60,
        expires=7 * 24 * 60 * 60,
        samesite="lax",
        secure=False,  # Set to True in production with HTTPS
    )
    return {"status": "success"}

@router.post("/logout")
def logout(response: Response):
    response.delete_cookie("session_token", httponly=True, samesite="lax")
    return {"status": "success"}

@router.get("/status")
def status(request: Request):
    token = request.cookies.get("session_token")
    if not token:
        return {"authenticated": False}
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
        if payload.get("expires", 0) < time.time():
            return {"authenticated": False}
        return {"authenticated": True}
    except jwt.PyJWTError:
        return {"authenticated": False}
