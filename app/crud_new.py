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
