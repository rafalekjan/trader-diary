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
import re
import os
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
    if "option_price_provider" not in columns:
        try:
            with engine.begin() as conn:
                conn.execute(text("ALTER TABLE account ADD COLUMN option_price_provider VARCHAR(40)"))
        except Exception:
            pass

ensure_account_columns()

def ensure_trade_columns() -> None:
    try:
        inspector = inspect(engine)
        columns = {col["name"] for col in inspector.get_columns("trades")}
    except Exception:
        return

    if "closed_at" not in columns:
        try:
            with engine.begin() as conn:
                conn.execute(text("ALTER TABLE trades ADD COLUMN closed_at DATETIME"))
        except Exception:
            pass

ensure_trade_columns()

def format_decimal(value):
    if value is None:
        return "-"
    return f"{value:,.2f}"

templates.env.filters["format_decimal"] = format_decimal

STOCK_PRICE_TTL_SECONDS = 4
STOCK_PRICE_CACHE: dict[str, dict[str, object]] = {}

OPTION_PRICE_TTL_SECONDS = 8
OPTION_PRICE_CACHE: dict[str, dict[str, object]] = {}

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

def fetch_option_price_tradingview(symbol: str) -> Optional[Decimal]:
    normalized = (symbol or "").strip().upper()
    if normalized.startswith("OPRA:"):
        normalized = normalized.split(":", 1)[1]
    if not normalized:
        return None

    now = time.time()
    cache_key = f"tv:{normalized}"
    cached = OPTION_PRICE_CACHE.get(cache_key)
    if cached and now - float(cached["ts"]) < OPTION_PRICE_TTL_SECONDS:
        return cached["price"]  # type: ignore[return-value]

    url = f"https://www.tradingview.com/symbols/{urllib.parse.quote(normalized)}/"
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    try:
        with urllib.request.urlopen(req, timeout=6) as response:
            payload = response.read().decode("utf-8", errors="ignore")
    except Exception:
        return None

    def parse_decimal(value: str) -> Optional[Decimal]:
        cleaned = re.sub(r"[^0-9,.\-]", "", value or "")
        if not cleaned:
            return None
        cleaned = cleaned.replace(",", ".")
        try:
            return Decimal(cleaned)
        except Exception:
            return None

    price: Optional[Decimal] = None

    header_match = re.search(
        r"class=\"js-symbol-header-ticker\"[^>]*>(.*?)<",
        payload,
        re.IGNORECASE | re.DOTALL,
    )
    if header_match:
        header_block = header_match.group(1)
        last_match = re.search(
            r"class=\"[^\"\"]*js-symbol-last[^\"\"]*\"[^>]*>(.*?)</span>",
            header_block,
            re.IGNORECASE | re.DOTALL,
        )
        if last_match:
            raw_html = last_match.group(1)
            raw_text = re.sub(r"<[^>]+>", "", raw_html)
            raw_text = raw_text.replace(" ", "").replace("\n", "")
            price = parse_decimal(raw_text)
        if price is None:
            number_match = re.search(r"([0-9]+(?:[.,][0-9]+)?)", header_block)
            if number_match:
                price = parse_decimal(number_match.group(1))

    if price is None:
        patterns = [
            r"class=\"js-symbol-header-ticker\"[^>]*data-value=\"([0-9]+(?:[.,][0-9]+)?)\"",
            r"\"last_price\"\s*:\s*\"?([0-9]+(?:[.,][0-9]+)?)\"?",
            r"\"lp\"\s*:\s*\"?([0-9]+(?:[.,][0-9]+)?)\"?",
            r"\"regularMarketPrice\"\s*:\s*\"?([0-9]+(?:[.,][0-9]+)?)\"?",
            r"Last Price[^0-9]*([0-9]+(?:[.,][0-9]+)?)",
        ]
        for pattern in patterns:
            match = re.search(pattern, payload, re.IGNORECASE | re.DOTALL)
            if match:
                price = parse_decimal(match.group(1))
                if price is not None:
                    break

    if price is None:
        return None

    OPTION_PRICE_CACHE[cache_key] = {"ts": now, "price": price}
    return price

