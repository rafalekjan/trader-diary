from fastapi import FastAPI, Request, Depends, Form, HTTPException
from fastapi.responses import HTMLResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from sqlalchemy.orm import Session
from typing import Optional
from decimal import Decimal

from app.database import get_db, engine, Base
from app import models, schemas, crud

Base.metadata.create_all(bind=engine)

app = FastAPI(title="Dziennik Tradera")

app.mount("/static", StaticFiles(directory="app/static"), name="static")
templates = Jinja2Templates(directory="app/templates")

def format_decimal(value):
    if value is None:
        return "-"
    return f"{value:,.2f}"

templates.env.filters["format_decimal"] = format_decimal

def calculate_total_pnl(db: Session) -> Decimal:
    trades = crud.get_trades(db)
    total_pnl = Decimal("0.0")
    for trade in trades:
        if not trade.entered:
            continue
        pnl = crud.calculate_pnl(trade)
        if pnl:
            total_pnl += pnl
    return total_pnl

def calculate_equity(db: Session) -> Decimal:
    account = crud.get_account(db)
    return account.balance + calculate_total_pnl(db)

@app.get("/", response_class=HTMLResponse)
async def home(request: Request, db: Session = Depends(get_db)):
    """Home page - Add new trade"""
    account = crud.get_account(db)
    return templates.TemplateResponse("trade_select.html", {
        "request": request,
        "account": account,
        "equity": calculate_equity(db)
    })

@app.get("/trades/new/stock", response_class=HTMLResponse)
async def new_stock_trade(request: Request, db: Session = Depends(get_db)):
    account = crud.get_account(db)
    traders = crud.get_traders(db)
    return templates.TemplateResponse("index_stock.html", {
        "request": request,
        "account": account,
        "equity": calculate_equity(db),
        "traders": traders
    })

@app.get("/trades/new/option", response_class=HTMLResponse)
async def new_option_trade(request: Request, db: Session = Depends(get_db)):
    account = crud.get_account(db)
    traders = crud.get_traders(db)
    return templates.TemplateResponse("index_option.html", {
        "request": request,
        "account": account,
        "equity": calculate_equity(db),
        "traders": traders
    })

