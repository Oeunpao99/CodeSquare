from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel, Field, ConfigDict, computed_field
from typing import Optional
from datetime import datetime, timedelta
import jwt
from jwt import PyJWTError
import base64
import binascii
import re
import bcrypt
from database import get_db
from models.models import User
import os
from dotenv import load_dotenv

load_dotenv()

router = APIRouter()

# The JWT signing key is mandatory and must be strong — a forged token here is a
# full account (and admin) takeover. No fallback: refuse to boot without one.
SECRET_KEY = os.getenv("SECRET_KEY", "")
_INSECURE_KEYS = {
    "",
    "codesphere-secret-key-change-in-production-2024",
    "change-me",
    "secret",
    "your-secret-key",
}
if SECRET_KEY in _INSECURE_KEYS or len(SECRET_KEY) < 32:
    raise RuntimeError(
        "SECRET_KEY is unset, too short, or a known default. Set SECRET_KEY in "
        "the environment to a unique random string of at least 32 characters "
        '(e.g. `python -c "import secrets; print(secrets.token_urlsafe(48))"`).'
    )
ALGORITHM = os.getenv("ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "1440"))

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/auth/login")

class UserCreate(BaseModel):
    email: str = Field(
        min_length=5, max_length=254, pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$"
    )
    username: str = Field(min_length=3, max_length=32, pattern=r"^[A-Za-z0-9_.-]+$")
    password: str = Field(min_length=10, max_length=128)

class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: str
    username: str
    display_name: Optional[str] = None
    headline: Optional[str] = None
    bio: Optional[str] = None
    avatar_url: Optional[str] = None
    # Raw uploaded image — kept out of the serialized payload; `avatar` below is
    # the effective one clients should render.
    avatar_data: Optional[str] = Field(default=None, exclude=True)
    github_url: Optional[str] = None
    website_url: Optional[str] = None
    linkedin_url: Optional[str] = None
    major: Optional[str] = None
    plan: Optional[str] = "free"
    plan_expires_at: Optional[datetime] = None
    onboarded_at: Optional[datetime] = Field(default=None, exclude=True)
    created_at: datetime

    @computed_field
    @property
    def avatar(self) -> Optional[str]:
        """Uploaded image wins over an OAuth picture URL."""
        return self.avatar_data or self.avatar_url

    @computed_field
    @property
    def onboarded(self) -> bool:
        return self.onboarded_at is not None

class MajorUpdate(BaseModel):
    major: Optional[str] = None

class ProfileUpdate(BaseModel):
    """All fields optional — only the keys present in the request are touched."""
    display_name: Optional[str] = Field(default=None, max_length=60)
    headline: Optional[str] = Field(default=None, max_length=120)
    bio: Optional[str] = Field(default=None, max_length=600)
    github_url: Optional[str] = Field(default=None, max_length=300)
    website_url: Optional[str] = Field(default=None, max_length=300)
    linkedin_url: Optional[str] = Field(default=None, max_length=300)
    # data:image/(png|jpeg|webp|gif);base64,<...>  — send "" to clear.
    avatar_data: Optional[str] = Field(default=None, max_length=400_000)
    complete_onboarding: bool = False

class Token(BaseModel):
    access_token: str
    token_type: str
    user: UserResponse

class GoogleAuth(BaseModel):
    token: str

def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        return bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))
    except ValueError:
        return False

