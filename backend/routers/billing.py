"""Subscription billing.

Pro is a prepaid 30-day pass (KHQR / Bakong can't auto-charge). The flow:

    POST /api/billing/checkout               -> create a pending Payment, return the QR + amount
    POST /api/billing/checkout/{id}/confirm  -> settle it, extend User.plan_expires_at

`confirm` is a MOCK today — it just marks the payment paid. When a real gateway
(ABA PayWay / Bakong) is wired, its webhook does the same three lines: verify the
callback, look up the Payment, extend the plan.
"""
from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

import plans as plans_cfg
from database import get_db
from models.models import Payment, User
from routers.auth import get_current_user

router = APIRouter()

PRO_PRICE_CENTS = 1200
PRO_CURRENCY = "USD"
QR_URL = "/pro-khqr.png"  # drop your KHQR PNG at frontend/public/pro-khqr.png


class CheckoutIn(BaseModel):
    plan: str = "pro"


class CheckoutOut(BaseModel):
    payment_id: int
    plan: str
    amount_cents: int
    amount_display: str
    currency: str
    period_days: int
    qr_url: str
    provider: str


class BillingStatus(BaseModel):
    plan: str
    plan_label: str
    plan_expires_at: Optional[datetime] = None
    days_left: Optional[int] = None


def _status(user: User) -> BillingStatus:
    p = plans_cfg.effective_plan(user.plan, user.plan_expires_at)
    days = None
    if p["key"] != plans_cfg.DEFAULT_PLAN and user.plan_expires_at:
        secs = (user.plan_expires_at - datetime.utcnow()).total_seconds()
        days = max(0, int(secs // 86400))
    return BillingStatus(
        plan=p["key"],
        plan_label=p["label"],
        plan_expires_at=user.plan_expires_at if p["key"] != plans_cfg.DEFAULT_PLAN else None,
        days_left=days,
    )


@router.get("/status", response_model=BillingStatus)
async def billing_status(user: User = Depends(get_current_user)):
    return _status(user)


@router.post("/checkout", response_model=CheckoutOut)
async def checkout(
    body: CheckoutIn,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if body.plan != "pro" or "pro" not in plans_cfg.PLANS:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Only the Pro plan is purchasable")

    pay = Payment(
        user_id=user.id,
        provider="mock",
        plan="pro",
        amount_cents=PRO_PRICE_CENTS,
        currency=PRO_CURRENCY,
        status="pending",
    )
    db.add(pay)
    await db.commit()
    await db.refresh(pay)

    return CheckoutOut(
        payment_id=pay.id,
        plan="pro",
        amount_cents=PRO_PRICE_CENTS,
        amount_display=f"${PRO_PRICE_CENTS / 100:.0f}",
        currency=PRO_CURRENCY,
        period_days=plans_cfg.PRO_PERIOD_DAYS,
        qr_url=QR_URL,
        provider="mock",
    )


@router.post("/checkout/{payment_id}/confirm", response_model=BillingStatus)
async def confirm(
    payment_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    pay = (
        await db.execute(
            select(Payment).where(Payment.id == payment_id, Payment.user_id == user.id)
        )
    ).scalar_one_or_none()
    if pay is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Payment not found")
    if pay.status == "paid":
        return _status(user)
    if pay.status != "pending":
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Payment is {pay.status}")

    now = datetime.utcnow()
    # Extend from the later of now / the current expiry, so renewing early doesn't
    # forfeit remaining days.
    base = user.plan_expires_at if (user.plan_expires_at and user.plan_expires_at > now) else now
    user.plan = "pro"
    user.plan_expires_at = base + timedelta(days=plans_cfg.PRO_PERIOD_DAYS)
    pay.status = "paid"
    pay.paid_at = now
    pay.provider_ref = f"MOCK-{pay.id}"

    db.add_all([user, pay])
    await db.commit()
    await db.refresh(user)
    return _status(user)
