# Stock 1D Scoring (Direction & Context) - dokumentacja 1:1

Ta dokumentacja odzwierciedla aktualna logike `calculateStock1DScore(...)` w `app/static/script.js`.

## 0) Minimalny warunek "No data"

`grade = "No data"` dopoki nie ma minimum:
- `bias` ustawione (`bullish` / `bearish` / `neutral`)
- `structure` ustawione (`hh_hl` / `ll_lh` / `mixed`)

Dopiero po tym mapowany jest grade (`Pass/C/B/A`).

## 1) Inputs uzywane w scoringu

- `bias`
- `structure`
- `sma200`
- `trendAnchor`
- `rate` (0-99, pusty/NaN => 0, potem clamp)
- `spyAlignment`
- `relativeVsSpy`
- `rsTrend`
- `trendState`
- `gapRisk`
- `optionsLiquidity`
- `betaSensitivity`
- `levelPosition`
- `pullback`
- `earningsSoon`
- `dividendSoon`
- `otherCatalyst`

## 2) Struktura wyniku

- `directionScore` max `8`
- `contextScore` max `8`
- `riskLevelsScore` max `4`
- `penalties` (ujemne)

RAW:
- `rawTotal = directionScore + contextScore + riskLevelsScore + penalties`
- `boundedRawTotal = clamp(rawTotal, 0, 20)` -> to jest `RAW SCORE (before caps)`

FINAL:
- `total = min(boundedRawTotal, cap)`
- `capApplied = (total < boundedRawTotal)`

## A) Direction Score (0..8)

Start: `directionScore = 0`

1. Bias kierunkowy:
- `bullish` lub `bearish` -> `+2`
- `neutral` -> `+0`

2. Structure czytelna:
- `hh_hl` lub `ll_lh` -> `+2`
- `mixed` -> `+0`

3. SMA200 (tylko przy kierunkowym bias):
- `bullish + above` -> `+2`
- `bearish + below` -> `+2`
- bias kierunkowy i SMA ustawione, ale niezgodne -> `+1`
- bias `neutral` -> `+0` (niezaleznie od SMA)

4. Trend anchor (tylko przy kierunkowym bias):
- `bullish + above` -> `+2`
- `bearish + below` -> `+2`
- bias kierunkowy i `middle` -> `+1`
- bias `neutral` -> `+0`

Clamp: `directionScore = clamp(directionScore, 0, 8)`

## B) Context Score (0..8)

Start: `contextScore = 0`

1. Rate:
- `rate >= 80` -> `+2`
- `rate >= 60` -> `+1`
- inaczej -> `+0`

2. SPY alignment:
- `aligned` -> `+2`
- `diverging` -> `+1`
- `opposite` -> `+0`

3. Relative vs SPY:
- `strength` -> `+2`
- `neutral` -> `+1`
- `weakness` -> `+0`

4. RS trend:
- `improving` -> `+2`
- `stable` -> `+1`
- `deteriorating` -> `+0`

5. Trend state bonus:
- `trendState = intact` -> `+1`
- inaczej -> `+0`

Clamp: `contextScore = clamp(contextScore, 0, 8)`

## C) Risk + Levels Score (0..4)

Start: `riskLevelsScore = 0`

1. Gap risk:
- `low` -> `+2`
- `medium` -> `+1`
- `high` -> `+0`

2. Options liquidity:
- `good` -> `+2`
- `medium` -> `+1`
- `poor` -> `+0`

3. Beta / sensitivity:
- `neutral_beta` lub `defensive` -> `+1`
- `high_beta` -> `+0`

4. Level position bonus (tylko przy kierunkowym bias):
- `bullish + near_support` -> `+1`
- `bearish + near_resistance` -> `+1`
- pozostale -> `+0`
- bias `neutral` -> `+0`

Clamp: `riskLevelsScore = clamp(riskLevelsScore, 0, 4)`

## D) Penalties (ujemne)

Start: `penalties = 0`

1. Konflikt bias vs RS:
- `bullish + relativeVsSpy=weakness` -> `-2`
- `bearish + relativeVsSpy=strength` -> `-2`

2. Neutral bias:
- `bias=neutral` -> `-1`

3. Broken trend:
- `trendState=broken` -> `-2` (zawsze)
- dodatkowo `trendState=broken` i `structure=mixed` -> `-1` extra

4. Pullback:
- `pullback=against` -> `-1`

5. Beta + SPY:
- `betaSensitivity=high_beta` i `spyAlignment=opposite` -> `-1`

6. Events/catalysts:
- `earningsSoon=true` -> `-2`
- `dividendSoon=true` -> `-1`
- `otherCatalyst=true` -> `-1`

## E) Caps (najbardziej restrykcyjny wygrywa)

Start:
- `cap = 20`
- `capReasons = []`

Reguly:
1. `gapRisk=high` -> cap `12`
2. `earningsSoon=true` -> cap `12`
3. `optionsLiquidity=poor` -> cap `12`
4. `spyAlignment=opposite` i `relativeVsSpy=weakness` -> cap `10`

Final:
- `total = min(boundedRawTotal, cap)`
- `capApplied = (total < boundedRawTotal)`

## F) Grade (mapowanie total -> opis)

Jesli nie spelniono minimum (`bias + structure`):
- `No data`

W przeciwnym razie:
- `total >= 16` -> `A Candidate (worth planning)`
- `total >= 12` -> `B Candidate (selective)`
- `total >= 8` -> `C / Watchlist`
- `< 8` -> `Pass / observation`

## 3) Szybkie test cases

1. Ideal A:
- bullish, hh_hl, above/above, rate 85, aligned, strength, improving, intact, low gap, good liquidity, no events
- Oczekiwane: wysoki wynik, brak cap, `A`.

2. Cap przez earnings:
- jak wyzej + `earningsSoon=true`
- Oczekiwane: cap 12, `capApplied=true`.

3. Bullish ale weakness vs SPY:
- Oczekiwane: `-2` i wyrazny spadek grade.

4. Neutral bias:
- Oczekiwane: malo punktow kierunkowych + kara `-1`.

5. Broken trend:
- Oczekiwane: `-2` zawsze, `-3` przy `structure=mixed`.

6. High beta + opposite SPY:
- Oczekiwane: dodatkowe `-1`, a przy `opposite + weakness` takze cap 10.
