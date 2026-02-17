# Scoring Fields + Answers + Tooltips

## Audit Baseline (AUTO / SEMI / MANUAL)

## Architecture (4 Layers)

### 1) RAW MARKET DATA (AUTO, Pine 100%)
- Trend/price: Close vs MA20/50/200, MA alignment, VWAP, 20D high/low, distance to 20D range.
- Structure quantifiable: HH/HL, LL/LH, BOS, higher lows intact, lower highs intact.
- Volatility: VIX level/trend, ATR, ATR expansion, range width, ADX.
- Volume: volume vs 20D avg, spike, RVOL.
- Price state: pullback depth, compression, expansion, inside-bar cluster.

### 2) DERIVED METRICS (AUTO, Pine logic flags)
- `trend_state`: Bull / Bear / Range
- `vol_regime`: Low / Normal / High
- `structure_state`: HHHL / LLLH / Mixed
- Trend strength / expansion-compression flags

### 3) DISCRETION / INTERPRETATION (MANUAL)
- Structure/regime as final trader read (if not fully auto-driven)
- Location and room-to-move (especially with hand-drawn levels)
- Breadth interpretation and sector participation labels

### 4) EXTERNAL CONTEXT (MANUAL, outside chart)
- Event risk (CPI/FOMC/NFP), OPEX, mega-cap earnings, geopolitical/liquidity context

## UI Split (Target)

### Block A: System Data (AUTO, readonly)
- MA alignment, Close vs 50D/200D, BOS, VWAP, VIX level/trend, volume state, distance to range, compression/expansion.

### Block B: Structural Interpretation (MANUAL/SEMI)
- Structure, market regime, location, room to move, breadth, sectors participation.

### Block C: Risk Filter (MANUAL)
- Event risk, rate, summary.

### Practical target ratio
- Manual inputs should be ~30-40% max.

### Global UI rules

1. Add source badge near every field label:
   - `AUTO` = fully deterministic from TradingView/Pine.
   - `SEMI` = TV data + selected method (M1/M2/M3).
   - `MANUAL` = requires trader judgement or external source.
2. For all `SEMI` fields add method selector in UI (per section).
3. For all `MANUAL` fields tooltips must include a concrete checklist, not only definition.

### Section classification (high-level)

- `SPY`
  - `AUTO`: VWAP state, volume vs avg (if scripted), ATR/vol proxies.
  - `SEMI`: bias, structure, regime, location, room, behavior trend.
  - `MANUAL`: rate, summary.
- `Stock 1D`
  - `AUTO`: SMA200, volatility/extension proxies.
  - `SEMI`: bias/structure/alignment/RS trend/gap proxy/anchor (if method-based).
  - `MANUAL`: events, options liquidity, trend quality, rate, summary, gap override.
- `Stock 4H`
  - `AUTO`: volatility profile proxy, range stats.
  - `SEMI`: structure, anchor state, location.
  - `MANUAL`: setup type, invalidation logic, key levels, liquidity check, trend quality.
- `Stock 1H`
  - `SEMI`: structure, anchor, range state.
  - `MANUAL`: intraday reactions, alignment with 4H, setup type, risk model, notes.
- `15m`
  - `AUTO` (recommended readonly additions): VWAP state, volume vs avg, momentum helper.
  - `MANUAL`: trigger/confirmation/quality/timing/spread/IV behavior.
- `Options`
  - `MANUAL`: spread, OI/volume, delta/moneyness, tradeable decision.
  - `SEMI` (proxy): IV level/trend/vs RV/EM fit/room-vs-theta with manual confirmation.

### Mandatory tooltip additions (missing today)

- `setup_status`:
  - "Decyzja operacyjna: `Valid` = plan gotowy; `Needs trigger` = czekasz na warunek 15m; `Observation-only` = brak edge/konflikt; `Invalidation hit` = plan unieważniony."
- `entry_plan`:
  - "Jedno zdanie: typ triggera + poziom + warunek potwierdzenia (close/retest/follow-through)."
- `must_happen`:
  - "Warunek konieczny przed wejściem. Jeśli nie wystąpi — nie wchodzisz."
