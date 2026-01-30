from sqlalchemy.orm import Session
from sqlalchemy import func, case
from app import models, schemas
from decimal import Decimal
from typing import List, Optional

def get_trades(db: Session, skip: int = 0, limit: int = 100, 
               status: Optional[str] = None, 
               ticker: Optional[str] = None) -> List[models.Trade]:
    query = db.query(models.Trade)
    
    if status:
        query = query.filter(models.Trade.status == status)
    if ticker:
        query = query.filter(models.Trade.ticker.ilike(f"%{ticker}%"))
    
    return query.order_by(models.Trade.created_at.desc()).offset(skip).limit(limit).all()

def get_trade(db: Session, trade_id: int) -> Optional[models.Trade]:
    return db.query(models.Trade).filter(models.Trade.id == trade_id).first()

def create_trade(db: Session, trade: schemas.TradeCreate) -> models.Trade:
    db_trade = models.Trade(**trade.model_dump())
    db.add(db_trade)
    db.commit()
    db.refresh(db_trade)
    return db_trade

def update_trade(db: Session, trade_id: int, trade: schemas.TradeUpdate) -> Optional[models.Trade]:
    db_trade = get_trade(db, trade_id)
    if db_trade:
        for key, value in trade.model_dump().items():
            setattr(db_trade, key, value)
        
        # Auto-close trade if exit_price is set
        if db_trade.exit_price is not None and db_trade.status != models.TradeStatus.CLOSED:
            db_trade.status = models.TradeStatus.CLOSED
        
        db.commit()
        db.refresh(db_trade)
    return db_trade

def delete_trade(db: Session, trade_id: int) -> bool:
    db_trade = get_trade(db, trade_id)
    if db_trade:
        db.delete(db_trade)
        db.commit()
        return True
    return False

def calculate_pnl(trade: models.Trade) -> Optional[Decimal]:
    """Calculate P&L for a trade"""
    if trade.exit_price is None:
        return None
    
    price_diff = trade.exit_price - trade.entry_price
    
    # Adjust for short positions
    if trade.direction == models.Direction.SHORT:
        price_diff = -price_diff
    
    # Calculate based on instrument type
    if trade.instrument_type == models.InstrumentType.OPTION:
        # Options have 100 multiplier
        pnl = price_diff * trade.quantity * 100
    else:
        # Stocks
        pnl = price_diff * trade.quantity
    
    # Subtract fees
    pnl -= trade.fees
    
    return pnl

def get_account(db: Session) -> models.Account:
    account = db.query(models.Account).first()
    if not account:
        # Create default account
        account = models.Account(balance=Decimal("10000.00"))
        db.add(account)
        db.commit()
        db.refresh(account)
    return account

def update_account(db: Session, balance: Decimal) -> models.Account:
    account = get_account(db)
    account.balance = balance
    db.commit()
    db.refresh(account)
    return account

def get_statistics(db: Session) -> dict:
    """Calculate trading statistics"""
    trades = db.query(models.Trade).all()
    
    total_trades = len(trades)
    closed_trades = [t for t in trades if t.exit_price is not None]
    
    total_pnl = Decimal("0.0")
    winning_trades = 0
    losing_trades = 0
    
    for trade in closed_trades:
        pnl = calculate_pnl(trade)
        if pnl:
            total_pnl += pnl
            if pnl > 0:
                winning_trades += 1
            elif pnl < 0:
                losing_trades += 1
    
    winrate = (winning_trades / len(closed_trades) * 100) if closed_trades else 0
    
    return {
        "total_trades": total_trades,
        "closed_trades": len(closed_trades),
        "open_trades": total_trades - len(closed_trades),
        "total_pnl": total_pnl,
        "winning_trades": winning_trades,
        "losing_trades": losing_trades,
        "winrate": round(winrate, 2)
    }
from sqlalchemy.orm import Session
from sqlalchemy import func, case
from app import models, schemas
from decimal import Decimal
from typing import List, Optional

def get_trades(db: Session, skip: int = 0, limit: int = 100, 
               status: Optional[List[str]] = None, 
               ticker: Optional[str] = None) -> List[models.Trade]:
    query = db.query(models.Trade)
    
    if status:
        if isinstance(status, list):
            query = query.filter(models.Trade.status.in_(status))
        else:
            query = query.filter(models.Trade.status == status)
    if ticker:
        query = query.filter(models.Trade.ticker.ilike(f"%{ticker}%"))
    
    return query.order_by(models.Trade.created_at.desc()).offset(skip).limit(limit).all()

def get_trade(db: Session, trade_id: int) -> Optional[models.Trade]:
    return db.query(models.Trade).filter(models.Trade.id == trade_id).first()