def get_password_hash(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

async def get_current_user(token: str = Depends(oauth2_scheme), db: AsyncSession = Depends(get_db)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        sub = payload.get("sub")
        if sub is None:
            raise credentials_exception
        user_id = int(sub)
    except (PyJWTError, ValueError, TypeError):
        raise credentials_exception
    
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if user is None:
        raise credentials_exception
    return user

@router.post("/register", response_model=Token)
async def register(user_data: UserCreate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == user_data.email))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Email already registered")
    
    result = await db.execute(select(User).where(User.username == user_data.username))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Username already taken")
    
    user = User(
        email=user_data.email,
        username=user_data.username,
        hashed_password=get_password_hash(user_data.password)
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    
    access_token = create_access_token(data={"sub": str(user.id)})
    return Token(
        access_token=access_token,
        token_type="bearer",
        user=UserResponse.model_validate(user)
    )

@router.post("/login", response_model=Token)
async def login(form_data: OAuth2PasswordRequestForm = Depends(), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == form_data.username))
    user = result.scalar_one_or_none()
    
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    access_token = create_access_token(data={"sub": str(user.id)})
    return Token(
        access_token=access_token,
        token_type="bearer",
        user=UserResponse.model_validate(user)
    )

@router.post("/google", response_model=Token)
async def google_auth(auth_data: GoogleAuth, db: AsyncSession = Depends(get_db)):
    try:
        from google.oauth2 import id_token
        from google.auth.transport import requests as google_requests
        
        client_id = os.getenv("GOOGLE_CLIENT_ID")
        idinfo = id_token.verify_oauth2_token(
            auth_data.token, 
            google_requests.Request(), 
            client_id
        )
        
        google_id = idinfo["sub"]
        email = idinfo["email"]
        username = idinfo.get("name", email.split("@")[0])
        avatar_url = idinfo.get("picture")
        
        result = await db.execute(select(User).where(User.google_id == google_id))
        user = result.scalar_one_or_none()
        
        if not user:
            result = await db.execute(select(User).where(User.email == email))
            user = result.scalar_one_or_none()
            
            if user:
                user.google_id = google_id
                user.avatar_url = avatar_url
            else:
                user = User(
                    email=email,
                    username=username,
                    google_id=google_id,
                    avatar_url=avatar_url,
                    hashed_password=get_password_hash(os.urandom(32).hex())
                )
                db.add(user)
        
        await db.commit()
        await db.refresh(user)
        
        access_token = create_access_token(data={"sub": str(user.id)})
        return Token(
            access_token=access_token,
            token_type="bearer",
            user=UserResponse.model_validate(user)
        )
    except HTTPException:
        raise
    except Exception:
        # Don't echo the underlying library error back to the client.
        import logging
        logging.getLogger("auth").warning("Google auth failed", exc_info=True)
        raise HTTPException(status_code=400, detail="Google authentication failed.")

@router.get("/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_user)):
    return UserResponse.model_validate(current_user)

@router.patch("/major", response_model=UserResponse)
async def update_major(
    body: MajorUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    current_user.major = body.major or None
    db.add(current_user)
    await db.commit()
    await db.refresh(current_user)
    return UserResponse.model_validate(current_user)


_AVATAR_PREFIXES = (
    "data:image/png;base64,",
    "data:image/jpeg;base64,",
    "data:image/webp;base64,",
    "data:image/gif;base64,",
)
_MAX_AVATAR_BYTES = 200 * 1024  # generous headroom over a ~256px cropped square


def _validate_avatar(value: str) -> str:
    if not value.startswith(_AVATAR_PREFIXES):
        raise HTTPException(status_code=400, detail="Avatar must be a PNG, JPEG, WebP or GIF image.")
    try:
        raw = base64.b64decode(value.split(",", 1)[1], validate=True)
    except (binascii.Error, IndexError, ValueError):
        raise HTTPException(status_code=400, detail="Avatar image data is not valid base64.")
    if len(raw) > _MAX_AVATAR_BYTES:
        raise HTTPException(status_code=400, detail="Avatar image is too large — crop/resize it first.")
    return value


def _clean_url(value: Optional[str]) -> Optional[str]:
    value = (value or "").strip()
    if not value:
        return None
    if not re.match(r"^https?://", value, re.IGNORECASE):
        raise HTTPException(status_code=400, detail="Links must start with http:// or https://")
    return value[:300]


@router.patch("/profile", response_model=UserResponse)
async def update_profile(
    body: ProfileUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    data = body.model_dump(exclude_unset=True)

    if "avatar_data" in data:
        av = (data["avatar_data"] or "").strip()
        current_user.avatar_data = _validate_avatar(av) if av else None

    for field in ("display_name", "headline", "bio"):
        if field in data:
            setattr(current_user, field, ((data[field] or "").strip() or None))

    for field in ("github_url", "website_url", "linkedin_url"):
        if field in data:
            setattr(current_user, field, _clean_url(data[field]))

    if body.complete_onboarding and current_user.onboarded_at is None:
        current_user.onboarded_at = datetime.utcnow()

    db.add(current_user)
    await db.commit()
    await db.refresh(current_user)
    return UserResponse.model_validate(current_user)


@router.post("/onboarding/skip", response_model=UserResponse)
async def skip_onboarding(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.onboarded_at is None:
        current_user.onboarded_at = datetime.utcnow()
        db.add(current_user)
        await db.commit()
        await db.refresh(current_user)
    return UserResponse.model_validate(current_user)


# ---------------------------------------------------------------------------
#  VS Code extension login  (JSON body — not form-encoded like the web login)
# ---------------------------------------------------------------------------

class VscodeLoginRequest(BaseModel):
    email: str
    password: str


@router.post("/vscode-login", response_model=Token)
async def vscode_login(body: VscodeLoginRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == body.email))
    user = result.scalar_one_or_none()

    if not user or not verify_password(body.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
        )

    access_token = create_access_token(data={"sub": str(user.id)})
    return Token(
        access_token=access_token,
        token_type="bearer",
        user=UserResponse.model_validate(user),
    )