- `stop_loss`:
  - "Techniczny poziom unieważnienia pozycji. To nie to samo co invalidation logiki planu 4H."
- `tp1`:
  - "Pierwszy logiczny target (np. najbliższy poziom HTF)."
- `tp2`:
  - "Drugi target/runner; dla opcji dopisz czy planujesz partial/roll."
- `sc_spy_summary`:
  - "1–2 zdania: co robi SPY i jak to wpływa na trade permission."

### Strict manual checklists (to enforce in tooltip text)

- `stk1d_options_liquidity`: bid/ask spread %, OI/volume around ATM, fill quality on nearby strikes.
- `stk1d_trend_quality`: explicit criteria for Clean/Acceptable/Choppy.
- `stk1d_gap_risk`: split into `AUTO proxy` + `MANUAL override`.
- `stk4h_invalidation_logic`: clearly separate "plan invalidation" vs "position stop".
- `stk4h_key_level_*`: rule "mark max 2-3 active levels".
- `stk1h_intraday_*`: define concrete conditions when a level is "active".
- `m15_trigger_confirmed`: require at least `2 of 3` (close, follow-through, retest).

| Field | Type | Answers | Tooltip |
|---|---|---|---|
| `entry_plan` | text | (free input) | (no tooltip found) |
| `m15_bias` | radio | Bullish (Bullish); Bearish (Bearish) | Kierunek na 15m dla wykonania. Jesli 15m jest w kontrze do 1D/4H, ryzyko whipsaw rośnie. |
| `m15_entry_quality` | radio | A+ (A+); OK (OK); Late/Chase (Late/Chase) | A+ = przy poziomie i potwierdzeniu, OK = poprawne, Late = gonienie ruchu. |
| `m15_event_timing` | radio | Before news (Before news); After news (After news); No scheduled risk (No scheduled risk) | Czy wejście jest przed/po newsach. Przed newsami częściej rośnie ryzyko fałszywych ruchów. |
| `m15_impulse_volume_confirms` | checkbox | Impulse volume confirms | Idealnie: impuls ma wolumen, a pullback ma słabszy wolumen. |
| `m15_invalidation_level` | text | (free input) | Poziom, przy którym założenie jest błędne. |
| `m15_iv_behavior` | radio | IV rising (IV rising); IV stable (IV stable); IV falling (IV falling) | Dla opcji: rising pomaga long premium, falling może zjadać zysk mimo ruchu ceny. |
| `m15_micro_sr_last_swing` | checkbox | Last swing | Zaznacz poziomy, które realnie uczestniczą w triggerze 15m. |
| `m15_micro_sr_orh_orl` | checkbox | ORH/ORL | Zaznacz poziomy, które realnie uczestniczą w triggerze 15m. |
| `m15_micro_sr_pdh_pdl` | checkbox | PDH/PDL | Zaznacz poziomy, które realnie uczestniczą w triggerze 15m. |
| `m15_micro_sr_premarket_h_l` | checkbox | Premarket H/L | Zaznacz poziomy, które realnie uczestniczą w triggerze 15m. |
| `m15_micro_sr_vwap` | checkbox | VWAP | Zaznacz poziomy, które realnie uczestniczą w triggerze 15m. |
| `m15_momentum_state` | radio | Expanding with move (Expanding with move); Diverging (Diverging); Overextended (Overextended); Failed reclaim / turn back down (Failed reclaim / turn back down) | Expanding = paliwo, Diverging = ostrzeżenie, Overextended = chase risk, Failed reclaim = słabość. |
| `m15_note` | textarea | (free input) | 1-2 linie: trigger, warunek wejścia i co unieważnia setup. |
| `m15_pullback_volume_dries_up` | checkbox | Pullback volume dries up | Idealnie: impuls ma wolumen, a pullback ma słabszy wolumen. |
| `m15_rate` | text | (free input) | Ocena jakości wykonania 0-99: trigger, momentum, wolumen, alignment ze SPY. |
| `m15_retest_quality` | radio | Clean retest (Clean retest); Wicky (Wicky); No retest (No retest) | Clean retest = najlepsza jakość, Wicky = większy szum, No retest = większe ryzyko chase. |
| `m15_session_timing` | radio | Open (first 30m) (Open (first 30m)); Midday (Midday); Power hour (Power hour); Close (Close) | Open = szybkie ruchy, Midday = słabszy wolumen, Power hour = często kontynuacje. |
| `m15_spread_fills` | radio | OK (OK); Wide (Wide) | Na opcjach wide spread mocno pogarsza wykonanie nawet przy dobrym kierunku. |
| `m15_spy_alignment` | radio | Aligned (Aligned); Diverging (Diverging); Opposite (Opposite) | Aligned = SPY pomaga, Diverging = brak wsparcia, Opposite = SPY gra przeciwko. |
| `m15_spy_vwap` | radio | Above (Above); Below (Below) | Pozycja SPY względem VWAP na 15m. Dla long lepiej Above, dla short lepiej Below. |
| `m15_structure` | radio | HH/HL (HH/HL); LL/LH (LL/LH); Mixed (Mixed) | HH/HL = przewaga long, LL/LH = przewaga short, Mixed = chop i gorszy edge. |
| `m15_structure_breaks` | radio | Yes (Yes); No (No) | Czy struktura faktycznie pekla, a nie tylko dotknela poziomu. |
| `m15_trigger_confirmed` | radio | Yes (Yes); No (No) | Yes gdy jest akceptacja poziomu: zamknięcie po właściwej stronie + follow-through/retest. |
| `m15_trigger_level` | text | (free input) | Konkretny poziom/zakres wejścia na 15m. |
| `m15_trigger_type` | radio | Breakout (Breakout); Breakdown (Breakdown); Reclaim (Reclaim); Rejection (Rejection); Fade (Fade) | Mechanika wejścia: wybicie, reclaim, rejection lub fade. |
| `m15_vwap` | radio | Above (Above); Middle (Middle); Below (Below) | Dla long lepiej Above/reclaim, dla short lepiej Below/rejection. Middle zwykle oznacza brak edge. |
| `must_happen` | text | (free input) | (no tooltip found) |
| `opt_catalyst_type` | radio | Earnings (Earnings); Macro/news (Macro/news); None planned (None planned); Unknown (Unknown) | Bliskosc katalizatora: Earnings soon (<14 dni), duzy event (np. FOMC/FDA), brak duzego katalizatora lub Unknown. Im blizej wydarzenia, tym wieksze ryzyko zmian IV. |
| `opt_contract_type` | radio | Calls / Puts (directional) (Calls / Puts (directional)); Debit spread (Debit spread); Credit spread (Credit spread); Calendar/Diagonal (Calendar/Diagonal); Straddle/Strangle (volatility) (Straddle/Strangle (volatility)) | Zaznacz konstrukcje, ktora realnie planujesz: Long Call/Put (kierunek), Debit Spread (kontrola kosztu), Credit Spread (short premium), Calendar/Diagonal (czas + IV). |
| `opt_delta_bucket` | radio | 0.20-0.30 (0.20-0.30); 0.30-0.45 (0.30-0.45); 0.45-0.60 (0.45-0.60); 0.60+ (0.60+); Unknown (---) (Unknown (---)) | Delta jako proxy ryzyka. Nizsza delta = wieksza zaleznosc od szybkiego ruchu; wyzsza delta = bardziej stock-like. |
| `opt_dte_bucket` | radio | 0-7 DTE (0-7 DTE); 8-21 DTE (8-21 DTE); 22-45 DTE (22-45 DTE); 46-90 DTE (46-90 DTE) | Dopasuj DTE do planu trzymania: 0-7 agresywne (wysoka theta), 8-21 krotki swing, 22-45 klasyczny swing, 46-90 spokojniejsza pozycja. Zaznacz zakres zgodny z holding time. |
| `opt_expected_move_fit` | radio | Target inside EM (Target inside EM); Target near EM (Target near EM); Target beyond EM (Target beyond EM); Unknown (---) (Unknown (---)) | Porownaj target z 1D/4H do expected move na danym DTE: Inside EM = realistycznie, Near EM = blisko granicy, Beyond EM = ruch moze nie zdazyc. Unknown = brak EM. |
| `opt_gap_risk_ack` | radio | Acceptable (Acceptable); Too high (avoid) (Too high (avoid)) | Czy akceptujesz gap risk na opcjach. Jesli nie, wybieraj defined-risk (spread) albo omijaj. |
| `opt_holding_plan` | radio | 3-7 days (3-7 days); 2-4 weeks (2-4 weeks) | To plan trzymania pozycji, nie timing wejscia. Wybierz realny horyzont ruchu z 4H/1D. |
| `opt_iv_crush_risk` | radio | High (High); Medium (Medium); Low (Low) | Ryzyko spadku IV po wydarzeniu: High (czesto przed earnings), Medium (umiarkowane), Low (brak duzych eventow). High crush moze zdominowac long premium. |
| `opt_iv_level` | radio | Low (Low); Mid (Mid); High (High); Unknown (---) (Unknown (---)) | Low: IV historycznie nisko (czesto lepsze dla long premium). Mid: okolice mediany. High: IV wysoko, opcje drozsze niz zwykle. Unknown: nie sprawdziles IV rank/percentyla. |
| `opt_iv_trend` | radio | Rising (Rising); Stable (Stable); Falling (Falling); Unknown (---) (Unknown (---)) | Rising: IV rosnie (vega pomaga long premium). Falling: IV spada (lepiej dla short premium/spreadow). Stable: brak wyraznego trendu. |
| `opt_iv_vs_rv` | radio | IV ~= RV (IV = RV); IV &lt; RV (premium cheap) (IV < RV (premium cheap)); Unknown (---) (Unknown (---)) | Porownaj implied vs realized volatility: IV < RV = long premium ma edge; IV ~= RV = fair; IV > RV = opcje drogie, czesciej preferuj credit/spread; Unknown = brak porownania. |
| `opt_moneyness` | radio | ITM (ITM); ATM (ATM); OTM (OTM) | Wybor moneyness. ITM = wieksza delta, mniej theta; OTM = tansze, ale wieksze ryzyko, ze ruch nie dojedzie. |
| `opt_oi_volume` | radio | Good (Good); Medium (Medium); Poor (Poor); Unknown (---) (Unknown (---)) | Plynnosc kontraktu: Good = wysokie OI i wolumen, Medium = umiarkowane, Poor = niska plynnosc i trudniejsze wyjscie/rolowanie, Unknown = brak danych. |
| `opt_room_vs_theta` | radio | Plenty of room (theta ok) (Plenty of room (theta ok)); Some room (selective) (Some room (selective)); Limited room (theta danger) (Limited room (theta danger)) | Sprawdz, czy jest miejsce na ruch zanim theta zacznie bolec: Plenty = komfort, Some = selektywnie, Limited = blisko poziomow i ryzyko zjedzenia premii przez czas. |
| `opt_slippage_risk` | radio | Low (Low); Medium (Medium); High (High) | Ryzyko poslizgu w wejsciu/wyjsciu. High czesto przy wide spread + szybki move. |
| `opt_spread_quality` | radio | Tight (Tight); Ok (Ok); Wide (Wide); Unknown (---) (Unknown (---)) | Ocen bid-ask: Tight = latwiejsze wejscie/wyjscie, OK = akceptowalne, Wide = trudniejsze fille i mniejszy edge, Unknown = nie sprawdzone. |
| `opt_strategy_note` | textarea | (free input) | Krotko: jaka konstrukcja i dlaczego (IV, DTE, EM, room, liquidity). Bez detali entry. |
| `opt_structure_fit` | radio | Good (fits trend) (Good (fits trend)); Ok (Ok); Bad (mismatch) (Bad (mismatch)) | Czy konstrukcja pasuje do Twojego 1D/4H (trend/volatility/liquidity). To szybka kontrola spojnosci. |
| `opt_tradeable` | radio | Yes (options) (Yes (options)); Yes (but shares better) (Yes (but shares better)); No (skip) (No (skip)) | Finalna decyzja: czy opcje maja sens vs akcje. Czasem wykres jest swietny, ale opcje sa za drogie/za malo miejsca/za slaba plynnosc. |
| `opt_vol_play_fit` | radio | Directional (delta) (Directional (delta)); Volatility expansion (vega) (Volatility expansion (vega)); Theta harvest (Theta harvest); None / unclear (None / unclear) | Wybierz glowny edge opcyjny: kierunek (delta), zmiennosc (vega) albo theta. Ma to byc spojne z volatility state na 1D/4H. |
| `sc_spy_behavior_above_200` | checkbox | Above 200 | Zaznacz, gdy cena zamyka sie powyzej SMA200. |
| `sc_spy_behavior_above_20_50` | checkbox | Above 20/50 | Zaznacz, gdy cena utrzymuje sie nad srednimi 20 i 50. |
| `sc_spy_behavior_compression` | checkbox | Compression | Zaznacz, gdy ostatnie swiece maja coraz mniejszy zakres ruchu. |
| `sc_spy_behavior_expansion_down` | checkbox | Price expansion down | Zaznacz, gdy swieca ma duzy zakres i zamyka sie blisko minimum. |
| `sc_spy_behavior_expansion_up` | checkbox | Price expansion up | Zaznacz, gdy swieca ma duzy zakres i zamyka sie blisko maksimum. |
| `sc_spy_behavior_pullback_in_progress` | checkbox | Pullback in progress | Zaznacz, gdy po ruchu kierunkowym trwa korekta, ale struktura nie zostala zanegowana. |
| `sc_spy_behavior_trend` | radio | Higher lows intact (higher_lows); Lower highs intact (lower_highs); No clear trend signal (none) | Higher lows gdy dolki rosna, Lower highs gdy szczyty spadaja, None gdy nie ma czytelnego sygnalu. |
| `sc_spy_bias` | radio | Bullish (bullish); Bearish (bearish); Neutral (neutral) | Wybierz kierunek, ktory widzisz na wykresie; jesli nie masz przewagi, wybierz Neutral. |
| `sc_spy_breadth` | radio | Strong (strong); Neutral (neutral); Weak (weak) | Strong gdy wiekszosc rynku idzie w tym samym kierunku, Weak gdy tylko czesc spolek bierze udzial, Neutral gdy jest po rowno. |
| `sc_spy_location` | radio | At resistance (at_resistance); At support (at_support); Mid-range (mid_range); Breaking range (breaking_range) | Breaking range gdy cena wybija zakres konsolidacji, inaczej wybierz support, resistance albo srodek zakresu. |
| `sc_spy_rate` | text | (free input) | Wpisz ocene sily rynku od 0 do 100 na podstawie tego, co widzisz na wykresie. |
| `sc_spy_regime` | radio | Trending (trending); Ranging (ranging); Volatile/Distribution (volatile) | Trending gdy ruch jest kierunkowy, Ranging gdy cena chodzi bokiem, Volatile gdy czesto gwaltownie zawraca. |
| `sc_spy_room` | radio | Large (large); Limited (limited); None (none) | Large gdy do kolejnego poziomu jest duzo miejsca, Limited gdy poziom jest blisko, None gdy miejsca praktycznie nie ma. |
| `sc_spy_structure` | radio | HH/HL (hh_hl); LL/LH (ll_lh); Mixed (mixed) | HH/HL gdy dolki i szczyty ida wyzej, LL/LH gdy ida nizej, Mixed gdy brak konsekwencji. |
| `sc_spy_summary` | textarea | (free input) | (no tooltip found) |
| `sc_spy_vix_level` | radio | &lt;20 (lt20); 20-25 (20_25); &gt;25 (gt25) | Wybierz zakres zgodny z aktualnym VIX: ponizej 20, 20-25 lub powyzej 25. |
| `sc_spy_vix_trend` | radio | Falling (falling); Rising (rising); Flat (flat) | Falling gdy VIX spada od kilku dni, Rising gdy rosnie, Flat gdy stoi blisko jednego poziomu. |
| `sc_spy_volume_expansion` | checkbox | Volume expansion | Zaznacz, gdy wolumen jest wyraznie wiekszy niz na kilku poprzednich sesjach. |
| `sc_spy_volume_gt_20d` | checkbox | Volume &gt; 20D avg | Zaznacz, gdy dzisiejszy wolumen jest wiekszy niz srednia z 20 dni. |
| `sc_spy_vwap` | radio | Above (above); Below (below) | Above gdy cena zamkniecia jest nad VWAP, Below gdy jest pod VWAP. |
| `setup_status` | select | Select status (); Valid (Valid); Needs trigger (Needs trigger); Observation-only (Observation-only); Invalidation hit (Invalidation hit) | (no tooltip found) |
| `stk1d_beta_sensitivity` | radio | High beta (high_beta); Neutral (neutral_beta); Defensive (defensive) | High beta = mocno reaguje na ruch SPY, Defensive = mniej zaleĹĽna od rynku, Neutral = poĹ›rodku. |
| `stk1d_bias` | radio | Bullish (bullish); Bearish (bearish); Neutral (neutral) | Ostateczny kierunek po uwzglÄ™dnieniu struktury, 200 SMA, trend anchor i kontekstu SPY. |
| `stk1d_event_dividends` | checkbox | Dividends | Dywidenda moĹĽe zmieniÄ‡ cenÄ™ odniesienia i zachowanie kursu w krĂłtkim terminie. |
| `stk1d_event_earnings` | checkbox | Earnings | Wyniki mogÄ… wywoĹ‚aÄ‡ gwaĹ‚towny ruch i zmieniÄ‡ kontekst (ryzyko dla swing options). |
| `stk1d_event_other` | checkbox | Other catalyst | Inny zaplanowany katalizator (np. decyzja sÄ…dowa, FDA, makro, split). |
| `stk1d_extension_state` | radio | Extended (extended); Balanced (balanced); Reset (reset) | Extended = daleko od EMA20/50 (Ĺ‚atwo o cofkÄ™), Reset = po mocnym cofniÄ™ciu, Balanced = poĹ›rodku. |
| `stk1d_gap_risk` | radio | Low (low); Medium (medium); High (high) | Ocena ryzyka luki cenowej (gap) na podstawie historii zachowania i bieĹĽÄ…cych katalizatorĂłw. |
| `stk1d_level_position` | radio | Near support (near_support); Mid-range (mid_range); Near resistance (near_resistance); Range break (range_break) | Gdzie jest cena wzglÄ™dem kluczowych poziomĂłw: przy wsparciu, w Ĺ›rodku zakresu, przy oporze lub wybija zakres. |
| `stk1d_options_liquidity` | radio | Good (good); Medium (medium); Poor (poor) | Good = wÄ…skie spready i duĹĽy obrĂłt, Poor = szerokie spready/niska pĹ‚ynnoĹ›Ä‡ (ryzyko pod swing options). |
| `stk1d_phase` | radio | Impulse (impulse); Pullback (pullback); Base (base) | Impulse = silny ruch kierunkowy, Pullback = cofniÄ™cie, Base = konsolidacja/budowanie bazy. |
| `stk1d_pullback` | radio | Within trend (within_trend); Against (against); None (none) | Within trend = cofniÄ™cie zgodne z kierunkiem biasu, Against = cofniÄ™cie przeciwne do biasu, None = brak cofniÄ™cia. |
| `stk1d_rate` | text | (free input) | Twoja ocena jakoĹ›ci kandydata (0-99) na podstawie zewnÄ™trznej aplikacji lub wĹ‚asnej oceny. |
| `stk1d_relative_vs_spy` | radio | Strength (strength); Weakness (weakness); Neutral (neutral) | Relative = dziĹ› vs SPY (stan bieĹĽÄ…cy): Strength, Weakness albo Neutral. |
| `stk1d_resistance` | text | (free input) | NajbliĹĽszy istotny poziom oporu na 1D. |
| `stk1d_rs_trend` | radio | Improving (improving); Stable (stable); Deteriorating (deteriorating) | RS trend = czy relacja Relative vs SPY poprawia siÄ™, jest stabilna, czy pogarsza. |
| `stk1d_sma200` | radio | Above (above); Below (below) | Above = cena powyĹĽej SMA200 (czÄ™sto bullish kontekst), Below = poniĹĽej (czÄ™sto bearish kontekst). |
| `stk1d_spy_alignment` | radio | Aligned (aligned); Diverging (diverging); Opposite (opposite) | Aligned = akcja idzie w tym samym kierunku co SPY, Diverging = wyraĹşnie inaczej, Opposite = przeciwnie do SPY. |
| `stk1d_structure` | radio | HH/HL (hh_hl); LL/LH (ll_lh); Mixed (mixed) | HH/HL = wyĹĽsze szczyty i doĹ‚ki, LL/LH = niĹĽsze szczyty i doĹ‚ki, Mixed = brak czytelnej struktury. |
| `stk1d_summary` | textarea | (free input) | W 1-2 zdaniach podaj, czy akcja jest kandydatem i dlaczego (bez planu wejscia/stop/target). |
| `stk1d_support` | text | (free input) | NajbliĹĽszy istotny poziom wsparcia na 1D. |
| `stk1d_ticker` | text | (free input) | Symbol akcji analizowanej na interwale dziennym (1D). |
| `stk1d_trend_anchor` | radio | Above (above); Middle (middle); Below (below) | PorĂłwnaj cenÄ™ do EMA20 na D1: Above = powyĹĽej, Middle = dotyka/krÄ…ĹĽy, Below = poniĹĽej. |
| `stk1d_trend_quality` | radio | Clean (clean); Acceptable (acceptable); Choppy (choppy) | Wybierz Clean jeĹ›li ruch jest gĹ‚adki i respektuje poziomy; Choppy jeĹ›li duĹĽo szarpania i faĹ‚szywych Ĺ›wiec. |
| `stk1d_trend_state` | radio | Intact (intact); Weakening (weakening); Broken (broken) | Intact = trend dziaĹ‚a, Weakening = traci impet/Ĺ‚amie zasady, Broken = struktura trendu jest naruszona. |
| `stk1d_volatility_state` | radio | Expanding (expanding); Stable (stable); Contracting (contracting) | Expanding gdy dzienne Ĺ›wiece/zakres rosnÄ…, Contracting gdy zmiennoĹ›Ä‡ siÄ™ zwija i rynek usypia. |
| `stk1h_alignment_with_4h` | radio | Aligned (aligned); Minor pullback (minor_pullback); Counter-trend (counter_trend) | Relacja 1H do planu 4H: Aligned, Minor pullback lub Counter-trend (wyzsze ryzyko fake move). |
| `stk1h_anchor_state` | radio | Above (above); Around (around); Below (below) | Pozycja ceny wzgledem anchor na 1H pomaga ocenic, czy momentum intraday wspiera plan 4H. |
| `stk1h_intraday_opening_range` | checkbox | Opening range high/low | Zaznacz tylko poziomy dnia, ktore realnie steruja ruchem (PMH/PML, OR, VWAP, PDH/PDL). |
| `stk1h_intraday_pdh_pdl` | checkbox | PDH/PDL | Zaznacz tylko poziomy dnia, ktore realnie steruja ruchem (PMH/PML, OR, VWAP, PDH/PDL). |
| `stk1h_intraday_premarket` | checkbox | Premarket high/low | Zaznacz tylko poziomy dnia, ktore realnie steruja ruchem (PMH/PML, OR, VWAP, PDH/PDL). |
| `stk1h_intraday_vwap_reclaim_loss` | checkbox | VWAP reclaim/loss | Zaznacz tylko poziomy dnia, ktore realnie steruja ruchem (PMH/PML, OR, VWAP, PDH/PDL). |
| `stk1h_notes` | textarea | (free input) | Krotki opis, co na 1H musi sie wydarzyc, aby plan 4H byl gotowy. |
| `stk1h_range_state` | radio | Breaking range (breaking_range); Inside range (inside_range); Rejecting level (rejecting_level) | Stan 1H wzgledem range: wybicie, handel w srodku, albo odrzucenie poziomu. |
| `stk1h_rate` | text | (free input) | Twoja ocena jakoĹ›ci ukĹ‚adu na 1H (0-99). |
| `stk1h_risk_model` | radio | Structure based (structure_based); Level based (level_based); Volatility based (volatility_based) | Model ryzyka 1H: structure-based, level-based albo volatility-based. |
| `stk1h_setup_type` | radio | Breakout hold (breakout_hold); Failed breakout (failed_breakout); Pullback continuation (pullback_continuation); Rejection reversal (rejection_reversal) | Mikroschemat 1H (bez execution): breakout hold, failed breakout, pullback continuation, rejection reversal. |
| `stk1h_structure` | radio | HH/HL (hh_hl); LL/LH (ll_lh); Mixed (mixed) | Struktura 1H opisuje lokalny swing i moze byc inna niz 4H. |
| `stk4h_anchor_state` | radio | Above anchor (above_anchor); Around anchor (around_anchor); Below anchor (below_anchor) | Pozycja ceny wzgledem anchor na 4H (EMA20/VWAP proxy): powyzej, wokol lub ponizej. |
| `stk4h_bias` | radio | Bullish (bullish); Bearish (bearish); Neutral (neutral) | Bias 4H to finalny kierunek po ocenie struktury i polozenia wzgledem anchor/poziomow. To filtr, nie sygnal wejscia. |
| `stk4h_invalidation_logic` | radio | Structure break (structure_break); Loss of anchor (loss_of_anchor); Rejection at level (rejection_at_level); Volatility collapse (volatility_collapse); Time decay risk (time_decay_risk) | Logika uniewaznienia planu 4H. To nie jest stop-loss, tylko warunek utraty sensu setupu. |
| `stk4h_key_level_major_ma` | checkbox | Major MA (50/200) | Zaznacz tylko poziomy, ktore realnie graja. To nie jest checklista wszystkiego. |
| `stk4h_key_level_prior_day` | checkbox | Prior day high/low | Zaznacz tylko poziomy, ktore realnie graja. To nie jest checklista wszystkiego. |
| `stk4h_key_level_range` | checkbox | 4H range level | Zaznacz tylko poziomy, ktore realnie graja. To nie jest checklista wszystkiego. |
| `stk4h_key_level_supply_demand` | checkbox | HTF supply/demand | Zaznacz tylko poziomy, ktore realnie graja. To nie jest checklista wszystkiego. |
| `stk4h_key_level_weekly` | checkbox | Weekly high/low | Zaznacz tylko poziomy, ktore realnie graja. To nie jest checklista wszystkiego. |
| `stk4h_liquidity_check` | radio | Good (good); Medium (medium); Poor (poor) | Ocena optionability: czy spready i plynnosc sa akceptowalne dla swing options. |
| `stk4h_location` | radio | Near support (near_support); Mid-range (mid_range); Near resistance (near_resistance); Range high (range_high); Range low (range_low) | Lokalizacja ceny wzgledem aktualnego range/swing, pomocna do oceny jakosci planu i przestrzeni ruchu. |
| `stk4h_notes` | textarea | (free input) | Krotki opis planu 4H (1-2 linie), bez entry/stop/TP. |
| `stk4h_rate` | text | (free input) | Twoja ocena jakoĹ›ci ukĹ‚adu na 4H (0-99). |
| `stk4h_setup_type` | radio | Breakout continuation (breakout_continuation); Breakdown continuation (breakdown_continuation); Pullback within trend (pullback_within_trend); Reversal attempt (reversal_attempt); Range play (range_play) | Typ planowanego schematu 4H (continuation, pullback, reversal, range). Okresla co chcesz grac, bez triggera. |
| `stk4h_structure` | radio | HH/HL (hh_hl); LL/LH (ll_lh); Mixed (mixed) | Struktura swingowa 4H: HH/HL trend wzrostowy, LL/LH trend spadkowy, Mixed brak czytelnej struktury. |
| `stk4h_trend_quality` | radio | Clean (clean); Acceptable (acceptable); Choppy (choppy) | Jakosc trendu 4H: Clean, Acceptable lub Choppy. Choppy zwykle podnosi ryzyko theta i whipsaw. |
| `stk4h_volatility_profile` | radio | Expanding (expanding); Stable (stable); Contracting (contracting) | Profil zmiennosci 4H: Expanding, Stable, Contracting. Wplywa na zachowanie premii opcyjnych. |
| `stop_loss` | text | (free input) | (no tooltip found) |
| `tp1` | text | (free input) | (no tooltip found) |
| `tp2` | text | (free input) | (no tooltip found) |