def parse_option_symbol(symbol: str) -> Optional[dict]:
    normalized = (symbol or "").strip().upper()
    if normalized.startswith("OPRA:"):
        normalized = normalized.split(":", 1)[1]
    match = re.match(r"^([A-Z]{1,6})(\d{2})(\d{2})(\d{2})([CP])(\d+(?:\.\d+)?)$", normalized)
    if not match:
        return None
    ticker, yy, mm, dd, cp, strike = match.groups()
    try:
        year = 2000 + int(yy)
        month = int(mm)
        day = int(dd)
        strike_value = float(strike)
    except Exception:
        return None
    return {
        "ticker": ticker,
        "year": year,
        "month": month,
        "day": day,
        "cp": cp,
        "strike": strike_value,
    }

def fetch_option_price_yahoo(symbol: str) -> Optional[Decimal]:
    price, _ = fetch_option_price_yahoo_with_meta(symbol)
    return price

def fetch_option_price_yahoo_with_meta(symbol: str) -> tuple[Optional[Decimal], dict]:
    parsed = parse_option_symbol(symbol)
    meta: dict[str, object] = {
        "parsed": parsed,
        "available_dates": 0,
        "target_date": None,
        "matched_expiry_ts": None,
        "used_nearest": False,
        "best_diff": None,
        "contracts": 0,
    }
    if not parsed:
        return None, meta

    ticker = parsed["ticker"]
    strike_target = parsed["strike"]
    side_key = "calls" if parsed["cp"] == "C" else "puts"

    now = time.time()
    target_date = date(parsed["year"], parsed["month"], parsed["day"])
    meta["target_date"] = target_date.isoformat()

    url = f"https://query1.finance.yahoo.com/v7/finance/options/{urllib.parse.quote(ticker)}"
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=6) as response:
            payload = response.read().decode("utf-8", errors="ignore")
    except Exception:
        return None, meta

    try:
        data = json.loads(payload)
        result = (data.get("optionChain") or {}).get("result") or []
        if not result:
            return None, meta
        available_dates = result[0].get("expirationDates") or []
    except Exception:
        return None, meta

    meta["available_dates"] = len(available_dates)

    expiry_ts = None
    nearest_ts = None
    nearest_diff = None
    for ts in available_dates:
        try:
            ts_int = int(ts)
        except Exception:
            continue
        if datetime.utcfromtimestamp(ts_int).date() == target_date:
            expiry_ts = ts_int
            break
        if datetime.fromtimestamp(ts_int).date() == target_date:
            expiry_ts = ts_int
            break
        diff_days = abs((datetime.utcfromtimestamp(ts_int).date() - target_date).days)
        if nearest_diff is None or diff_days < nearest_diff:
            nearest_diff = diff_days
            nearest_ts = ts_int

    if expiry_ts is None:
        if nearest_ts is not None:
            expiry_ts = nearest_ts
            meta["used_nearest"] = True
        else:
            expiry_ts = int(datetime(parsed["year"], parsed["month"], parsed["day"]).timestamp())

    meta["matched_expiry_ts"] = expiry_ts

    cache_key = f"yahoo_option:{ticker}:{expiry_ts}:{parsed['cp']}:{strike_target}"
    cached = OPTION_PRICE_CACHE.get(cache_key)
    if cached and now - float(cached["ts"]) < OPTION_PRICE_TTL_SECONDS:
        return cached["price"], meta  # type: ignore[return-value]

    url = f"https://query1.finance.yahoo.com/v7/finance/options/{urllib.parse.quote(ticker)}?date={expiry_ts}"
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=6) as response:
            payload = response.read().decode("utf-8", errors="ignore")
    except Exception:
        return None, meta

    try:
        data = json.loads(payload)
        result = (data.get("optionChain") or {}).get("result") or []
        if not result:
            return None, meta
        options = (result[0].get("options") or [])
        if not options:
            return None, meta
        contracts = options[0].get(side_key) or []
    except Exception:
        return None, meta

    meta["contracts"] = len(contracts)

    best_match = None
    best_diff = None
    for contract in contracts:
        try:
            strike_value = float(contract.get("strike"))
        except Exception:
            continue
        diff = abs(strike_value - strike_target)
        if best_diff is None or diff < best_diff:
            best_diff = diff
            best_match = contract

    meta["best_diff"] = best_diff

    if best_match and best_diff is not None and best_diff > 0.1:
        best_match = None

    if not best_match:
        return None, meta

    price_value = best_match.get("lastPrice")
    if price_value is None:
        price_value = best_match.get("bid") if best_match.get("bid") is not None else best_match.get("ask")
    if price_value is None:
        return None, meta

    try:
        price = Decimal(str(price_value))
    except Exception:
        return None, meta

    OPTION_PRICE_CACHE[cache_key] = {"ts": now, "price": price}
    return price, meta

