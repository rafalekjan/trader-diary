// Auto-uppercase ticker input
document.addEventListener('DOMContentLoaded', function() {
    const tickerInputs = document.querySelectorAll('input[name="ticker"], input[name="stk1d_ticker"]');
    tickerInputs.forEach(input => {
        input.addEventListener('input', function() {
            this.value = this.value.toUpperCase();
        });
    });

    // Confirm delete
    const deleteForms = document.querySelectorAll('form[action*="/delete"]');
    deleteForms.forEach(form => {
        form.addEventListener('submit', function(e) {
            if (!confirm('Are you sure you want to delete this trade?')) {
                e.preventDefault();
            }
        });
    });

    initAnalysisBuilder();
    initScoringBuilder();
    initScoreGatekeeper();
});

// Toggle option fields based on instrument type
function toggleOptionFields() {
    const instrumentType = document.getElementById('instrument_type');
    if (!instrumentType) return;

    const optionFields = ['option_type_group', 'expiration_group', 'strike_group'];
    const isOption = instrumentType.value === 'option';

    optionFields.forEach(fieldId => {
        const field = document.getElementById(fieldId);
        if (field) {
            field.style.display = isOption ? 'block' : 'none';
        }
    });
}

function initAnalysisBuilder() {
    const form = document.getElementById('analysis-form');
    if (!form) return;

    const output = document.getElementById('analysis-output');
    const generateBtn = document.getElementById('analysis-generate');
    const copyBtn = document.getElementById('analysis-copy');
    const saveBtn = document.getElementById('analysis-save');
    const loadBtn = document.getElementById('analysis-load');
    const deleteBtn = document.getElementById('analysis-delete');
    const previewBtn = document.getElementById('analysis-preview');
    const nameInput = document.getElementById('analysis_name');
    const listSelect = document.getElementById('analysis_list');
    const sortSelect = document.getElementById('analysis_sort');
    const previewOutput = document.getElementById('analysis-preview-output');
    const clearBtn = document.getElementById('analysis-clear');

    const getValue = (id) => {
        const el = document.getElementById(id);
        return el ? el.value.trim() : '';
    };

    const getRadio = (name) => {
        const el = document.querySelector(`input[name="${name}"]:checked`);
        return el ? el.value : '';
    };

    const getCheckbox = (name) => {
        const el = document.querySelector(`input[name="${name}"]`);
        return el ? el.checked : false;
    };

    const bindMutualExclusive = (nameA, nameB) => {
        const a = document.querySelector(`input[name="${nameA}"]`);
        const b = document.querySelector(`input[name="${nameB}"]`);
        if (!a || !b) return;
        a.addEventListener('change', () => {
            if (a.checked) b.checked = false;
        });
        b.addEventListener('change', () => {
            if (b.checked) a.checked = false;
        });
    };
    const bindMutualExclusiveGroup = (names) => {
        const inputs = names.map(name => document.querySelector(`input[name="${name}"]`)).filter(Boolean);
        if (inputs.length < 2) return;
        inputs.forEach(input => {
            input.addEventListener('change', () => {
                if (!input.checked) return;
                inputs.forEach(other => {
                    if (other !== input) other.checked = false;
                });
            });
        });
    };

    const withFallback = (value, fallback) => (value && value.length ? value : fallback);
    const storageKey = 'analysis:latest';
    const storageListKey = 'analysis:entries';

    bindMutualExclusive('h4_pdh_above', 'h4_pdh_below');
    bindMutualExclusive('h4_pdl_above', 'h4_pdl_below');
    bindMutualExclusive('h4_ma20_above', 'h4_ma20_below');
    bindMutualExclusive('h4_ma50_above', 'h4_ma50_below');
    bindMutualExclusive('h4_ma200_above', 'h4_ma200_below');
    bindMutualExclusive('h1_pdh_above', 'h1_pdh_below');
    bindMutualExclusive('h1_pdl_above', 'h1_pdl_below');
    bindMutualExclusive('h1_pmh_above', 'h1_pmh_below');
    bindMutualExclusive('h1_pml_above', 'h1_pml_below');
    bindMutualExclusiveGroup(['h1_or_above', 'h1_or_middle', 'h1_or_below']);
    bindMutualExclusive('h1_ma20_above', 'h1_ma20_below');
    bindMutualExclusive('h1_ma50_above', 'h1_ma50_below');
    bindMutualExclusive('h1_ma200_above', 'h1_ma200_below');

    const formatDate = (d) => {
        const pad = (n) => String(n).padStart(2, '0');
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    };

    const buildAutoName = () => {
        const ticker = (getValue('ticker') || 'TICKER').toUpperCase();
        const datePart = formatDate(new Date());
        const optExpiry = getValue('opt_expiry');
        const optCp = getValue('opt_cp');
        const optStrike = getValue('opt_strike');
        const optionParts = [optExpiry, optCp, optStrike].filter(Boolean);
        const optionDetail = optionParts.length ? optionParts.join('_') : 'NO_OPTIONS';
        return `${ticker}_${datePart}_${optionDetail}`;
    };

    const collectFormState = () => {
        const data = {};
        const fields = form.querySelectorAll('input, select, textarea');
        fields.forEach(field => {
            if (!field.name) return;
            if (field.type === 'radio') {
                if (field.checked) {
                    data[field.name] = field.value;
                }
                return;
            }
            if (field.type === 'checkbox') {
                data[field.name] = field.checked;
                return;
            }
            data[field.name] = field.value;
        });
        return data;
    };

    const applyFormState = (data) => {
        if (!data) return;
        const fields = form.querySelectorAll('input, select, textarea');
        fields.forEach(field => {
            if (!field.name || !(field.name in data)) return;
            if (field.type === 'radio') {
                field.checked = field.value === data[field.name];
                return;
            }
            if (field.type === 'checkbox') {
                field.checked = Boolean(data[field.name]);
                return;
            }
            field.value = data[field.name] ?? '';
        });
    };

    const buildTemplateOutput = () => {
        const setup = withFallback(getValue('setup_number'), '1');
        const ticker = withFallback(getValue('ticker'), '_____');
        const status = withFallback(getRadio('status'), 'Observation-only');

        const spyBias = withFallback(getValue('spy_bias'), '---');
        const spyRate = withFallback(getValue('spy_rate'), '---');
        const spyStructure = withFallback(getValue('spy_structure'), '---');
        const spyVwap = withFallback(getValue('spy_vwap'), '---');
        const spySupport = withFallback(getValue('spy_support'), '---');
        const spyResistance = withFallback(getValue('spy_resistance'), '---');
        const spyNote = withFallback(getValue('spy_note'), '---');
        const marketAligned = withFallback(getRadio('market_aligned'), 'Yes (trade allowed)');

        const trigger = withFallback(getValue('trigger'), '---');
        const entryPlan = withFallback(getValue('entry_plan'), '---');
        const stopLoss = withFallback(getValue('stop_loss'), '---');
        const tp1 = withFallback(getValue('tp1'), '---');
        const tp2 = withFallback(getValue('tp2'), '---');

        const d1Bias = withFallback(getValue('d1_bias'), '---');
        const d1Structure = withFallback(getValue('d1_structure'), '---');
        const d1Support = withFallback(getValue('d1_support'), '---');
        const d1Resistance = withFallback(getValue('d1_resistance'), '---');
        const d1Vwap = withFallback(getValue('d1_vwap'), '---');
        const d1Sma200 = withFallback(getValue('d1_sma_200'), '---');
        const d1Relative = withFallback(getValue('d1_relative'), '---');
        const d1Note = withFallback(getValue('d1_note'), '---');
        const d1Rate = withFallback(getValue('d1_rate'), '---');
        const d1Pullback = withFallback(getValue('d1_pullback'), '---');
        const d1CompanyEvents = [
            getCheckbox('d1_event_dividend') ? 'Dividends' : '',
            getCheckbox('d1_event_earnings') ? 'Earnings' : ''
        ].filter(Boolean).join(', ') || 'None';

        const h4Bias = withFallback(getValue('h4_bias'), '---');
        const h4Structure = withFallback(getValue('h4_structure'), '---');
        const h4Vwap = withFallback(getValue('h4_vwap'), '---');
        const h4Rate = withFallback(getValue('h4_rate'), '---');
        const h4Pullback = withFallback(getValue('h4_pullback'), '---');
        const h4TrendPattern = withFallback(getValue('h4_trend_pattern'), '---');
        const h4RiskDefine = withFallback(getValue('h4_risk_define'), '---');
        const h4Note = withFallback(getValue('h4_note'), '---');
        const h4Breakdown = withFallback(getValue('h4_breakdown'), '---');
        const h4Breakout = withFallback(getValue('h4_breakout'), '---');
        const h4KeyLevels = [
            getCheckbox('h4_pdh_above') ? 'PDH above' : '',
            getCheckbox('h4_pdh_below') ? 'PDH below' : '',
            getCheckbox('h4_pdl_above') ? 'PDL above' : '',
            getCheckbox('h4_pdl_below') ? 'PDL below' : '',
            getCheckbox('h4_ma20_above') ? 'MA20 above' : '',
            getCheckbox('h4_ma20_below') ? 'MA20 below' : '',
            getCheckbox('h4_ma50_above') ? 'MA50 above' : '',
            getCheckbox('h4_ma50_below') ? 'MA50 below' : '',
            getCheckbox('h4_ma200_above') ? 'MA200 above' : '',
            getCheckbox('h4_ma200_below') ? 'MA200 below' : ''
        ].filter(Boolean).join(', ') || '---';

        const h1Bias = withFallback(getValue('h1_bias'), '---');
        const h1Structure = withFallback(getValue('h1_structure'), '---');
        const h1Vwap = withFallback(getValue('h1_vwap'), '---');
        const h1Rate = withFallback(getValue('h1_rate'), '---');
        const h1Pullback = withFallback(getValue('h1_pullback'), '---');
        const h1TrendPattern = withFallback(getValue('h1_trend_pattern'), '---');
        const h1RiskDefine = withFallback(getValue('h1_risk_define'), '---');
        const h1Note = withFallback(getValue('h1_note'), '---');
        const h1Breakdown = withFallback(getValue('h1_breakdown'), '---');
        const h1Breakout = withFallback(getValue('h1_breakout'), '---');
        const h1KeyLevels = [
            getCheckbox('h1_pdh_above') ? 'PDH above' : '',
            getCheckbox('h1_pdh_below') ? 'PDH below' : '',
            getCheckbox('h1_pdl_above') ? 'PDL above' : '',
            getCheckbox('h1_pdl_below') ? 'PDL below' : '',
            getCheckbox('h1_pmh_above') ? 'Premarket high above' : '',
            getCheckbox('h1_pmh_below') ? 'Premarket high below' : '',
            getCheckbox('h1_pml_above') ? 'Premarket low above' : '',
            getCheckbox('h1_pml_below') ? 'Premarket low below' : '',
            getCheckbox('h1_or_above') ? 'Opening range above' : '',
            getCheckbox('h1_or_middle') ? 'Opening range middle' : '',
            getCheckbox('h1_or_below') ? 'Opening range below' : '',
            getCheckbox('h1_ma20_above') ? 'MA20 above' : '',
            getCheckbox('h1_ma20_below') ? 'MA20 below' : '',
            getCheckbox('h1_ma50_above') ? 'MA50 above' : '',
            getCheckbox('h1_ma50_below') ? 'MA50 below' : '',
            getCheckbox('h1_ma200_above') ? 'MA200 above' : '',
            getCheckbox('h1_ma200_below') ? 'MA200 below' : ''
        ].filter(Boolean).join(', ') || '---';

        const m15Bias = withFallback(getValue('m15_bias'), '---');
        const m15Structure = withFallback(getValue('m15_structure'), '---');
        const m15Vwap = withFallback(getValue('m15_vwap'), '---');
        const m15Note = withFallback(getValue('m15_note'), '---');
        const m15Rate = withFallback(getValue('m15_rate'), '---');
        const m15StructureBreaks = withFallback(getValue('m15_structure_breaks'), '---');
        const m15Momentum = withFallback(getValue('m15_momentum'), '---');
        const m15Volume = withFallback(getValue('m15_volume'), '---');
        const m15Breakdown = withFallback(getValue('m15_breakdown'), '---');
        const m15Breakout = withFallback(getValue('m15_breakout'), '---');

        const optExpiry = getValue('opt_expiry');
        const optCp = getValue('opt_cp');
        const optStrike = getValue('opt_strike');
        const optPrice = getValue('opt_price');
        const optVolume = getValue('opt_volume');
        const optionsEmpty = !optExpiry && !optCp && !optStrike && !optPrice && !optVolume;

        const optContractParts = [optExpiry, optCp, optStrike].filter(Boolean);
        const optContractOut = optionsEmpty ? '---' : (optContractParts.length ? optContractParts.join(' ') : '---');
        const optPriceOut = optionsEmpty ? '---' : withFallback(optPrice, '---');
        const optVolumeOut = optionsEmpty ? '---' : withFallback(optVolume, '---');

        const riskMain = withFallback(getValue('risk_main'), '---');
        const riskWhy = withFallback(getValue('risk_why'), '---');
        const riskWrong = withFallback(getValue('risk_wrong'), '---');

        const statusLine = (label) => `[${status === label ? 'X' : ' '}] ${label}`;
        const marketAlignedLine = (label) => `[${marketAligned === label ? 'X' : ' '}] ${label}`;

        return [
            '================================================',
            '',
            `SETUP #${setup}        TICKER: ${ticker}`,
            '',
            'STATUS:',
            statusLine('Valid'),
            statusLine('Needs trigger'),
            statusLine('Observation-only'),
            statusLine('Invalidation hit'),
            '',
            'ENTRY PLAN:',
            `Entry: ${entryPlan}`,
            `Stop Loss (invalidation): ${stopLoss}`,
            `TP1: ${tp1}`,
            `TP2 / Runner: ${tp2}`,
            `What must happen to enter: ${trigger}`,
            '',
            'DAY CONTEXT (SPY FIRST):',
            `Bias: ${spyBias}`,
            `Rate: ${spyRate}`,
            `Structure: ${spyStructure}`,
            `VWAP: ${spyVwap}`,
            `Resistance: ${spyResistance}`,
            `Support: ${spySupport}`,
            `Note: ${spyNote}`,
            '',
            'MARKET ALIGNED?',
            marketAlignedLine('Yes (trade allowed)'),
            marketAlignedLine('No (observation-only / smaller size / wait)'),
            '',
            '--------------------------------',
            'TOP-DOWN STRUCTURE',
            '--------------------------------',
            '',
            '1D:',
            `Bias: ${d1Bias}`,
            `Structure: ${d1Structure}`,
            `Resistance: ${d1Resistance}`,
            `Support: ${d1Support}`,
            `VWAP: ${d1Vwap}`,
            `200 SMA: ${d1Sma200}`,
            `Relative: ${d1Relative}`,
            `Rate: ${d1Rate}`,
            `Pullback: ${d1Pullback}`,
            `Company events: ${d1CompanyEvents}`,
            `Note: ${d1Note}`,
            '',
            '4H:',
            `Bias: ${h4Bias}`,
            `Structure: ${h4Structure}`,
            `VWAP: ${h4Vwap}`,
            `Rate: ${h4Rate}`,
            `Pullback: ${h4Pullback}`,
            `Trend pattern: ${h4TrendPattern}`,
            `Define risk: ${h4RiskDefine}`,
            `Key levels: ${h4KeyLevels}`,
            `Breakdown: ${h4Breakdown}`,
            `Breakout: ${h4Breakout}`,
            `Note: ${h4Note}`,
            '',
            '1H:',
            `Bias: ${h1Bias}`,
            `Structure: ${h1Structure}`,
            `VWAP: ${h1Vwap}`,
            `Rate: ${h1Rate}`,
            `Pullback: ${h1Pullback}`,
            `Trend pattern: ${h1TrendPattern}`,
            `Define risk: ${h1RiskDefine}`,
            `Key levels: ${h1KeyLevels}`,
            `Breakdown: ${h1Breakdown}`,
            `Breakout: ${h1Breakout}`,
            `Note: ${h1Note}`,
            '',
            '15m (TIMING ONLY):',
            `Bias: ${m15Bias}`,
            `Structure: ${m15Structure}`,
            `VWAP: ${m15Vwap}`,
            `Rate: ${m15Rate}`,
            `Structure breaks: ${m15StructureBreaks}`,
            `Momentum: ${m15Momentum}`,
            `Volume: ${m15Volume}`,
            `Breakdown: ${m15Breakdown}`,
            `Breakout: ${m15Breakout}`,
            `Note: ${m15Note}`,
            '',
            '--------------------------------',
            'OPTIONS (if applicable)',
            '--------------------------------',
            `Contract: ${optContractOut}`,
            `Price: ${optPriceOut}`,
            `Volume / OI: ${optVolumeOut}`,
            '',
            '--------------------------------',
            'NOTES / RISKS',
            '--------------------------------',
            `Main risk: ${riskMain}`,
            `Why this trade exists: ${riskWhy}`,
            `What makes me wrong: ${riskWrong}`,
            ''
        ].join('\n');
    };

    const buildCompactOutput = () => {
        const ticker = withFallback(getValue('ticker'), '_____');

        const spyBias = withFallback(getValue('spy_bias'), '---');
        const spyRate = withFallback(getValue('spy_rate'), '---');
        const spyStructure = withFallback(getValue('spy_structure'), '---');
        const spyVwap = withFallback(getValue('spy_vwap'), '---');
        const spySupport = withFallback(getValue('spy_support'), '---');
        const spyResistance = withFallback(getValue('spy_resistance'), '---');
        const spyNote = withFallback(getValue('spy_note'), '');

        const d1Bias = withFallback(getValue('d1_bias'), '---');
        const d1Structure = withFallback(getValue('d1_structure'), '---');
        const d1Resistance = withFallback(getValue('d1_resistance'), '---');
        const d1Support = withFallback(getValue('d1_support'), '---');
        const d1Vwap = withFallback(getValue('d1_vwap'), '---');
        const d1Sma200 = withFallback(getValue('d1_sma_200'), '');
        const d1Relative = withFallback(getValue('d1_relative'), '---');
        const d1Note = withFallback(getValue('d1_note'), '');
        const d1Rate = withFallback(getValue('d1_rate'), '');
        const d1Pullback = withFallback(getValue('d1_pullback'), '');
        const d1CompanyEvents = [
            getCheckbox('d1_event_dividend') ? 'Dividends' : '',
            getCheckbox('d1_event_earnings') ? 'Earnings' : ''
        ].filter(Boolean).join(', ');

        const h4Bias = withFallback(getValue('h4_bias'), '---');
        const h4Structure = withFallback(getValue('h4_structure'), '---');
        const h4Vwap = withFallback(getValue('h4_vwap'), '---');
        const h4Rate = withFallback(getValue('h4_rate'), '');
        const h4Pullback = withFallback(getValue('h4_pullback'), '');
        const h4TrendPattern = withFallback(getValue('h4_trend_pattern'), '');
        const h4RiskDefine = withFallback(getValue('h4_risk_define'), '');
        const h4Note = withFallback(getValue('h4_note'), '');
        const h4Breakdown = withFallback(getValue('h4_breakdown'), '');
        const h4Breakout = withFallback(getValue('h4_breakout'), '');
        const h4KeyLevels = [
            getCheckbox('h4_pdh_above') ? 'PDH above' : '',
            getCheckbox('h4_pdh_below') ? 'PDH below' : '',
            getCheckbox('h4_pdl_above') ? 'PDL above' : '',
            getCheckbox('h4_pdl_below') ? 'PDL below' : '',
            getCheckbox('h4_ma20_above') ? 'MA20 above' : '',
            getCheckbox('h4_ma20_below') ? 'MA20 below' : '',
            getCheckbox('h4_ma50_above') ? 'MA50 above' : '',
            getCheckbox('h4_ma50_below') ? 'MA50 below' : '',
            getCheckbox('h4_ma200_above') ? 'MA200 above' : '',
            getCheckbox('h4_ma200_below') ? 'MA200 below' : ''
        ].filter(Boolean).join(', ');

        const h1Bias = withFallback(getValue('h1_bias'), '---');
        const h1Structure = withFallback(getValue('h1_structure'), '---');
        const h1Vwap = withFallback(getValue('h1_vwap'), '---');
        const h1Rate = withFallback(getValue('h1_rate'), '');
        const h1Pullback = withFallback(getValue('h1_pullback'), '');
        const h1TrendPattern = withFallback(getValue('h1_trend_pattern'), '');
        const h1RiskDefine = withFallback(getValue('h1_risk_define'), '');
        const h1Note = withFallback(getValue('h1_note'), '');
        const h1Breakdown = withFallback(getValue('h1_breakdown'), '');
        const h1Breakout = withFallback(getValue('h1_breakout'), '');
        const h1KeyLevels = [
            getCheckbox('h1_pdh_above') ? 'PDH above' : '',
            getCheckbox('h1_pdh_below') ? 'PDH below' : '',
            getCheckbox('h1_pdl_above') ? 'PDL above' : '',
            getCheckbox('h1_pdl_below') ? 'PDL below' : '',
            getCheckbox('h1_pmh_above') ? 'Premarket high above' : '',
            getCheckbox('h1_pmh_below') ? 'Premarket high below' : '',
            getCheckbox('h1_pml_above') ? 'Premarket low above' : '',
            getCheckbox('h1_pml_below') ? 'Premarket low below' : '',
            getCheckbox('h1_or_above') ? 'Opening range above' : '',
            getCheckbox('h1_or_middle') ? 'Opening range middle' : '',
            getCheckbox('h1_or_below') ? 'Opening range below' : '',
            getCheckbox('h1_ma20_above') ? 'MA20 above' : '',
            getCheckbox('h1_ma20_below') ? 'MA20 below' : '',
            getCheckbox('h1_ma50_above') ? 'MA50 above' : '',
            getCheckbox('h1_ma50_below') ? 'MA50 below' : '',
            getCheckbox('h1_ma200_above') ? 'MA200 above' : '',
            getCheckbox('h1_ma200_below') ? 'MA200 below' : ''
        ].filter(Boolean).join(', ');

        const m15Bias = withFallback(getValue('m15_bias'), '---');
        const m15Structure = withFallback(getValue('m15_structure'), '---');
        const m15Vwap = withFallback(getValue('m15_vwap'), '---');
        const m15Note = withFallback(getValue('m15_note'), '');
        const m15Rate = withFallback(getValue('m15_rate'), '');
        const m15StructureBreaks = withFallback(getValue('m15_structure_breaks'), '');
        const m15Momentum = withFallback(getValue('m15_momentum'), '');
        const m15Volume = withFallback(getValue('m15_volume'), '');
        const m15Breakdown = withFallback(getValue('m15_breakdown'), '');
        const m15Breakout = withFallback(getValue('m15_breakout'), '');

        const optExpiry = getValue('opt_expiry');
        const optCp = getValue('opt_cp');
        const optStrike = getValue('opt_strike');
        const optPrice = getValue('opt_price');
        const optVolume = getValue('opt_volume');
        const optionParts = [optExpiry, optCp, optStrike].filter(Boolean);
        const optionLine = optionParts.length ? `Options: ${optionParts.join(' ')}${optPrice ? ` @ ${optPrice}` : ''}` : '';
        const optionVolumeLine = optVolume ? `Volume / OI: ${optVolume}` : '';

        const riskWhy = withFallback(getValue('risk_why'), '');

        const spyLine = `${spyBias.toLowerCase()} - ${spyStructure}`;
        const spyVwapLine = `${spyVwap} VWAP + holding`;

        return [
            'SPY',
            spyLine,
            spyRate ? `Rate: ${spyRate}` : '',
            `Resistance - ${spyResistance}`,
            `Support - ${spySupport}`,
            spyVwapLine,
            spyNote ? spyNote : '',
            '',
            ticker,
            '1D',
            `${d1Bias.toLowerCase()} - ${d1Structure}`,
            `Resistance - ${d1Resistance}`,
            `Support - ${d1Support}`,
            `${d1Vwap} VWAP + holding`,
            d1Sma200 ? `200 SMA: ${d1Sma200}` : '',
            d1Relative,
            d1Rate ? `Rate: ${d1Rate}` : '',
            d1Pullback ? `Pullback: ${d1Pullback}` : '',
            d1CompanyEvents ? `Company events: ${d1CompanyEvents}` : '',
            d1Note ? d1Note : '',
            '4H',
            `${h4Bias.toLowerCase()} - ${h4Structure}`,
            `${h4Vwap} VWAP + holding`,
            h4Rate ? `Rate: ${h4Rate}` : '',
            h4Pullback ? `Pullback: ${h4Pullback}` : '',
            h4TrendPattern ? `Trend pattern: ${h4TrendPattern}` : '',
            h4RiskDefine ? `Define risk: ${h4RiskDefine}` : '',
            h4KeyLevels ? `Key levels: ${h4KeyLevels}` : '',
            h4Breakdown ? `Breakdown: ${h4Breakdown}` : '',
            h4Breakout ? `Breakout: ${h4Breakout}` : '',
            h4Note ? h4Note : '',
            '1H',
            `${h1Bias.toLowerCase()} - ${h1Structure}`,
            `${h1Vwap} VWAP + holding`,
            h1Rate ? `Rate: ${h1Rate}` : '',
            h1Pullback ? `Pullback: ${h1Pullback}` : '',
            h1TrendPattern ? `Trend pattern: ${h1TrendPattern}` : '',
            h1RiskDefine ? `Define risk: ${h1RiskDefine}` : '',
            h1KeyLevels ? `Key levels: ${h1KeyLevels}` : '',
            h1Breakdown ? `Breakdown: ${h1Breakdown}` : '',
            h1Breakout ? `Breakout: ${h1Breakout}` : '',
            h1Note ? h1Note : '',
            '15m',
            `${m15Bias.toLowerCase()} - ${m15Structure}`,
            `${m15Vwap} VWAP + holding`,
            m15Rate ? `Rate: ${m15Rate}` : '',
            m15StructureBreaks ? `Structure breaks: ${m15StructureBreaks}` : '',
            m15Momentum ? `Momentum: ${m15Momentum}` : '',
            m15Volume ? `Volume: ${m15Volume}` : '',
            m15Breakdown ? `Breakdown: ${m15Breakdown}` : '',
            m15Breakout ? `Breakout: ${m15Breakout}` : '',
            m15Note ? m15Note : '',
            '',
            riskWhy,
            optionLine,
            optionVolumeLine
        ].filter(Boolean).join('\n');
    };

    const buildOutput = () => {
        const style = getRadio('output_style') || 'template';
        return style === 'compact' ? buildCompactOutput() : buildTemplateOutput();
    };

    if (generateBtn && output) {
        generateBtn.addEventListener('click', () => {
            output.value = buildOutput();
        });
    }

    if (copyBtn && output) {
        copyBtn.addEventListener('click', async () => {
            if (!output.value.trim()) {
                output.value = buildOutput();
            }
            try {
                await navigator.clipboard.writeText(output.value);
                copyBtn.textContent = 'Copied';
                setTimeout(() => {
                    copyBtn.textContent = 'Copy to Clipboard';
                }, 1200);
            } catch (err) {
                alert('Copy failed. Please copy manually.');
            }
        });
    }

    if (clearBtn && output) {
        clearBtn.addEventListener('click', () => {
            output.value = '';
        });
    }

    const readList = () => {
        const raw = localStorage.getItem(storageListKey);
        if (!raw) return [];
        try {
            const parsed = JSON.parse(raw);
            return Array.isArray(parsed) ? parsed : [];
        } catch (err) {
            return [];
        }
    };

    const writeList = (entries) => {
        localStorage.setItem(storageListKey, JSON.stringify(entries));
    };

    const sortEntries = (entries) => {
        const sortBy = sortSelect ? sortSelect.value : 'updated_desc';
        const copy = [...entries];
        const byName = (a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
        const byDate = (key, dir) => (a, b) => {
            const aVal = a[key] || '';
            const bVal = b[key] || '';
            return dir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
        };
        switch (sortBy) {
            case 'updated_asc':
                return copy.sort(byDate('updatedAt', 'asc'));
            case 'created_desc':
                return copy.sort(byDate('createdAt', 'desc'));
            case 'created_asc':
                return copy.sort(byDate('createdAt', 'asc'));
            case 'name_desc':
                return copy.sort((a, b) => byName(b, a));
            case 'name_asc':
                return copy.sort(byName);
            case 'updated_desc':
            default:
                return copy.sort(byDate('updatedAt', 'desc'));
        }
    };

    const refreshList = () => {
        if (!listSelect) return;
        const entries = sortEntries(readList());
        listSelect.innerHTML = '<option value="">Select saved analysis</option>';
        entries.forEach(entry => {
            const option = document.createElement('option');
            option.value = entry.id;
            option.textContent = entry.name;
            listSelect.appendChild(option);
        });
    };

    const findEntry = (id) => {
        const entries = readList();
        return entries.find(entry => entry.id === id);
    };

    const previewSelected = () => {
        const selected = listSelect ? listSelect.value : '';
        if (!selected) {
            if (previewOutput) previewOutput.value = '';
            return;
        }
        const entry = findEntry(selected);
        if (!entry) {
            if (previewOutput) previewOutput.value = '';
            return;
        }
        const currentState = collectFormState();
        applyFormState(entry.data);
        if (previewOutput) {
            previewOutput.value = buildOutput();
        }
        applyFormState(currentState);
    };

    if (saveBtn) {
        saveBtn.addEventListener('click', () => {
            let name = nameInput ? nameInput.value.trim() : '';
            if (!name) {
                name = buildAutoName();
                if (nameInput) nameInput.value = name;
            }
            const payload = collectFormState();
            const entries = readList();
            const existing = entries.find(entry => entry.name.toLowerCase() === name.toLowerCase());
            if (existing) {
                if (!confirm('Analysis name exists. Overwrite?')) {
                    return;
                }
                existing.data = payload;
                existing.updatedAt = new Date().toISOString();
            } else {
                entries.unshift({
                    id: `analysis_${Date.now()}`,
                    name,
                    data: payload,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                });
            }
            writeList(entries);
            localStorage.setItem(storageKey, JSON.stringify(payload));
            refreshList();
            saveBtn.textContent = 'Saved';
            setTimeout(() => {
                saveBtn.textContent = 'Save Analysis';
            }, 1200);
        });
    }

    if (loadBtn) {
        loadBtn.addEventListener('click', () => {
            const selected = listSelect ? listSelect.value : '';
            if (!selected) {
                alert('Select an analysis from the list.');
                return;
            }
            const entry = findEntry(selected);
            if (!entry) {
                alert('Saved analysis not found.');
                return;
            }
            applyFormState(entry.data);
            if (nameInput) nameInput.value = entry.name;
        });
    }

    if (previewBtn) {
        previewBtn.addEventListener('click', () => {
            if (!listSelect || !listSelect.value) {
                alert('Select an analysis from the list.');
                return;
            }
            previewSelected();
        });
    }

    if (deleteBtn) {
        deleteBtn.addEventListener('click', () => {
            const selected = listSelect ? listSelect.value : '';
            if (!selected) {
                alert('Select an analysis to delete.');
                return;
            }
            if (!confirm('Delete selected analysis?')) {
                return;
            }
            const entries = readList().filter(entry => entry.id !== selected);
            writeList(entries);
            refreshList();
            if (previewOutput) previewOutput.value = '';
        });
    }

    if (sortSelect) {
        sortSelect.addEventListener('change', refreshList);
    }

    if (listSelect) {
        listSelect.addEventListener('change', previewSelected);
    }

    refreshList();
}

function initScoreGatekeeper() {
    const form = document.getElementById('score-form');
    if (!form) return;

    const scoreEl = document.getElementById('score-market-score');
    const permissionEl = document.getElementById('score-market-permission');
    const riskStateEl = document.getElementById('score-risk-state');
    const sizeEl = document.getElementById('score-size-modifier');
    const permissionBoxEl = document.getElementById('score-market-permission-box');
    const riskStateBoxEl = document.getElementById('score-risk-state-box');
    const sizeBoxEl = document.getElementById('score-size-modifier-box');
    const breakdownEl = document.getElementById('score-breakdown');
    const edgeTypeBoxEl = document.getElementById('score-edge-type-box');
    const inconsistencyEl = document.getElementById('score-inconsistency');
    const summaryEl = document.getElementById('score-summary');
    const autoLevelsEl = document.getElementById('score-auto-levels');
    const roomAutoEl = document.getElementById('score-room-auto');
    const snapshotStatusEl = document.getElementById('score-snapshot-status');
    const manualCloseEl = form.querySelector('input[name="score_spy_manual_close"]');
    const manualAtrEl = form.querySelector('input[name="score_spy_manual_atr"]');
    const keySupportEl = form.querySelector('input[name="score_spy_key_support"]');
    const keyResistanceEl = form.querySelector('input[name="score_spy_key_resistance"]');
    let latestComputed = null;
    let latestWarnings = [];

    const sessionDateEl = document.getElementById('score-session-date');
    const saveSnapshotBtn = document.getElementById('score-save-snapshot');
    const refreshHistoryBtn = document.getElementById('score-refresh-history');
    const historyStatusEl = document.getElementById('score-history-status');
    const historyBodyEl = document.getElementById('score-history-body');
    const biasAutoEl = document.getElementById('score-bias-auto');
    const biasOverrideEl = form.querySelector('input[name="score_spy_bias_manual_override"]');
    const biasInputs = Array.from(form.querySelectorAll('input[name="score_spy_bias"]'));

    const setTodayDate = () => {
        if (!sessionDateEl || sessionDateEl.value) return;
        const d = new Date();
        const pad = (n) => String(n).padStart(2, '0');
        sessionDateEl.value = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    };

    const computeAutoBias = (values) => {
        let bull = 0;
        let bear = 0;

        if (values.regime === 'trend_up') bull += 2;
        if (values.regime === 'trend_down') bear += 2;

        if (values.structure === 'hh_hl') bull += 2;
        if (values.structure === 'll_lh') bear += 2;

        if (values.trendStrength === 'above_key_mas') bull += 2;
        if (values.trendStrength === 'below_key_mas') bear += 2;

        if (values.momentumCondition === 'expanding' || values.momentumCondition === 'stable') {
            if (values.regime === 'trend_up') bull += 1;
            if (values.regime === 'trend_down') bear += 1;
        }

        if (bull - bear >= 2) return 'bullish';
        if (bear - bull >= 2) return 'bearish';
        return 'neutral';
    };

    const updateBiasOverrideUI = () => {
        const manual = Boolean(biasOverrideEl && biasOverrideEl.checked);
        biasInputs.forEach((input) => {
            input.disabled = !manual;
        });
    };

    const getRadio = (name) => {
        const el = form.querySelector(`input[name="${name}"]:checked`);
        return el ? el.value : '';
    };

    const isChecked = (name) => {
        const el = form.querySelector(`input[name="${name}"]`);
        return Boolean(el && el.checked);
    };

    const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

    const fmt = (v) => {
        if (v === null || v === undefined || v === '') return '-';
        const n = Number(v);
        return Number.isFinite(n) ? String(n) : String(v);
    };

    const parseLevel = (raw) => {
        const text = String(raw || '').trim();
        if (!text) return null;
        const rangeMatch = text.match(/(-?\d+(?:\.\d+)?)\s*[-:]\s*(-?\d+(?:\.\d+)?)/);
        if (rangeMatch) {
            const a = Number(rangeMatch[1]);
            const b = Number(rangeMatch[2]);
            if (Number.isFinite(a) && Number.isFinite(b)) return (a + b) / 2;
        }
        const numMatch = text.match(/-?\d+(?:\.\d+)?/);
        if (!numMatch) return null;
        const n = Number(numMatch[0]);
        return Number.isFinite(n) ? n : null;
    };

    const classifyRoomFromAtr = (distanceAtr) => {
        const n = Number(distanceAtr);
        if (!Number.isFinite(n)) return null;
        if (n > 1.5) return 'large';
        if (n >= 0.8) return 'medium';
        if (n >= 0.3) return 'limited';
        return 'none';
    };

    const roomLabel = (room) => {
        if (room === 'large') return 'Large';
        if (room === 'medium') return 'Medium';
        if (room === 'limited') return 'Limited';
        if (room === 'none') return 'None';
        return '-';
    };

    const updateRoomSuggestionManual = (effectiveBias) => {
        const closeVal = parseLevel(manualCloseEl ? manualCloseEl.value : '');
        const atrVal = parseLevel(manualAtrEl ? manualAtrEl.value : '');
        const supportVal = parseLevel(keySupportEl ? keySupportEl.value : '');
        const resistanceVal = parseLevel(keyResistanceEl ? keyResistanceEl.value : '');

        if (autoLevelsEl) {
            autoLevelsEl.textContent = `Manual levels: Support ${fmt(supportVal)} | Resistance ${fmt(resistanceVal)} | Close ${fmt(closeVal)} | ATR ${fmt(atrVal)}`;
        }
        if (snapshotStatusEl) {
            snapshotStatusEl.textContent = 'Manual mode: copy Close + ATR + Key Levels from TV table.';
        }

        if (!Number.isFinite(closeVal) || !Number.isFinite(atrVal) || atrVal <= 0) {
            if (roomAutoEl) roomAutoEl.textContent = 'Enter numeric Close and ATR(14) to get suggestion';
            return null;
        }

        let dist = null;
        if (effectiveBias === 'bullish' && Number.isFinite(resistanceVal)) dist = Math.abs(resistanceVal - closeVal);
        else if (effectiveBias === 'bearish' && Number.isFinite(supportVal)) dist = Math.abs(closeVal - supportVal);
        else {
            const candidates = [];
            if (Number.isFinite(supportVal)) candidates.push(Math.abs(closeVal - supportVal));
            if (Number.isFinite(resistanceVal)) candidates.push(Math.abs(resistanceVal - closeVal));
            if (candidates.length > 0) dist = Math.min(...candidates);
        }

        if (!Number.isFinite(dist)) {
            if (roomAutoEl) roomAutoEl.textContent = 'Enter Support/Resistance levels to compute room';
            return null;
        }

        const distanceAtr = dist / atrVal;
        const room = classifyRoomFromAtr(distanceAtr);
        if (roomAutoEl) roomAutoEl.textContent = `Auto suggestion: ${roomLabel(room)} (${distanceAtr.toFixed(2)} ATR)`;
        return room;
    };

    const collectFormInputs = () => {
        const data = {};
        const fields = form.querySelectorAll('input[name], select[name], textarea[name]');
        fields.forEach((field) => {
            if (!field.name.startsWith('score_')) return;
            if (field.type === 'radio') {
                if (field.checked) data[field.name] = field.value;
                return;
            }
            if (field.type === 'checkbox') {
                data[field.name] = Boolean(field.checked);
                return;
            }
            data[field.name] = field.value;
        });
        return data;
    };

    const applyFormInputs = (data) => {
        if (!data || typeof data !== 'object') return;
        const fields = form.querySelectorAll('input[name], select[name], textarea[name]');
        fields.forEach((field) => {
            if (!field.name.startsWith('score_')) return;
            if (!(field.name in data)) return;
            const value = data[field.name];
            if (field.type === 'radio') {
                field.checked = String(value) === field.value;
                return;
            }
            if (field.type === 'checkbox') {
                field.checked = Boolean(value);
                return;
            }
            field.value = value ?? '';
        });
    };

    const hasMinimumData = (values) => (
        Boolean(values.regime) &&
        Boolean(values.structure) &&
        Boolean(values.trendStrength) &&
        Boolean(values.momentumCondition) &&
        Boolean(values.location) &&
        Boolean(values.roomToMove) &&
        Boolean(values.vixLevel) &&
        Boolean(values.vixTrend) &&
        Boolean(values.atrEnv)
    );

    const calculate = (values) => {
        const hasDirectionalBias = values.bias === 'bullish' || values.bias === 'bearish';

        let aScore = 0;
        aScore += (values.regime === 'trend_up' || values.regime === 'trend_down') ? 18 : values.regime === 'range' ? 8 : 0;
        aScore += (values.structure === 'hh_hl' || values.structure === 'll_lh') ? 8 : values.structure === 'mixed' ? 4 : values.structure === 'range' ? 2 : 0;
        if (values.trendStrength === 'above_key_mas' || values.trendStrength === 'below_key_mas') {
            if (!hasDirectionalBias) aScore += 4;
            else if (
                (values.bias === 'bullish' && values.trendStrength === 'above_key_mas') ||
                (values.bias === 'bearish' && values.trendStrength === 'below_key_mas')
            ) aScore += 6;
        }
        aScore += values.momentumCondition === 'expanding' ? 8
            : values.momentumCondition === 'stable' ? 6
            : values.momentumCondition === 'diverging' ? 2
            : 0;
        aScore = clamp(aScore, 0, 40);

        let bScore = 0;
        bScore += values.location === 'post_break_retest' ? 8
            : (values.location === 'at_support' || values.location === 'at_resistance') ? 6
            : (values.location === 'breakout_attempt' || values.location === 'breakdown_attempt') ? 5
            : 0;

        let statusScore = 0;
        if (values.bias === 'bullish') {
            if (values.supportStatus === 'holding' || values.supportStatus === 'reclaimed') statusScore += 3;
            if (values.resistanceStatus === 'broken' || values.resistanceStatus === 'reclaimed') statusScore += 4;
            if (values.supportStatus === 'broken') statusScore -= 5;
        } else if (values.bias === 'bearish') {
            if (values.resistanceStatus === 'holding' || values.resistanceStatus === 'rejecting') statusScore += 3;
            if (values.supportStatus === 'broken' || values.supportStatus === 'rejecting') statusScore += 4;
            if (values.resistanceStatus === 'broken') statusScore -= 5;
        } else {
            if (values.supportStatus || values.resistanceStatus) statusScore += 3;
        }
        bScore += statusScore;
        bScore += values.roomToMove === 'large' ? 20 : values.roomToMove === 'medium' ? 12 : values.roomToMove === 'limited' ? 5 : 0;
        bScore = clamp(bScore, 0, 35);

        let cScore = 0;
        cScore += values.vixLevel === 'lt20' ? 10 : values.vixLevel === '20_25' ? 7 : 0;
        cScore += values.vixTrend === 'falling' ? 7 : values.vixTrend === 'flat' ? 4 : 0;
        cScore += values.atrEnv === 'normal' ? 5 : values.atrEnv === 'low' ? 3 : 0;
        cScore += values.breadth === 'strong' ? 3 : values.breadth === 'neutral' ? 1 : 0;
        cScore -= Math.min(values.eventCount * 3, 9);
        cScore = clamp(cScore, 0, 25);

        const rawScore = clamp(aScore + bScore + cScore, 0, 100);

        let permission = rawScore >= 75 ? 'Allowed' : rawScore >= 45 ? 'Reduced' : 'No-trade';
        let size = rawScore >= 75 ? '1.0x' : rawScore >= 45 ? '0.5x' : '0x';
        const reasons = [];

        const retestReclaimedException = (
            values.location === 'post_break_retest' &&
            (
                (values.bias === 'bullish' && (values.supportStatus === 'reclaimed' || values.resistanceStatus === 'reclaimed')) ||
                (values.bias === 'bearish' && (values.supportStatus === 'reclaimed' || values.resistanceStatus === 'reclaimed'))
            )
        );

        if (values.regime === 'volatile') {
            permission = 'No-trade';
            size = '0x';
            reasons.push('Hard rule: Volatile-Unstable regime');
        }
        if (values.roomToMove === 'none') {
            if (retestReclaimedException) {
                permission = 'Reduced';
                size = '0.5x';
                reasons.push('Exception: post-break retest + reclaimed level (room none downgraded to Reduced)');
            } else {
                permission = 'No-trade';
                size = '0x';
                reasons.push('Hard rule: Room to Move = None');
            }
        }
        if (values.vixLevel === 'gt25' && values.vixTrend === 'rising') {
            if (permission === 'Allowed') permission = 'Reduced';
            if (size === '1.0x') size = '0.5x';
            reasons.push('Hard rule: VIX >25 and rising');
        }
        if (values.trendStrength === 'chop_around_mas' && values.location === 'middle_of_range') {
            if (permission === 'Allowed') permission = 'Reduced';
            if (size === '1.0x') size = '0.5x';
            reasons.push('Hard rule: chop around MAs in middle of range');
        }

        let riskState = 'Neutral';
        const riskOff = (values.vixLevel === 'gt25' && values.vixTrend === 'rising') || values.trendStrength === 'below_key_mas' || values.qqq200 === 'below';
        const riskOn = values.trendStrength === 'above_key_mas' && values.qqq200 === 'above' && !(values.vixLevel === 'gt25' && values.vixTrend === 'rising');
        if (riskOff) riskState = 'Risk-off';
        else if (riskOn) riskState = 'Risk-on';

        let edgeType = 'No Clear Edge';
        if ((values.regime === 'trend_up' || values.regime === 'trend_down') && values.location === 'post_break_retest') edgeType = 'Trend Continuation';
        else if ((values.location === 'breakout_attempt' || values.location === 'breakdown_attempt') && values.momentumCondition === 'expanding') edgeType = 'Breakout Expansion';
        else if (values.momentumCondition === 'exhausted' && (values.location === 'at_support' || values.location === 'at_resistance')) edgeType = 'Mean Reversion';

        return { rawScore, aScore, bScore, cScore, permission, size, reasons, riskState, edgeType };
    };

    const detectInconsistencies = (values) => {
        const warnings = [];
        if (values.regime === 'trend_up' && values.structure === 'll_lh') warnings.push('Regime Trend Up vs Structure LL/LH are inconsistent.');
        if (values.regime === 'trend_down' && values.structure === 'hh_hl') warnings.push('Regime Trend Down vs Structure HH/HL are inconsistent.');
        if (values.bias === 'bullish' && values.trendStrength === 'below_key_mas') warnings.push('Bullish bias with Below key MAs is inconsistent.');
        if (values.bias === 'bearish' && values.trendStrength === 'above_key_mas') warnings.push('Bearish bias with Above key MAs is inconsistent.');
        if (values.regime === 'range' && (values.location === 'breakout_attempt' || values.location === 'breakdown_attempt')) warnings.push('Range regime with breakout/breakdown attempt: validate with key levels.');
        if (values.roomToMove === 'none' && (values.location === 'breakout_attempt' || values.location === 'breakdown_attempt')) warnings.push('No room to move with breakout/breakdown attempt.');
        if (values.momentumCondition === 'exhausted' && (values.location === 'breakout_attempt' || values.location === 'breakdown_attempt')) warnings.push('Exhausted momentum with breakout/breakdown attempt.');
        return warnings;
    };

    const render = () => {
        const values = {
            regime: getRadio('score_spy_regime'),
            manualBias: getRadio('score_spy_bias'),
            structure: getRadio('score_spy_structure'),
            trendStrength: getRadio('score_spy_trend_strength'),
            momentumCondition: getRadio('score_spy_momentum_condition'),
            location: getRadio('score_spy_location'),
            supportStatus: getRadio('score_spy_support_status'),
            resistanceStatus: getRadio('score_spy_resistance_status'),
            roomToMove: getRadio('score_spy_room_to_move'),
            vixLevel: getRadio('score_spy_vix_level'),
            vixTrend: getRadio('score_spy_vix_trend'),
            atrEnv: getRadio('score_spy_atr_env'),
            breadth: getRadio('score_spy_breadth'),
            qqq200: getRadio('score_qqq_200_state'),
            eventCount: [
                isChecked('score_spy_event_cpi'),
                isChecked('score_spy_event_fomc'),
                isChecked('score_spy_event_nfp'),
                isChecked('score_spy_event_opex'),
                isChecked('score_spy_event_earnings_heavy')
            ].filter(Boolean).length,
            biasManualOverride: isChecked('score_spy_bias_manual_override')
        };

        const autoBias = computeAutoBias(values);
        const effectiveBias = values.biasManualOverride && values.manualBias ? values.manualBias : autoBias;
        values.bias = effectiveBias;
        values.biasMode = values.biasManualOverride ? 'manual_override' : 'auto';
        values.roomSuggestion = updateRoomSuggestionManual(effectiveBias);

        if (biasAutoEl) {
            const modeLabel = values.biasManualOverride ? 'Manual override' : 'Auto';
            biasAutoEl.textContent = `Auto bias: ${autoBias} | Effective: ${effectiveBias} (${modeLabel})`;
        }

        if (!hasMinimumData(values)) {
            scoreEl.textContent = '0 / 100';
            permissionEl.textContent = 'No data';
            if (riskStateEl) riskStateEl.textContent = 'No data';
            sizeEl.textContent = '-';
            permissionBoxEl.textContent = 'No data';
            if (riskStateBoxEl) riskStateBoxEl.textContent = 'No data';
            sizeBoxEl.textContent = '-';
            if (breakdownEl) breakdownEl.textContent = 'A: 0/40 | B: 0/35 | C: 0/25';
            if (edgeTypeBoxEl) edgeTypeBoxEl.textContent = 'No data';
            if (inconsistencyEl) inconsistencyEl.textContent = '';
            summaryEl.textContent = 'Fill regime, direction, location, and risk fields to calculate market permission.';
            return;
        }

        const warnings = detectInconsistencies(values);
        latestWarnings = warnings;
        if (inconsistencyEl) inconsistencyEl.textContent = warnings.length ? `Warnings: ${warnings.join(' | ')}` : '';

        const result = calculate(values);
        latestComputed = {
            score: result.rawScore,
            permission: result.permission,
            size_modifier: result.size,
            risk_state: result.riskState,
            section_a: result.aScore,
            section_b: result.bScore,
            section_c: result.cScore,
            auto_bias: autoBias,
            effective_bias: effectiveBias,
            bias_mode: values.biasMode,
        };
        scoreEl.textContent = `${result.rawScore} / 100`;
        permissionEl.textContent = result.permission;
        if (riskStateEl) riskStateEl.textContent = result.riskState;
        sizeEl.textContent = result.size;
        permissionBoxEl.textContent = result.permission;
        if (riskStateBoxEl) riskStateBoxEl.textContent = result.riskState;
        sizeBoxEl.textContent = result.size;
        if (breakdownEl) breakdownEl.textContent = `A: ${result.aScore}/40 | B: ${result.bScore}/35 | C: ${result.cScore}/25`;
        if (edgeTypeBoxEl) edgeTypeBoxEl.textContent = result.edgeType;
        let invalidation = 'monitor key levels';
        if (values.bias === 'bullish') invalidation = 'daily close below support/reclaim zone or loss of key MA context';
        else if (values.bias === 'bearish') invalidation = 'daily close above resistance/reclaim zone or loss of bearish MA context';
        if (values.vixLevel === 'gt25' && values.vixTrend === 'rising') invalidation = 'VIX stays >25 and rising (risk-off continuation)';
        summaryEl.textContent = `Regime: ${values.regime}, Bias: ${values.bias || 'n/a'} (${values.biasMode}), Structure: ${values.structure}, Momentum: ${values.momentumCondition}, VIX: ${values.vixLevel}/${values.vixTrend}, Events: ${values.eventCount}. ${result.reasons.join('; ') || 'No hard-rule overrides.'} Invalidation tomorrow: ${invalidation}.`;
    };

    const renderHistoryTable = (items) => {
        if (!historyBodyEl) return;
        if (!Array.isArray(items) || !items.length) {
            historyBodyEl.innerHTML = '<tr><td colspan="8">No data</td></tr>';
            return;
        }
        historyBodyEl.innerHTML = items.map((item) => {
            const abc = `${item.section_a}/${item.section_b}/${item.section_c}`;
            return `
                <tr data-id="${item.id}">
                    <td>${item.session_date || '-'}</td>
                    <td>${item.score ?? '-'}</td>
                    <td>${item.permission || '-'}</td>
                    <td>${item.size_modifier || '-'}</td>
                    <td>${item.risk_state || '-'}</td>
                    <td>${abc}</td>
                    <td><button type="button" class="btn btn-secondary btn-sm score-history-view" data-id="${item.id}">View</button></td>
                    <td><button type="button" class="btn btn-secondary btn-sm score-history-load" data-id="${item.id}">Load</button></td>
                </tr>
            `;
        }).join('');
    };

    const fetchHistory = async () => {
        try {
            const res = await fetch('/api/score/snapshots?symbol=SPY&timeframe=1D');
            const data = await res.json();
            const items = Array.isArray(data.items) ? data.items : [];
            renderHistoryTable(items);
            if (historyStatusEl) historyStatusEl.textContent = `Loaded ${items.length} snapshot(s).`;
        } catch (err) {
            if (historyStatusEl) historyStatusEl.textContent = `Failed to load history: ${String(err)}`;
        }
    };

    const saveSnapshot = async (overwrite = false) => {
        setTodayDate();
        const sessionDate = sessionDateEl ? sessionDateEl.value : '';
        if (!sessionDate) {
            if (historyStatusEl) historyStatusEl.textContent = 'Set session date before saving.';
            return;
        }
        if (!latestComputed) {
            if (historyStatusEl) historyStatusEl.textContent = 'No computed score to save.';
            return;
        }

        const payload = {
            symbol: 'SPY',
            timeframe: '1D',
            session_date: sessionDate,
            score: latestComputed.score,
            permission: latestComputed.permission,
            size_modifier: latestComputed.size_modifier,
            risk_state: latestComputed.risk_state,
            section_a: latestComputed.section_a,
            section_b: latestComputed.section_b,
            section_c: latestComputed.section_c,
            warnings: latestWarnings,
            inputs: collectFormInputs(),
            overwrite,
        };

        try {
            const res = await fetch('/api/score/snapshots', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            if (res.status === 409 && !overwrite) {
                const shouldOverwrite = confirm('Snapshot for this date already exists. Overwrite?');
                if (shouldOverwrite) {
                    await saveSnapshot(true);
                    return;
                }
                if (historyStatusEl) historyStatusEl.textContent = 'Save cancelled (duplicate date).';
                return;
            }
            const data = await res.json();
            if (!res.ok) {
                throw new Error(data?.detail || data?.error || `HTTP ${res.status}`);
            }
            if (historyStatusEl) historyStatusEl.textContent = `Snapshot saved: ${data.session_date} (${data.score}/100).`;
            await fetchHistory();
        } catch (err) {
            if (historyStatusEl) historyStatusEl.textContent = `Save failed: ${String(err)}`;
        }
    };

    const viewSnapshot = async (snapshotId) => {
        try {
            const res = await fetch(`/api/score/snapshots/${snapshotId}`);
            const data = await res.json();
            if (!res.ok) throw new Error(data?.detail || `HTTP ${res.status}`);
            const warnings = Array.isArray(data.warnings) ? data.warnings.join(' | ') : '';
            const abc = `${data.section_a}/${data.section_b}/${data.section_c}`;
            if (historyStatusEl) {
                historyStatusEl.textContent = `View ${data.session_date}: Score ${data.score}, Permission ${data.permission}, Size ${data.size_modifier}, Risk ${data.risk_state}, A/B/C ${abc}${warnings ? `, Warnings: ${warnings}` : ''}`;
            }
        } catch (err) {
            if (historyStatusEl) historyStatusEl.textContent = `View failed: ${String(err)}`;
        }
    };

    const loadSnapshot = async (snapshotId) => {
        try {
            const res = await fetch(`/api/score/snapshots/${snapshotId}`);
            const data = await res.json();
            if (!res.ok) throw new Error(data?.detail || `HTTP ${res.status}`);
            applyFormInputs(data.inputs || {});
            if (sessionDateEl) sessionDateEl.value = data.session_date || sessionDateEl.value;
            render();
            if (historyStatusEl) historyStatusEl.textContent = `Loaded snapshot ${data.session_date} into form.`;
        } catch (err) {
            if (historyStatusEl) historyStatusEl.textContent = `Load failed: ${String(err)}`;
        }
    };

    if (biasOverrideEl) biasOverrideEl.addEventListener('change', () => {
        updateBiasOverrideUI();
        render();
    });
    if (saveSnapshotBtn) saveSnapshotBtn.addEventListener('click', () => saveSnapshot(false));
    if (refreshHistoryBtn) refreshHistoryBtn.addEventListener('click', fetchHistory);
    if (historyBodyEl) {
        historyBodyEl.addEventListener('click', (event) => {
            const target = event.target;
            if (!(target instanceof HTMLElement)) return;
            const id = target.getAttribute('data-id');
            if (!id) return;
            if (target.classList.contains('score-history-view')) {
                viewSnapshot(id);
            } else if (target.classList.contains('score-history-load')) {
                loadSnapshot(id);
            }
        });
    }

    setTodayDate();
    updateBiasOverrideUI();
    form.addEventListener('change', render);
    form.addEventListener('input', render);
    render();
    fetchHistory();
}

const SPY_SCORING_FIELD_HELP = {
    sc_spy_bias: { tooltipText: 'Wybierz kierunek, ktory widzisz na wykresie; jesli nie masz przewagi, wybierz Neutral.' },
    sc_spy_regime: { tooltipText: 'Trending gdy ruch jest kierunkowy, Ranging gdy cena chodzi bokiem, Volatile gdy czesto gwaltownie zawraca.' },
    sc_spy_structure: { tooltipText: 'HH/HL gdy dolki i szczyty ida wyzej, LL/LH gdy ida nizej, Mixed gdy brak konsekwencji.' },
    sc_spy_vwap: { tooltipText: 'Above gdy cena zamkniecia jest nad VWAP, Below gdy jest pod VWAP.' },
    sc_spy_rate: { tooltipText: 'Wpisz ocene sily rynku od 0 do 100 na podstawie tego, co widzisz na wykresie.' },
    sc_spy_volume_gt_20d: { tooltipText: 'Zaznacz, gdy dzisiejszy wolumen jest wiekszy niz srednia z 20 dni.' },
    sc_spy_volume_expansion: { tooltipText: 'Zaznacz, gdy wolumen jest wyraznie wiekszy niz na kilku poprzednich sesjach.' },
    sc_spy_vix_trend: { tooltipText: 'Falling gdy VIX spada od kilku dni, Rising gdy rosnie, Flat gdy stoi blisko jednego poziomu.' },
    sc_spy_vix_level: { tooltipText: 'Wybierz zakres zgodny z aktualnym VIX: ponizej 20, 20-25 lub powyzej 25.' },
    sc_spy_breadth: { tooltipText: 'Strong gdy wiekszosc rynku idzie w tym samym kierunku, Weak gdy tylko czesc spolek bierze udzial, Neutral gdy jest po rowno.' },
    sc_spy_location: { tooltipText: 'Breaking range gdy cena wybija zakres konsolidacji, inaczej wybierz support, resistance albo srodek zakresu.' },
    sc_spy_room: { tooltipText: 'Large gdy do kolejnego poziomu jest duzo miejsca, Limited gdy poziom jest blisko, None gdy miejsca praktycznie nie ma.' },
    sc_spy_50d_state: { tooltipText: 'Pozycja ceny wzgledem 50D MA/EMA. Uzyj jako kotwicy trendu wyzszego TF.' },
    sc_spy_ma_alignment: { tooltipText: 'Uklad 20/50/200: Bull (20>50>200), Bear (20<50<200), Mixed (brak pelnego ukladu).' },
    sc_spy_bos: { tooltipText: 'Czy ostatnio byl break of structure na 1D. BOS pomaga odroznic trend od samego odczucia kierunku.' },
    sc_spy_sector_participation: { tooltipText: 'Broad = wiele sektorow uczestniczy; Narrow = ruch ciagnie waska grupa liderow.' },
    sc_spy_event_risk: { tooltipText: 'Ryzyko eventowe na najblizsze 3 sesje (np. CPI/FOMC/NFP/duze earnings). High = ostrozniejsze permission.' },
    sc_spy_distance_key_level: { tooltipText: 'Odleglosc do najblizszego kluczowego poziomu. Close = latwiej o odrzucenie; Far = wiecej przestrzeni ruchu.' },
    sc_spy_behavior_above_20_50: { tooltipText: 'Zaznacz, gdy cena utrzymuje sie nad srednimi 20 i 50.' },
    sc_spy_behavior_above_200: { tooltipText: 'Zaznacz, gdy cena zamyka sie powyzej SMA200.' },
    sc_spy_behavior_trend: { tooltipText: 'Higher lows gdy dolki rosna, Lower highs gdy szczyty spadaja, None gdy nie ma czytelnego sygnalu.' },
    sc_spy_behavior_pullback_in_progress: { tooltipText: 'Zaznacz, gdy po ruchu kierunkowym trwa korekta, ale struktura nie zostala zanegowana.' },
    sc_spy_behavior_compression: { tooltipText: 'Zaznacz, gdy ostatnie swiece maja coraz mniejszy zakres ruchu.' },
    sc_spy_behavior_expansion_up: { tooltipText: 'Zaznacz, gdy swieca ma duzy zakres i zamyka sie blisko maksimum.' },
    sc_spy_behavior_expansion_down: { tooltipText: 'Zaznacz, gdy swieca ma duzy zakres i zamyka sie blisko minimum.' },
    sc_spy_summary: { tooltipText: '1-2 zdania: co robi SPY i jak to wplywa na trade permission.', source: 'MANUAL' }
};

const STOCK_SCORING_FIELD_HELP = {
    stk1d_ticker: { tooltipText: 'Symbol akcji analizowanej na interwale dziennym (1D).' },
    stk1d_rate: { tooltipText: 'Twoja ocena jakoĹ›ci kandydata (0-99) na podstawie zewnÄ™trznej aplikacji lub wĹ‚asnej oceny.' },
    stk4h_rate: { tooltipText: 'Twoja ocena jakoĹ›ci ukĹ‚adu na 4H (0-99).' },
    stk1h_rate: { tooltipText: 'Twoja ocena jakoĹ›ci ukĹ‚adu na 1H (0-99).' },
    stk1d_bias: { tooltipText: 'Ostateczny kierunek po uwzglÄ™dnieniu struktury, 200 SMA, trend anchor i kontekstu SPY.' },
    stk1d_relative_vs_spy: { tooltipText: 'Relative = dziĹ› vs SPY (stan bieĹĽÄ…cy): Strength, Weakness albo Neutral.' },
    stk1d_rs_trend: { tooltipText: 'RS trend = czy relacja Relative vs SPY poprawia siÄ™, jest stabilna, czy pogarsza.' },
    stk1d_structure: { tooltipText: 'HH/HL = wyĹĽsze szczyty i doĹ‚ki, LL/LH = niĹĽsze szczyty i doĹ‚ki, Mixed = brak czytelnej struktury.' },
    stk1d_sma200: { tooltipText: 'Above = cena powyĹĽej SMA200 (czÄ™sto bullish kontekst), Below = poniĹĽej (czÄ™sto bearish kontekst).' },
    stk1d_trend_anchor: { tooltipText: 'PorĂłwnaj cenÄ™ do EMA20 na D1: Above = powyĹĽej, Middle = dotyka/krÄ…ĹĽy, Below = poniĹĽej.' },
    stk1d_spy_alignment: { tooltipText: 'Aligned = akcja idzie w tym samym kierunku co SPY, Diverging = wyraĹşnie inaczej, Opposite = przeciwnie do SPY.' },
    stk1d_beta_sensitivity: { tooltipText: 'High beta = mocno reaguje na ruch SPY, Defensive = mniej zaleĹĽna od rynku, Neutral = poĹ›rodku.' },
    stk1d_trend_state: { tooltipText: 'Intact = trend dziaĹ‚a, Weakening = traci impet/Ĺ‚amie zasady, Broken = struktura trendu jest naruszona.' },
    stk1d_trend_quality: { tooltipText: 'Clean: czytelne swingi i malo falszywych wybic. Acceptable: trend jest, ale z 1-2 whipsaw. Choppy: czeste zmiany kierunku, duzo knotow i brak follow-through.' },
    stk1d_phase: { tooltipText: 'Impulse = silny ruch kierunkowy, Pullback = cofniÄ™cie, Base = konsolidacja/budowanie bazy.' },
    stk1d_pullback: { tooltipText: 'Within trend = cofniÄ™cie zgodne z kierunkiem biasu, Against = cofniÄ™cie przeciwne do biasu, None = brak cofniÄ™cia.' },
    stk1d_volatility_state: { tooltipText: 'Expanding gdy dzienne Ĺ›wiece/zakres rosnÄ…, Contracting gdy zmiennoĹ›Ä‡ siÄ™ zwija i rynek usypia.' },
    stk1d_extension_state: { tooltipText: 'Extended = daleko od EMA20/50 (Ĺ‚atwo o cofkÄ™), Reset = po mocnym cofniÄ™ciu, Balanced = poĹ›rodku.' },
    stk1d_gap_risk: { tooltipText: 'Najpierw ocen AUTO proxy (srednie luki z historii), potem zrob MANUAL override gdy sa catalysty (earnings/makro/news).', source: 'SEMI' },
    stk1d_options_liquidity: { tooltipText: 'Sprawdz chain: 1) bid/ask spread % (ATM i +/- 1-2 strike), 2) OI i volume, 3) czy fill na mid jest realistyczny. Good: zwykle <=5% spread i sensowna plynnosc; Poor: szerokie spready i slabe OI/vol.' },
    stk1d_event_earnings: { tooltipText: 'Wyniki mogÄ… wywoĹ‚aÄ‡ gwaĹ‚towny ruch i zmieniÄ‡ kontekst (ryzyko dla swing options).' },
    stk1d_event_dividends: { tooltipText: 'Dywidenda moĹĽe zmieniÄ‡ cenÄ™ odniesienia i zachowanie kursu w krĂłtkim terminie.' },
    stk1d_event_other: { tooltipText: 'Inny zaplanowany katalizator (np. decyzja sÄ…dowa, FDA, makro, split).' },
    stk1d_support: { tooltipText: 'NajbliĹĽszy istotny poziom wsparcia na 1D.' },
    stk1d_resistance: { tooltipText: 'NajbliĹĽszy istotny poziom oporu na 1D.' },
    stk1d_level_position: { tooltipText: 'Gdzie jest cena wzglÄ™dem kluczowych poziomĂłw: przy wsparciu, w Ĺ›rodku zakresu, przy oporze lub wybija zakres.' },
    stk1d_summary: { tooltipText: 'W 1-2 zdaniach podaj, czy akcja jest kandydatem i dlaczego (bez planu wejscia/stop/target).' },
    stk4h_bias: { tooltipText: 'Bias 4H to finalny kierunek po ocenie struktury i polozenia wzgledem anchor/poziomow. To filtr, nie sygnal wejscia.' },
    stk4h_structure: { tooltipText: 'Struktura swingowa 4H: HH/HL trend wzrostowy, LL/LH trend spadkowy, Mixed brak czytelnej struktury.' },
    stk4h_anchor_state: { tooltipText: 'Pozycja ceny wzgledem anchor na 4H (EMA20/VWAP proxy): powyzej, wokol lub ponizej.' },
    stk4h_location: { tooltipText: 'Lokalizacja ceny wzgledem aktualnego range/swing, pomocna do oceny jakosci planu i przestrzeni ruchu.' },
    stk4h_key_level_prior_day: { tooltipText: 'Zaznacz tylko poziomy, ktore realnie graja dla planu. Zasada: max 2-3 aktywne poziomy.' },
    stk4h_key_level_weekly: { tooltipText: 'Zaznacz tylko poziomy, ktore realnie graja dla planu. Zasada: max 2-3 aktywne poziomy.' },
    stk4h_key_level_range: { tooltipText: 'Zaznacz tylko poziomy, ktore realnie graja dla planu. Zasada: max 2-3 aktywne poziomy.' },
    stk4h_key_level_major_ma: { tooltipText: 'Zaznacz tylko poziomy, ktore realnie graja dla planu. Zasada: max 2-3 aktywne poziomy.' },
    stk4h_key_level_supply_demand: { tooltipText: 'Zaznacz tylko poziomy, ktore realnie graja dla planu. Zasada: max 2-3 aktywne poziomy.' },
    stk4h_setup_type: { tooltipText: 'Typ planowanego schematu 4H (continuation, pullback, reversal, range). Okresla co chcesz grac, bez triggera.' },
    stk4h_trend_quality: { tooltipText: 'Jakosc trendu 4H: Clean, Acceptable lub Choppy. Choppy zwykle podnosi ryzyko theta i whipsaw.' },
    stk4h_volatility_profile: { tooltipText: 'Profil zmiennosci 4H: Expanding, Stable, Contracting. Wplywa na zachowanie premii opcyjnych.' },
    stk4h_invalidation_logic: { tooltipText: 'To jest invalidation planu (4H), nie stop-loss pozycji. Uzyj gdy struktura/anchor/level uniewaznia caly setup.' },
    stk4h_liquidity_check: { tooltipText: 'Ocena optionability: czy spready i plynnosc sa akceptowalne dla swing options.' },
    stk4h_notes: { tooltipText: 'Krotki opis planu 4H (1-2 linie), bez entry/stop/TP.' },
    stk1h_structure: { tooltipText: 'Struktura 1H opisuje lokalny swing i moze byc inna niz 4H.' },
    stk1h_anchor_state: { tooltipText: 'Pozycja ceny wzgledem anchor na 1H pomaga ocenic, czy momentum intraday wspiera plan 4H.' },
    stk1h_range_state: { tooltipText: 'Stan 1H wzgledem range: wybicie, handel w srodku, albo odrzucenie poziomu.' },
    stk1h_intraday_premarket: { tooltipText: 'Zaznacz tylko gdy PMH/PML dal reakcje z follow-through lub retestem. Samo dotkniecie poziomu nie wystarcza.' },
    stk1h_intraday_opening_range: { tooltipText: 'Zaznacz gdy ORH/ORL jest realna linia walki: odrzucenie, reclaim albo wielokrotny test z reakcja.' },
    stk1h_intraday_vwap_reclaim_loss: { tooltipText: 'Zaznacz gdy reclaim/loss VWAP zmienil charakter ruchu (np. shift struktury lub momentum).' },
    stk1h_intraday_pdh_pdl: { tooltipText: 'Zaznacz gdy PDH/PDL dzialal jako pivot: odrzucenie lub reclaim z potwierdzeniem.' },
    stk1h_alignment_with_4h: { tooltipText: 'Aligned: 1H wspiera 4H bias i setup. Minor pullback: chwilowo pod prad bez lamania 4H invalidation. Counter-trend: 1H idzie przeciw 4H i zwieksza ryzyko fake move.' },
    stk1h_setup_type: { tooltipText: 'Mikroschemat 1H (bez execution): breakout hold, failed breakout, pullback continuation, rejection reversal.' },
    stk1h_risk_model: { tooltipText: 'Model ryzyka 1H: structure-based, level-based albo volatility-based.' },
    stk1h_notes: { tooltipText: 'Krotki opis, co na 1H musi sie wydarzyc, aby plan 4H byl gotowy.' },
    opt_dte_bucket: { tooltipText: 'Dopasuj DTE do planu trzymania: 0-7 agresywne (wysoka theta), 8-21 krotki swing, 22-45 klasyczny swing, 46-90 spokojniejsza pozycja. Zaznacz zakres zgodny z holding time.' },
    opt_holding_plan: { tooltipText: 'To plan trzymania pozycji, nie timing wejscia. Wybierz realny horyzont ruchu z 4H/1D.' },
    opt_contract_type: { tooltipText: 'Zaznacz konstrukcje, ktora realnie planujesz: Long Call/Put (kierunek), Debit Spread (kontrola kosztu), Credit Spread (short premium), Calendar/Diagonal (czas + IV).' },
    opt_iv_level: { tooltipText: 'Low: IV historycznie nisko (czesto lepsze dla long premium). Mid: okolice mediany. High: IV wysoko, opcje drozsze niz zwykle. Unknown: nie sprawdziles IV rank/percentyla.' },
    opt_iv_trend: { tooltipText: 'Rising: IV rosnie (vega pomaga long premium). Falling: IV spada (lepiej dla short premium/spreadow). Stable: brak wyraznego trendu.' },
    opt_iv_vs_rv: { tooltipText: 'Porownaj implied vs realized volatility: IV < RV = long premium ma edge; IV ~= RV = fair; IV > RV = opcje drogie, czesciej preferuj credit/spread; Unknown = brak porownania.' },
    opt_vol_play_fit: { tooltipText: 'Wybierz glowny edge opcyjny: kierunek (delta), zmiennosc (vega) albo theta. Ma to byc spojne z volatility state na 1D/4H.' },
    opt_expected_move_fit: { tooltipText: 'Porownaj target z 1D/4H do expected move na danym DTE: Inside EM = realistycznie, Near EM = blisko granicy, Beyond EM = ruch moze nie zdazyc. Unknown = brak EM.' },
    opt_room_vs_theta: { tooltipText: 'Sprawdz, czy jest miejsce na ruch zanim theta zacznie bolec: Plenty = komfort, Some = selektywnie, Limited = blisko poziomow i ryzyko zjedzenia premii przez czas.' },
    opt_spread_quality: { tooltipText: 'Ocen bid-ask: Tight = latwiejsze wejscie/wyjscie, OK = akceptowalne, Wide = trudniejsze fille i mniejszy edge, Unknown = nie sprawdzone.' },
    opt_oi_volume: { tooltipText: 'Plynnosc kontraktu: Good = wysokie OI i wolumen, Medium = umiarkowane, Poor = niska plynnosc i trudniejsze wyjscie/rolowanie, Unknown = brak danych.' },
    opt_slippage_risk: { tooltipText: 'Ryzyko poslizgu w wejsciu/wyjsciu. High czesto przy wide spread + szybki move.' },
    opt_moneyness: { tooltipText: 'Wybor moneyness. ITM = wieksza delta, mniej theta; OTM = tansze, ale wieksze ryzyko, ze ruch nie dojedzie.' },
    opt_delta_bucket: { tooltipText: 'Delta jako proxy ryzyka. Nizsza delta = wieksza zaleznosc od szybkiego ruchu; wyzsza delta = bardziej stock-like.' },
    opt_structure_fit: { tooltipText: 'Czy konstrukcja pasuje do Twojego 1D/4H (trend/volatility/liquidity). To szybka kontrola spojnosci.' },
    opt_catalyst_type: { tooltipText: 'Bliskosc katalizatora: Earnings soon (<14 dni), duzy event (np. FOMC/FDA), brak duzego katalizatora lub Unknown. Im blizej wydarzenia, tym wieksze ryzyko zmian IV.' },
    opt_iv_crush_risk: { tooltipText: 'Ryzyko spadku IV po wydarzeniu: High (czesto przed earnings), Medium (umiarkowane), Low (brak duzych eventow). High crush moze zdominowac long premium.' },
    opt_gap_risk_ack: { tooltipText: 'Czy akceptujesz gap risk na opcjach. Jesli nie, wybieraj defined-risk (spread) albo omijaj.' },
    opt_tradeable: { tooltipText: 'Finalna decyzja: czy opcje maja sens vs akcje. Czasem wykres jest swietny, ale opcje sa za drogie/za malo miejsca/za slaba plynnosc.' },
    opt_strategy_note: { tooltipText: 'Krotko: jaka konstrukcja i dlaczego (IV, DTE, EM, room, liquidity). Bez detali entry.' },
    setup_status: { tooltipText: 'Decyzja operacyjna: Valid = plan gotowy; Needs trigger = czekasz na warunek 15m; Observation-only = brak edge/konflikt; Invalidation hit = plan uniewazniony.', source: 'MANUAL' },
    entry_plan: { tooltipText: 'Jedno zdanie: typ triggera + poziom + warunek potwierdzenia (close/retest/follow-through).', source: 'MANUAL' },
    must_happen: { tooltipText: 'Warunek konieczny przed wejsciem. Jesli nie wystapi - nie wchodzisz.', source: 'MANUAL' },
    stop_loss: { tooltipText: 'Techniczny poziom uniewaznienia pozycji. To nie to samo co invalidation logiki planu 4H.', source: 'MANUAL' },
    tp1: { tooltipText: 'Pierwszy logiczny target (np. najblizszy poziom HTF).', source: 'MANUAL' },
    tp2: { tooltipText: 'Drugi target/runner; dla opcji dopisz czy planujesz partial/roll.', source: 'MANUAL' }
};

function initScoringFieldHelp(form, stockSection = form) {
    const getFieldMeta = (fieldId) => SPY_SCORING_FIELD_HELP[fieldId] || STOCK_SCORING_FIELD_HELP[fieldId];

    const appendMeta = (targetEl, fieldId, meta) => {
        if (!targetEl || !meta) return;
        if (targetEl.querySelector(`.help-icon[data-field-id="${fieldId}"]`)) return;
        const help = document.createElement('span');
        help.className = 'help-icon';
        help.dataset.fieldId = fieldId;
        help.dataset.tooltip = meta.tooltipText || '';
        help.textContent = '?';
        targetEl.appendChild(help);
    };

    const appendToGroupLabel = (inputName, scope = form) => {
        const field = scope.querySelector(`input[name="${inputName}"], select[name="${inputName}"], textarea[name="${inputName}"]`);
        if (!field) return;
        const label = field.closest('.form-group')?.querySelector(':scope > label');
        appendMeta(label, inputName, getFieldMeta(inputName));
    };

    const appendToOptionText = (inputName, scope = form) => {
        const input = scope.querySelector(`input[name="${inputName}"]`);
        if (!input) return;
        const text = input.closest('label.checkbox-label')?.querySelector('.checkbox-text');
        appendMeta(text, inputName, getFieldMeta(inputName));
    };

    const enrichExistingHelpIcons = (scope = form) => {
        const icons = scope.querySelectorAll('.help-icon:not([data-field-id])');
        icons.forEach((icon) => {
            const group = icon.closest('.form-group');
            if (!group) return;
            const field = group.querySelector('input[name], select[name], textarea[name]');
            if (!field) return;
            const fieldId = field.name;
            const meta = getFieldMeta(fieldId);
            if (!meta) return;
            icon.dataset.fieldId = fieldId;
            if (!icon.dataset.tooltip) icon.dataset.tooltip = meta.tooltipText || '';
        });
    };

    [
        'sc_spy_bias',
        'sc_spy_regime',
        'sc_spy_structure',
        'sc_spy_vwap',
        'sc_spy_50d_state',
        'sc_spy_ma_alignment',
        'sc_spy_bos',
        'sc_spy_rate',
        'sc_spy_vix_trend',
        'sc_spy_vix_level',
        'sc_spy_breadth',
        'sc_spy_sector_participation',
        'sc_spy_event_risk',
        'sc_spy_location',
        'sc_spy_room',
        'sc_spy_distance_key_level',
        'sc_spy_behavior_trend',
        'sc_spy_summary',
        'setup_status',
        'entry_plan',
        'must_happen',
        'stop_loss',
        'tp1',
        'tp2'
    ].forEach((name) => appendToGroupLabel(name, form));

    [
        'stk1d_ticker',
        'stk1d_rate',
        'stk1d_bias',
        'stk1d_structure',
        'stk1d_sma200',
        'stk1d_trend_anchor',
        'stk1d_spy_alignment',
        'stk1d_relative_vs_spy',
        'stk1d_rs_trend',
        'stk1d_beta_sensitivity',
        'stk1d_trend_state',
        'stk1d_trend_quality',
        'stk1d_phase',
        'stk1d_pullback',
        'stk1d_volatility_state',
        'stk1d_extension_state',
        'stk1d_gap_risk',
        'stk1d_options_liquidity',
        'stk1d_support',
        'stk1d_resistance',
        'stk1d_level_position',
        'stk1d_summary',
        'stk4h_bias',
        'stk4h_rate',
        'stk4h_structure',
        'stk4h_anchor_state',
        'stk4h_location',
        'stk4h_key_level_prior_day',
        'stk4h_setup_type',
        'stk4h_trend_quality',
        'stk4h_volatility_profile',
        'stk4h_invalidation_logic',
        'stk4h_liquidity_check',
        'stk4h_notes',
        'stk1h_structure',
        'stk1h_rate',
        'stk1h_anchor_state',
        'stk1h_range_state',
        'stk1h_intraday_premarket',
        'stk1h_alignment_with_4h',
        'stk1h_setup_type',
        'stk1h_risk_model',
        'stk1h_notes'
    ].forEach((name) => appendToGroupLabel(name, stockSection));

    [
        'opt_dte_bucket',
        'opt_holding_plan',
        'opt_contract_type',
        'opt_iv_level',
        'opt_iv_trend',
        'opt_iv_vs_rv',
        'opt_vol_play_fit',
        'opt_expected_move_fit',
        'opt_room_vs_theta',
        'opt_spread_quality',
        'opt_oi_volume',
        'opt_slippage_risk',
        'opt_moneyness',
        'opt_delta_bucket',
        'opt_structure_fit',
        'opt_catalyst_type',
        'opt_iv_crush_risk',
        'opt_gap_risk_ack',
        'opt_tradeable',
        'opt_strategy_note'
    ].forEach((name) => appendToGroupLabel(name, form));

    [
        'sc_spy_volume_gt_20d',
        'sc_spy_volume_expansion',
        'sc_spy_behavior_above_20_50',
        'sc_spy_behavior_above_200',
        'sc_spy_behavior_pullback_in_progress',
        'sc_spy_behavior_compression',
        'sc_spy_behavior_expansion_up',
        'sc_spy_behavior_expansion_down'
    ].forEach((name) => appendToOptionText(name, form));

    [
        'stk1d_event_earnings',
        'stk1d_event_dividends',
        'stk1d_event_other',
        'stk4h_key_level_prior_day',
        'stk4h_key_level_weekly',
        'stk4h_key_level_range',
        'stk4h_key_level_major_ma',
        'stk4h_key_level_supply_demand',
        'stk1h_intraday_premarket',
        'stk1h_intraday_opening_range',
        'stk1h_intraday_vwap_reclaim_loss',
        'stk1h_intraday_pdh_pdl'
    ].forEach((name) => appendToOptionText(name, stockSection));

    enrichExistingHelpIcons(form);
}

function calculateSpyScore(values) {
    const bias = values.bias;
    const structure = values.structure;
    const vwap = values.vwap;
    const trend50 = values.trend50;
    const maAlignment = values.maAlignment;
    const bos = values.bos;
    const regime = values.regime;
    const breadth = values.breadth;
    const sectorParticipation = values.sectorParticipation;
    const eventRisk = values.eventRisk;
    const vixTrend = values.vixTrend;
    const vixLevel = values.vixLevel;
    const room = values.room;
    const location = values.location;
    const distanceKeyLevel = values.distanceKeyLevel;
    const behaviorTrend = values.behaviorTrend;

    let directionScore = 0;
    if (bias === 'bullish' || bias === 'bearish') directionScore += 1;
    if (structure === 'hh_hl' || structure === 'll_lh') directionScore += 1;
    if ((bias === 'bullish' && vwap === 'above') || (bias === 'bearish' && vwap === 'below')) directionScore += 1;
    if ((bias === 'bullish' && trend50 === 'above') || (bias === 'bearish' && trend50 === 'below')) directionScore += 1;
    if ((bias === 'bullish' && maAlignment === 'bull_stack') || (bias === 'bearish' && maAlignment === 'bear_stack')) directionScore += 1;
    directionScore = Math.max(0, Math.min(directionScore, 5));

    let rateScore = 0;
    if (values.rate >= 80) rateScore = 3;
    else if (values.rate >= 65) rateScore = 2;
    else if (values.rate >= 50) rateScore = 1;

    let strengthScore = 0;
    strengthScore += rateScore;
    if (values.volumeGt20d) strengthScore += 2;
    if (values.volumeExpansion) strengthScore += 1;
    if (breadth === 'strong') strengthScore += 2;
    else if (breadth === 'neutral') strengthScore += 1;
    if (sectorParticipation === 'broad') strengthScore += 1;
    strengthScore = Math.max(0, Math.min(strengthScore, 8));

    let volatilityRegimeScore = 0;
    if (vixLevel === 'lt20') volatilityRegimeScore += 3;
    else if (vixLevel === '20_25') volatilityRegimeScore += 2;
    if (vixTrend === 'falling') volatilityRegimeScore += 2;
    else if (vixTrend === 'flat') volatilityRegimeScore += 1;
    if (regime === 'trending') volatilityRegimeScore += 2;
    else if (regime === 'ranging') volatilityRegimeScore += 1;
    volatilityRegimeScore = Math.max(0, Math.min(volatilityRegimeScore, 6));

    let locationScore = 0;
    if (location === 'breaking_range') locationScore += 2;
    if ((bias === 'bullish' && location === 'at_support') || (bias === 'bearish' && location === 'at_resistance')) {
        locationScore += 1;
    }
    if (room === 'large') locationScore += 2;
    else if (room === 'limited') locationScore += 1;
    if (distanceKeyLevel === 'far') locationScore += 1;
    else if (distanceKeyLevel === 'medium') locationScore += 1;
    locationScore = Math.max(0, Math.min(locationScore, 6));

    let penDir = 0;
    let penVol = 0;
    let penLoc = 0;
    let penBrk = 0;
    let penBeh = 0;
    let penFallback = 0;

    // Direction consistency penalties
    if (bias === 'bullish' && structure === 'll_lh') penDir -= 2;
    if (bias === 'bearish' && structure === 'hh_hl') penDir -= 2;
    if (bias === 'bullish' && vwap === 'below') penDir -= 1;
    if (bias === 'bearish' && vwap === 'above') penDir -= 1;

    // Volatility + breadth penalties
    const isRisingWeakSpecialCase = vixTrend === 'rising' && breadth === 'weak';
    if (isRisingWeakSpecialCase) {
        penVol -= 2;
    } else {
        if (vixTrend === 'rising') penVol -= 1;
        if (breadth === 'weak' && bias === 'bullish') penVol -= 1;
    }
    if (breadth === 'strong' && bias === 'bearish') penVol -= 1;
    if (regime === 'volatile') penVol -= 2;
    if (eventRisk === 'medium') penVol -= 1;
    if (eventRisk === 'high') penVol -= 2;
    if (sectorParticipation === 'narrow') penVol -= 1;

    // Location consistency penalties
    if (bias === 'bullish' && location === 'at_resistance') penLoc -= 1;
    if (bias === 'bearish' && location === 'at_support') penLoc -= 1;
    if (distanceKeyLevel === 'close') penLoc -= 1;

    // Volume quality penalties
    const noVolumeConfirmation = !values.volumeGt20d;
    if (noVolumeConfirmation && location === 'breaking_range') penBrk -= 2;
    if (
        location === 'breaking_range' &&
        !values.behaviorExpansionUp &&
        !values.behaviorExpansionDown &&
        !values.behaviorCompression
    ) {
        penBrk -= 1;
    }

    // Directional behavior penalties
    if (bias === 'bullish') {
        if (behaviorTrend === 'lower_highs') penBeh -= 1;
        if (values.behaviorExpansionDown) penBeh -= 1;
    } else if (bias === 'bearish') {
        if (behaviorTrend === 'higher_lows') penBeh -= 1;
        if (values.behaviorExpansionUp) penBeh -= 1;
    }
    if (values.behaviorExpansionUp && values.behaviorExpansionDown) penFallback -= 1;
    if (bos === 'yes') penFallback -= 1;

    const penalties = penDir + penVol + penLoc + penBrk + penBeh + penFallback;

    // Directional behavior bonuses
    let behaviorBonus = 0;
    if (bias === 'bullish') {
        if (behaviorTrend === 'higher_lows') behaviorBonus += 1;
        if (values.behaviorExpansionUp) behaviorBonus += 1;
    } else if (bias === 'bearish') {
        if (behaviorTrend === 'lower_highs') behaviorBonus += 1;
        if (values.behaviorExpansionDown) behaviorBonus += 1;
    }
    if (structure === 'mixed') behaviorBonus = Math.min(behaviorBonus, 1);

    const rawTotal = directionScore + strengthScore + volatilityRegimeScore + locationScore + behaviorBonus + penalties;
    const boundedRawTotal = Math.max(0, Math.min(rawTotal, 25));

    // Dynamic caps (apply the strictest one)
    let cap = 25;
    const capReasons = [];
    if (bias === 'neutral') {
        cap = Math.min(cap, 14);
        capReasons.push('Neutral bias (cap 14)');
    }
    if (room === 'limited') cap = Math.min(cap, 14);
    if (room === 'limited') capReasons.push('Room to move: Limited (cap 14)');
    if (room === 'none') {
        cap = Math.min(cap, 10);
        capReasons.push('Room to move: None (cap 10)');
    }
    if (vixLevel === 'gt25') {
        cap = Math.min(cap, 14);
        capReasons.push('VIX level >25 (cap 14)');
    }
    if (vixTrend === 'rising' && regime === 'volatile' && (vixLevel === '20_25' || vixLevel === 'gt25')) {
        cap = Math.min(cap, 10);
        capReasons.push('VIX Rising + Volatile Regime with VIX >=20 (cap 10)');
    }

    const total = Math.min(boundedRawTotal, cap);
    const capApplied = total < boundedRawTotal;

    const hasMinimumData = Boolean(bias && structure && regime && location);
    let interpretation = 'No data';
    if (hasMinimumData) {
        interpretation = 'Observation only';
        if (total >= 20) interpretation = 'A+ Market (Full aggression)';
        else if (total >= 15) interpretation = 'Normal swing environment';
        else if (total >= 10) interpretation = 'Selective / reduced size';
    }

    return {
        total,
        rawTotal: boundedRawTotal,
        behaviorBonus,
        penalties,
        penBuckets: { penDir, penVol, penLoc, penBrk, penBeh, penFallback },
        cap,
        capApplied,
        capReasons,
        directionScore,
        strengthScore,
        volatilityRegimeScore,
        locationScore,
        interpretation
    };
}

function calculateStock1DScore(values) {
    const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
    const hasDirectionalBias = values.bias === 'bullish' || values.bias === 'bearish';

    let directionScore = 0;
    directionScore += hasDirectionalBias ? 2 : 0;
    directionScore += (values.structure === 'hh_hl' || values.structure === 'll_lh') ? 2 : 0;
    if (hasDirectionalBias) {
        if ((values.bias === 'bullish' && values.sma200 === 'above') || (values.bias === 'bearish' && values.sma200 === 'below')) {
            directionScore += 2;
        } else if (values.sma200 === 'above' || values.sma200 === 'below') {
            directionScore += 1;
        }
        if ((values.bias === 'bullish' && values.trendAnchor === 'above') || (values.bias === 'bearish' && values.trendAnchor === 'below')) {
            directionScore += 2;
        } else if (values.trendAnchor === 'middle') {
            directionScore += 1;
        }
    }
    directionScore = clamp(directionScore, 0, 8);

    let contextScore = 0;
    contextScore += values.rate >= 80 ? 2 : values.rate >= 60 ? 1 : 0;
    contextScore += values.spyAlignment === 'aligned' ? 2 : values.spyAlignment === 'diverging' ? 1 : 0;
    contextScore += values.relativeVsSpy === 'strength' ? 2 : values.relativeVsSpy === 'neutral' ? 1 : 0;
    contextScore += values.rsTrend === 'improving' ? 2 : values.rsTrend === 'stable' ? 1 : 0;
    contextScore += values.trendState === 'intact' ? 1 : 0;
    contextScore = clamp(contextScore, 0, 8);

    let riskLevelsScore = 0;
    riskLevelsScore += values.gapRisk === 'low' ? 2 : values.gapRisk === 'medium' ? 1 : 0;
    riskLevelsScore += values.optionsLiquidity === 'good' ? 2 : values.optionsLiquidity === 'medium' ? 1 : 0;
    riskLevelsScore += (values.betaSensitivity === 'neutral_beta' || values.betaSensitivity === 'defensive') ? 1 : 0;
    if (hasDirectionalBias) {
        if (
            (values.bias === 'bullish' && values.levelPosition === 'near_support') ||
            (values.bias === 'bearish' && values.levelPosition === 'near_resistance')
        ) {
            riskLevelsScore += 1;
        }
    }
    riskLevelsScore = clamp(riskLevelsScore, 0, 4);

    let penalties = 0;
    if (values.bias === 'bullish' && values.relativeVsSpy === 'weakness') penalties -= 2;
    if (values.bias === 'bearish' && values.relativeVsSpy === 'strength') penalties -= 2;
    if (values.bias === 'neutral') penalties -= 1;
    if (values.trendState === 'broken') penalties -= 2;
    if (values.trendState === 'broken' && values.structure === 'mixed') penalties -= 1;
    if (values.pullback === 'against') penalties -= 1;
    if (values.betaSensitivity === 'high_beta' && values.spyAlignment === 'opposite') penalties -= 1;
    if (values.earningsSoon) penalties -= 2;
    if (values.dividendSoon) penalties -= 1;
    if (values.otherCatalyst) penalties -= 1;

    const rawTotalUnbounded = directionScore + contextScore + riskLevelsScore + penalties;
    const boundedRawTotal = clamp(rawTotalUnbounded, 0, 20);

    let cap = 20;
    const capReasons = [];
    if (values.gapRisk === 'high') {
        cap = Math.min(cap, 12);
        capReasons.push('Gap risk: High (cap 12)');
    }
    if (values.earningsSoon) {
        cap = Math.min(cap, 12);
        capReasons.push('Earnings soon (cap 12)');
    }
    if (values.optionsLiquidity === 'poor') {
        cap = Math.min(cap, 12);
        capReasons.push('Options liquidity: Poor (cap 12)');
    }
    if (values.spyAlignment === 'opposite' && values.relativeVsSpy === 'weakness') {
        cap = Math.min(cap, 10);
        capReasons.push('Opposite + Weakness vs SPY (cap 10)');
    }

    const total = Math.min(boundedRawTotal, cap);
    const capApplied = total < boundedRawTotal;

    // Keep "No data" until core directional context is provided.
    const hasMinimumDirectionContext = Boolean(values.bias && values.structure);

    let grade = 'No data';
    if (hasMinimumDirectionContext) {
        grade = 'Pass / observation';
        if (total >= 16) grade = 'A Candidate (worth planning)';
        else if (total >= 12) grade = 'B Candidate (selective)';
        else if (total >= 8) grade = 'C / Watchlist';
    }

    return {
        total,
        rawTotal: boundedRawTotal,
        directionScore,
        contextScore,
        riskLevelsScore,
        penalties,
        cap,
        capApplied,
        capReasons,
        grade,
        hasMinimumData: hasMinimumDirectionContext
    };
}

function calculateStock4HScore(values) {
    const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
    const hasDirectionalBias = values.bias === 'bullish' || values.bias === 'bearish';
    const clearStructure = values.structure === 'hh_hl' || values.structure === 'll_lh';
    const hasMinimumData = Boolean(values.bias && values.structure && values.setupType);

    let setupScore = 0;
    setupScore += hasDirectionalBias ? 2 : 0;
    setupScore += clearStructure ? 2 : 0;
    if (hasDirectionalBias) {
        if ((values.bias === 'bullish' && values.anchorState === 'above_anchor') || (values.bias === 'bearish' && values.anchorState === 'below_anchor')) {
            setupScore += 2;
        } else if (values.anchorState === 'around_anchor') {
            setupScore += 1;
        }
        if (values.bias === 'bullish') {
            if (values.setupType === 'breakout_continuation' || values.setupType === 'pullback_within_trend') setupScore += 2;
            else if (values.setupType === 'range_play' || values.setupType === 'reversal_attempt') setupScore += 1;
        } else if (values.bias === 'bearish') {
            if (values.setupType === 'breakdown_continuation' || values.setupType === 'pullback_within_trend') setupScore += 2;
            else if (values.setupType === 'range_play' || values.setupType === 'reversal_attempt') setupScore += 1;
        }
    }
    setupScore = clamp(setupScore, 0, 8);

    let locationLevelsScore = 0;
    if (values.bias === 'bullish') {
        if (values.location === 'near_support' || values.location === 'range_low') locationLevelsScore += 2;
        else if (values.location === 'mid_range') locationLevelsScore += 1;
    } else if (values.bias === 'bearish') {
        if (values.location === 'near_resistance' || values.location === 'range_high') locationLevelsScore += 2;
        else if (values.location === 'mid_range') locationLevelsScore += 1;
    } else if (values.bias === 'neutral') {
        if (values.location === 'mid_range') locationLevelsScore += 1;
    }
    if (values.hardLevelsCount >= 2) locationLevelsScore += 2;
    else if (values.selectedLevelsCount >= 2) locationLevelsScore += 1;
    if (values.invalidationLogic) locationLevelsScore += 2;
    locationLevelsScore = clamp(locationLevelsScore, 0, 6);

    let qualityRiskScore = 0;
    qualityRiskScore += values.trendQuality === 'clean' ? 2 : values.trendQuality === 'acceptable' ? 1 : 0;
    qualityRiskScore += values.liquidityCheck === 'good' ? 2 : values.liquidityCheck === 'medium' ? 1 : 0;
    qualityRiskScore += values.volatilityProfile === 'stable' ? 2 : values.volatilityProfile === 'contracting' ? 1 : 0;
    qualityRiskScore = clamp(qualityRiskScore, 0, 6);

    let penalties = 0;
    if (values.bias === 'neutral') penalties -= 2;
    if (values.structure === 'mixed') penalties -= 2;
    if (values.trendQuality === 'choppy') penalties -= 2;
    if (values.liquidityCheck === 'poor') penalties -= 3;
    if (values.setupType === 'breakout_continuation' && (values.location === 'near_resistance' || values.location === 'range_high')) penalties -= 2;
    if (values.setupType === 'breakdown_continuation' && (values.location === 'near_support' || values.location === 'range_low')) penalties -= 2;
    if (values.bias === 'bullish' && values.anchorState === 'below_anchor') penalties -= 2;
    if (values.bias === 'bearish' && values.anchorState === 'above_anchor') penalties -= 2;

    const rawTotalUnbounded = setupScore + locationLevelsScore + qualityRiskScore + penalties;
    const boundedRawTotal = clamp(rawTotalUnbounded, 0, 20);

    let cap = 20;
    const capReasons = [];
    if (values.liquidityCheck === 'poor') {
        cap = Math.min(cap, 10);
        capReasons.push('Cap 10: Poor liquidity (4H)');
    }
    if (values.trendQuality === 'choppy') {
        cap = Math.min(cap, 12);
        capReasons.push('Cap 12: Choppy trend (4H)');
    }
    if (values.structure === 'mixed') {
        cap = Math.min(cap, 12);
        capReasons.push('Cap 12: Mixed structure (4H)');
    }
    if (values.bias === 'neutral') {
        cap = Math.min(cap, 12);
        capReasons.push('Cap 12: Neutral bias (4H)');
    }
    if (
        values.volatilityProfile === 'expanding' &&
        (values.setupType === 'reversal_attempt' || values.setupType === 'range_play')
    ) {
        cap = Math.min(cap, 12);
        capReasons.push('Cap 12: Expanding volatility + reversal/range plan (4H)');
    }

    const total = Math.min(boundedRawTotal, cap);
    const capApplied = total < boundedRawTotal;

    let grade = 'No data';
    if (hasMinimumData) {
        grade = 'Pass';
        if (total >= 16) grade = 'A (plan-ready)';
        else if (total >= 12) grade = 'B (selective)';
        else if (total >= 8) grade = 'C (watch)';
    }

    return {
        total,
        rawTotal: boundedRawTotal,
        setupScore,
        locationLevelsScore,
        qualityRiskScore,
        penalties,
        cap,
        capApplied,
        capReasons,
        grade,
        hasMinimumData
    };
}

function calculateStock1HScore(values) {
    const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
    const clearStructure = values.structure === 'hh_hl' || values.structure === 'll_lh';
    const hasMinimumData = Boolean(values.structure && values.rangeState && values.alignment4h && values.setupType);

    let microStructureScore = 0;
    microStructureScore += clearStructure ? 2 : 0;
    if (values.structure === 'hh_hl' && values.anchorState === 'above') microStructureScore += 2;
    else if (values.structure === 'll_lh' && values.anchorState === 'below') microStructureScore += 2;
    else if (values.anchorState === 'around') microStructureScore += 1;
    if (values.rangeState === 'breaking_range' || values.rangeState === 'rejecting_level') microStructureScore += 2;
    else if (values.rangeState === 'inside_range') microStructureScore += 1;
    if (
        values.structure &&
        values.anchorState &&
        values.rangeState &&
        values.structure !== 'mixed' &&
        values.anchorState !== 'around' &&
        values.rangeState !== 'inside_range'
    ) microStructureScore += 1;
    microStructureScore = clamp(microStructureScore, 0, 7);

    let intradayContextScore = 0;
    if (values.intradayReactionCount >= 2) intradayContextScore += 3;
    else if (values.intradayReactionCount === 1) intradayContextScore += 2;
    if (values.hasVWAPReaction) intradayContextScore += 2;
    if (values.hasPDHOrORReaction) intradayContextScore += 2;
    intradayContextScore = clamp(intradayContextScore, 0, 7);

    let alignmentRiskScore = 0;
    alignmentRiskScore += values.alignment4h === 'aligned' ? 3 : values.alignment4h === 'minor_pullback' ? 2 : 0;
    if (values.rangeState === 'breaking_range' && values.setupType === 'breakout_hold') alignmentRiskScore += 2;
    else if (values.rangeState === 'breaking_range' && values.setupType === 'failed_breakout') alignmentRiskScore += 1;
    else if (values.rangeState === 'rejecting_level' && values.setupType === 'rejection_reversal') alignmentRiskScore += 2;
    else if (values.rangeState === 'inside_range' && values.setupType === 'pullback_continuation') alignmentRiskScore += 1;
    if (values.riskModel) alignmentRiskScore += 1;
    alignmentRiskScore = clamp(alignmentRiskScore, 0, 6);

    let penalties = 0;
    if (values.alignment4h === 'counter_trend') penalties -= 3;
    if (values.structure === 'mixed') penalties -= 2;
    if (values.rangeState === 'inside_range' && values.setupType === 'breakout_hold') penalties -= 2;
    if (values.setupType === 'failed_breakout' && values.intradayReactionCount === 0) penalties -= 2;
    if (values.anchorState === 'around' && values.structure === 'mixed') penalties -= 2;

    const rawTotalUnbounded = microStructureScore + intradayContextScore + alignmentRiskScore + penalties;
    const boundedRawTotal = clamp(rawTotalUnbounded, 0, 20);

    let cap = 20;
    const capReasons = [];
    if (values.alignment4h === 'counter_trend') {
        cap = Math.min(cap, 10);
        capReasons.push('Cap 10: 1H counter-trend vs 4H');
    }
    if (values.structure === 'mixed') {
        cap = Math.min(cap, 12);
        capReasons.push('Cap 12: Mixed structure (1H)');
    }
    if (values.rangeState === 'inside_range' && values.intradayReactionCount === 0) {
        cap = Math.min(cap, 12);
        capReasons.push('Cap 12: Inside range + no intraday reaction (1H)');
    }

    const total = Math.min(boundedRawTotal, cap);
    const capApplied = total < boundedRawTotal;

    let grade = 'No data';
    if (hasMinimumData) {
        grade = 'Pass';
        if (total >= 16) grade = 'A (execution-ready context)';
        else if (total >= 12) grade = 'B (selective)';
        else if (total >= 8) grade = 'C (watch)';
    }

    return {
        total,
        rawTotal: boundedRawTotal,
        microStructureScore,
        intradayContextScore,
        alignmentRiskScore,
        penalties,
        cap,
        capApplied,
        capReasons,
        grade,
        hasMinimumData
    };
}

function calculateStock15MScore(values) {
    const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
    // 15m should start counting earlier (context + trigger plan), not only after full execution details are filled.
    const hasMinimumData = Boolean(values.structure && values.triggerType);
    const hasTriggerLevel = Boolean((values.triggerLevel || '').trim());
    const hasInvalidationLevel = Boolean((values.invalidationLevel || '').trim());

    let microContextScore = 0;
    const hasDirectionalBias = values.bias === 'Bullish' || values.bias === 'Bearish';
    const clearStructure = values.structure === 'HH/HL' || values.structure === 'LL/LH';
    microContextScore += hasDirectionalBias ? 1 : 0;
    microContextScore += clearStructure ? 2 : 0;
    if (clearStructure) {
        if ((values.structure === 'HH/HL' && values.vwap === 'Above') || (values.structure === 'LL/LH' && values.vwap === 'Below')) {
            microContextScore += 2;
        } else if (values.vwap === 'Middle') {
            microContextScore += 1;
        }
    } else if (values.vwap === 'Middle') {
        microContextScore += 1;
    }
    microContextScore += values.spyAlignment === 'Aligned' ? 1 : 0;
    microContextScore = clamp(microContextScore, 0, 6);

    let triggerConfirmScore = 0;
    triggerConfirmScore += values.structureBreaks === 'Yes' ? 1 : 0;
    if (values.triggerType === 'Fade') triggerConfirmScore += 1;
    else if (['Breakout', 'Breakdown', 'Reclaim', 'Rejection'].includes(values.triggerType)) triggerConfirmScore += 2;
    triggerConfirmScore += values.triggerConfirmed === 'Yes' ? 2 : 0;
    triggerConfirmScore += hasTriggerLevel ? 1 : 0;
    triggerConfirmScore = clamp(triggerConfirmScore, 0, 6);

    let entryTimingScore = 0;
    entryTimingScore += values.rate >= 80 ? 2 : values.rate >= 60 ? 1 : 0;
    entryTimingScore += values.momentumState === 'Expanding with move' ? 2 : 0;
    entryTimingScore += values.entryQuality === 'A+' ? 2 : values.entryQuality === 'OK' ? 1 : 0;
    entryTimingScore += values.retestQuality === 'Clean retest' ? 1 : 0;
    entryTimingScore += (values.sessionTiming === 'Open (first 30m)' || values.sessionTiming === 'Power hour') ? 1 : 0;
    entryTimingScore = clamp(entryTimingScore, 0, 5);

    let volLevelsOptionsScore = 0;
    volLevelsOptionsScore += values.impulseVolumeConfirms ? 1 : 0;
    volLevelsOptionsScore += values.pullbackVolumeDriesUp ? 1 : 0;
    volLevelsOptionsScore += values.microSrCount >= 1 ? 1 : 0;
    volLevelsOptionsScore += values.spreadFills === 'OK' ? 1 : 0;
    volLevelsOptionsScore += (values.ivBehavior === 'IV rising' || values.ivBehavior === 'IV stable') ? 1 : 0;
    volLevelsOptionsScore = clamp(volLevelsOptionsScore, 0, 3);

    let penalties = 0;
    if (values.structure === 'Mixed') penalties -= 2;
    if (values.spyAlignment === 'Opposite') penalties -= 2;
    if (values.momentumState === 'Diverging') penalties -= 2;
    if (values.momentumState === 'Overextended') penalties -= 1;
    if (values.momentumState === 'Failed reclaim / turn back down') penalties -= 2;
    if (values.entryQuality === 'Late/Chase') penalties -= 2;
    if (values.triggerConfirmed === 'No') penalties -= 1;
    if (values.spreadFills === 'Wide') penalties -= 2;
    if (values.ivBehavior === 'IV falling' && values.triggerType === 'Breakout') penalties -= 1;
    if (!hasInvalidationLevel) penalties -= 1;

    const rawTotalUnbounded = microContextScore + triggerConfirmScore + entryTimingScore + volLevelsOptionsScore + penalties;
    const boundedRawTotal = clamp(rawTotalUnbounded, 0, 20);

    let cap = 20;
    const capReasons = [];
    if (values.spyAlignment === 'Opposite') {
        cap = Math.min(cap, 12);
        capReasons.push('Cap 12: SPY alignment Opposite (15m)');
    }
    if (values.structure === 'Mixed') {
        cap = Math.min(cap, 12);
        capReasons.push('Cap 12: Mixed structure (15m)');
    }
    if (values.triggerConfirmed === 'No') {
        cap = Math.min(cap, 14);
        capReasons.push('Cap 14: Trigger not confirmed (15m)');
    }
    if (values.spreadFills === 'Wide') {
        cap = Math.min(cap, 12);
        capReasons.push('Cap 12: Wide spread/fills (15m)');
    }
    if (values.entryQuality === 'Late/Chase') {
        cap = Math.min(cap, 14);
        capReasons.push('Cap 14: Late/Chase entry (15m)');
    }
    if (values.momentumState === 'Overextended') {
        cap = Math.min(cap, 14);
        capReasons.push('Cap 14: Overextended momentum (15m)');
    }
    if (!hasTriggerLevel) {
        cap = Math.min(cap, 15);
        capReasons.push('Cap 15: Missing trigger level (15m)');
    }

    const total = Math.min(boundedRawTotal, cap);
    const capApplied = total < boundedRawTotal;

    let grade = 'No data';
    if (hasMinimumData) {
        grade = 'Pass / avoid';
        if (total >= 16) grade = 'A (clean execution)';
        else if (total >= 12) grade = 'B (acceptable execution)';
        else if (total >= 8) grade = 'C (low-quality entry)';
    }

    return {
        total,
        rawTotal: boundedRawTotal,
        microContextScore,
        triggerConfirmScore,
        entryTimingScore,
        volLevelsOptionsScore,
        penalties,
        cap,
        capApplied,
        capReasons,
        grade,
        hasMinimumData
    };
}

function calculateOptionsSuitabilityScore(values) {
    const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
    const contractType = values.contractType || '';
    const dteBucket = values.dteBucket || '';
    const ivLevel = values.ivLevel || '';
    const spreadQuality = values.spreadQuality || '';
    const ivVsRv = values.ivVsRv || '';
    const ivTrend = values.ivTrend || '';
    const holdingPlan = values.holdingPlan || '';
    const expectedMoveFit = values.expectedMoveFit || '';
    const roomVsTheta = values.roomVsTheta || '';
    const oiVolume = values.oiVolume || '';
    const catalystType = values.catalystType || '';
    const ivCrushRisk = values.ivCrushRisk || '';
    const moneyness = values.moneyness || '';

    const isLongPremium = [
        'Calls / Puts (directional)',
        'Debit spread',
        'Straddle/Strangle (volatility)'
    ].includes(contractType);
    const isDefinedRiskSpread = ['Debit spread', 'Credit spread'].includes(contractType);
    const isDirectional = contractType === 'Calls / Puts (directional)';
    const isShortDte = dteBucket === '0-7 DTE';

    let volatilityEdgeScore = 0;
    volatilityEdgeScore += ivLevel === 'Low' ? 2 : ivLevel === 'Mid' ? 1 : 0;
    volatilityEdgeScore += ivVsRv === 'IV < RV (premium cheap)' ? 2 : ivVsRv === 'IV = RV' ? 1 : 0;
    if ((ivTrend === 'Rising' && isLongPremium) || (ivTrend === 'Falling' && contractType === 'Credit spread')) {
        volatilityEdgeScore += 2;
    } else if (ivTrend === 'Stable') {
        volatilityEdgeScore += 1;
    }
    volatilityEdgeScore = clamp(volatilityEdgeScore, 0, 6);

    let structureFitScore = 0;
    const dteHoldingMatrix = {
        'Intraday -> 1-2 days': { best: ['0-7 DTE'], ok: ['8-21 DTE'] },
        '3-7 days': { best: ['8-21 DTE'], ok: ['0-7 DTE', '22-45 DTE'] },
        '2-4 weeks': { best: ['22-45 DTE'], ok: ['8-21 DTE', '46-90 DTE'] },
        '>4 weeks': { best: ['46-90 DTE'], ok: ['22-45 DTE'] }
    };
    const dteFit = dteHoldingMatrix[holdingPlan];
    if (dteFit) {
        if (dteFit.best.includes(dteBucket)) structureFitScore += 2;
        else if (dteFit.ok.includes(dteBucket)) structureFitScore += 1;
    }
    structureFitScore += expectedMoveFit === 'Target inside EM' ? 2 : expectedMoveFit === 'Target near EM' ? 1 : 0;
    structureFitScore += roomVsTheta === 'Plenty of room (theta ok)' ? 2 : roomVsTheta === 'Some room (selective)' ? 1 : 0;
    structureFitScore = clamp(structureFitScore, 0, 6);

    let liquidityRealityScore = 0;
    liquidityRealityScore += spreadQuality === 'Tight' ? 2 : spreadQuality === 'Ok' ? 1 : 0;
    liquidityRealityScore += oiVolume === 'Good' ? 2 : oiVolume === 'Medium' ? 1 : 0;
    liquidityRealityScore = clamp(liquidityRealityScore, 0, 4);

    let riskCatalystScore = 0;
    if (catalystType === 'Earnings') {
        if (isLongPremium) riskCatalystScore += 0;
        else if (isDefinedRiskSpread) riskCatalystScore += 1;
    } else if (catalystType === 'None planned') {
        riskCatalystScore += 2;
    } else if (catalystType === 'Macro/news') {
        riskCatalystScore += 1;
    }
    riskCatalystScore += ivCrushRisk === 'Low' ? 2 : ivCrushRisk === 'Medium' ? 1 : 0;
    riskCatalystScore = clamp(riskCatalystScore, 0, 4);

    let penalties = 0;
    if (ivVsRv === 'IV > RV (premium rich)' && isLongPremium) penalties -= 2;
    if (ivLevel === 'High' && isDirectional && moneyness === 'OTM') penalties -= 2;
    if (spreadQuality === 'Wide' && moneyness === 'OTM') penalties -= 2;
    if (roomVsTheta === 'Limited room (theta danger)' && isShortDte) penalties -= 2;
    if (catalystType === 'Earnings' && isShortDte) penalties -= 3;
    if (ivCrushRisk === 'High' && isLongPremium) penalties -= 2;

    const rawOptionsUnbounded = volatilityEdgeScore + structureFitScore + liquidityRealityScore + riskCatalystScore + penalties;
    const boundedRawOptions = clamp(rawOptionsUnbounded, 0, 20);

    let capOptions = 20;
    const capReasons = [];
    if (ivCrushRisk === 'High') {
        capOptions = Math.min(capOptions, 12);
        capReasons.push('Cap 12: IV crush High');
    }
    if (spreadQuality === 'Wide') {
        capOptions = Math.min(capOptions, 12);
        capReasons.push('Cap 12: Wide spread');
    }
    if (oiVolume === 'Poor') {
        capOptions = Math.min(capOptions, 10);
        capReasons.push('Cap 10: OI/Volume Poor');
    }
    if (catalystType === 'Earnings' && isShortDte) {
        capOptions = Math.min(capOptions, 10);
        capReasons.push('Cap 10: Earnings + 0-7 DTE');
    }
    if (ivVsRv === 'IV > RV (premium rich)' && isLongPremium) {
        capOptions = Math.min(capOptions, 12);
        capReasons.push('Cap 12: IV>RV + long premium');
    }

    const total = Math.min(boundedRawOptions, capOptions);
    const capApplied = total < boundedRawOptions;

    const hasMinimumData = Boolean(contractType && dteBucket && ivLevel && spreadQuality);
    let grade = 'No data';
    if (hasMinimumData) {
        grade = 'Avoid options';
        if (total >= 16) grade = 'A (strong options edge)';
        else if (total >= 12) grade = 'B (good)';
        else if (total >= 8) grade = 'C (marginal)';
    }

    return {
        total,
        rawTotal: boundedRawOptions,
        volatilityEdgeScore,
        structureFitScore,
        liquidityRealityScore,
        riskCatalystScore,
        penalties,
        cap: capOptions,
        capApplied,
        capReasons,
        grade,
        hasMinimumData
    };
}

function initScoringBuilder() {
    const form = document.getElementById('scoring-form');
    if (!form) return;
    const stockSection = form.querySelector('#stock-1d-section');
    if (!stockSection) return;
    initScoringFieldHelp(form, stockSection);

    const totalEl = document.getElementById('scoring-total-score');
    const totalResultEl = document.getElementById('scoring-total-score-result');
    const rawEl = document.getElementById('scoring-raw-score');
    const interpretationEl = document.getElementById('scoring-interpretation');
    const interpretationResultEl = document.getElementById('scoring-interpretation-result');
    const breakdownEl = document.getElementById('scoring-breakdown');
    const penVolSubtotalEl = document.getElementById('pen-vol-subtotal');
    const capNoteEl = document.getElementById('scoring-cap-note');
    const stockTotalEl = document.getElementById('stock1d-total-score');
    const stockRawEl = document.getElementById('stock1d-raw-score');
    const stockGradeEl = document.getElementById('stock1d-grade');
    const stock1dHeaderScoreEl = document.getElementById('stock1d-header-score');
    const stock1dHeaderGradeEl = document.getElementById('stock1d-header-grade');
    const stockBreakdownEl = document.getElementById('stock1d-breakdown');
    const stockCapNoteEl = document.getElementById('stock1d-cap-note');
    const stock4hTotalEl = document.getElementById('stock4h-total-score');
    const stock4hRawEl = document.getElementById('stock4h-raw-score');
    const stock4hGradeEl = document.getElementById('stock4h-grade');
    const stock4hHeaderScoreEl = document.getElementById('stock4h-header-score');
    const stock4hHeaderGradeEl = document.getElementById('stock4h-header-grade');
    const stock4hBreakdownEl = document.getElementById('stock4h-breakdown');
    const stock4hCapNoteEl = document.getElementById('stock4h-cap-note');
    const stock1hTotalEl = document.getElementById('stock1h-total-score');
    const stock1hRawEl = document.getElementById('stock1h-raw-score');
    const stock1hGradeEl = document.getElementById('stock1h-grade');
    const stock1hHeaderScoreEl = document.getElementById('stock1h-header-score');
    const stock1hHeaderGradeEl = document.getElementById('stock1h-header-grade');
    const stock1hBreakdownEl = document.getElementById('stock1h-breakdown');
    const stock1hCapNoteEl = document.getElementById('stock1h-cap-note');
    const stock15mTotalEl = document.getElementById('stock15m-total-score');
    const stock15mRawEl = document.getElementById('stock15m-raw-score');
    const stock15mGradeEl = document.getElementById('stock15m-grade');
    const stock15mHeaderScoreEl = document.getElementById('stock15m-header-score');
    const stock15mHeaderGradeEl = document.getElementById('stock15m-header-grade');
    const stock15mBreakdownEl = document.getElementById('stock15m-breakdown');
    const stock15mCapNoteEl = document.getElementById('stock15m-cap-note');
    const stockGlobalTotalEl = document.getElementById('stock-global-total-score');
    const stockGlobalGradeEl = document.getElementById('stock-global-grade');
    const stockGlobalBreakdownEl = document.getElementById('stock-global-breakdown');
    const stockGlobalCapNoteEl = document.getElementById('stock-global-cap-note');
    const finalDecisionEl = document.getElementById('scoring-final-decision');
    const optionsTotalEl = document.getElementById('options-total-score-result');
    const optionsRawEl = document.getElementById('options-raw-score');
    const optionsGradeEl = document.getElementById('options-grade-result');
    const optionsHeaderScoreEl = document.getElementById('options-header-score');
    const optionsHeaderGradeEl = document.getElementById('options-header-grade');
    const optionsBreakdownEl = document.getElementById('options-breakdown');
    const optionsCapNoteEl = document.getElementById('options-cap-note');
    const trendQualityGuardrailEl = document.getElementById('stk1d_trend_quality_guardrail');
    const liquidityEventGuardrailEl = document.getElementById('stk1d_liquidity_event_guardrail');
    const volGapGuardrailEl = document.getElementById('stk1d_vol_gap_guardrail');
    const pullbackGroupEl = document.getElementById('stk1d_pullback_group');
    const pullbackNaEl = document.getElementById('stk1d_pullback_na');
    const stk4hChoppyGuardrailEl = document.getElementById('stk4h_choppy_guardrail');
    const stk4hSetupLocationGuardrailEl = document.getElementById('stk4h_setup_location_guardrail');
    const stk1hAlignmentGuardrailEl = document.getElementById('stk1h_alignment_guardrail');
    const stk4hVolLiqGuardrailEl = document.getElementById('stk4h_vol_liq_guardrail');
    const stk4hAnchorBiasGuardrailEl = document.getElementById('stk4h_anchor_bias_guardrail');
    const spyChatButtonEl = document.getElementById('spy-chat-generate');
    const spyChatCopyButtonEl = document.getElementById('spy-chat-copy');
    const spyChatApplyButtonEl = document.getElementById('spy-chat-apply');
    const spyChatExtraContextEl = document.getElementById('spy-chat-extra-context');
    const spyChatResponseInputEl = document.getElementById('spy-chat-response-input');
    const stockChatCopyButtonEl = document.getElementById('stock-chat-copy');
    const stockChatApplyButtonEl = document.getElementById('stock-chat-apply');
    const stockChatExtraContextEl = document.getElementById('stock-chat-extra-context');
    const stockChatResponseInputEl = document.getElementById('stock-chat-response-input');
    const mentorReportOutputEl = document.getElementById('mentor-report-output');
    const generateMentorReportBtn = document.getElementById('scoring-generate-mentor-report');
    const copyMentorReportBtn = document.getElementById('scoring-copy-mentor-report');
    const clearReportBtn = document.getElementById('scoring-clear-report');
    const saveBtn = document.getElementById('scoring-save');
    const loadBtn = document.getElementById('scoring-load');
    const deleteBtn = document.getElementById('scoring-delete');
    const nameInput = document.getElementById('scoring_name');
    const listSelect = document.getElementById('scoring_list');
    const sortSelect = document.getElementById('scoring_sort');
    let generatedSpyPrompt = '';
    let lastComputedScores = null;
    const storageKey = 'scoring:latest';
    const storageListKey = 'scoring:entries';

    const bindMutualExclusiveGroup = (names) => {
        const inputs = names.map(name => form.querySelector(`input[name="${name}"]`)).filter(Boolean);
        if (inputs.length < 2) return;
        inputs.forEach(input => {
            input.addEventListener('change', () => {
                if (!input.checked) return;
                inputs.forEach(other => {
                    if (other !== input) other.checked = false;
                });
            });
        });
    };
    const isChecked = (name) => {
        const el = form.querySelector(`input[name="${name}"]`);
        return Boolean(el && el.checked);
    };
    const getRadioValue = (name) => {
        const el = form.querySelector(`input[name="${name}"]:checked`);
        return el ? el.value : '';
    };
    const getFieldValue = (name) => {
        const el = form.querySelector(`[name="${name}"]`);
        return el ? (el.value || '') : '';
    };
    const getStockRadioValue = (name) => {
        const el = stockSection.querySelector(`input[name="${name}"]:checked`);
        return el ? el.value : '';
    };
    const isStockChecked = (name) => {
        const el = stockSection.querySelector(`input[name="${name}"]`);
        return Boolean(el && el.checked);
    };

    const parseRate = (fieldName, min = 0, max = 100) => {
        const el = form.querySelector(`input[name="${fieldName}"]`);
        if (!el) return 0;
        const normalized = (el.value || '').replace(',', '.').trim();
        const num = Number.parseFloat(normalized);
        if (!Number.isFinite(num)) return 0;
        return Math.max(min, Math.min(max, num));
    };

    const collectSpyInputs = () => {
        const result = {};
        const spyFields = form.querySelectorAll('[name^="sc_spy_"]');
        spyFields.forEach((field) => {
            if (!field.name) return;
            if (field.type === 'radio') {
                if (field.checked) result[field.name] = field.value;
                return;
            }
            if (field.type === 'checkbox') {
                if (field.checked) result[field.name] = true;
                return;
            }
            const value = (field.value || '').trim();
            if (value) result[field.name] = value;
        });
        return result;
    };

    const collectStockInputs = () => {
        const result = {};
        const stockFields = form.querySelectorAll('[name^="stk1d_"], [name^="stk4h_"], [name^="stk1h_"], [name^="m15_"], [name^="opt_"]');
        stockFields.forEach((field) => {
            if (!field.name) return;
            if (field.type === 'radio') {
                if (field.checked) result[field.name] = field.value;
                return;
            }
            if (field.type === 'checkbox') {
                if (field.checked) result[field.name] = true;
                return;
            }
            const value = (field.value || '').trim();
            if (value) result[field.name] = value;
        });
        return result;
    };

    const buildInputsBlock = (inputs) => {
        const lines = [];
        Object.keys(inputs || {}).sort().forEach((key) => {
            const value = inputs[key];
            if (value === null || value === undefined) return;
            if (typeof value === 'string' && !value.trim()) return;
            lines.push(`- ${key}: ${value}`);
        });
        return lines.length ? lines.join('\n') : '- brak zaznaczen';
    };

    const clearChatHints = (hintClass) => {
        const hintEls = form.querySelectorAll(`.${hintClass}`);
        hintEls.forEach((el) => el.remove());
    };

    const applyChatHints = (suggestions, hintClass) => {
        clearChatHints(hintClass);
        if (!suggestions || typeof suggestions !== 'object') return;
        Object.entries(suggestions).forEach(([name, value]) => {
            const input = form.querySelector(`input[name="${name}"][value="${value}"]`);
            if (!input) return;
            const label = input.closest('.checkbox-label');
            if (!label) return;
            const hint = document.createElement('span');
            hint.className = hintClass;
            hint.textContent = 'Chat';
            label.appendChild(hint);
        });
    };

    const extractSuggestionsFromResponse = (rawText) => {
        const text = (rawText || '').trim();
        if (!text) return null;
        let parsed = null;
        try {
            parsed = JSON.parse(text);
        } catch (_) {
            parsed = null;
        }
        if (!parsed) {
            const start = text.lastIndexOf('{"suggestions"');
            if (start >= 0) {
                const maybeJson = text.slice(start).trim();
                try {
                    parsed = JSON.parse(maybeJson);
                } catch (_) {
                    parsed = null;
                }
            }
        }
        if (!parsed || typeof parsed !== 'object' || typeof parsed.suggestions !== 'object') {
            return null;
        }
        return parsed.suggestions;
    };

    const extractCombinedSuggestionsFromResponse = (rawText) => {
        const text = (rawText || '').trim();
        if (!text) return null;
        let parsed = null;
        try {
            parsed = JSON.parse(text);
        } catch (_) {
            parsed = null;
        }
        if (!parsed) {
            const startSpy = text.lastIndexOf('{"spy_suggestions"');
            const startStock = text.lastIndexOf('{"suggestions"');
            const start = startSpy >= 0 ? startSpy : startStock;
            if (start >= 0) {
                const maybeJson = text.slice(start).trim();
                try {
                    parsed = JSON.parse(maybeJson);
                } catch (_) {
                    parsed = null;
                }
            }
        }
        if (!parsed || typeof parsed !== 'object') {
            return null;
        }
        const stock = (parsed.suggestions && typeof parsed.suggestions === 'object') ? parsed.suggestions : null;
        const spy = (parsed.spy_suggestions && typeof parsed.spy_suggestions === 'object') ? parsed.spy_suggestions : null;
        if (!stock && !spy) return null;
        return { stock, spy };
    };

    const runSpyChatAnalysis = async () => {
        if (!spyChatButtonEl) return;
        const extraContext = spyChatExtraContextEl ? (spyChatExtraContextEl.value || '').trim() : '';
        generatedSpyPrompt = [
            'Przeanalizuj SPY w TF 1D i wydaj NIEZALEZNA opinie.',
            'Nie kopiuj i nie zgaduj moich wyborow z formularza. Oceń rynek samodzielnie.',
            '',
            'Dokladnie sprawdz te elementy:',
            '- Kierunek biasu rynku (bullish / bearish / neutral).',
            '- Rezim rynku: trend, range czy warunki niestabilne/volatile.',
            '- Strukture ceny: HH/HL, LL/LH albo mixed.',
            '- Polozenie ceny wzgledem VWAP: powyzej czy ponizej.',
            '- Kierunek VIX: rising, falling albo flat.',
            '- Poziom VIX: <20, 20-25, >25.',
            '- Breadth rynku: strong / neutral / weak.',
            '- Lokacje ceny: przy oporze, przy wsparciu, srodek zakresu, wybicie z zakresu.',
            '- Miejsce na ruch (room to move): duze / ograniczone / brak.',
            '- Zachowanie trendowe: higher lows, lower highs albo brak czytelnego sygnalu.',
            '',
            `Dodatkowy kontekst ode mnie (opcjonalny): ${extraContext || 'brak'}`,
            '',
            'Zwróc dokładnie 3 zdania po polsku:',
            '1) Ogolny opis co dzieje sie na SPY.',
            '2) Jedno zdanie o glownym zagrozeniu/risku.',
            '3) Jedno zdanie odwrotne do risku: co musi sie wydarzyc, aby scenariusz byl po naszej stronie.',
            '',
            'Dodatkowo zwroc JSON z sugestiami dla pol (bez markdown):',
            '{"suggestions":{"sc_spy_bias":"bullish|bearish|neutral","sc_spy_regime":"trending|ranging|volatile","sc_spy_structure":"hh_hl|ll_lh|mixed","sc_spy_vwap":"above|below","sc_spy_vix_trend":"falling|rising|flat","sc_spy_vix_level":"lt20|20_25|gt25","sc_spy_breadth":"strong|neutral|weak","sc_spy_location":"at_resistance|at_support|mid_range|breaking_range","sc_spy_room":"large|limited|none","sc_spy_behavior_trend":"higher_lows|lower_highs|none"}}'
        ].join('\n');

        clearChatHints('spy-ai-hint');
        const originalLabel = spyChatButtonEl.textContent || 'Generate Prompt';
        spyChatButtonEl.textContent = 'Prompt ready';
        setTimeout(() => {
            spyChatButtonEl.textContent = originalLabel;
        }, 900);
    };

    const buildStockChatPrompt = () => {
        const extraContext = stockChatExtraContextEl ? (stockChatExtraContextEl.value || '').trim() : '';
        const spyExtraContext = spyChatExtraContextEl ? (spyChatExtraContextEl.value || '').trim() : '';
        const tfs = '1D, 4H, 1H, 15m';
        const ticker = (form.querySelector('input[name="stk1d_ticker"]')?.value || '').trim().toUpperCase() || 'BRAK_TICKERA';
        const stockInputsBlock = buildInputsBlock(collectStockInputs());
        const spyInputsBlock = buildInputsBlock(collectSpyInputs());
        return [
            'Przeanalizuj rynek na podstawie dostarczonych odczytow: SPY oraz STOCK.',
            'Oceniaj niezaleznie. Nie kopiuj automatycznie moich zaznaczen, tylko porownaj je z Twoja analiza.',
            '',
            `Ticker: ${ticker}`,
            `TF SPY: 1D`,
            `TF STOCK: ${tfs}`,
            '',
            'Kontekst SPY z formularza:',
            spyInputsBlock,
            '',
            'Moje zaznaczenia (stock):',
            stockInputsBlock,
            '',
            `Dodatkowy kontekst SPY (opcjonalny): ${spyExtraContext || 'brak'}`,
            `Dodatkowy kontekst STOCK (opcjonalny): ${extraContext || 'brak'}`,
            '',
            'Wymagany format odpowiedzi (bez markdown, bez dodatkowych sekcji):',
            'SPY - Wskazniki:',
            '- wypisz tylko roznice miedzy Twoja analiza a moimi zaznaczeniami SPY;',
            '- kazdy punkt: [pole] -> moje: ... | twoje: ... | komentarz: ...',
            '',
            'SPY - Ogolen:',
            '- jedno zdanie o zachowaniu SPY.',
            '',
            'SPY - Mozliwosci na plus:',
            '- 2-4 krotkie punkty.',
            '',
            'SPY - Mozliwosci na minus:',
            '- 2-4 krotkie punkty.',
            '',
            'STOCK - Wskazniki:',
            '- wypisz tylko roznice miedzy Twoja analiza a moimi zaznaczeniami;',
            '- kazdy punkt: [pole] -> moje: ... | twoje: ... | komentarz: ...',
            '- uwzglednij wszystkie TF stocka: 1D, 4H, 1H oraz 15m (Execution & Timing).',
            '- uwzglednij warstwe opcyjna (DTE, IV regime, EM vs room, liquidity, structure fit, catalyst/gap).',
            '',
            'STOCK - Ogolen:',
            '- jedno zdanie o zachowaniu SPY i jego wplywie na ticker.',
            '',
            'STOCK - Mozliwosci na plus:',
            '- 2-4 krotkie punkty: co musi sie wydarzyc, aby scenariusz byl korzystny.',
            '',
            'STOCK - Mozliwosci na minus:',
            '- 2-4 krotkie punkty: co moze pojsc nie tak i zanegowac scenariusz.',
            '',
            'Na koncu dodaj jedna linie JSON (bez markdown), zaczynajaca sie dokladnie od {"suggestions":...}.',
            'JSON ma zawierac dwa klucze: "spy_suggestions" oraz "suggestions".',
            '{"spy_suggestions":{"sc_spy_bias":"bullish|bearish|neutral","sc_spy_regime":"trending|ranging|volatile","sc_spy_structure":"hh_hl|ll_lh|mixed","sc_spy_vwap":"above|below","sc_spy_vix_trend":"falling|rising|flat","sc_spy_vix_level":"lt20|20_25|gt25","sc_spy_breadth":"strong|neutral|weak","sc_spy_location":"at_resistance|at_support|mid_range|breaking_range","sc_spy_room":"large|limited|none","sc_spy_behavior_trend":"higher_lows|lower_highs|none"},"suggestions":{"stk1d_bias":"bullish|bearish|neutral","stk1d_structure":"hh_hl|ll_lh|mixed","stk1d_sma200":"above|below","stk1d_trend_anchor":"above|middle|below","stk1d_spy_alignment":"aligned|diverging|opposite","stk1d_relative_vs_spy":"strength|weakness|neutral","stk1d_phase":"impulse|pullback|base|distribution","stk1d_volatility_state":"expanding|normal|contracting","stk1d_options_liquidity":"good|medium|poor","stk4h_bias":"bullish|bearish|neutral","stk4h_structure":"hh_hl|ll_lh|mixed","stk4h_anchor_state":"above_anchor|around_anchor|below_anchor","stk4h_location":"near_support|mid_range|near_resistance|range_high|range_low","stk4h_setup_type":"breakout_continuation|breakdown_continuation|pullback_within_trend|reversal_attempt|range_play","stk4h_trend_quality":"clean|acceptable|choppy","stk4h_volatility_profile":"expanding|stable|contracting","stk4h_liquidity_check":"good|medium|poor","stk1h_structure":"hh_hl|ll_lh|mixed","stk1h_anchor_state":"above|around|below","stk1h_range_state":"breaking_range|inside_range|rejecting_level","stk1h_alignment_with_4h":"aligned|minor_pullback|counter_trend","stk1h_setup_type":"breakout_hold|failed_breakout|pullback_continuation|rejection_reversal","stk1h_risk_model":"structure_based|level_based|volatility_based","m15_bias":"Bullish|Bearish","m15_structure":"HH/HL|LL/LH|Mixed","m15_vwap":"Above|Middle|Below","m15_spy_alignment":"Aligned|Diverging|Opposite","m15_spy_vwap":"Above|Below","m15_structure_breaks":"Yes|No","m15_trigger_type":"Breakout|Breakdown|Reclaim|Rejection|Fade","m15_trigger_confirmed":"Yes|No","m15_momentum_state":"Expanding with move|Diverging|Overextended|Failed reclaim / turn back down","m15_entry_quality":"A+|OK|Late/Chase","m15_retest_quality":"Clean retest|Wicky|No retest","m15_session_timing":"Open (first 30m)|Midday|Power hour|Close","m15_event_timing":"Before news|After news|No scheduled risk","m15_spread_fills":"OK|Wide","m15_iv_behavior":"IV rising|IV stable|IV falling"}}'
        ].join('\n');
    };

    const bindVolumeValidation = () => {
        const avg = form.querySelector('input[name="sc_spy_volume_gt_20d"]');
        const expansion = form.querySelector('input[name="sc_spy_volume_expansion"]');
        if (!avg || !expansion) return;

        expansion.addEventListener('change', () => {
            if (expansion.checked) {
                avg.checked = true;
            }
        });

        avg.addEventListener('change', () => {
            if (!avg.checked && expansion.checked) {
                expansion.checked = false;
            }
        });
    };

    const bindRateValidation = () => {
        const rateFields = [
            { name: 'sc_spy_rate', min: 0, max: 100 },
            { name: 'stk1d_rate', min: 0, max: 99 },
            { name: 'stk4h_rate', min: 0, max: 99 },
            { name: 'stk1h_rate', min: 0, max: 99 },
            { name: 'm15_rate', min: 0, max: 99 }
        ];
        rateFields.forEach(({ name, min, max }) => {
            const field = form.querySelector(`input[name="${name}"]`);
            if (!field) return;
            field.addEventListener('input', () => {
                if (field.value === '') return;
                const parsed = Number.parseFloat(field.value.replace(',', '.'));
                if (!Number.isFinite(parsed)) return;
                field.value = String(Math.max(min, Math.min(max, Math.round(parsed))));
            });
        });
    };

    const setText = (el, value) => {
        if (el) el.textContent = value;
    };

    const formatScore = (value, max) => `${value} / ${max}`;

    const formatCapNote = (score, withPrefix = true) => {
        if (!score.capApplied) return '';
        if (withPrefix) return `Cap active: max ${score.cap}. Reason: ${score.capReasons.join('; ')}.`;
        return score.capReasons.join('; ');
    };

    const renderTfScore = ({
        score,
        max,
        totalEl,
        rawEl,
        gradeEl,
        headerScoreEl,
        headerGradeEl,
        breakdownEl,
        breakdownText,
        capNoteEl
    }) => {
        if (!score.hasMinimumData) {
            setText(totalEl, 'No data');
            setText(rawEl, 'No data');
            setText(gradeEl, 'No data');
            setText(headerScoreEl, 'No data');
            setText(headerGradeEl, 'No data');
            setText(breakdownEl, 'No data - missing minimum fields');
            setText(capNoteEl, '');
            return;
        }
        setText(totalEl, formatScore(score.total, max));
        setText(rawEl, formatScore(score.rawTotal, max));
        setText(gradeEl, score.grade);
        setText(headerScoreEl, formatScore(score.total, max));
        setText(headerGradeEl, score.grade);
        setText(breakdownEl, breakdownText);
        setText(capNoteEl, formatCapNote(score, true));
    };

    const renderGlobalStockScore = ({ stock1d, stock4h, stock1h, stock15m }) => {
        const has1d = stock1d.hasMinimumData;
        const has4h = stock4h.hasMinimumData;
        const has1h = stock1h.hasMinimumData;
        const has15m = stock15m.hasMinimumData;
        const hasAllGlobal = has1d && has4h && has1h && has15m;
        const globalTotal = stock1d.total + stock4h.total + stock1h.total + stock15m.total;
        const missing = [];

        if (hasAllGlobal) {
            setText(stockGlobalTotalEl, formatScore(globalTotal, 80));
        } else {
            if (!has1d) missing.push('1D');
            if (!has4h) missing.push('4H');
            if (!has1h) missing.push('1H');
            if (!has15m) missing.push('15m');
            setText(stockGlobalTotalEl, `No data (need ${missing.join(' + ')})`);
        }

        setText(
            stockGlobalBreakdownEl,
            `1D: ${has1d ? `${stock1d.total}/20` : 'No data'} | 4H: ${has4h ? `${stock4h.total}/20` : 'No data'} | 1H: ${has1h ? `${stock1h.total}/20` : 'No data'} | 15m: ${has15m ? `${stock15m.total}/20` : 'No data'}`
        );

        let globalGrade = 'No data';
        if (hasAllGlobal) {
            globalGrade = 'Pass';
            if (globalTotal >= 64) globalGrade = 'A (global-ready)';
            else if (globalTotal >= 48) globalGrade = 'B (selective)';
            else if (globalTotal >= 32) globalGrade = 'C (watch)';
        }
        setText(stockGlobalGradeEl, globalGrade);

        const capLines = [];
        if (stock1d.capApplied && stock1d.capReasons.length) capLines.push(`1D: ${stock1d.capReasons.join('; ')}`);
        if (stock4h.capApplied && stock4h.capReasons.length) capLines.push(`4H: ${stock4h.capReasons.join('; ')}`);
        if (stock1h.capApplied && stock1h.capReasons.length) capLines.push(`1H: ${stock1h.capReasons.join('; ')}`);
        if (stock15m.capApplied && stock15m.capReasons.length) capLines.push(`15m: ${stock15m.capReasons.join('; ')}`);
        setText(stockGlobalCapNoteEl, capLines.join('\n'));

        return {
            hasAllGlobal,
            globalTotal,
            globalGrade,
            missing
        };
    };

    const renderScore = () => {
        const score = calculateSpyScore({
            bias: getRadioValue('sc_spy_bias'),
            structure: getRadioValue('sc_spy_structure'),
            vwap: getRadioValue('sc_spy_vwap'),
            trend50: getRadioValue('sc_spy_50d_state'),
            maAlignment: getRadioValue('sc_spy_ma_alignment'),
            bos: getRadioValue('sc_spy_bos'),
            regime: getRadioValue('sc_spy_regime'),
            volumeGt20d: isChecked('sc_spy_volume_gt_20d'),
            volumeExpansion: isChecked('sc_spy_volume_expansion'),
            breadth: getRadioValue('sc_spy_breadth'),
            sectorParticipation: getRadioValue('sc_spy_sector_participation'),
            eventRisk: getRadioValue('sc_spy_event_risk'),
            vixTrend: getRadioValue('sc_spy_vix_trend'),
            vixLevel: getRadioValue('sc_spy_vix_level'),
            location: getRadioValue('sc_spy_location'),
            room: getRadioValue('sc_spy_room'),
            distanceKeyLevel: getRadioValue('sc_spy_distance_key_level'),
            behaviorTrend: getRadioValue('sc_spy_behavior_trend'),
            behaviorAbove200: isChecked('sc_spy_behavior_above_200'),
            behaviorCompression: isChecked('sc_spy_behavior_compression'),
            behaviorExpansionUp: isChecked('sc_spy_behavior_expansion_up'),
            behaviorExpansionDown: isChecked('sc_spy_behavior_expansion_down'),
            rate: parseRate('sc_spy_rate')
        });

        const stockScore = calculateStock1DScore({
            spyAlignment: getStockRadioValue('stk1d_spy_alignment'),
            bias: getStockRadioValue('stk1d_bias'),
            relativeVsSpy: getStockRadioValue('stk1d_relative_vs_spy'),
            rsTrend: getStockRadioValue('stk1d_rs_trend'),
            structure: getStockRadioValue('stk1d_structure'),
            trendState: getStockRadioValue('stk1d_trend_state'),
            trendAnchor: getStockRadioValue('stk1d_trend_anchor'),
            sma200: getStockRadioValue('stk1d_sma200'),
            pullback: getStockRadioValue('stk1d_pullback'),
            betaSensitivity: getStockRadioValue('stk1d_beta_sensitivity'),
            gapRisk: getStockRadioValue('stk1d_gap_risk'),
            optionsLiquidity: getStockRadioValue('stk1d_options_liquidity'),
            levelPosition: getStockRadioValue('stk1d_level_position'),
            earningsSoon: isStockChecked('stk1d_event_earnings'),
            dividendSoon: isStockChecked('stk1d_event_dividends'),
            otherCatalyst: isStockChecked('stk1d_event_other'),
            rate: parseRate('stk1d_rate', 0, 99)
        });
        const stock4hScore = calculateStock4HScore({
            bias: getRadioValue('stk4h_bias'),
            structure: getRadioValue('stk4h_structure'),
            anchorState: getRadioValue('stk4h_anchor_state'),
            location: getRadioValue('stk4h_location'),
            selectedLevelsCount: [
                isChecked('stk4h_key_level_prior_day'),
                isChecked('stk4h_key_level_weekly'),
                isChecked('stk4h_key_level_range'),
                isChecked('stk4h_key_level_major_ma'),
                isChecked('stk4h_key_level_supply_demand')
            ].filter(Boolean).length,
            hardLevelsCount: [
                isChecked('stk4h_key_level_weekly'),
                isChecked('stk4h_key_level_supply_demand'),
                isChecked('stk4h_key_level_major_ma')
            ].filter(Boolean).length,
            setupType: getRadioValue('stk4h_setup_type'),
            trendQuality: getRadioValue('stk4h_trend_quality'),
            volatilityProfile: getRadioValue('stk4h_volatility_profile'),
            invalidationLogic: getRadioValue('stk4h_invalidation_logic'),
            liquidityCheck: getRadioValue('stk4h_liquidity_check')
        });
        const intradayReactionCount = [
            isChecked('stk1h_intraday_premarket'),
            isChecked('stk1h_intraday_opening_range'),
            isChecked('stk1h_intraday_vwap_reclaim_loss'),
            isChecked('stk1h_intraday_pdh_pdl')
        ].filter(Boolean).length;
        const stock1hScore = calculateStock1HScore({
            structure: getRadioValue('stk1h_structure'),
            anchorState: getRadioValue('stk1h_anchor_state'),
            rangeState: getRadioValue('stk1h_range_state'),
            intradayReactionCount,
            hasVWAPReaction: isChecked('stk1h_intraday_vwap_reclaim_loss'),
            hasPDHOrORReaction: isChecked('stk1h_intraday_pdh_pdl') || isChecked('stk1h_intraday_opening_range'),
            alignment4h: getRadioValue('stk1h_alignment_with_4h'),
            setupType: getRadioValue('stk1h_setup_type'),
            riskModel: getRadioValue('stk1h_risk_model')
        });
        const stock15mScore = calculateStock15MScore({
            bias: getRadioValue('m15_bias'),
            rate: parseRate('m15_rate', 0, 99),
            structure: getRadioValue('m15_structure'),
            vwap: getRadioValue('m15_vwap'),
            spyAlignment: getRadioValue('m15_spy_alignment'),
            structureBreaks: getRadioValue('m15_structure_breaks'),
            triggerType: getRadioValue('m15_trigger_type'),
            triggerConfirmed: getRadioValue('m15_trigger_confirmed'),
            triggerLevel: getFieldValue('m15_trigger_level'),
            invalidationLevel: getFieldValue('m15_invalidation_level'),
            momentumState: getRadioValue('m15_momentum_state'),
            entryQuality: getRadioValue('m15_entry_quality'),
            retestQuality: getRadioValue('m15_retest_quality'),
            sessionTiming: getRadioValue('m15_session_timing'),
            impulseVolumeConfirms: isChecked('m15_impulse_volume_confirms'),
            pullbackVolumeDriesUp: isChecked('m15_pullback_volume_dries_up'),
            microSrCount: [
                isChecked('m15_micro_sr_pdh_pdl'),
                isChecked('m15_micro_sr_orh_orl'),
                isChecked('m15_micro_sr_vwap'),
                isChecked('m15_micro_sr_premarket_h_l'),
                isChecked('m15_micro_sr_last_swing')
            ].filter(Boolean).length,
            spreadFills: getRadioValue('m15_spread_fills'),
            ivBehavior: getRadioValue('m15_iv_behavior')
        });
        const optionsScore = calculateOptionsSuitabilityScore({
            contractType: getRadioValue('opt_contract_type'),
            dteBucket: getRadioValue('opt_dte_bucket'),
            holdingPlan: getRadioValue('opt_holding_plan'),
            ivLevel: getRadioValue('opt_iv_level'),
            ivVsRv: getRadioValue('opt_iv_vs_rv'),
            ivTrend: getRadioValue('opt_iv_trend'),
            expectedMoveFit: getRadioValue('opt_expected_move_fit'),
            roomVsTheta: getRadioValue('opt_room_vs_theta'),
            spreadQuality: getRadioValue('opt_spread_quality'),
            oiVolume: getRadioValue('opt_oi_volume'),
            catalystType: getRadioValue('opt_catalyst_type'),
            ivCrushRisk: getRadioValue('opt_iv_crush_risk'),
            moneyness: getRadioValue('opt_moneyness')
        });

        setText(totalEl, formatScore(score.total, 25));
        setText(totalResultEl, formatScore(score.total, 25));
        setText(rawEl, formatScore(score.rawTotal, 25));
        setText(interpretationEl, score.interpretation);
        setText(interpretationResultEl, score.interpretation);
        setText(
            breakdownEl,
            `Direction: ${score.directionScore}/5 | Strength: ${score.strengthScore}/8 | Volatility Regime: ${score.volatilityRegimeScore}/6 | Location: ${score.locationScore}/6 | Behavior bonus: ${score.behaviorBonus} | Penalties: ${score.penalties}`
        );
        setText(penVolSubtotalEl, `Volatility penalties subtotal: ${score.penBuckets.penVol}`);
        setText(capNoteEl, formatCapNote(score, true));

        renderTfScore({
            score: stockScore,
            max: 20,
            totalEl: stockTotalEl,
            rawEl: stockRawEl,
            gradeEl: stockGradeEl,
            headerScoreEl: stock1dHeaderScoreEl,
            headerGradeEl: stock1dHeaderGradeEl,
            breakdownEl: stockBreakdownEl,
            breakdownText: `Direction: ${stockScore.directionScore}/8 | Context: ${stockScore.contextScore}/8 | Risk/Levels: ${stockScore.riskLevelsScore}/4 | Penalties: ${stockScore.penalties}`,
            capNoteEl: stockCapNoteEl
        });

        renderTfScore({
            score: stock4hScore,
            max: 20,
            totalEl: stock4hTotalEl,
            rawEl: stock4hRawEl,
            gradeEl: stock4hGradeEl,
            headerScoreEl: stock4hHeaderScoreEl,
            headerGradeEl: stock4hHeaderGradeEl,
            breakdownEl: stock4hBreakdownEl,
            breakdownText: `Setup: ${stock4hScore.setupScore}/8 | Location/Levels: ${stock4hScore.locationLevelsScore}/6 | Quality/Risk: ${stock4hScore.qualityRiskScore}/6 | Penalties: ${stock4hScore.penalties}`,
            capNoteEl: stock4hCapNoteEl
        });

        renderTfScore({
            score: stock1hScore,
            max: 20,
            totalEl: stock1hTotalEl,
            rawEl: stock1hRawEl,
            gradeEl: stock1hGradeEl,
            headerScoreEl: stock1hHeaderScoreEl,
            headerGradeEl: stock1hHeaderGradeEl,
            breakdownEl: stock1hBreakdownEl,
            breakdownText: `Micro structure: ${stock1hScore.microStructureScore}/7 | Intraday context: ${stock1hScore.intradayContextScore}/7 | Alignment/Risk: ${stock1hScore.alignmentRiskScore}/6 | Penalties: ${stock1hScore.penalties}`,
            capNoteEl: stock1hCapNoteEl
        });

        renderTfScore({
            score: stock15mScore,
            max: 20,
            totalEl: stock15mTotalEl,
            rawEl: stock15mRawEl,
            gradeEl: stock15mGradeEl,
            headerScoreEl: stock15mHeaderScoreEl,
            headerGradeEl: stock15mHeaderGradeEl,
            breakdownEl: stock15mBreakdownEl,
            breakdownText: `Micro context: ${stock15mScore.microContextScore}/6 | Trigger/Confirm: ${stock15mScore.triggerConfirmScore}/6 | Entry/Timing: ${stock15mScore.entryTimingScore}/5 | Volume/Levels/Options: ${stock15mScore.volLevelsOptionsScore}/3 | Penalties: ${stock15mScore.penalties}`,
            capNoteEl: stock15mCapNoteEl
        });

        const globalScoreState = renderGlobalStockScore({
            stock1d: stockScore,
            stock4h: stock4hScore,
            stock1h: stock1hScore,
            stock15m: stock15mScore
        });

        if (optionsScore.hasMinimumData) {
            setText(optionsTotalEl, formatScore(optionsScore.total, 20));
            setText(optionsRawEl, formatScore(optionsScore.rawTotal, 20));
            setText(optionsGradeEl, optionsScore.grade);
            setText(optionsHeaderScoreEl, formatScore(optionsScore.total, 20));
            setText(optionsHeaderGradeEl, optionsScore.grade);
            setText(
                optionsBreakdownEl,
                `Volatility edge: ${optionsScore.volatilityEdgeScore}/6 | Structure fit: ${optionsScore.structureFitScore}/6 | Liquidity: ${optionsScore.liquidityRealityScore}/4 | Risk/Catalyst: ${optionsScore.riskCatalystScore}/4 | Penalties: ${optionsScore.penalties}`
            );
            setText(optionsCapNoteEl, formatCapNote(optionsScore, true));
        } else {
            setText(optionsTotalEl, 'No data');
            setText(optionsRawEl, 'No data');
            setText(optionsGradeEl, 'No data');
            setText(optionsHeaderScoreEl, 'No data');
            setText(optionsHeaderGradeEl, 'No data');
            setText(optionsBreakdownEl, 'No data - missing minimum fields');
            setText(optionsCapNoteEl, '');
        }

        const hasAllStructureData = globalScoreState.hasAllGlobal;
        const structureTotal = stockScore.total + stock4hScore.total + stock1hScore.total + stock15mScore.total;
        const structureText = hasAllStructureData
            ? `${structureTotal} / 80 (${globalScoreState.globalGrade})`
            : 'No data';
        const optionsText = optionsScore.hasMinimumData
            ? `${optionsScore.total} / 20 (${optionsScore.grade})`
            : 'No data';

        let decisionText = 'No data';
        if (hasAllStructureData && optionsScore.hasMinimumData) {
            if (structureTotal >= 48 && optionsScore.total >= 12) {
                decisionText = 'Tradeable on options';
            } else if (structureTotal >= 48 && optionsScore.total < 12) {
                decisionText = 'Better via shares';
            } else if (structureTotal < 48 && optionsScore.total >= 12) {
                decisionText = 'Options edge present, but structure weak';
            } else {
                decisionText = 'Skip';
            }
        }
        setText(finalDecisionEl, `Structure: ${structureText} | Options: ${optionsText} | Decision: ${decisionText}`);

        lastComputedScores = {
            spy: score,
            stock1d: stockScore,
            stock4h: stock4hScore,
            stock1h: stock1hScore,
            stock15m: stock15mScore,
            global: globalScoreState,
            options: optionsScore,
            decisionText
        };

        if (trendQualityGuardrailEl) {
            const trendQuality = getStockRadioValue('stk1d_trend_quality');
            trendQualityGuardrailEl.textContent = trendQuality === 'choppy'
                ? 'Warning: Swing options often suffer from theta in choppy markets.'
                : '';
        }
        if (pullbackGroupEl) {
            const phase = getStockRadioValue('stk1d_phase');
            const pullbackInputs = pullbackGroupEl.querySelectorAll('input[name="stk1d_pullback"]');
            const isPullbackPhase = phase === 'pullback';
            pullbackInputs.forEach((input) => {
                input.disabled = !isPullbackPhase;
            });
            if (!isPullbackPhase) {
                pullbackInputs.forEach((input) => {
                    input.checked = false;
                });
            }
            if (pullbackNaEl) {
                pullbackNaEl.textContent = isPullbackPhase ? '' : 'Pullback: N/A (Phase â‰  Pullback)';
            }
        }
        if (liquidityEventGuardrailEl) {
            const earnings = isStockChecked('stk1d_event_earnings');
            const liq = getStockRadioValue('stk1d_options_liquidity');
            liquidityEventGuardrailEl.textContent = (earnings && liq === 'poor')
                ? 'Warning: Earnings plus poor options liquidity can significantly worsen RR via spread/IV/slippage.'
                : '';
        }
        if (volGapGuardrailEl) {
            const vol = getStockRadioValue('stk1d_volatility_state');
            const gap = getStockRadioValue('stk1d_gap_risk');
            volGapGuardrailEl.textContent = (vol === 'expanding' && gap === 'high')
                ? 'Warning: Expanding volatility and high gap risk increase jump risk.'
                : '';
        }
        if (stk4hChoppyGuardrailEl) {
            const trendQuality4h = getRadioValue('stk4h_trend_quality');
            stk4hChoppyGuardrailEl.textContent = trendQuality4h === 'choppy'
                ? 'Warning: Choppy market increases theta drag and whipsaw risk.'
                : '';
        }
        if (stk4hSetupLocationGuardrailEl) {
            const setupType4h = getRadioValue('stk4h_setup_type');
            const location4h = getRadioValue('stk4h_location');
            const breakoutLike = setupType4h === 'breakout_continuation' || setupType4h === 'breakdown_continuation';
            stk4hSetupLocationGuardrailEl.textContent = (breakoutLike && location4h === 'near_resistance')
                ? 'Warning: Breakout near resistance; verify this is not a double-top.'
                : '';
        }
        if (stk1hAlignmentGuardrailEl) {
            const alignment1h = getRadioValue('stk1h_alignment_with_4h');
            stk1hAlignmentGuardrailEl.textContent = alignment1h === 'counter_trend'
                ? 'Warning: Fake-move risk; wait for 1H to realign with 4H.'
                : '';
        }
        if (stk4hVolLiqGuardrailEl) {
            const volProfile4h = getRadioValue('stk4h_volatility_profile');
            const liq4h = getRadioValue('stk4h_liquidity_check');
            stk4hVolLiqGuardrailEl.textContent = (volProfile4h === 'expanding' && liq4h === 'poor')
                ? 'Warning: Expanding volatility plus poor liquidity increases wide-spread risk.'
                : '';
        }
        if (stk4hAnchorBiasGuardrailEl) {
            const bias4h = getRadioValue('stk4h_bias');
            const anchor4h = getRadioValue('stk4h_anchor_state');
            stk4hAnchorBiasGuardrailEl.textContent = (bias4h === 'bullish' && anchor4h === 'below_anchor')
                ? 'Warning: Bullish bias with anchor below indicates momentum mismatch.'
                : '';
        }
    };

    const formatDate = (d) => {
        const pad = (n) => String(n).padStart(2, '0');
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    };

    const buildAutoName = () => {
        const ticker = (getFieldValue('stk1d_ticker') || 'TICKER').toUpperCase();
        return `${ticker} SCORING ${formatDate(new Date())}`;
    };

    const collectFormState = () => {
        const data = {};
        const fields = form.querySelectorAll('input, select, textarea');
        fields.forEach(field => {
            if (!field.name) return;
            if (field.type === 'radio') {
                if (field.checked) data[field.name] = field.value;
                return;
            }
            if (field.type === 'checkbox') {
                data[field.name] = field.checked;
                return;
            }
            data[field.name] = field.value;
        });
        return data;
    };

    const applyFormState = (data) => {
        if (!data) return;
        const fields = form.querySelectorAll('input, select, textarea');
        fields.forEach(field => {
            if (!field.name || !(field.name in data)) return;
            if (field.type === 'radio') {
                field.checked = field.value === data[field.name];
                return;
            }
            if (field.type === 'checkbox') {
                field.checked = Boolean(data[field.name]);
                return;
            }
            field.value = data[field.name] ?? '';
        });
    };

    const EMPTY_MARKERS = new Set(['', 'n/a', '---', 'unknown', 'unknown (---)', 'select status']);

    const isEmptyValue = (value) => {
        if (value === null || value === undefined) return true;
        return EMPTY_MARKERS.has(String(value).trim().toLowerCase());
    };

    const normalizeValue = (value, fallback = 'N/A') => {
        if (isEmptyValue(value)) return fallback;
        return String(value).trim();
    };

    const toMentorEnglish = (value) => {
        const text = normalizeValue(value, '');
        if (!text) return '';
        const lower = text.toLowerCase();

        if (lower.includes('uwaga: swing options')) return 'Warning: Swing options often suffer from theta in choppy markets.';
        if (lower.includes('pullback: n/a')) return 'Pullback: N/A (phase is not pullback).';
        if (lower.includes('earnings') && (lower.includes('plyn') || lower.includes('płyn'))) return 'Warning: Earnings plus poor options liquidity can significantly worsen RR via spread/IV/slippage.';
        if (lower.includes('ekspansja') && lower.includes('gap')) return 'Warning: Expanding volatility with high gap risk increases jump risk.';
        if (lower.includes('szarpany rynek')) return 'Warning: Choppy market increases theta drag and whipsaw risk.';
        if (lower.includes('near resistance') && lower.includes('podw')) return 'Warning: Breakout near resistance; verify this is not a double-top.';
        if (lower.includes('ryzyko fake move')) return 'Warning: Fake-move risk; wait for 1H to realign with 4H.';
        if (lower.includes('expanding volatility + poor liquidity')) return 'Warning: Expanding volatility plus poor liquidity increases wide-spread risk.';
        if (lower.includes('anchor below') && lower.includes('momentum mismatch')) return 'Warning: Bullish bias with anchor below indicates momentum mismatch.';

        const hasPolishChars = /[ąćęłńóśźż]/i.test(text);
        const hasPolishWords = /(uwaga|ryzyko|brak|szarpany|poczekaj|powrot|sprawdz|plynn|płynn|wzgl|zwieksz|zwiększ|szerokich|cofni)/i.test(text);
        if (hasPolishChars || hasPolishWords) return '';
        return text;
    };

    const getRadioLabel = (name, fallback = 'N/A') => {
        const el = form.querySelector(`input[name="${name}"]:checked`);
        if (!el) return fallback;
        const txt = el.closest('.checkbox-label')?.querySelector('.checkbox-text')?.textContent?.trim();
        return normalizeValue(txt || el.value || fallback, fallback);
    };

    const collectSpyFacts = () => {
        const s = lastComputedScores ? lastComputedScores.spy : null;
        return {
            score: s ? formatScore(s.total, 25) : (totalResultEl ? totalResultEl.textContent : 'No data'),
            raw: s ? formatScore(s.rawTotal, 25) : (rawEl ? rawEl.textContent : 'No data'),
            grade: normalizeValue(s ? s.interpretation : (interpretationResultEl ? interpretationResultEl.textContent : 'No data'), 'No data'),
            bias: getRadioLabel('sc_spy_bias'),
            regime: getRadioLabel('sc_spy_regime'),
            structure: getRadioLabel('sc_spy_structure'),
            vwap: getRadioLabel('sc_spy_vwap'),
            vixTrend: getRadioLabel('sc_spy_vix_trend'),
            vixLevel: getRadioLabel('sc_spy_vix_level'),
            breadth: getRadioLabel('sc_spy_breadth'),
            location: getRadioLabel('sc_spy_location'),
            room: getRadioLabel('sc_spy_room'),
            cap: toMentorEnglish((capNoteEl?.textContent || '').trim()),
            guardrails: [
                trendQualityGuardrailEl?.textContent?.trim() || '',
                liquidityEventGuardrailEl?.textContent?.trim() || '',
                volGapGuardrailEl?.textContent?.trim() || ''
            ].map((v) => toMentorEnglish(v)).filter(Boolean)
        };
    };

    const collectStockFacts = () => {
        const scores = lastComputedScores || {};
        const globalState = scores.global || {};
        const optionsState = scores.options || {};
        const globalScoreText = globalState.hasAllGlobal ? formatScore(globalState.globalTotal, 80) : `No data${globalState.missing && globalState.missing.length ? ` (need ${globalState.missing.join(' + ')})` : ''}`;
        const optionsScoreText = optionsState.hasMinimumData ? formatScore(optionsState.total, 20) : 'No data';
        return {
            ticker: normalizeValue((getFieldValue('stk1d_ticker') || '').toUpperCase()),
            globalScore: globalScoreText,
            globalGrade: normalizeValue(globalState.globalGrade || (stockGlobalGradeEl ? stockGlobalGradeEl.textContent : 'No data'), 'No data'),
            stock1dScore: scores.stock1d && scores.stock1d.hasMinimumData ? formatScore(scores.stock1d.total, 20) : 'No data',
            stock4hScore: scores.stock4h && scores.stock4h.hasMinimumData ? formatScore(scores.stock4h.total, 20) : 'No data',
            stock1hScore: scores.stock1h && scores.stock1h.hasMinimumData ? formatScore(scores.stock1h.total, 20) : 'No data',
            stock15mScore: scores.stock15m && scores.stock15m.hasMinimumData ? formatScore(scores.stock15m.total, 20) : 'No data',
            optionsScore: optionsScoreText,
            optionsGrade: normalizeValue(optionsState.hasMinimumData ? optionsState.grade : 'No data', 'No data'),
            finalDecision: normalizeValue(finalDecisionEl ? finalDecisionEl.textContent : 'Decision: No data', 'No data'),
            minFlags: {
                stock1d: Boolean(scores.stock1d && scores.stock1d.hasMinimumData),
                stock4h: Boolean(scores.stock4h && scores.stock4h.hasMinimumData),
                stock1h: Boolean(scores.stock1h && scores.stock1h.hasMinimumData),
                stock15m: Boolean(scores.stock15m && scores.stock15m.hasMinimumData)
            },
            setupStatus: normalizeValue(getFieldValue('setup_status')),
            entryPlan: normalizeValue(getFieldValue('entry_plan')),
            stopLoss: normalizeValue(getFieldValue('stop_loss')),
            tp1: normalizeValue(getFieldValue('tp1')),
            tp2: normalizeValue(getFieldValue('tp2')),
            mustHappen: normalizeValue(getFieldValue('must_happen')),
            d1: {
                bias: getRadioLabel('stk1d_bias'),
                structure: getRadioLabel('stk1d_structure'),
                sma200: getRadioLabel('stk1d_sma200'),
                anchor: getRadioLabel('stk1d_trend_anchor'),
                spyAlignment: getRadioLabel('stk1d_spy_alignment'),
                relative: getRadioLabel('stk1d_relative_vs_spy')
            },
            h4: {
                setupType: getRadioLabel('stk4h_setup_type'),
                location: getRadioLabel('stk4h_location'),
                invalidation: getRadioLabel('stk4h_invalidation_logic'),
                anchor: getRadioLabel('stk4h_anchor_state'),
                bias: getRadioLabel('stk4h_bias')
            },
            h1: {
                structure: getRadioLabel('stk1h_structure'),
                rangeState: getRadioLabel('stk1h_range_state'),
                alignment4h: getRadioLabel('stk1h_alignment_with_4h')
            },
            m15: {
                triggerType: getRadioLabel('m15_trigger_type'),
                triggerConfirmed: getRadioLabel('m15_trigger_confirmed'),
                entryQuality: getRadioLabel('m15_entry_quality'),
                timing: getRadioLabel('m15_session_timing')
            },
            caps: [
                (stockCapNoteEl?.textContent || '').trim(),
                (stock4hCapNoteEl?.textContent || '').trim(),
                (stock1hCapNoteEl?.textContent || '').trim(),
                (stock15mCapNoteEl?.textContent || '').trim(),
                (optionsCapNoteEl?.textContent || '').trim(),
                (stockGlobalCapNoteEl?.textContent || '').trim()
            ].map((v) => toMentorEnglish(v)).filter(Boolean),
            guardrails: [
                stk4hChoppyGuardrailEl?.textContent?.trim() || '',
                stk4hSetupLocationGuardrailEl?.textContent?.trim() || '',
                stk1hAlignmentGuardrailEl?.textContent?.trim() || '',
                stk4hVolLiqGuardrailEl?.textContent?.trim() || '',
                stk4hAnchorBiasGuardrailEl?.textContent?.trim() || '',
                trendQualityGuardrailEl?.textContent?.trim() || '',
                liquidityEventGuardrailEl?.textContent?.trim() || '',
                volGapGuardrailEl?.textContent?.trim() || ''
            ].map((v) => toMentorEnglish(v)).filter(Boolean)
        };
    };

    const pickTop = (items, max) => items.filter(Boolean).slice(0, max);
    const asLc = (value) => normalizeValue(value, '').toLowerCase();

    const deriveSpyInsights = (facts) => {
        const drivers = pickTop([
            (facts.bias === 'Bullish' && facts.structure === 'HH/HL' && facts.vwap === 'Above') ? 'Directional stack is aligned for upside continuation.' : '',
            (facts.bias === 'Bearish' && facts.structure === 'LL/LH' && facts.vwap === 'Below') ? 'Directional stack is aligned for downside continuation.' : '',
            (facts.vixTrend === 'Falling' && (facts.vixLevel === '<20' || facts.vixLevel === '20-25')) ? 'Volatility backdrop is supportive (VIX not expanding).' : '',
            facts.breadth === 'Strong' ? 'Breadth confirms market participation.' : '',
            facts.room === 'Large' ? 'There is enough room to move before key barriers.' : ''
        ], 3);

        const risks = pickTop([
            facts.cap,
            facts.vixLevel === '>25' ? 'VIX is elevated (>25), follow-through quality may degrade.' : '',
            facts.regime === 'Volatile/Distribution' ? 'Regime is unstable; higher chance of failed moves.' : '',
            (facts.room === 'Limited' || facts.room === 'None') ? 'Limited room-to-move compresses reward/risk quickly.' : '',
            ...facts.guardrails
        ], 2);

        const conflicts = pickTop([
            (facts.bias === 'Bullish' && facts.vixTrend === 'Rising') ? 'Bullish bias conflicts with rising VIX.' : '',
            (facts.bias === 'Bearish' && facts.vixTrend === 'Falling') ? 'Bearish bias conflicts with falling VIX.' : '',
            (facts.structure === 'Mixed' && facts.location === 'Mid-range') ? 'Mixed structure in mid-range lowers directional clarity.' : ''
        ], 1);

        return { drivers, risks, conflicts };
    };

    const deriveStockInsights = (facts) => {
        const d1Align = asLc(facts.d1.spyAlignment);
        const d1Relative = asLc(facts.d1.relative);
        const setupType = asLc(facts.h4.setupType);
        const h1Align = asLc(facts.h1.alignment4h);
        const m15Confirmed = asLc(facts.m15.triggerConfirmed);
        const optionsGrade = asLc(facts.optionsGrade);
        const h4Bias = asLc(facts.h4.bias);
        const h4Anchor = asLc(facts.h4.anchor);
        const h4Location = asLc(facts.h4.location);

        const drivers = pickTop([
            (d1Align === 'aligned' && d1Relative === 'strength') ? '1D has market alignment with relative strength.' : '',
            (setupType === 'breakout continuation' || setupType === 'breakdown continuation') ? '4H setup is continuation-friendly.' : '',
            h1Align === 'aligned' ? '1H is aligned with 4H directional plan.' : '',
            m15Confirmed === 'yes' ? '15m trigger is confirmed, improving execution quality.' : '',
            (optionsGrade.startsWith('a ') || optionsGrade.startsWith('b ')) ? 'Options layer is supportive for structure.' : ''
        ], 3);

        const risks = pickTop([
            ...facts.caps,
            ...facts.guardrails,
            optionsGrade === 'avoid options' ? 'Options layer currently says avoid options.' : ''
        ], 2);

        const conflicts = pickTop([
            (h4Bias === 'bullish' && h4Anchor === 'below anchor') ? 'Bullish 4H bias conflicts with anchor below.' : '',
            (setupType === 'breakout continuation' && h4Location === 'near resistance') ? 'Breakout setup is too close to resistance.' : '',
            h1Align === 'counter-trend' ? '1H is counter-trend to 4H.' : ''
        ], 1);

        return { drivers, risks, conflicts };
    };

    const determineStockMentorDecision = (facts, insights) => {
        if (!isEmptyValue(facts.setupStatus) && facts.setupStatus !== 'N/A') return facts.setupStatus;

        const grade = asLc(facts.globalGrade);
        const triggerConfirmed = asLc(facts.m15.triggerConfirmed) === 'yes';
        const allRiskText = [...facts.caps, ...facts.guardrails].join(' | ').toLowerCase();
        const hasHardCap = [
            'poor liquidity',
            'earnings',
            'opposite',
            'counter-trend',
            'trigger not confirmed',
            'wide spread',
            'cap 10',
            'cap 12'
        ].some((k) => allRiskText.includes(k));
        const hasConflict = insights.conflicts.length > 0;

        if ((grade.startsWith('a ') || grade.startsWith('b ')) && triggerConfirmed && !hasHardCap && !hasConflict) return 'Valid';
        if (!triggerConfirmed) return 'Needs trigger';
        if (grade === 'no data') return 'No data';
        if (grade.startsWith('c ') || grade === 'pass' || hasHardCap || hasConflict) return 'Observation-only';
        return 'wait';
    };

    const buildSpyMentorReport = () => {
        const facts = collectSpyFacts();
        const insights = deriveSpyInsights(facts);
        const minSpyData = !isEmptyValue(facts.bias) && !isEmptyValue(facts.structure) && !isEmptyValue(facts.regime);
        if (!minSpyData) {
            return [
                'DAY CONTEXT (SPY)',
                'No data - fill Bias, Structure and Regime first.'
            ].join('\n');
        }

        const gradeLc = asLc(facts.grade);
        let decision = 'No data';
        if ((gradeLc.includes('strongly favorable') || gradeLc.includes('favorable')) && !facts.cap && insights.conflicts.length === 0 && !gradeLc.includes('selective')) {
            decision = 'trade allowed';
        } else if (
            gradeLc.includes('favorable with caution') ||
            gradeLc.includes('selective') ||
            gradeLc.includes('reduced size') ||
            gradeLc.includes('observation') ||
            !!facts.cap
        ) {
            decision = 'observation-only';
        } else if (insights.conflicts.length > 0 || gradeLc.includes('unfavorable') || gradeLc.includes('wait')) {
            decision = 'wait';
        }

        return [
            'DAY CONTEXT (SPY)',
            `SPY Gatekeeper: TOTAL ${facts.score} (RAW ${facts.raw}), Grade: ${facts.grade}`,
            `Snapshot: Bias ${facts.bias} | Regime ${facts.regime} | Structure ${facts.structure} | VWAP ${facts.vwap}`,
            `Vol/Breadth: VIX ${facts.vixTrend} (${facts.vixLevel}) | Breadth ${facts.breadth} | Location ${facts.location} | Room ${facts.room}`,
            `CAPS: ${facts.cap || 'None'}`,
            `Top reasons: ${insights.drivers.length ? insights.drivers.join(' | ') : 'No strong confluence yet.'}`,
            `Top risks: ${insights.risks.length ? insights.risks.join(' | ') : 'No major risk flags.'}`,
            `Key conflict: ${insights.conflicts.length ? insights.conflicts[0] : 'No major conflict.'}`,
            `Decision: ${decision}`
        ].join('\n');
    };

    const buildStockMentorReport = () => {
        const facts = collectStockFacts();
        const insights = deriveStockInsights(facts);
        const stockDecision = determineStockMentorDecision(facts, insights);
        const missingBuckets = [];
        if (!facts.minFlags.stock1d) missingBuckets.push('1D');
        if (!facts.minFlags.stock4h) missingBuckets.push('4H');
        if (!facts.minFlags.stock1h) missingBuckets.push('1H');
        if (!facts.minFlags.stock15m) missingBuckets.push('15m');
        const minStockData = !isEmptyValue(facts.ticker) && missingBuckets.length === 0;
        if (!minStockData) {
            return [
                'STOCK MENTOR REPORT',
                `No data - fill Ticker and complete minimum fields for: ${missingBuckets.length ? missingBuckets.join(', ') : '1D, 4H, 1H, 15m'}.`
            ].join('\n');
        }

        const marketAlignedLine = asLc(facts.d1.spyAlignment) === 'aligned'
            ? 'Yes (1D aligned with SPY)'
            : `No (${facts.d1.spyAlignment})`;
        const thesisLine = insights.drivers.length
            ? insights.drivers[0]
            : 'No clear thesis - confluence not strong enough.';
        const capsLine = pickTop(facts.caps, 3);

        return [
            `SETUP: TICKER ${facts.ticker} | Timestamp: ${new Date().toISOString()}`,
            `STATUS: ${stockDecision}`,
            '',
            'DIRECTION & CONTEXT (1D)',
            `Bias ${facts.d1.bias} | Structure ${facts.d1.structure} | 200SMA ${facts.d1.sma200} | Anchor ${facts.d1.anchor}`,
            `SPY alignment ${facts.d1.spyAlignment} | Relative vs SPY ${facts.d1.relative}`,
            `MARKET ALIGNED?: ${marketAlignedLine}`,
            `THESIS: ${thesisLine}`,
            '',
            'STRUCTURE & PLANNING (4H / 1H)',
            `4H: ${facts.h4.setupType}, ${facts.h4.location}, invalidation: ${facts.h4.invalidation}`,
            `1H: ${facts.h1.structure}, ${facts.h1.rangeState}, ${facts.h1.alignment4h}`,
            '',
            'EXECUTION & TIMING (15m)',
            `Trigger: ${facts.m15.triggerType} | Confirmed: ${facts.m15.triggerConfirmed} | Entry quality: ${facts.m15.entryQuality} | Timing: ${facts.m15.timing}`,
            '',
            `SCORES: Global ${facts.globalScore} (${facts.globalGrade}) | 1D ${facts.stock1dScore} | 4H ${facts.stock4hScore} | 1H ${facts.stock1hScore} | 15m ${facts.stock15mScore} | Options ${facts.optionsScore} (${facts.optionsGrade})`,
            `CAPS: ${capsLine.length ? capsLine.join(' | ') : 'None'}`,
            `TOP 3 REASONS: ${insights.drivers.length ? insights.drivers.join(' | ') : 'No strong confluence yet.'}`,
            `TOP 2 RISKS: ${insights.risks.length ? insights.risks.join(' | ') : 'No major risk flags.'}`,
            `KEY CONFLICT: ${insights.conflicts.length ? insights.conflicts[0] : 'No major conflict.'}`,
            '',
            'PLAN',
            `Entry: ${facts.entryPlan}`,
            `Stop: ${facts.stopLoss}`,
            `TP1: ${facts.tp1} | TP2: ${facts.tp2}`,
            `Must happen: ${facts.mustHappen}`,
            `Decision line: ${facts.finalDecision}`
        ].join('\n');
    };

    const buildMentorReport = () => {
        renderScore();
        const spy = buildSpyMentorReport();
        const stock = buildStockMentorReport();
        return [
            '========================================',
            'MENTOR REPORT',
            '========================================',
            '',
            spy,
            '',
            '----------------------------------------',
            '',
            stock,
            ''
        ].join('\n');
    };

    const readList = () => {
        const raw = localStorage.getItem(storageListKey);
        if (!raw) return [];
        try {
            const parsed = JSON.parse(raw);
            return Array.isArray(parsed) ? parsed : [];
        } catch (_) {
            return [];
        }
    };

    const writeList = (entries) => {
        localStorage.setItem(storageListKey, JSON.stringify(entries));
    };

    const sortEntries = (entries) => {
        const sortBy = sortSelect ? sortSelect.value : 'updated_desc';
        const copy = [...entries];
        const byName = (a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
        const byDate = (key, dir) => (a, b) => {
            const aVal = a[key] || '';
            const bVal = b[key] || '';
            return dir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
        };
        switch (sortBy) {
            case 'updated_asc':
                return copy.sort(byDate('updatedAt', 'asc'));
            case 'created_desc':
                return copy.sort(byDate('createdAt', 'desc'));
            case 'created_asc':
                return copy.sort(byDate('createdAt', 'asc'));
            case 'name_desc':
                return copy.sort((a, b) => byName(b, a));
            case 'name_asc':
                return copy.sort(byName);
            case 'updated_desc':
            default:
                return copy.sort(byDate('updatedAt', 'desc'));
        }
    };

    const refreshList = () => {
        if (!listSelect) return;
        const entries = sortEntries(readList());
        listSelect.innerHTML = '<option value="">Select saved analysis</option>';
        entries.forEach(entry => {
            const option = document.createElement('option');
            option.value = entry.id;
            option.textContent = entry.name;
            listSelect.appendChild(option);
        });
    };

    const findEntry = (id) => {
        const entries = readList();
        return entries.find(entry => entry.id === id);
    };

    bindMutualExclusiveGroup(['sc_spy_behavior_expansion_up', 'sc_spy_behavior_expansion_down']);
    bindVolumeValidation();
    bindRateValidation();
    if (spyChatButtonEl) {
        spyChatButtonEl.addEventListener('click', runSpyChatAnalysis);
    }
    if (spyChatCopyButtonEl) {
        spyChatCopyButtonEl.addEventListener('click', async () => {
            if (!generatedSpyPrompt.trim()) {
                runSpyChatAnalysis();
            }
            const text = generatedSpyPrompt.trim();
            if (!text) return;
            try {
                await navigator.clipboard.writeText(text);
                spyChatCopyButtonEl.textContent = 'Copied';
                setTimeout(() => {
                    spyChatCopyButtonEl.textContent = 'Copy Prompt';
                }, 1200);
            } catch (_) {
                spyChatCopyButtonEl.textContent = 'Copy failed';
                setTimeout(() => {
                    spyChatCopyButtonEl.textContent = 'Copy Prompt';
                }, 1200);
            }
        });
    }
    if (spyChatApplyButtonEl && spyChatResponseInputEl) {
        spyChatApplyButtonEl.addEventListener('click', () => {
            const suggestions = extractSuggestionsFromResponse(spyChatResponseInputEl.value);
            if (!suggestions) {
                const originalLabel = spyChatApplyButtonEl.textContent || 'Apply Suggestions';
                spyChatApplyButtonEl.textContent = 'Invalid JSON';
                setTimeout(() => {
                    spyChatApplyButtonEl.textContent = originalLabel;
                }, 1200);
                return;
            }
            applyChatHints(suggestions, 'spy-ai-hint');
            const originalLabel = spyChatApplyButtonEl.textContent || 'Apply Suggestions';
            spyChatApplyButtonEl.textContent = 'Applied';
            setTimeout(() => {
                spyChatApplyButtonEl.textContent = originalLabel;
            }, 1200);
        });
    }
    if (stockChatCopyButtonEl) {
        stockChatCopyButtonEl.addEventListener('click', async () => {
            const text = buildStockChatPrompt().trim();
            if (!text) return;
            try {
                await navigator.clipboard.writeText(text);
                stockChatCopyButtonEl.textContent = 'Copied';
                setTimeout(() => {
                    stockChatCopyButtonEl.textContent = 'Copy Prompt (SPY + Stock)';
                }, 1200);
            } catch (_) {
                stockChatCopyButtonEl.textContent = 'Copy failed';
                setTimeout(() => {
                    stockChatCopyButtonEl.textContent = 'Copy Prompt (SPY + Stock)';
                }, 1200);
            }
        });
    }
    if (stockChatApplyButtonEl && stockChatResponseInputEl) {
        stockChatApplyButtonEl.addEventListener('click', () => {
            const combined = extractCombinedSuggestionsFromResponse(stockChatResponseInputEl.value);
            if (!combined) {
                const originalLabel = stockChatApplyButtonEl.textContent || 'Apply Suggestions';
                stockChatApplyButtonEl.textContent = 'Invalid JSON';
                setTimeout(() => {
                    stockChatApplyButtonEl.textContent = originalLabel;
                }, 1200);
                return;
            }
            if (combined.stock) applyChatHints(combined.stock, 'stock-ai-hint');
            if (combined.spy) applyChatHints(combined.spy, 'spy-ai-hint');
            const originalLabel = stockChatApplyButtonEl.textContent || 'Apply Suggestions';
            stockChatApplyButtonEl.textContent = 'Applied';
            setTimeout(() => {
                stockChatApplyButtonEl.textContent = originalLabel;
            }, 1200);
        });
    }
    if (generateMentorReportBtn && mentorReportOutputEl) {
        generateMentorReportBtn.addEventListener('click', () => {
            renderScore();
            mentorReportOutputEl.value = buildMentorReport();
        });
    }
    if (copyMentorReportBtn && mentorReportOutputEl) {
        copyMentorReportBtn.addEventListener('click', async () => {
            renderScore();
            if (!mentorReportOutputEl.value.trim()) {
                mentorReportOutputEl.value = buildMentorReport();
            }
            try {
                await navigator.clipboard.writeText(mentorReportOutputEl.value);
                copyMentorReportBtn.textContent = 'Copied';
                setTimeout(() => {
                    copyMentorReportBtn.textContent = 'Copy Mentor Report';
                }, 1200);
            } catch (_) {
                alert('Copy failed. Please copy manually.');
            }
        });
    }
    if (clearReportBtn) {
        clearReportBtn.addEventListener('click', () => {
            if (mentorReportOutputEl) mentorReportOutputEl.value = '';
        });
    }
    if (saveBtn) {
        saveBtn.addEventListener('click', () => {
            let name = nameInput ? nameInput.value.trim() : '';
            if (!name) {
                name = buildAutoName();
                if (nameInput) nameInput.value = name;
            }
            const payload = collectFormState();
            const entries = readList();
            const existing = entries.find(entry => entry.name.toLowerCase() === name.toLowerCase());
            if (existing) {
                if (!confirm('Analysis name exists. Overwrite?')) return;
                existing.data = payload;
                existing.updatedAt = new Date().toISOString();
            } else {
                entries.unshift({
                    id: `scoring_${Date.now()}`,
                    name,
                    data: payload,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                });
            }
            writeList(entries);
            localStorage.setItem(storageKey, JSON.stringify(payload));
            refreshList();
            saveBtn.textContent = 'Saved';
            setTimeout(() => {
                saveBtn.textContent = 'Save Analysis';
            }, 1200);
        });
    }
    if (loadBtn) {
        loadBtn.addEventListener('click', () => {
            const selected = listSelect ? listSelect.value : '';
            if (!selected) {
                alert('Select an analysis from the list.');
                return;
            }
            const entry = findEntry(selected);
            if (!entry) {
                alert('Saved analysis not found.');
                return;
            }
            applyFormState(entry.data);
            renderScore();
            if (nameInput) nameInput.value = entry.name;
        });
    }
    if (deleteBtn) {
        deleteBtn.addEventListener('click', () => {
            const selected = listSelect ? listSelect.value : '';
            if (!selected) {
                alert('Select an analysis to delete.');
                return;
            }
            if (!confirm('Delete selected analysis?')) return;
            const entries = readList().filter(entry => entry.id !== selected);
            writeList(entries);
            refreshList();
        });
    }
    if (sortSelect) {
        sortSelect.addEventListener('change', refreshList);
    }
    form.addEventListener('change', renderScore);
    form.addEventListener('input', renderScore);
    form.addEventListener('reset', () => {
        setTimeout(() => {
            renderScore();
            if (mentorReportOutputEl) mentorReportOutputEl.value = '';
        }, 0);
    });
    refreshList();
    renderScore();
}





