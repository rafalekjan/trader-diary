from fastapi import FastAPI, Request, Depends, Form, HTTPException
from fastapi.responses import HTMLResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from sqlalchemy.orm import Session
from typing import Optional
from decimal import Decimal

from app.database import get_db, engine, Base
from app import models, schemas, crud

# Create tables
Base.metadata.create_all(bind=engine)

app = FastAPI(title="Dziennik Tradera")

# Mount static files and templates
app.mount("/static", StaticFiles(directory="app/static"), name="static")
templates = Jinja2Templates(directory="app/templates")

# Custom filter for Jinja2
def format_decimal(value):
    if value is None:
        return "-"
    return f"{value:,.2f}"

templates.env.filters["format_decimal"] = format_decimal

@app.get("/", response_class=HTMLResponse)
async def home(request: Request, db: Session = Depends(get_db)):
    """Home page - Add new trade"""
    account = crud.get_account(db)
    return templates.TemplateResponse("index.html", {
        "request": request,
        "account": account
    })

@app.post("/trades/create")
async def create_trade(
    request: Request,
    status: str = Form(...),
    trading_style: str = Form(...),
    instrument_type: str = Form(...),
    ticker: str = Form(...),
    direction: str = Form("long"),
    option_type: Optional[str] = Form(None),
    expiration_date: Optional[str] = Form(None),
    strike: Optional[str] = Form(None),
    entry_price: str = Form(...),
    exit_price: Optional[str] = Form(None),
    quantity: int = Form(1),
    fees: str = Form("0.0"),
    notes: Optional[str] = Form(None),
    db: Session = Depends(get_db)
):
    """Create a new trade"""
    trade_data = schemas.TradeCreate(
        status=status,
        trading_style=trading_style,
        instrument_type=instrument_type,
        ticker=ticker.upper(),
        direction=direction,
        option_type=option_type if option_type else None,
        expiration_date=expiration_date if expiration_date else None,
        strike=Decimal(strike) if strike else None,
        entry_price=Decimal(entry_price),
        exit_price=Decimal(exit_price) if exit_price else None,
        quantity=quantity,
        fees=Decimal(fees),
        notes=notes
    )
    
    crud.create_trade(db, trade_data)
    return RedirectResponse(url="/trades", status_code=303)

@app.get("/trades", response_class=HTMLResponse)
async def list_trades(
    request: Request,
    status: Optional[str] = None,
    ticker: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """List all trades with filtering"""
    trades = crud.get_trades(db, status=status, ticker=ticker)
    account = crud.get_account(db)
    
    # Calculate P&L for each trade
    trades_with_pnl = []
    total_pnl = Decimal("0.0")
    
    for trade in trades:
        pnl = crud.calculate_pnl(trade)
        trades_with_pnl.append({
            "trade": trade,
            "pnl": pnl
        })
        if pnl:
            total_pnl += pnl
    
    return templates.TemplateResponse("trades.html", {
        "request": request,
        "trades": trades_with_pnl,
        "total_pnl": total_pnl,
        "account": account,
        "current_status": status,
        "current_ticker": ticker
    })

@app.get("/trades/{trade_id}/edit", response_class=HTMLResponse)
async def edit_trade_form(
    request: Request,
    trade_id: int,
    db: Session = Depends(get_db)
):
    """Edit trade form"""
    trade = crud.get_trade(db, trade_id)
    if not trade:
        raise HTTPException(status_code=404, detail="Trade not found")
    
    account = crud.get_account(db)
    return templates.TemplateResponse("index.html", {
        "request": request,
        "trade": trade,
        "account": account,
        "edit_mode": True
    })

@app.post("/trades/{trade_id}/update")
async def update_trade(
    trade_id: int,
    status: str = Form(...),
    trading_style: str = Form(...),
    instrument_type: str = Form(...),
    ticker: str = Form(...),
    direction: str = Form("long"),
    option_type: Optional[str] = Form(None),
    expiration_date: Optional[str] = Form(None),
    strike: Optional[str] = Form(None),
    entry_price: str = Form(...),
    exit_price: Optional[str] = Form(None),
    quantity: int = Form(1),
    fees: str = Form("0.0"),
    notes: Optional[str] = Form(None),
    db: Session = Depends(get_db)
):
    """Update existing trade"""
    trade_data = schemas.TradeUpdate(
        status=status,
        trading_style=trading_style,
        instrument_type=instrument_type,
        ticker=ticker.upper(),
        direction=direction,
        option_type=option_type if option_type else None,
        expiration_date=expiration_date if expiration_date else None,
        strike=Decimal(strike) if strike else None,
        entry_price=Decimal(entry_price),
        exit_price=Decimal(exit_price) if exit_price else None,
        quantity=quantity,
        fees=Decimal(fees),
        notes=notes
    )
    
    crud.update_trade(db, trade_id, trade_data)
    return RedirectResponse(url="/trades", status_code=303)

@app.post("/trades/{trade_id}/close")
async def close_trade(
    trade_id: int,
    exit_price: str = Form(...),
    db: Session = Depends(get_db)
):
    """Quick close trade with exit price"""
    trade = crud.get_trade(db, trade_id)
    if not trade:
        raise HTTPException(status_code=404, detail="Trade not found")
    
    trade.exit_price = Decimal(exit_price)
    trade.status = models.TradeStatus.CLOSED
    db.commit()
    
    return RedirectResponse(url="/trades", status_code=303)

@app.post("/trades/{trade_id}/delete")
async def delete_trade(trade_id: int, db: Session = Depends(get_db)):
    """Delete a trade"""
    success = crud.delete_trade(db, trade_id)
    if not success:
        raise HTTPException(status_code=404, detail="Trade not found")
    
    return RedirectResponse(url="/trades", status_code=303)

@app.get("/account", response_class=HTMLResponse)
async def account_page(request: Request, db: Session = Depends(get_db)):
    """Account management page"""
    account = crud.get_account(db)
    trades = crud.get_trades(db)
    
    # Calculate open P&L
    open_pnl = Decimal("0.0")
    for trade in trades:
        if trade.status != models.TradeStatus.CLOSED and trade.exit_price:
            pnl = crud.calculate_pnl(trade)
            if pnl:
                open_pnl += pnl
    
    equity = account.balance + open_pnl
    
    return templates.TemplateResponse("account.html", {
        "request": request,
        "account": account,
        "open_pnl": open_pnl,
        "equity": equity
    })

@app.post("/account/update")
async def update_account(
    balance: str = Form(...),
    db: Session = Depends(get_db)
):
    """Update account balance"""
    crud.update_account(db, Decimal(balance))
    return RedirectResponse(url="/account", status_code=303)

@app.get("/stats", response_class=HTMLResponse)
async def statistics_page(request: Request, db: Session = Depends(get_db)):
    """Statistics page"""
    account = crud.get_account(db)
    stats = crud.get_statistics(db)
    
    return templates.TemplateResponse("stats.html", {
        "request": request,
        "account": account,
        "stats": stats
    })

# API Endpoints (optional, for future use)
@app.get("/api/trades", response_model=list[schemas.TradeResponse])
async def api_list_trades(db: Session = Depends(get_db)):
    trades = crud.get_trades(db)
    return [
        schemas.TradeResponse(
            **trade.__dict__,
            pnl=crud.calculate_pnl(trade)
        ) for trade in trades
    ]

@app.get("/api/account", response_model=schemas.AccountResponse)
async def api_get_account(db: Session = Depends(get_db)):
    return crud.get_account(db)