def to_occ_symbol(symbol: str) -> Optional[str]:
    parsed = parse_option_symbol(symbol)
    if not parsed:
        return None
    ticker = parsed["ticker"].upper()
    yy = str(parsed["year"])[-2:]
    mm = f"{parsed['month']:02d}"
    dd = f"{parsed['day']:02d}"
    cp = parsed["cp"]
    strike_int = int(round(parsed["strike"] * 1000))
    strike_str = f"{strike_int:08d}"
    return f"{ticker}{yy}{mm}{dd}{cp}{strike_str}"

def to_polygon_symbol(symbol: str) -> Optional[str]:
    occ = to_occ_symbol(symbol)
    if not occ:
        return None
    return f"O:{occ}"

def fetch_option_price_marketdata(symbol: str) -> Optional[Decimal]:
    occ = to_occ_symbol(symbol)
    if not occ:
        return None

    now = time.time()
    cache_key = f"marketdata:{occ}"
    cached = OPTION_PRICE_CACHE.get(cache_key)
    if cached and now - float(cached["ts"]) < OPTION_PRICE_TTL_SECONDS:
        return cached["price"]  # type: ignore[return-value]

    url = f"https://api.marketdata.app/v1/options/quotes/{urllib.parse.quote(occ)}/"
    token = os.environ.get("MARKETDATA_TOKEN", "").strip()
    headers = {"User-Agent": "Mozilla/5.0"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    req = urllib.request.Request(url, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=6) as response:
            payload = response.read().decode("utf-8", errors="ignore")
    except Exception:
        return None

    try:
        data = json.loads(payload)
        if data.get("s") != "ok":
            return None
        def first_value(key):
            value = data.get(key)
            if isinstance(value, list) and value:
                return value[0]
            return value
        price_value = first_value("last")
        if price_value is None:
            price_value = first_value("mid")
        if price_value is None:
            bid = first_value("bid")
            ask = first_value("ask")
            if bid is not None and ask is not None:
                price_value = (float(bid) + float(ask)) / 2
        if price_value is None:
            return None
        price = Decimal(str(price_value))
    except Exception:
        return None

    OPTION_PRICE_CACHE[cache_key] = {"ts": now, "price": price}
    return price

def fetch_option_price_polygon(symbol: str) -> Optional[Decimal]:
    polygon_symbol = to_polygon_symbol(symbol)
    parsed = parse_option_symbol(symbol)
    if not polygon_symbol or not parsed:
        return None
    api_key = os.environ.get("POLYGON_API_KEY", "").strip()
    if not api_key:
        return None

    now = time.time()
    cache_key = f"polygon:{polygon_symbol}"
    cached = OPTION_PRICE_CACHE.get(cache_key)
    if cached and now - float(cached["ts"]) < OPTION_PRICE_TTL_SECONDS:
        return cached["price"]  # type: ignore[return-value]

    underlying = parsed["ticker"]
    url = (
        f"https://api.polygon.io/v3/snapshot/options/{urllib.parse.quote(underlying)}/"
        f"{urllib.parse.quote(polygon_symbol)}?apiKey={urllib.parse.quote(api_key)}"
    )
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    try:
        with urllib.request.urlopen(req, timeout=6) as response:
            payload = response.read().decode("utf-8", errors="ignore")
    except Exception:
        return None

    try:
        data = json.loads(payload)
        results = data.get("results") or {}
        last_trade = results.get("last_trade") or {}
        last_quote = results.get("last_quote") or {}
        price_value = last_trade.get("price")
        if price_value is None:
            bid = last_quote.get("bid")
            ask = last_quote.get("ask")
            if bid is not None and ask is not None:
                price_value = (float(bid) + float(ask)) / 2
            elif bid is not None:
                price_value = bid
            elif ask is not None:
                price_value = ask
        if price_value is None:
            return None
        price = Decimal(str(price_value))
    except Exception:
        return None

    OPTION_PRICE_CACHE[cache_key] = {"ts": now, "price": price}
    return price

def fetch_option_price_tradier(symbol: str) -> Optional[Decimal]:
    occ = to_occ_symbol(symbol)
    if not occ:
        return None

    token = os.environ.get("TRADIER_TOKEN", "").strip()
    if not token:
        return None

    base_url = os.environ.get("TRADIER_BASE_URL", "https://api.tradier.com").strip()
    now = time.time()
    cache_key = f"tradier:{occ}"
    cached = OPTION_PRICE_CACHE.get(cache_key)
    if cached and now - float(cached["ts"]) < OPTION_PRICE_TTL_SECONDS:
        return cached["price"]  # type: ignore[return-value]

    url = f"{base_url}/v1/markets/quotes?symbols={urllib.parse.quote(occ)}&greeks=false"
    headers = {"Authorization": f"Bearer {token}", "Accept": "application/json"}
    req = urllib.request.Request(url, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=6) as response:
            payload = response.read().decode("utf-8", errors="ignore")
    except Exception:
        return None

    try:
        data = json.loads(payload)
        quotes = (data.get("quotes") or {}).get("quote") or {}
        if isinstance(quotes, list):
            quotes = quotes[0] if quotes else {}
        price_value = quotes.get("last")
        if price_value is None:
            bid = quotes.get("bid")
            ask = quotes.get("ask")
            if bid is not None and ask is not None:
                price_value = (float(bid) + float(ask)) / 2
            elif bid is not None:
                price_value = bid
            elif ask is not None:
                price_value = ask
        if price_value is None:
            return None
        price = Decimal(str(price_value))
    except Exception:
        return None

    OPTION_PRICE_CACHE[cache_key] = {"ts": now, "price": price}
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
    closed_at: Optional[str] = Form(None),
    sl: Optional[str] = Form(None),
    tp: Optional[str] = Form(None),
    quantity: int = Form(1),
    fees: str = Form("0.0"),
    notes: Optional[str] = Form(None),
    db: Session = Depends(get_db)
):
    """Create a new trade"""
    entered_flag = bool(entered)
    if trader_id is None:
        entered_flag = True
    normalized_status = "idea"
    if entered_flag:
        normalized_status = "entered"
    if exit_price:
        normalized_status = "closed"

    normalized_direction = direction
    if instrument_type == "option" and option_type:
        normalized_direction = "long" if option_type == "CALL" else "short"

    parsed_closed_at = None
    if exit_price and closed_at:
        try:
            parsed_closed_at = datetime.fromisoformat(closed_at)
        except ValueError:
            parsed_closed_at = None

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
        closed_at=parsed_closed_at,
        sl=Decimal(sl) if sl else None,
        tp=Decimal(tp) if tp else None,
        quantity=quantity,
        fees=Decimal(fees),
        notes=notes
    )
    
    crud.create_trade(db, trade_data)
    return RedirectResponse(url=resolve_trades_redirect(request, trader_id, True), status_code=303)

