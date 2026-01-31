from fastapi import FastAPI, Request, Depends, Form, HTTPException
from fastapi.responses import HTMLResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from sqlalchemy.orm import Session
from typing import Optional
from decimal import Decimal
from datetime import datetime, timedelta, date
import csv
import json
import time
import urllib.parse
import urllib.request
from sqlalchemy import inspect, text

from app.database import get_db, engine, Base
from app import models, schemas, crud

Base.metadata.create_all(bind=engine)

app = FastAPI(title="Dziennik Tradera")

app.mount("/static", StaticFiles(directory="app/static"), name="static")
templates = Jinja2Templates(directory="app/templates")

def ensure_account_columns() -> None:
    try:
        inspector = inspect(engine)
        columns = {col["name"] for col in inspector.get_columns("account")}
    except Exception:
        return

    if "stock_price_provider" not in columns:
        try:
            with engine.begin() as conn:
                conn.execute(text("ALTER TABLE account ADD COLUMN stock_price_provider VARCHAR(40)"))
        except Exception:
            pass

ensure_account_columns()

def format_decimal(value):
    if value is None:
        return "-"
    return f"{value:,.2f}"

templates.env.filters["format_decimal"] = format_decimal

STOCK_PRICE_TTL_SECONDS = 4
STOCK_PRICE_CACHE: dict[str, dict[str, object]] = {}

def fetch_stock_price_stooq(ticker: str) -> Optional[Decimal]:
    symbol = (ticker or "").strip().upper()
    if not symbol:
        return None

    stooq_symbol = symbol.replace(".", "-").lower() + ".us"
    now = time.time()
    cache_key = f"stooq:{stooq_symbol}"
    cached = STOCK_PRICE_CACHE.get(cache_key)
    if cached and now - float(cached["ts"]) < STOCK_PRICE_TTL_SECONDS:
        return cached["price"]  # type: ignore[return-value]

    url = f"https://stooq.pl/q/l/?s={urllib.parse.quote(stooq_symbol)}&f=sd2t2ohlcv&h&e=csv"
    try:
        with urllib.request.urlopen(url, timeout=4) as response:
            payload = response.read().decode("utf-8", errors="ignore")
    except Exception:
        return None

    rows = list(csv.reader(payload.splitlines()))
    if len(rows) < 2:
        return None
    if rows[1] and rows[1][0].lower().startswith("no data"):
        return None

    try:
        close_str = rows[1][6]
    except Exception:
        return None
    if not close_str or close_str in {"-", "N/D", "n/a"}:
        return None

    try:
        price = Decimal(close_str)
    except Exception:
        return None

    STOCK_PRICE_CACHE[cache_key] = {"ts": now, "price": price}
    return price

def fetch_stock_price_yahoo(ticker: str) -> Optional[Decimal]:
    symbol = (ticker or "").strip().upper()
    if not symbol:
        return None

    yahoo_symbol = symbol.replace(".", "-")
    now = time.time()
    cache_key = f"yahoo:{yahoo_symbol}"
    cached = STOCK_PRICE_CACHE.get(cache_key)
    if cached and now - float(cached["ts"]) < STOCK_PRICE_TTL_SECONDS:
        return cached["price"]  # type: ignore[return-value]

    url = f"https://query1.finance.yahoo.com/v7/finance/quote?symbols={urllib.parse.quote(yahoo_symbol)}"
    try:
        with urllib.request.urlopen(url, timeout=4) as response:
            payload = response.read().decode("utf-8", errors="ignore")
    except Exception:
        return None

    try:
        data = json.loads(payload)
        result = (data.get("quoteResponse") or {}).get("result") or []
        if not result:
            return None
        price_value = result[0].get("regularMarketPrice")
    except Exception:
        return None

    if price_value is None:
        return None

    try:
        price = Decimal(str(price_value))
    except Exception:
        return None

    STOCK_PRICE_CACHE[cache_key] = {"ts": now, "price": price}
    return price

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

@app.get("/trades/new/stock/bulk", response_class=HTMLResponse)
async def bulk_stock_trade(request: Request, db: Session = Depends(get_db)):
    account = crud.get_account(db)
    traders = crud.get_traders(db)
    return templates.TemplateResponse("bulk_stock.html", {
        "request": request,
        "account": account,
        "equity": calculate_equity(db),
        "traders": traders
    })

