"""Users router — profile and preferences."""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user import User
from app.schemas.user import UserUpdate, UserResponse
from app.services.auth import get_current_user

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/search", response_model=list[UserResponse])
async def search_users(
    q: str = Query(..., min_length=1, description="Username prefix to search"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Search users by username prefix. Used for sharing watchlists."""
    result = await db.execute(
        select(User)
        .where(User.username.ilike(f"{q}%"))
        .where(User.id != current_user.id)
        .limit(10)
    )
    return result.scalars().all()


@router.patch("/me", response_model=UserResponse)
async def update_profile(
    updates: UserUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update the current user's profile."""
    if updates.display_name is not None:
        current_user.display_name = updates.display_name
    if updates.email is not None:
        current_user.email = updates.email
    if updates.theme_preference is not None:
        if updates.theme_preference not in ("dark", "light"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="theme_preference must be 'dark' or 'light'",
            )
        current_user.theme_preference = updates.theme_preference

    db.add(current_user)
    await db.flush()
    await db.refresh(current_user)
    return current_user
