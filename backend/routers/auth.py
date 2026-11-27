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
from common.avatars import avatar_url as default_avatar, STYLES as AVATAR_STYLES
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
    avatar_style: Optional[str] = None
    plan: Optional[str] = "free"
    plan_expires_at: Optional[datetime] = None
    onboarded_at: Optional[datetime] = Field(default=None, exclude=True)
    created_at: datetime

    @computed_field
    @property
    def avatar(self) -> Optional[str]:
        """Uploaded image, else OAuth picture, else the illustrated default."""
        return self.avatar_data or self.avatar_url or default_avatar(self.avatar_style, self.id)

    @computed_field
    @property
    def has_photo(self) -> bool:
        return bool(self.avatar_data or self.avatar_url)

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
    avatar_style: Optional[str] = None   # woman | man | neutral
    complete_onboarding: bool = False

class Token(BaseModel):
    access_token: str
    token_type: str
    user: UserResponse

class GoogleAuth(BaseModel):
    token: str


class TelegramAuth(BaseModel):
    """Payload from Telegram's login popup (signed by Telegram with our bot token)."""
    id: int
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    username: Optional[str] = None
    photo_url: Optional[str] = None
    auth_date: int
    hash: str

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

def _google_client_id() -> str:
    cid = (os.getenv("GOOGLE_CLIENT_ID") or "").strip()
    return cid if cid.endswith(".apps.googleusercontent.com") and not cid.startswith("your") else ""


@router.get("/google/config")
async def google_config():
    """Public: the OAuth client id the Google button needs (not a secret)."""
    cid = _google_client_id()
    return {"enabled": bool(cid), "client_id": cid or None}


@router.post("/google", response_model=Token)
async def google_auth(auth_data: GoogleAuth, db: AsyncSession = Depends(get_db)):
    try:
        from google.oauth2 import id_token
        from google.auth.transport import requests as google_requests
        
        client_id = _google_client_id()
        if not client_id:
            raise HTTPException(status_code=503, detail="Google sign-in isn't set up yet.")
        idinfo = id_token.verify_oauth2_token(
            auth_data.token, 
            google_requests.Request(), 
            client_id
        )
        
        google_id = idinfo["sub"]
        email = idinfo["email"]
        if not idinfo.get("email_verified"):
            raise HTTPException(status_code=400, detail="Your Google email isn't verified.")
        full_name = (idinfo.get("name") or "").strip()
        avatar_url = idinfo.get("picture")
        
        result = await db.execute(select(User).where(User.google_id == google_id))
        user = result.scalar_one_or_none()
        
        if not user:
            result = await db.execute(select(User).where(User.email == email))
            user = result.scalar_one_or_none()
            
            if user:
                user.google_id = google_id
                user.avatar_url = user.avatar_url or avatar_url
            else:
                user = User(
                    email=email,
                    username=await _free_username(db, full_name.replace(" ", "_") or email.split("@")[0]),
                    display_name=full_name or None,
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

    if "avatar_style" in data:
        current_user.avatar_style = data["avatar_style"] if data["avatar_style"] in AVATAR_STYLES else None

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


# ---------------------------------------------------------------- Telegram
# Sign in with Telegram uses Telegram's login popup (oauth.telegram.org). The
# popup returns the user's id/name/photo plus a `hash`: HMAC-SHA256 of the
# fields, keyed with SHA256(bot token). Only Telegram and we know the token, so
# a matching hash proves the data came from Telegram.
# Setup: in @BotFather run /setdomain for the bot and enter the site's domain.
TELEGRAM_MAX_AGE = 24 * 3600  # reject logins older than a day (replay guard)


def _tg_token() -> str:
    return os.getenv("TELEGRAM_BOT_TOKEN", "").strip()


def verify_telegram_login(data: dict, bot_token: str) -> bool:
    import hashlib
    import hmac
    import time

    received = data.get("hash") or ""
    fields = {k: v for k, v in data.items() if k != "hash" and v is not None}
    check = "\n".join(f"{k}={fields[k]}" for k in sorted(fields))
    secret = hashlib.sha256(bot_token.encode()).digest()
    expected = hmac.new(secret, check.encode(), hashlib.sha256).hexdigest()
    if not hmac.compare_digest(expected, received):
        return False
    return time.time() - int(fields.get("auth_date", 0)) <= TELEGRAM_MAX_AGE


async def _free_username(db: AsyncSession, base: str) -> str:
    base = re.sub(r"[^A-Za-z0-9_]", "", base)[:24] or "user"
    name, n = base, 1
    while (await db.execute(select(User).where(User.username == name))).scalar_one_or_none():
        n += 1
        name = f"{base}{n}"
    return name


@router.get("/telegram/config")
async def telegram_config():
    """Public bits the login popup needs: the numeric bot id (not secret)."""
    token = _tg_token()
    if not token or ":" not in token:
        return {"enabled": False, "bot_id": None}
    return {"enabled": True, "bot_id": int(token.split(":", 1)[0])}


@router.post("/telegram", response_model=Token)
async def telegram_auth(payload: TelegramAuth, db: AsyncSession = Depends(get_db)):
    token = _tg_token()
    if not token:
        raise HTTPException(status_code=503, detail="Telegram sign-in is not set up.")
    if not verify_telegram_login(payload.model_dump(), token):
        raise HTTPException(status_code=401, detail="Telegram sign-in could not be verified. Try again.")

    tg_id = str(payload.id)
    user = (await db.execute(select(User).where(User.telegram_id == tg_id))).scalar_one_or_none()
    if not user:
        name = " ".join(x for x in [payload.first_name, payload.last_name] if x) or None
        user = User(
            # Telegram shares no email. This placeholder is never mailed;
            # the user can set a real address in Settings.
            email=f"tg{tg_id}@telegram.invalid",
            username=await _free_username(db, payload.username or f"tg{tg_id}"),
            display_name=name,
            telegram_id=tg_id,
            avatar_url=payload.photo_url,
            hashed_password=get_password_hash(os.urandom(32).hex()),
        )
        db.add(user)
    elif payload.photo_url and not user.avatar_url:
        user.avatar_url = payload.photo_url
    await db.commit()
    await db.refresh(user)

    return Token(
        access_token=create_access_token(data={"sub": str(user.id)}),
        token_type="bearer",
        user=UserResponse.model_validate(user),
    )
