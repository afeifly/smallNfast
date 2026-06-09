from datetime import timedelta
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlmodel import Session, select
from app.database import get_session
from app.models import User, Role
from app.api.deps import get_current_user
from app.core.security import create_access_token, verify_password, get_password_hash, needs_rehash
from app.core.config import settings

router = APIRouter()

@router.post("/token")
async def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends(), session: Session = Depends(get_session)):
    user = session.exec(select(User).where(User.username == form_data.username)).first()
    if not user or not verify_password(form_data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    if needs_rehash(user.password_hash):
        user.password_hash = get_password_hash(form_data.password)
        session.add(user)
        session.commit()
        session.refresh(user)

    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.username, "role": user.role, "id": user.id}, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}

    return {"access_token": access_token, "token_type": "bearer"}

@router.post("/login-as/{user_id}")
async def login_as_user(
    user_id: int,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    # Only admin can use this
    if current_user.role != Role.ADMIN:
        raise HTTPException(status_code=403, detail="Not authorized")
        
    # Find target user
    target_user = session.get(User, user_id)
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")
        
    # Prevent logging in as another admin (optional, but good practice)
    # User said "no need for admin line", implying we don't need to login as admins.
    if target_user.role == Role.ADMIN:
         raise HTTPException(status_code=400, detail="Cannot login as another admin")
         
    # Generate token for target user
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": target_user.username, "role": target_user.role, "id": target_user.id},
        expires_delta=access_token_expires
    )
    
    return {
        "access_token": access_token, 
        "token_type": "bearer",
        "user": {
            "id": target_user.id,
            "username": target_user.username,
            "role": target_user.role,
            "full_name": target_user.full_name
        }
    }