@app.get("/trades/new/option/bulk", response_class=HTMLResponse)
async def bulk_option_trade(request: Request, db: Session = Depends(get_db)):
    account = crud.get_account(db)
    traders = crud.get_traders(db)
    return templates.TemplateResponse("bulk_option.html", {
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
    trader_id: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """List all trades with filtering"""
    parsed_trader_id = int(trader_id) if trader_id and trader_id.isdigit() else None
    trades = crud.get_trades(db, status=status, ticker=ticker, trader_id=parsed_trader_id)
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
        "current_trader": parsed_trader_id,
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

@app.post("/trades/bulk_create")
async def bulk_create_trades(
    instrument_type: str = Form(...),
    bulk_data: str = Form(...),
    trader_id: Optional[int] = Form(None),
    db: Session = Depends(get_db)
):
    """Create multiple trades from parsed data"""
    try:
        rows = json.loads(bulk_data)
    except Exception:
        rows = []

    for row in rows:
        ticker = (row.get("ticker") or "").strip().upper()
        entry_price = row.get("entry_price")
        if not ticker or not entry_price:
            continue

        entered_flag = bool(row.get("entered"))
        exit_price = row.get("exit_price")
        normalized_status = "closed" if exit_price else ("entered" if entered_flag else "idea")

        option_type = row.get("option_type")
        normalized_direction = row.get("direction") or "long"
        if instrument_type == "stock":
            normalized_direction = "long"
        if instrument_type == "option" and option_type:
            normalized_direction = "long" if option_type == "CALL" else "short"

        trade_data = schemas.TradeCreate(
            status=normalized_status,
            trading_style="swing",
            instrument_type=instrument_type,
            ticker=ticker,
            direction=normalized_direction,
            entered=entered_flag,
            trader_id=trader_id,
            option_type=option_type if instrument_type == "option" else None,
            expiration_date=row.get("expiration_date") if instrument_type == "option" else None,
            entry_price=Decimal(str(entry_price)),
            exit_price=Decimal(str(exit_price)) if exit_price else None,
            quantity=int(row.get("quantity") or 1),
            fees=Decimal("0.0"),
            notes=None
        )
        crud.create_trade(db, trade_data)

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

    return templates.TemplateResponse("account.html", {
        "request": request,
        "account": account,
        "traders": traders,
        "equity": calculate_equity(db)
    })

@app.post("/account/update")
async def update_account(
    balance: str = Form(...),
    global_sl: Optional[str] = Form(None),
    global_tp: Optional[str] = Form(None),
    stock_price_provider: Optional[str] = Form(None),
    db: Session = Depends(get_db)
):
    """Update account balance"""
    account = crud.get_account(db)
    account.balance = Decimal(balance)
    account.global_sl = Decimal(global_sl) if global_sl else None
    account.global_tp = Decimal(global_tp) if global_tp else None
    account.stock_price_provider = stock_price_provider or None
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

@app.get("/charts", response_class=HTMLResponse)
async def charts_page(
    request: Request,
    instrument: Optional[str] = None,
    entered_only: Optional[str] = None,
    trader_id: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    metric: Optional[str] = "equity",
    group_by: Optional[str] = "day",
    db: Session = Depends(get_db)
):
    account = crud.get_account(db)
    traders = crud.get_traders(db)

    parsed_trader_id = int(trader_id) if trader_id and trader_id.isdigit() else None
    trades = crud.get_trades(db, trader_id=parsed_trader_id)

    if instrument in ("stock", "option"):
        trades = [t for t in trades if t.instrument_type.value == instrument]

    if entered_only:
        trades = [t for t in trades if t.entered]

    start_date = None
    end_date = None
    if date_from:
        try:
            start_date = datetime.strptime(date_from, "%Y-%m-%d").date()
        except ValueError:
            start_date = None

    if date_to:
        try:
            end_date = datetime.strptime(date_to, "%Y-%m-%d").date()
        except ValueError:
            end_date = None

    if start_date:
        trades = [t for t in trades if t.created_at.date() >= start_date]

    if end_date:
        trades = [t for t in trades if t.created_at.date() <= end_date]

    trades = sorted(trades, key=lambda t: t.created_at)

    def bucket_date(dt: datetime, group: str) -> date:
        d = dt.date()
        if group == "week":
            return d - timedelta(days=d.weekday())
        if group == "month":
            return date(d.year, d.month, 1)
        return d

    def format_bucket(d: date, group: str) -> str:
        if group == "month":
            return d.strftime("%Y-%m")
        return d.strftime("%Y-%m-%d")

    grouped = {}
    for trade in trades:
        if trade.exit_price is None:
            continue
        pnl = crud.calculate_pnl(trade)
        if pnl is None:
            continue
        key = bucket_date(trade.created_at, group_by or "day")
        grouped[key] = grouped.get(key, Decimal("0.0")) + pnl

    grouped_items = sorted(grouped.items(), key=lambda x: x[0])

    points = []
    if metric == "pnl":
        for bucket, pnl in grouped_items:
            points.append({
                "date": format_bucket(bucket, group_by or "day"),
                "value": float(pnl)
            })
    elif metric == "cumulative_pnl":
        running = Decimal("0.0")
        for bucket, pnl in grouped_items:
            running += pnl
            points.append({
                "date": format_bucket(bucket, group_by or "day"),
                "value": float(running)
            })
    else:
        running = account.balance
        if grouped_items:
            for bucket, pnl in grouped_items:
                running += pnl
                points.append({
                    "date": format_bucket(bucket, group_by or "day"),
                    "value": float(running)
                })
        else:
            if start_date and end_date:
                points.append({
                    "date": start_date.strftime("%Y-%m-%d"),
                    "value": float(running)
                })
                points.append({
                    "date": end_date.strftime("%Y-%m-%d"),
                    "value": float(running)
                })
            else:
                points.append({
                    "date": datetime.now().strftime("%Y-%m-%d"),
                    "value": float(running)
                })

    return templates.TemplateResponse("charts.html", {
        "request": request,
        "account": account,
        "equity": calculate_equity(db),
        "traders": traders,
        "points": points,
        "current_instrument": instrument or "",
        "current_trader": parsed_trader_id,
        "current_metric": metric or "equity",
        "current_group_by": group_by or "day",
        "current_entered_only": bool(entered_only),
        "current_date_from": date_from or "",
        "current_date_to": date_to or ""
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

@app.get("/api/price/stock/{ticker}")
async def api_stock_price(ticker: str, db: Session = Depends(get_db)):
    account = crud.get_account(db)
    provider = (account.stock_price_provider or "").strip().lower() or "auto"
    if provider == "off":
        return {"price": None}

    def price_or_none(value: Optional[Decimal]) -> dict:
        return {"price": float(value) if value is not None else None}

    if provider == "a":
        return price_or_none(fetch_stock_price_stooq(ticker))
    if provider == "b":
        return price_or_none(fetch_stock_price_yahoo(ticker))
    if provider == "auto":
        price = fetch_stock_price_stooq(ticker)
        if price is None:
            price = fetch_stock_price_yahoo(ticker)
        return price_or_none(price)

    return {"price": None}
    return {"price": float(price) if price is not None else None}
