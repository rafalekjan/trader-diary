from sqlalchemy import Column, Integer, String, Numeric, DateTime, Text, Enum as SQLEnum
from sqlalchemy.sql import func
from datetime import datetime
import enum
from app.database import Base

class TradeStatus(str, enum.Enum):
    IDEA = "idea"
    ENTERED = "entered"
    CLOSED = "closed"

class TradingStyle(str, enum.Enum):
    SWING = "swing"
    DAYTRADING = "daytrading"

class InstrumentType(str, enum.Enum):
    OPTION = "option"
    STOCK = "stock"

class Direction(str, enum.Enum):
    LONG = "long"
    SHORT = "short"

class OptionType(str, enum.Enum):
    CALL = "CALL"
    PUT = "PUT"

class Trade(Base):
    __tablename__ = "trades"
    
    id = Column(Integer, primary_key=True, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    status = Column(SQLEnum(TradeStatus), default=TradeStatus.IDEA, nullable=False)
    trading_style = Column(SQLEnum(TradingStyle), nullable=False)
    instrument_type = Column(SQLEnum(InstrumentType), nullable=False)
    ticker = Column(String(20), nullable=False, index=True)
    direction = Column(SQLEnum(Direction), default=Direction.LONG)
    
    # Option-specific fields
    option_type = Column(SQLEnum(OptionType), nullable=True)
    expiration_date = Column(String(20), nullable=True)
    strike = Column(Numeric(10, 2), nullable=True)
    
    # Price and quantity
    entry_price = Column(Numeric(10, 2), nullable=False)
    exit_price = Column(Numeric(10, 2), nullable=True)
    quantity = Column(Integer, default=1, nullable=False)
    fees = Column(Numeric(10, 2), default=0.0)
    
    # Notes
    notes = Column(Text, nullable=True)

class Account(Base):
    __tablename__ = "account"
    
    id = Column(Integer, primary_key=True)
    balance = Column(Numeric(12, 2), default=10000.00, nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())