def fetch_trades_for_scope(
    db: Session,
    status: Optional[str],
    ticker: Optional[str],
    is_self_scope: bool,
    is_all_scope: bool,
    trader_id: Optional[int]
):
    query = db.query(models.Trade)
    if status:
        query = query.filter(models.Trade.status == status)
    if ticker:
        query = query.filter(models.Trade.ticker.ilike(f"%{ticker}%"))
    if is_all_scope:
        pass
    elif is_self_scope:
        query = query.filter(models.Trade.trader_id.is_(None))
    elif trader_id is not None:
        query = query.filter(models.Trade.trader_id == trader_id)
    return query.order_by(models.Trade.created_at.desc()).all()

def render_trades_page(
    request: Request,
    db: Session,
    status: Optional[str],
    ticker: Optional[str],
    is_self_scope: bool,
    is_all_scope: bool,
    trader: Optional[models.Trader],
    scope_url: str
):
    trades = fetch_trades_for_scope(db, status, ticker, is_self_scope, is_all_scope, trader.id if trader else None)
    account = crud.get_account(db)
    traders = crud.get_traders(db)

    trades_with_pnl = []
    total_pnl = Decimal("0.0")

    for trade in trades:
        pnl = crud.calculate_pnl(trade)
        trades_with_pnl.append({
            "trade": trade,
            "pnl": pnl,
            "is_copy": crud.is_copy_trade(trade)
        })
        if pnl and trade.entered and not crud.is_source_trade(trade):
            total_pnl += pnl

    entered_trades = [
        item for item in trades_with_pnl
        if item["trade"].entered and not crud.is_source_trade(item["trade"])
    ]
    not_entered_trades = [item for item in trades_with_pnl if not item["trade"].entered]

    if is_all_scope:
        current_label = "All"
    else:
        current_label = "Me" if is_self_scope else trader.name if trader else "Trades"

    return templates.TemplateResponse("trades.html", {
        "request": request,
        "trades": trades_with_pnl,
        "entered_trades": entered_trades,
        "not_entered_trades": not_entered_trades,
        "total_pnl": total_pnl,
        "account": account,
        "equity": calculate_equity(db),
        "current_status": status,
        "current_ticker": ticker,
        "current_label": current_label,
        "is_self_scope": is_self_scope,
        "is_all_scope": is_all_scope,
        "current_trader_id": trader.id if trader else None,
        "scope_url": scope_url,
        "traders": traders
    })