@app.post("/trades/create")
async def create_trade(
    request: Request,
    entered: Optional[str] = Form(None),
    trading_style: str = Form(...),
    instrument_type: str = Form(...),
    ticker: str = Form(...),
    direction: str = Form("long"),
    trader_id: Optional[int] = Form(None),
    option_type: Optional[str] = Form(None),
    expiration_date: Optional[str] = Form(None),
    strike: Optional[str] = Form(None),
    entry_price: str = Form(...),
    exit_price: Optional[str] = Form(None),
    sl: Optional[str] = Form(None),
    tp: Optional[str] = Form(None),
    quantity: int = Form(1),
    fees: str = Form("0.0"),
    notes: Optional[str] = Form(None),
    db: Session = Depends(get_db)
):
    """Create a new trade"""
    entered_flag = bool(entered)
    normalized_status = "idea"
    if entered_flag:
        normalized_status = "entered"
    if exit_price:
        normalized_status = "closed"

    normalized_direction = direction
    if instrument_type == "option" and option_type:
        normalized_direction = "long" if option_type == "CALL" else "short"

    trade_data = schemas.TradeCreate(
        status=normalized_status,
        trading_style=trading_style,
        instrument_type=instrument_type,
        ticker=ticker.upper(),
        direction=normalized_direction,
        entered=entered_flag,
        trader_id=trader_id,
        option_type=option_type if option_type else None,
        expiration_date=expiration_date if expiration_date else None,
        strike=Decimal(strike) if strike else None,
        entry_price=Decimal(entry_price),
        exit_price=Decimal(exit_price) if exit_price else None,
        sl=Decimal(sl) if sl else None,
        tp=Decimal(tp) if tp else None,
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
    trader_id: Optional[int] = None,
    db: Session = Depends(get_db)
):
    """List all trades with filtering"""
    trades = crud.get_trades(db, status=status, ticker=ticker, trader_id=trader_id)
    account = crud.get_account(db)
    traders = crud.get_traders(db)
    
    trades_with_pnl = []
    total_pnl = Decimal("0.0")
    
    for trade in trades:
        pnl = crud.calculate_pnl(trade)
        trades_with_pnl.append({
            "trade": trade,
            "pnl": pnl
        })
        if pnl and trade.entered:
            total_pnl += pnl
    
    return templates.TemplateResponse("trades.html", {
        "request": request,
        "trades": trades_with_pnl,
        "total_pnl": total_pnl,
        "account": account,
        "equity": calculate_equity(db),
        "current_status": status,
        "current_ticker": ticker,
        "current_trader": trader_id,
        "traders": traders
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
    traders = crud.get_traders(db)
    template_name = "index_stock.html" if trade.instrument_type == models.InstrumentType.STOCK else "index_option.html"
    return templates.TemplateResponse(template_name, {
        "request": request,
        "trade": trade,
        "account": account,
        "equity": calculate_equity(db),
        "traders": traders,
        "edit_mode": True
    })

@app.post("/trades/{trade_id}/update")
async def update_trade(
    trade_id: int,
    entered: Optional[str] = Form(None),
    trading_style: str = Form(...),
    instrument_type: str = Form(...),
    ticker: str = Form(...),
    direction: str = Form("long"),
    trader_id: Optional[int] = Form(None),
    option_type: Optional[str] = Form(None),
    expiration_date: Optional[str] = Form(None),
    strike: Optional[str] = Form(None),
    entry_price: str = Form(...),
    exit_price: Optional[str] = Form(None),
    sl: Optional[str] = Form(None),
    tp: Optional[str] = Form(None),
    quantity: int = Form(1),
    fees: str = Form("0.0"),
    notes: Optional[str] = Form(None),
    db: Session = Depends(get_db)
):
    """Update existing trade"""
    entered_flag = bool(entered)
    normalized_status = "idea"
    if entered_flag:
        normalized_status = "entered"
    if exit_price:
        normalized_status = "closed"

    normalized_direction = direction
    if instrument_type == "option" and option_type:
        normalized_direction = "long" if option_type == "CALL" else "short"

    trade_data = schemas.TradeUpdate(
        status=normalized_status,
        trading_style=trading_style,
        instrument_type=instrument_type,
        ticker=ticker.upper(),
        direction=normalized_direction,
        entered=entered_flag,
        trader_id=trader_id,
        option_type=option_type if option_type else None,
        expiration_date=expiration_date if expiration_date else None,
        strike=Decimal(strike) if strike else None,
        entry_price=Decimal(entry_price),
        exit_price=Decimal(exit_price) if exit_price else None,
        sl=Decimal(sl) if sl else None,
        tp=Decimal(tp) if tp else None,
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

@app.post("/trades/{trade_id}/enter")
async def enter_trade(
    trade_id: int,
    db: Session = Depends(get_db)
):
    """Mark an idea as entered"""
    trade = crud.get_trade(db, trade_id)
    if not trade:
        raise HTTPException(status_code=404, detail="Trade not found")

    trade.entered = True
    if trade.exit_price:
        trade.status = models.TradeStatus.CLOSED
    else:
        trade.status = models.TradeStatus.ENTERED
    db.commit()

    return RedirectResponse(url="/trades", status_code=303)

@app.post("/trades/{trade_id}/unenter")
async def unenter_trade(
    trade_id: int,
    db: Session = Depends(get_db)
):
    """Mark a trade as not entered"""
    trade = crud.get_trade(db, trade_id)
    if not trade:
        raise HTTPException(status_code=404, detail="Trade not found")

    trade.entered = False
    if trade.exit_price:
        trade.status = models.TradeStatus.CLOSED
    else:
        trade.status = models.TradeStatus.IDEA
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
    traders = crud.get_traders(db)
    
    closed_pnl = Decimal("0.0")
    for trade in trades:
        if trade.status == models.TradeStatus.CLOSED and trade.exit_price:
            pnl = crud.calculate_pnl(trade)
            if pnl:
                closed_pnl += pnl
    
    open_pnl = Decimal("0.0")
    for trade in trades:
        if trade.status != models.TradeStatus.CLOSED and trade.exit_price:
            pnl = crud.calculate_pnl(trade)
            if pnl:
                open_pnl += pnl
    
    equity = calculate_equity(db)

    equity_points = []
    running = account.balance
    equity_points.append({
        "date": account.updated_at.strftime('%Y-%m-%d'),
        "value": float(running)
    })
    for trade in sorted(trades, key=lambda t: t.created_at):
        if not trade.entered or trade.exit_price is None:
            continue
        pnl = crud.calculate_pnl(trade)
        if pnl:
            running += pnl
            equity_points.append({
                "date": trade.created_at.strftime('%Y-%m-%d'),
                "value": float(running)
            })
    
    return templates.TemplateResponse("account.html", {
        "request": request,
        "account": account,
        "closed_pnl": closed_pnl,
        "open_pnl": open_pnl,
        "equity": equity,
        "equity_points": equity_points,
        "traders": traders
    })

@app.post("/account/update")
async def update_account(
    balance: str = Form(...),
    global_sl: Optional[str] = Form(None),
    global_tp: Optional[str] = Form(None),
    db: Session = Depends(get_db)
):
    """Update account balance"""
    account = crud.get_account(db)
    account.balance = Decimal(balance)
    account.global_sl = Decimal(global_sl) if global_sl else None
    account.global_tp = Decimal(global_tp) if global_tp else None
    db.commit()
    db.refresh(account)
    return RedirectResponse(url="/account", status_code=303)

@app.post("/traders/create")
async def create_trader(
    name: str = Form(...),
    db: Session = Depends(get_db)
):
    crud.create_trader(db, name)
    return RedirectResponse(url="/account", status_code=303)

@app.post("/traders/{trader_id}/delete")
async def delete_trader(trader_id: int, db: Session = Depends(get_db)):
    crud.delete_trader(db, trader_id)
    return RedirectResponse(url="/account", status_code=303)

@app.get("/stats", response_class=HTMLResponse)
async def statistics_page(request: Request, db: Session = Depends(get_db)):
    """Statistics page"""
    account = crud.get_account(db)
    stats = crud.get_statistics(db)
    
    return templates.TemplateResponse("stats.html", {
        "request": request,
        "account": account,
        "stats": stats,
        "equity": calculate_equity(db)
    })

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
