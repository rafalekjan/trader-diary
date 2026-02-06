from sqlalchemy.orm import Session
from sqlalchemy import func, case
from app import models, schemas
from decimal import Decimal
from datetime import datetime
from typing import List, Optional

def get_trades(db: Session, skip: int = 0, limit: int = 100, 
               status: Optional[str] = None, 
               ticker: Optional[str] = None,
               trader_id: Optional[int] = None) -> List[models.Trade]:
    query = db.query(models.Trade)
    
    if status:
        query = query.filter(models.Trade.status == status)
    if ticker:
        query = query.filter(models.Trade.ticker.ilike(f"%{ticker}%"))
    if trader_id:
        query = query.filter(models.Trade.trader_id == trader_id)
    
    return query.order_by(models.Trade.created_at.desc()).offset(skip).limit(limit).all()

def get_trade(db: Session, trade_id: int) -> Optional[models.Trade]:
    return db.query(models.Trade).filter(models.Trade.id == trade_id).first()

def get_traders(db: Session) -> List[models.Trader]:
    return db.query(models.Trader).order_by(models.Trader.name.asc()).all()

def create_trader(db: Session, name: str) -> models.Trader:
    trader = models.Trader(name=name.strip())
    db.add(trader)
    db.commit()
    db.refresh(trader)
    return trader

def delete_trader(db: Session, trader_id: int) -> bool:
    trader = db.query(models.Trader).filter(models.Trader.id == trader_id).first()
    if trader:
        db.delete(trader)
        db.commit()
        return True
    return False

def create_trade(db: Session, trade: schemas.TradeCreate) -> models.Trade:
    db_trade = models.Trade(**trade.model_dump())
    db.add(db_trade)
    db.commit()
    db.refresh(db_trade)
    if db_trade.exit_price is not None and db_trade.closed_at is None:
        db_trade.closed_at = db_trade.created_at
        db.commit()
        db.refresh(db_trade)
    return db_trade

def update_trade(db: Session, trade_id: int, trade: schemas.TradeUpdate) -> Optional[models.Trade]:
    db_trade = get_trade(db, trade_id)
    if db_trade:
        had_exit_price = db_trade.exit_price is not None
        for key, value in trade.model_dump().items():
            setattr(db_trade, key, value)
        
        # Auto-close trade if exit_price is set
        if db_trade.exit_price is not None and db_trade.status != models.TradeStatus.CLOSED:
            db_trade.status = models.TradeStatus.CLOSED
        if not had_exit_price and db_trade.exit_price is not None and db_trade.closed_at is None:
            db_trade.closed_at = datetime.utcnow()
        if db_trade.exit_price is None and db_trade.closed_at is not None:
            db_trade.closed_at = None
        
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

def is_source_trade(trade: models.Trade) -> bool:
    if not trade.notes:
        return False
    return "source trade #" in trade.notes.lower()

def is_copy_trade(trade: models.Trade) -> bool:
    if not trade.notes:
        return False
    return "copy of trade #" in trade.notes.lower()

def get_account(db: Session) -> models.Account:
    account = db.query(models.Account).first()
    if not account:
        # Create default account
        account = models.Account(balance=Decimal("10000.00"), stock_price_provider="auto")
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
    account = get_account(db)
    
    total_trades = len(trades)
    closed_trades = [t for t in trades if t.exit_price is not None]
    
    total_pnl = Decimal("0.0")
    winning_trades = 0
    losing_trades = 0
    
    for trade in closed_trades:
        if not trade.entered:
            continue
        if is_source_trade(trade):
            continue
        pnl = calculate_pnl(trade)
        if pnl:
            total_pnl += pnl
            if pnl > 0:
                winning_trades += 1
            elif pnl < 0:
                losing_trades += 1
    
    entered_closed_trades = [t for t in closed_trades if t.entered and not is_source_trade(t)]
    paper_closed_trades = [t for t in closed_trades if not t.entered]
    winrate = (winning_trades / len(entered_closed_trades) * 100) if entered_closed_trades else 0
    
    def build_stats(scope_trades: List[models.Trade]) -> dict:
        scope_closed = [t for t in scope_trades if t.exit_price is not None]
        scope_total_pnl = Decimal("0.0")
        scope_winning = 0
        scope_losing = 0

        for trade in scope_closed:
            if not trade.entered:
                continue
            if is_source_trade(trade):
                continue
            pnl = calculate_pnl(trade)
            if pnl:
                scope_total_pnl += pnl
                if pnl > 0:
                    scope_winning += 1
                elif pnl < 0:
                    scope_losing += 1

        scope_entered_closed = [t for t in scope_closed if t.entered]
        scope_winrate = (scope_winning / len(scope_entered_closed) * 100) if scope_entered_closed else 0

        return {
            "total_trades": len(scope_trades),
            "closed_trades": len(scope_closed),
            "open_trades": len(scope_trades) - len(scope_closed),
            "total_pnl": scope_total_pnl,
            "winning_trades": scope_winning,
            "losing_trades": scope_losing,
            "winrate": round(scope_winrate, 2)
        }

    stock_trades = [t for t in trades if t.instrument_type == models.InstrumentType.STOCK]
    option_trades = [t for t in trades if t.instrument_type == models.InstrumentType.OPTION]

    entered_closed_trades = [t for t in closed_trades if t.entered and not is_source_trade(t)]
    def sum_pnl(scope_trades: List[models.Trade]) -> Decimal:
        total = Decimal("0.0")
        for trade in scope_trades:
            pnl = calculate_pnl(trade)
            if pnl:
                total += pnl
        return total

    portfolio_breakdown = []
    all_pnl = sum_pnl(entered_closed_trades)
    portfolio_breakdown.append({
        "label": "All Traders",
        "pnl": all_pnl,
        "equity": account.balance + all_pnl,
        "trades": len(entered_closed_trades),
    })

    self_trades = [t for t in entered_closed_trades if t.trader_id is None]
    self_pnl = sum_pnl(self_trades)
    portfolio_breakdown.append({
        "label": "Self (unassigned)",
        "pnl": self_pnl,
        "equity": account.balance + self_pnl,
        "trades": len(self_trades),
    })

    for trader in get_traders(db):
        trader_trades = [t for t in paper_closed_trades if t.trader_id == trader.id]
        trader_pnl = sum_pnl(trader_trades)
        portfolio_breakdown.append({
            "label": trader.name,
            "pnl": trader_pnl,
            "equity": account.balance + trader_pnl,
            "trades": len(trader_trades),
        })

    return {
        "total_trades": total_trades,
        "closed_trades": len(closed_trades),
        "open_trades": total_trades - len(closed_trades),
        "total_pnl": total_pnl,
        "winning_trades": winning_trades,
        "losing_trades": losing_trades,
        "winrate": round(winrate, 2),
        "by_instrument": {
            "stock": build_stats(stock_trades),
            "option": build_stats(option_trades)
        },
        "portfolio_breakdown": portfolio_breakdown,
    }