def resolve_trades_redirect(
    request: Request,
    fallback_trader_id: Optional[int] = None,
    prefer_trader: bool = False
) -> str:
    if prefer_trader and fallback_trader_id:
        return f"/trades/trader/{fallback_trader_id}"
    referer = request.headers.get("referer")
    if referer:
        try:
            parsed = urllib.parse.urlparse(referer)
            if parsed.path.startswith("/trades"):
                if parsed.query:
                    return f"{parsed.path}?{parsed.query}"
                return parsed.path
        except Exception:
            pass
    if fallback_trader_id:
        return f"/trades/trader/{fallback_trader_id}"
    return "/trades"

@app.get("/trades", response_class=HTMLResponse)
async def list_trades_default(
    request: Request,
    status: Optional[str] = None,
    ticker: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """Default trades view (all)"""
    return render_trades_page(request, db, status, ticker, False, True, None, "/trades")

@app.get("/trades/self", response_class=HTMLResponse)
async def list_trades_self(
    request: Request,
    status: Optional[str] = None,
    ticker: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """Self trades view"""
    return render_trades_page(request, db, status, ticker, True, False, None, "/trades/self")

@app.get("/trades/trader/{trader_id}", response_class=HTMLResponse)
async def list_trades_trader(
    request: Request,
    trader_id: int,
    status: Optional[str] = None,
    ticker: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """Trades view for a specific trader"""
    trader = crud.get_trader(db, trader_id)
    if not trader:
        raise HTTPException(status_code=404, detail="Trader not found")
    scope_url = f"/trades/trader/{trader_id}"
    return render_trades_page(request, db, status, ticker, False, False, trader, scope_url)

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
    request: Request,
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
    closed_at: Optional[str] = Form(None),
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

    parsed_closed_at = None
    if closed_at:
        try:
            parsed_closed_at = datetime.fromisoformat(closed_at)
        except ValueError:
            parsed_closed_at = None

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
        closed_at=parsed_closed_at,
        sl=Decimal(sl) if sl else None,
        tp=Decimal(tp) if tp else None,
        quantity=quantity,
        fees=Decimal(fees),
        notes=notes
    )
    
    crud.update_trade(db, trade_id, trade_data)
    return RedirectResponse(url=resolve_trades_redirect(request, trader_id, True), status_code=303)

@app.post("/trades/{trade_id}/close")
async def close_trade(
    request: Request,
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
    trade.closed_at = datetime.utcnow()
    db.commit()
    
    return RedirectResponse(url=resolve_trades_redirect(request, trade.trader_id), status_code=303)

@app.post("/trades/{trade_id}/enter")
async def enter_trade(
    request: Request,
    trade_id: int,
    db: Session = Depends(get_db)
):
    """Mark an idea as entered"""
    trade = crud.get_trade(db, trade_id)
    if not trade:
        raise HTTPException(status_code=404, detail="Trade not found")

    if trade.trader_id is not None:
        if not trade.entered:
            trade.entered = True
        source_marker = f"Source trade #{trade.id}"
        existing_source = (trade.notes or "")
        if source_marker.lower() not in existing_source.lower():
            trade.notes = f"{existing_source}\n{source_marker}".strip() if existing_source else source_marker
        db.commit()

        copy_marker = f"Copy of trade #{trade.id}"
        existing = db.query(models.Trade).filter(
            models.Trade.notes.ilike(f"%{copy_marker}%")
        ).first()
        if not existing:
            notes = (trade.notes or "").strip()
            if notes:
                source_tag = f"Source trade #{trade.id}"
                notes = notes.replace(source_tag, "").strip()
            if notes:
                notes = f"{notes}\n{copy_marker}"
            else:
                notes = copy_marker

            trade_data = schemas.TradeCreate(
                status="entered",
                trading_style=trade.trading_style.value,
                instrument_type=trade.instrument_type.value,
                ticker=trade.ticker,
                direction=trade.direction.value,
                entered=True,
                trader_id=trade.trader_id,
                option_type=trade.option_type.value if trade.option_type else None,
                expiration_date=trade.expiration_date,
                strike=trade.strike,
                entry_price=trade.entry_price,
                exit_price=None,
                closed_at=None,
                sl=trade.sl,
                tp=trade.tp,
                quantity=trade.quantity,
                fees=trade.fees,
                notes=notes
            )
            crud.create_trade(db, trade_data)
    else:
        trade.entered = True
        if trade.exit_price:
            trade.status = models.TradeStatus.CLOSED
        else:
            trade.status = models.TradeStatus.ENTERED
        db.commit()

    return RedirectResponse(url=resolve_trades_redirect(request, trade.trader_id), status_code=303)

@app.post("/trades/{trade_id}/unenter")
async def unenter_trade(
    request: Request,
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

    return RedirectResponse(url=resolve_trades_redirect(request, trade.trader_id), status_code=303)

@app.post("/trades/{trade_id}/delete")
async def delete_trade(request: Request, trade_id: int, db: Session = Depends(get_db)):
    """Delete a trade"""
    trade = crud.get_trade(db, trade_id)
    if not trade:
        raise HTTPException(status_code=404, detail="Trade not found")

    crud.delete_trade(db, trade_id)
    return RedirectResponse(url=resolve_trades_redirect(request, trade.trader_id), status_code=303)

@app.post("/trades/bulk_create")
async def bulk_create_trades(
    request: Request,
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
        if isinstance(entry_price, str):
            entry_price = entry_price.replace(",", ".").strip()

        entered_flag = bool(row.get("entered"))
        exit_price = row.get("exit_price")
        if isinstance(exit_price, str):
            exit_price = exit_price.replace(",", ".").strip()
        normalized_status = "closed" if exit_price else ("entered" if entered_flag else "idea")

        option_type_raw = row.get("option_type") or ""
        if isinstance(option_type_raw, str):
            option_type_raw = option_type_raw.strip().upper()
        option_type = option_type_raw if option_type_raw in {"CALL", "PUT"} else None
        normalized_direction = row.get("direction") or "long"
        if instrument_type == "stock":
            normalized_direction = "long"
        if instrument_type == "option" and option_type:
            normalized_direction = "long" if option_type == "CALL" else "short"

        strike_raw = row.get("strike")
        if isinstance(strike_raw, str):
            strike_raw = strike_raw.replace(",", ".")

        try:
            entry_decimal = Decimal(str(entry_price))
        except Exception:
            continue

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
            strike=Decimal(str(strike_raw)) if instrument_type == "option" and strike_raw else None,
            entry_price=entry_decimal,
            exit_price=Decimal(str(exit_price)) if exit_price else None,
            quantity=int(row.get("quantity") or 1),
            fees=Decimal("0.0"),
            notes=None
        )
        crud.create_trade(db, trade_data)

    return RedirectResponse(url=resolve_trades_redirect(request, trader_id, True), status_code=303)

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
    option_price_provider: Optional[str] = Form(None),
    db: Session = Depends(get_db)
):
    """Update account balance"""
    account = crud.get_account(db)
    account.balance = Decimal(balance)
    account.global_sl = Decimal(global_sl) if global_sl else None
    account.global_tp = Decimal(global_tp) if global_tp else None
    account.stock_price_provider = stock_price_provider or None
    account.option_price_provider = option_price_provider or None
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

@app.get("/analysis", response_class=HTMLResponse)
async def analysis_page(request: Request, db: Session = Depends(get_db)):
    """Trade analysis builder page."""
    account = crud.get_account(db)
    return templates.TemplateResponse("analysis.html", {
        "request": request,
        "account": account,
        "equity": calculate_equity(db)
    })

@app.get("/calendar", response_class=HTMLResponse)
async def calendar_page(request: Request, db: Session = Depends(get_db)):
    """Calendar view with daily P&L."""
    account = crud.get_account(db)
    trades = crud.get_trades(db)

    pnl_by_date: dict[str, float] = {}
    for trade in trades:
        if not trade.entered:
            continue
        if trade.exit_price is None:
            continue
        if crud.is_source_trade(trade):
            continue
        pnl = crud.calculate_pnl(trade)
        if pnl is None:
            continue
        close_dt = trade.closed_at or trade.created_at
        day_key = close_dt.strftime("%Y-%m-%d")
        pnl_by_date[day_key] = pnl_by_date.get(day_key, 0.0) + float(pnl)

    return templates.TemplateResponse("calendar.html", {
        "request": request,
        "account": account,
        "equity": calculate_equity(db),
        "calendar_pnl": pnl_by_date,
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

@app.get("/api/price/option/{symbol}")
async def api_option_price(symbol: str, debug: Optional[int] = None, db: Session = Depends(get_db)):
    def price_or_none(value: Optional[Decimal]) -> dict:
        return {"price": float(value) if value is not None else None}

    account = crud.get_account(db)
    provider = (account.option_price_provider or "").strip().lower() or "auto"
    if provider == "off":
        return {"price": None} if not debug else {"price": None, "provider": "off"}

    if provider == "a":
        price = fetch_option_price_tradingview(symbol)
        return price_or_none(price) if not debug else {"price": float(price) if price is not None else None, "provider": "a"}
    if provider == "b":
        if not debug:
            price = fetch_option_price_yahoo(symbol)
            return price_or_none(price)
        price, meta = fetch_option_price_yahoo_with_meta(symbol)
        return {"price": float(price) if price is not None else None, "provider": "b", "yahoo": meta}
    if provider == "c":
        price = fetch_option_price_marketdata(symbol)
        return price_or_none(price) if not debug else {"price": float(price) if price is not None else None, "provider": "c"}
    if provider == "d":
        price = fetch_option_price_polygon(symbol)
        return price_or_none(price) if not debug else {"price": float(price) if price is not None else None, "provider": "d"}
    if provider == "e":
        price = fetch_option_price_tradier(symbol)
        return price_or_none(price) if not debug else {"price": float(price) if price is not None else None, "provider": "e"}
    if provider == "auto":
        price_a = fetch_option_price_tradingview(symbol)
        price = price_a
        source = "a"
        meta_b = None
        price_c = None
        price_d = None
        price_e = None
        if price is None:
            if debug:
                price_b, meta_b = fetch_option_price_yahoo_with_meta(symbol)
            else:
                price_b = fetch_option_price_yahoo(symbol)
            price = price_b
            source = "b"
        if price is None:
            price_c = fetch_option_price_marketdata(symbol)
            price = price_c
            source = "c"
        if price is None:
            price_d = fetch_option_price_polygon(symbol)
            price = price_d
            source = "d"
        if price is None:
            price_e = fetch_option_price_tradier(symbol)
            price = price_e
            source = "e"
        if not debug:
            return price_or_none(price)
        return {
            "price": float(price) if price is not None else None,
            "provider": "auto",
            "selected": source,
            "parsed": parse_option_symbol(symbol),
            "price_a": float(price_a) if price_a is not None else None,
            "price_b": float(price_b) if "price_b" in locals() and price_b is not None else None,
            "price_c": float(price_c) if price_c is not None else None,
            "price_d": float(price_d) if price_d is not None else None,
            "price_e": float(price_e) if price_e is not None else None,
            "yahoo": meta_b,
        }

    return {"price": None} if not debug else {"price": None, "provider": provider}
