from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
from decimal import Decimal

class TradeBase(BaseModel):
    status: str = "idea"
    trading_style: str
    instrument_type: str
    ticker: str
    direction: str = "long"
    entered: bool = False
    trader_id: Optional[int] = None
    option_type: Optional[str] = None
    expiration_date: Optional[str] = None
    strike: Optional[Decimal] = None
    entry_price: Decimal
    exit_price: Optional[Decimal] = None
    sl: Optional[Decimal] = None
    tp: Optional[Decimal] = None
    quantity: int = 1
    fees: Decimal = Decimal("0.0")
    notes: Optional[str] = None

class TradeCreate(TradeBase):
    pass

class TradeUpdate(TradeBase):
    pass

class TradeResponse(TradeBase):
    id: int
    created_at: datetime
    pnl: Optional[Decimal] = None
    
    class Config:
        from_attributes = True

class AccountResponse(BaseModel):
    id: int
    balance: Decimal
    updated_at: datetime
    
    class Config:
        from_attributes = True

class AccountUpdate(BaseModel):
    balance: Decimal
