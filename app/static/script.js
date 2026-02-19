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
    const roomAutoEl = document.getElementById('score-room-auto');
    const roomEffectiveEl = document.getElementById('score-room-effective');
    const manualCloseEl = form.querySelector('input[name="score_spy_manual_close"]');
    const manualAtrEl = form.querySelector('input[name="score_spy_manual_atr"]');
    const keySupportEl = form.querySelector('input[name="score_spy_key_support"]');
    const keyResistanceEl = form.querySelector('input[name="score_spy_key_resistance"]');
    const spySwingHighEl = form.querySelector('input[name="score_spy_swing_high"]');
    const spySwingLowEl = form.querySelector('input[name="score_spy_swing_low"]');
    const spySma200El = form.querySelector('input[name="score_spy_sma200"]');
    const spyPwhEl = form.querySelector('input[name="score_spy_pwh"]');
    const spyPwlEl = form.querySelector('input[name="score_spy_pwl"]');
    const spyDch20El = form.querySelector('input[name="score_spy_dch20"]');
    const spyDcl20El = form.querySelector('input[name="score_spy_dcl20"]');
    const spyDch55El = form.querySelector('input[name="score_spy_dch55"]');
    const spyDcl55El = form.querySelector('input[name="score_spy_dcl55"]');
    const spyRoomBarrierChoiceEl = form.querySelector('select[name="score_spy_room_barrier_choice"]');
    const spyRoomNoiseAtrEl = form.querySelector('input[name="score_spy_room_noise_atr"]');
    const spyRoomMinAtrEl = form.querySelector('input[name="score_spy_room_min_atr"]');
    const roomInputs = Array.from(form.querySelectorAll('input[name="score_spy_room_to_move"]'));
    const stk1dPermissionEl = document.getElementById('score-stk1d-permission');
    const stk1dScoreHeadEl = document.getElementById('score-stk1d-score-head');
    const stk1dPermissionHeadEl = document.getElementById('score-stk1d-permission-head');
    const stk1dInvalidationEl = document.getElementById('score-stk1d-invalidation');
    const stk1dRoomAutoEl = document.getElementById('score-stk1d-room-auto');
    const stk1dRoomEffectiveEl = document.getElementById('score-stk1d-room-effective');
    const stk1dBiasAutoEl = document.getElementById('score-stk1d-bias-auto');
    const stk1dCloseEl = form.querySelector('input[name="score_stk1d_close"]');
    const stk1dAtrEl = form.querySelector('input[name="score_stk1d_atr"]');
    const stk1dSupportEl = form.querySelector('input[name="score_stk1d_support"]');
    const stk1dResistanceEl = form.querySelector('input[name="score_stk1d_resistance"]');
    const stk1dSwingHighEl = form.querySelector('input[name="score_stk1d_swing_high"]');
    const stk1dSwingLowEl = form.querySelector('input[name="score_stk1d_swing_low"]');
    const stk1dSma200El = form.querySelector('input[name="score_stk1d_sma200"]');
    const stk1dPwhEl = form.querySelector('input[name="score_stk1d_pwh"]');
    const stk1dPwlEl = form.querySelector('input[name="score_stk1d_pwl"]');
    const stk1dDch20El = form.querySelector('input[name="score_stk1d_dch20"]');
    const stk1dDcl20El = form.querySelector('input[name="score_stk1d_dcl20"]');
    const stk1dRoomBarrierChoiceEl = form.querySelector('select[name="score_stk1d_room_barrier_choice"]');
    const stk1dRoomNoiseAtrEl = form.querySelector('input[name="score_stk1d_room_noise_atr"]');
    const stk1dRoomMinAtrEl = form.querySelector('input[name="score_stk1d_room_min_atr"]');
    const stk1dBiasOverrideEl = form.querySelector('input[name="score_stk1d_bias_manual_override"]');
    const stk1dBiasInputs = Array.from(form.querySelectorAll('input[name="score_stk1d_bias"]'));
    const stk1dRoomInputs = Array.from(form.querySelectorAll('input[name="score_stk1d_room_to_move"]'));
    const stk4hScoreHeadEl = document.getElementById('score-stk4h-score-head');
    const stk4hGradeHeadEl = document.getElementById('score-stk4h-grade-head');
    const stk4hStatusHeadEl = document.getElementById('score-stk4h-status-head');
    const stk4hRrEl = document.getElementById('score-stk4h-rr');
    const stk4hRoomEl = document.getElementById('score-stk4h-room');
    const stk4hPlanDirectionEl = document.getElementById('score-stk4h-plan-direction');
    const stk4hPlanSourceEl = document.getElementById('score-stk4h-plan-source');
    const stk4hBreakdownEl = document.getElementById('score-stk4h-breakdown');
    const stk4hStatusEl = document.getElementById('score-stk4h-status');
    const stk15mScoreHeadEl = document.getElementById('score-stk15m-score-head');
    const stk15mGradeHeadEl = document.getElementById('score-stk15m-grade-head');
    const stk15mStatusHeadEl = document.getElementById('score-stk15m-status-head');
    const stk15mStatusEl = document.getElementById('score-stk15m-status');
    const stk15mRrEl = document.getElementById('score-stk15m-rr');
    const stk15mBreakdownEl = document.getElementById('score-stk15m-breakdown');
    const decisionOverallHeadEl = document.getElementById('score-decision-overall-head');
    const decisionTextEl = document.getElementById('score-decision-text');
    const decisionChecklistBodyEl = document.getElementById('score-decision-checklist-body');
    const stk4hPlanOverrideEl = form.querySelector('input[name="score_stk4h_plan_manual_override"]');
    const stk4hSetupTypeInputs = Array.from(form.querySelectorAll('input[name="score_stk4h_setup_type"]'));
    const stk4hConfirmationInputs = Array.from(form.querySelectorAll('input[name="score_stk4h_confirmation"]'));
    const stk4hInvalidationInputs = Array.from(form.querySelectorAll('input[name="score_stk4h_invalidation_logic"]'));
    const stk4hEntryEl = form.querySelector('input[name="score_stk4h_entry"]');
    const stk4hStopEl = form.querySelector('input[name="score_stk4h_stop"]');
    const stk4hTargetEl = form.querySelector('input[name="score_stk4h_target"]');
    let latestComputed = null;
    let latestWarnings = [];
    let patternStatsCache = null;

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

    const computeAutoBiasFromState = (regime, structure, trendStrength, momentumCondition) => {
        // Keep parity with TradingView logic (SPY/stock1D Pine):
        // Bullish only for HH/HL + Above key MAs,
        // Bearish only for LL/LH + Below key MAs,
        // otherwise Neutral.
        if (structure === 'hh_hl' && trendStrength === 'above_key_mas') return 'bullish';
        if (structure === 'll_lh' && trendStrength === 'below_key_mas') return 'bearish';
        return 'neutral';
    };

    const computeAutoBias = (values) => computeAutoBiasFromState(
        values.regime,
        values.structure,
        values.trendStrength,
        values.momentumCondition
    );

    const updateBiasOverrideUI = () => {
        const manual = Boolean(biasOverrideEl && biasOverrideEl.checked);
        biasInputs.forEach((input) => {
            input.disabled = !manual;
        });
    };

    const updateStockBiasOverrideUI = () => {
        const manual = Boolean(stk1dBiasOverrideEl && stk1dBiasOverrideEl.checked);
        stk1dBiasInputs.forEach((input) => {
            input.disabled = !manual;
        });
    };

    const updateRoomAtrLocks = () => {
        const spyManual = Boolean(biasOverrideEl && biasOverrideEl.checked);
        if (spyRoomNoiseAtrEl) spyRoomNoiseAtrEl.disabled = !spyManual;
        if (spyRoomMinAtrEl) spyRoomMinAtrEl.disabled = !spyManual;

        const stk1dManual = Boolean(stk1dBiasOverrideEl && stk1dBiasOverrideEl.checked);
        if (stk1dRoomNoiseAtrEl) stk1dRoomNoiseAtrEl.disabled = !stk1dManual;
        if (stk1dRoomMinAtrEl) stk1dRoomMinAtrEl.disabled = !stk1dManual;
    };

    const updateRoomOverrideUI = () => {
        const manual = Boolean(biasOverrideEl && biasOverrideEl.checked);
        roomInputs.forEach((input) => {
            input.disabled = !manual;
        });
    };

    const updateStockRoomOverrideUI = () => {
        const manual = Boolean(stk1dBiasOverrideEl && stk1dBiasOverrideEl.checked);
        stk1dRoomInputs.forEach((input) => {
            input.disabled = !manual;
        });
    };

    const updateStock4HPlanOverrideUI = () => {
        const manual = Boolean(stk4hPlanOverrideEl && stk4hPlanOverrideEl.checked);
        stk4hSetupTypeInputs.forEach((el) => { el.disabled = !manual; });
        stk4hConfirmationInputs.forEach((el) => { el.disabled = !manual; });
        stk4hInvalidationInputs.forEach((el) => { el.disabled = !manual; });
        if (stk4hEntryEl) stk4hEntryEl.disabled = !manual;
        if (stk4hStopEl) stk4hStopEl.disabled = !manual;
        if (stk4hTargetEl) stk4hTargetEl.disabled = !manual;
    };

    const getChoiceValue = (name) => {
        const select = form.querySelector(`select[name="${name}"]`);
        if (select) return select.value || '';
        const checked = form.querySelector(`input[name="${name}"]:checked`);
        return checked ? checked.value : '';
    };

    const setChoiceValue = (name, value) => {
        if (!value) return;
        const select = form.querySelector(`select[name="${name}"]`);
        if (select) {
            select.value = value;
            return;
        }
        const radio = form.querySelector(`input[name="${name}"][value="${value}"]`);
        if (radio) radio.checked = true;
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

        const parseNumericToken = (tokenRaw) => {
            if (!tokenRaw) return null;
            let token = String(tokenRaw).trim().replace(/\s+/g, '');
            if (!token) return null;
            token = token.replace(/[^0-9,.\-]/g, '');
            if (!token) return null;

            const lastComma = token.lastIndexOf(',');
            const lastDot = token.lastIndexOf('.');
            if (lastComma >= 0 && lastDot >= 0) {
                if (lastComma > lastDot) {
                    token = token.replace(/\./g, '');
                    token = token.replace(',', '.');
                } else {
                    token = token.replace(/,/g, '');
                }
            } else if (lastComma >= 0) {
                token = token.replace(',', '.');
            }

            const n = Number(token);
            return Number.isFinite(n) ? n : null;
        };

        const rangeMatch = text.match(/(-?[\d.,]+)\s*[-:]\s*(-?[\d.,]+)/);
        if (rangeMatch) {
            const a = parseNumericToken(rangeMatch[1]);
            const b = parseNumericToken(rangeMatch[2]);
            if (Number.isFinite(a) && Number.isFinite(b)) return (a + b) / 2;
        }

        const numMatch = text.match(/-?[\d.,]+/);
        if (!numMatch) return null;
        return parseNumericToken(numMatch[0]);
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

    const buildSpyBarrierMapFromRaw = (raw) => ({
        swingHigh: parseLevel(raw.swingHigh),
        swingLow: parseLevel(raw.swingLow),
        rangeHigh: parseLevel(raw.rangeHigh),
        rangeLow: parseLevel(raw.rangeLow),
        pwh: parseLevel(raw.pwh),
        pwl: parseLevel(raw.pwl),
        dch20: parseLevel(raw.dch20),
        dcl20: parseLevel(raw.dcl20),
        dch55: parseLevel(raw.dch55),
        dcl55: parseLevel(raw.dcl55),
        sma200: parseLevel(raw.sma200),
        supportLegacy: parseLevel(raw.supportLegacy),
        resistanceLegacy: parseLevel(raw.resistanceLegacy)
    });

    const buildStock1DBarrierMapFromRaw = (raw) => ({
        swingHigh: parseLevel(raw.swingHigh),
        swingLow: parseLevel(raw.swingLow),
        rangeHigh: parseLevel(raw.rangeHigh),
        rangeLow: parseLevel(raw.rangeLow),
        pwh: parseLevel(raw.pwh),
        pwl: parseLevel(raw.pwl),
        dch20: parseLevel(raw.dch20),
        dcl20: parseLevel(raw.dcl20),
        sma200: parseLevel(raw.sma200),
        supportLegacy: parseLevel(raw.supportLegacy),
        resistanceLegacy: parseLevel(raw.resistanceLegacy)
    });

    const computeDirectionalRoomFromBarrierMap = ({
        bias,
        closeRaw,
        atrRaw,
        barrierMap,
        barrierChoiceRaw,
        noiseAtrRaw,
        roomMinAtrRaw,
        regimeRaw,
        setupTypeRaw,
        mode,
        sidesModeRaw
    }) => {
        const closeVal = parseLevel(closeRaw);
        const atrVal = parseLevel(atrRaw);
        if (!Number.isFinite(closeVal) || !Number.isFinite(atrVal) || atrVal <= 0) {
            return {
                room: null,
                distanceAtr: null,
                reason: 'missing_close_or_atr',
                label: '',
                skippedNoise: 0,
                skippedTooClose: 0,
                forcedLimited: false,
                levelsSource: 'unknown'
            };
        }

        const isBull = bias === 'bullish';
        const isBear = bias === 'bearish';
        const regime = String(regimeRaw || '');
        const setupType = String(setupTypeRaw || '');
        const sidesMode = String(sidesModeRaw || 'auto');
        const useBothSides = sidesMode !== 'single' && (regime === 'range' || (!isBull && !isBear));
        const noiseAtr = Number.isFinite(parseLevel(noiseAtrRaw)) ? Math.max(0, parseLevel(noiseAtrRaw)) : 0.3;
        const roomMinAtr = Number.isFinite(parseLevel(roomMinAtrRaw)) ? Math.max(0, parseLevel(roomMinAtrRaw)) : (mode === 'spy' ? 0.8 : 0.6);
        const barrierChoice = String(barrierChoiceRaw || 'auto');
        const candidates = [];
        const push = (key, label, value, quality) => {
            if (!Number.isFinite(value)) return;
            if (isBull && value <= closeVal) return;
            if (isBear && value >= closeVal) return;
            if (candidates.some((x) => x.key === key || Math.abs(x.value - value) < 1e-8)) return;
            candidates.push({ key, label, value, quality });
        };

        const hasModern = [
            barrierMap.swingHigh, barrierMap.swingLow, barrierMap.pwh, barrierMap.pwl,
            barrierMap.dch20, barrierMap.dcl20, barrierMap.dch55, barrierMap.dcl55, barrierMap.sma200
        ].some(Number.isFinite);

        if (useBothSides) {
            const hasRangeEdges = Number.isFinite(barrierMap.rangeHigh) && Number.isFinite(barrierMap.rangeLow);
            if (setupType === 'range_play' && hasRangeEdges) {
                const toHigh = Math.abs(barrierMap.rangeHigh - closeVal) / atrVal;
                const toLow = Math.abs(closeVal - barrierMap.rangeLow) / atrVal;
                const useHighAsOpposite = toLow <= toHigh;
                const chosenValue = useHighAsOpposite ? barrierMap.rangeHigh : barrierMap.rangeLow;
                const chosenLabel = useHighAsOpposite ? 'Range High (opposite edge)' : 'Range Low (opposite edge)';
                const chosenDist = Math.abs(chosenValue - closeVal) / atrVal;
                const source = 'candidates';
                if (chosenDist < noiseAtr) {
                    return {
                        room: 'limited',
                        distanceAtr: chosenDist,
                        reason: 'forced_noise_room',
                        label: `${chosenLabel} [Range]`,
                        skippedNoise: 1,
                        skippedTooClose: 0,
                        forcedLimited: true,
                        levelsSource: source
                    };
                }
                if (chosenDist < roomMinAtr) {
                    return {
                        room: 'limited',
                        distanceAtr: chosenDist,
                        reason: 'forced_min_room',
                        label: `${chosenLabel} [Range]`,
                        skippedNoise: 0,
                        skippedTooClose: 1,
                        forcedLimited: true,
                        levelsSource: source
                    };
                }
                return {
                    room: classifyRoomFromAtr(chosenDist),
                    distanceAtr: chosenDist,
                    reason: '',
                    label: `${chosenLabel} [Range]`,
                    skippedNoise: 0,
                    skippedTooClose: 0,
                    forcedLimited: false,
                    levelsSource: source
                };
            }
            const bull = computeDirectionalRoomFromBarrierMap({
                bias: 'bullish',
                closeRaw: closeVal,
                atrRaw: atrVal,
                barrierMap,
                barrierChoiceRaw,
                noiseAtrRaw,
                roomMinAtrRaw,
                regimeRaw: '',
                setupTypeRaw,
                mode,
                sidesModeRaw: 'single'
            });
            const bear = computeDirectionalRoomFromBarrierMap({
                bias: 'bearish',
                closeRaw: closeVal,
                atrRaw: atrVal,
                barrierMap,
                barrierChoiceRaw,
                noiseAtrRaw,
                roomMinAtrRaw,
                regimeRaw: '',
                setupTypeRaw,
                mode,
                sidesModeRaw: 'single'
            });
            if (Number.isFinite(bull.distanceAtr) && Number.isFinite(bear.distanceAtr)) return bull.distanceAtr <= bear.distanceAtr ? bull : bear;
            return Number.isFinite(bull.distanceAtr) ? bull : bear;
        }

        if (isBull) {
            if (mode === 'spy') {
                push('dch55', 'DCH55', barrierMap.dch55, 'Regime');
                push('dch20', 'DCH20', barrierMap.dch20, 'Regime');
                push('pwh', 'PWH', barrierMap.pwh, 'Major HTF');
                push('swing_high', 'MajorSwingHigh', barrierMap.swingHigh, 'Structure');
                push('sma200', 'SMA200', barrierMap.sma200, 'Indicator');
            } else {
                push('swing_high', 'MajorSwingHigh', barrierMap.swingHigh, 'Structure');
                push('pwh', 'PWH', barrierMap.pwh, 'Major HTF');
                push('dch20', 'DCH20', barrierMap.dch20, 'Indicator');
                push('sma200', 'SMA200', barrierMap.sma200, 'Indicator');
            }
            if (!hasModern) push('res_legacy', 'Resistance (legacy)', barrierMap.resistanceLegacy, 'Legacy');
        } else if (isBear) {
            if (mode === 'spy') {
                push('dcl55', 'DCL55', barrierMap.dcl55, 'Regime');
                push('dcl20', 'DCL20', barrierMap.dcl20, 'Regime');
                push('pwl', 'PWL', barrierMap.pwl, 'Major HTF');
                push('swing_low', 'MajorSwingLow', barrierMap.swingLow, 'Structure');
                push('sma200', 'SMA200', barrierMap.sma200, 'Indicator');
            } else {
                push('swing_low', 'MajorSwingLow', barrierMap.swingLow, 'Structure');
                push('pwl', 'PWL', barrierMap.pwl, 'Major HTF');
                push('dcl20', 'DCL20', barrierMap.dcl20, 'Indicator');
                push('sma200', 'SMA200', barrierMap.sma200, 'Indicator');
            }
            if (!hasModern) push('sup_legacy', 'Support (legacy)', barrierMap.supportLegacy, 'Legacy');
        }

        if (!candidates.length) {
            return {
                room: null,
                distanceAtr: null,
                reason: 'missing_levels',
                label: '',
                skippedNoise: 0,
                skippedTooClose: 0,
                forcedLimited: false,
                levelsSource: 'unknown'
            };
        }

        let ordered = candidates;
        if (barrierChoice !== 'auto') {
            const chosen = candidates.find((c) => c.key === barrierChoice);
            if (chosen) ordered = [chosen, ...candidates.filter((c) => c.key !== barrierChoice)];
        }
        let skippedNoise = 0;
        let skippedTooClose = 0;
        for (const c of ordered) {
            const distAtr = Math.abs(c.value - closeVal) / atrVal;
            if (distAtr < noiseAtr) {
                skippedNoise += 1;
                continue;
            }
            if (distAtr < roomMinAtr) {
                skippedTooClose += 1;
                continue;
            }
            return {
                room: classifyRoomFromAtr(distAtr),
                distanceAtr: distAtr,
                reason: '',
                label: `${c.label} [${c.quality}]`,
                skippedNoise,
                skippedTooClose,
                forcedLimited: false,
                levelsSource: c.quality === 'Legacy' ? 'legacy' : 'candidates'
            };
        }
        const firstBeyondNoise = ordered.find((c) => (Math.abs(c.value - closeVal) / atrVal) >= noiseAtr) || null;
        const first = firstBeyondNoise || ordered[0];
        const distAtr = first ? Math.abs(first.value - closeVal) / atrVal : null;
        return {
            room: Number.isFinite(distAtr) ? 'limited' : null,
            distanceAtr: distAtr,
            reason: firstBeyondNoise ? 'forced_min_room' : 'forced_noise_room',
            label: first ? `${first.label} [${first.quality}]` : '',
            skippedNoise,
            skippedTooClose,
            forcedLimited: true,
            levelsSource: first && first.quality === 'Legacy' ? 'legacy' : 'candidates'
        };
    };

    const updateRoomSuggestionManual = (effectiveBias) => {
        const out = computeDirectionalRoomFromBarrierMap({
            bias: effectiveBias,
            closeRaw: manualCloseEl ? manualCloseEl.value : '',
            atrRaw: manualAtrEl ? manualAtrEl.value : '',
            barrierMap: buildSpyBarrierMapFromRaw({
                swingHigh: spySwingHighEl ? spySwingHighEl.value : '',
                swingLow: spySwingLowEl ? spySwingLowEl.value : '',
                pwh: spyPwhEl ? spyPwhEl.value : '',
                pwl: spyPwlEl ? spyPwlEl.value : '',
                dch20: spyDch20El ? spyDch20El.value : '',
                dcl20: spyDcl20El ? spyDcl20El.value : '',
                dch55: spyDch55El ? spyDch55El.value : '',
                dcl55: spyDcl55El ? spyDcl55El.value : '',
                sma200: spySma200El ? spySma200El.value : '',
                supportLegacy: keySupportEl ? keySupportEl.value : '',
                resistanceLegacy: keyResistanceEl ? keyResistanceEl.value : ''
            }),
            barrierChoiceRaw: spyRoomBarrierChoiceEl ? spyRoomBarrierChoiceEl.value : 'auto',
            noiseAtrRaw: spyRoomNoiseAtrEl ? spyRoomNoiseAtrEl.value : '0.30',
            roomMinAtrRaw: spyRoomMinAtrEl ? spyRoomMinAtrEl.value : '0.80',
            regimeRaw: getRadio('score_spy_regime'),
            setupTypeRaw: '',
            mode: 'spy'
        });

        if (!out.room && out.reason === 'missing_close_or_atr') {
            if (roomAutoEl) roomAutoEl.textContent = 'Enter numeric Close and ATR(14) to get suggestion';
            return null;
        }
        if (!out.room) {
            if (roomAutoEl) roomAutoEl.textContent = 'Enter Level Pack to compute room';
            return null;
        }
        if (roomAutoEl) {
            const extra = [];
            if (out.label) extra.push(`barrier ${out.label}`);
            if (out.levelsSource) extra.push(`source ${out.levelsSource}`);
            if (out.forcedLimited) extra.push('forced limited');
            if (out.skippedNoise > 0) extra.push(`skip noise ${out.skippedNoise}`);
            if (out.skippedTooClose > 0) extra.push(`skip close ${out.skippedTooClose}`);
            roomAutoEl.textContent = `Auto suggestion: ${roomLabel(out.room)} (${out.distanceAtr.toFixed(2)} ATR${extra.length ? `, ${extra.join(', ')}` : ''})`;
        }
        return out;
    };

    const updateStockRoomSuggestionManual = (bias) => {
        const out = computeDirectionalRoomFromBarrierMap({
            bias,
            closeRaw: stk1dCloseEl ? stk1dCloseEl.value : '',
            atrRaw: stk1dAtrEl ? stk1dAtrEl.value : '',
            barrierMap: buildStock1DBarrierMapFromRaw({
                swingHigh: stk1dSwingHighEl ? stk1dSwingHighEl.value : '',
                swingLow: stk1dSwingLowEl ? stk1dSwingLowEl.value : '',
                pwh: stk1dPwhEl ? stk1dPwhEl.value : '',
                pwl: stk1dPwlEl ? stk1dPwlEl.value : '',
                dch20: stk1dDch20El ? stk1dDch20El.value : '',
                dcl20: stk1dDcl20El ? stk1dDcl20El.value : '',
                sma200: stk1dSma200El ? stk1dSma200El.value : '',
                supportLegacy: stk1dSupportEl ? stk1dSupportEl.value : '',
                resistanceLegacy: stk1dResistanceEl ? stk1dResistanceEl.value : ''
            }),
            barrierChoiceRaw: stk1dRoomBarrierChoiceEl ? stk1dRoomBarrierChoiceEl.value : 'auto',
            noiseAtrRaw: stk1dRoomNoiseAtrEl ? stk1dRoomNoiseAtrEl.value : '0.30',
            roomMinAtrRaw: stk1dRoomMinAtrEl ? stk1dRoomMinAtrEl.value : '0.60',
            regimeRaw: getRadio('score_stk1d_regime'),
            setupTypeRaw: '',
            mode: 'stock1d'
        });

        if (!out.room && out.reason === 'missing_close_or_atr') {
            if (stk1dRoomAutoEl) stk1dRoomAutoEl.textContent = 'Enter numeric Close and ATR(14) to get suggestion';
            return null;
        }
        if (!out.room) {
            if (stk1dRoomAutoEl) stk1dRoomAutoEl.textContent = 'Enter Level Pack to compute room';
            return null;
        }
        if (stk1dRoomAutoEl) {
            const extra = [];
            if (out.label) extra.push(`barrier ${out.label}`);
            if (out.levelsSource) extra.push(`source ${out.levelsSource}`);
            if (out.forcedLimited) extra.push('forced limited');
            if (out.skippedNoise > 0) extra.push(`skip noise ${out.skippedNoise}`);
            if (out.skippedTooClose > 0) extra.push(`skip close ${out.skippedTooClose}`);
            stk1dRoomAutoEl.textContent = `Auto suggestion: ${roomLabel(out.room)} (${out.distanceAtr.toFixed(2)} ATR${extra.length ? `, ${extra.join(', ')}` : ''})`;
        }
        return out;
    };

    const calculateStock1D = (values) => {
        const hasMinimum = Boolean(values.bias && values.regime && values.structure && values.trendStrength);
        if (!hasMinimum) {
            return { score20: 0, score100: 0, permission: 'No data', invalidation: 'No data' };
        }
        let score = 0;
        score += values.bias === 'neutral' ? 1 : 2;
        score += (values.structure === 'hh_hl' || values.structure === 'll_lh') ? 2 : values.structure === 'range' ? 1 : 0;
        score += (
            (values.bias === 'bullish' && values.regime === 'trend_up') ||
            (values.bias === 'bearish' && values.regime === 'trend_down')
        ) ? 2 : values.regime === 'range' ? 1 : 0;
        score += (
            (values.bias === 'bullish' && values.trendStrength === 'above_key_mas') ||
            (values.bias === 'bearish' && values.trendStrength === 'below_key_mas')
        ) ? 2 : values.trendStrength === 'chop_around_mas' ? 1 : 0;
        score += values.momentum === 'expanding' ? 2 : values.momentum === 'stable' ? 1 : 0;
        score += values.alignment === 'aligned' ? 2 : values.alignment === 'mixed' ? 1 : 0;
        score += values.rsState === 'strong' ? 2 : values.rsState === 'neutral' ? 1 : 0;
        score += values.rsTrend === 'rising' ? 2 : values.rsTrend === 'flat' ? 1 : 0;
        score += values.room === 'large' ? 3 : values.room === 'medium' ? 2 : values.room === 'limited' ? 1 : 0;

        if (values.alignment === 'contra') score -= 3;
        if (values.room === 'none') score -= 3;
        if (values.momentum === 'exhausted' || values.momentum === 'diverging') score -= 1;

        score = clamp(score, 0, 20);
        const score100 = Math.round(score * 5);
        let permission = score100 >= 70 ? 'Allowed' : score100 >= 50 ? 'Reduced' : 'No-trade';
        if (values.alignment === 'contra' && permission === 'Allowed') permission = 'Reduced';
        if (values.room === 'none') permission = 'No-trade';
        if (values.roomLevelsSource === 'legacy' && permission === 'Allowed') permission = 'Reduced';
        if (values.roomForced && permission === 'Allowed') permission = 'Reduced';
        let invalidation = 'monitor key levels';
        if (values.bias === 'bullish') invalidation = 'daily close below support zone';
        else if (values.bias === 'bearish') invalidation = 'daily close above resistance zone';
        return { score20: score, score100, permission, invalidation, roomLevelsSource: values.roomLevelsSource || 'unknown' };
    };

    const calculateStock1DFromInputs = (inputs) => {
        const safeInputs = inputs && typeof inputs === 'object' ? inputs : {};
        const regime = String(safeInputs.score_stk1d_regime || '');
        const structure = String(safeInputs.score_stk1d_structure || '');
        const trendStrength = String(safeInputs.score_stk1d_trend_strength || '');
        const momentumCondition = String(safeInputs.score_stk1d_momentum || '');
        const manualBias = String(safeInputs.score_stk1d_bias || '');
        const biasManualOverride = Boolean(safeInputs.score_stk1d_bias_manual_override);
        const autoBias = computeAutoBiasFromState(regime, structure, trendStrength, momentumCondition);
        const bias = (biasManualOverride && manualBias) ? manualBias : autoBias;
        const roomOut = computeDirectionalRoomFromBarrierMap({
            bias,
            closeRaw: safeInputs.score_stk1d_close,
            atrRaw: safeInputs.score_stk1d_atr,
            barrierMap: buildStock1DBarrierMapFromRaw({
                swingHigh: safeInputs.score_stk1d_swing_high,
                swingLow: safeInputs.score_stk1d_swing_low,
                pwh: safeInputs.score_stk1d_pwh,
                pwl: safeInputs.score_stk1d_pwl,
                dch20: safeInputs.score_stk1d_dch20,
                dcl20: safeInputs.score_stk1d_dcl20,
                sma200: safeInputs.score_stk1d_sma200,
                supportLegacy: safeInputs.score_stk1d_support,
                resistanceLegacy: safeInputs.score_stk1d_resistance
            }),
            barrierChoiceRaw: safeInputs.score_stk1d_room_barrier_choice,
            noiseAtrRaw: safeInputs.score_stk1d_room_noise_atr,
            roomMinAtrRaw: safeInputs.score_stk1d_room_min_atr,
            regimeRaw: regime,
            setupTypeRaw: '',
            mode: 'stock1d'
        });
        const manualRoom = String(safeInputs.score_stk1d_room_to_move || '');
        const roomManualOverride = Boolean(safeInputs.score_stk1d_bias_manual_override);
        const effectiveRoom = roomManualOverride && manualRoom ? manualRoom : roomOut.room;
        const roomLevelsSource = roomManualOverride ? 'manual' : roomOut.levelsSource;
        const roomForced = !roomManualOverride && Boolean(roomOut.forcedLimited);

        return calculateStock1D({
            bias,
            alignment: String(safeInputs.score_stk1d_alignment || ''),
            regime,
            structure,
            trendStrength,
            momentum: momentumCondition,
            rsState: String(safeInputs.score_stk1d_rs_state || ''),
            rsTrend: String(safeInputs.score_stk1d_rs_trend || ''),
            room: effectiveRoom,
            roomLevelsSource,
            roomForced
        });
    };

    const getPlanDirection = (setupType, oneDBias) => {
        if (setupType === 'breakdown_continuation') return 'bearish';
        if (setupType === 'breakout_continuation' || setupType === 'pullback_continuation') return 'bullish';
        if ((setupType === 'reversal_attempt' || setupType === 'range_play') && (oneDBias === 'bullish' || oneDBias === 'bearish')) {
            return oneDBias;
        }
        return '';
    };

    const calculateRR = (entryRaw, stopRaw, targetRaw, direction) => {
        const entry = parseLevel(entryRaw);
        const stop = parseLevel(stopRaw);
        const target = parseLevel(targetRaw);
        if (!Number.isFinite(entry) || !Number.isFinite(stop) || !Number.isFinite(target)) {
            return { rr: null, label: 'Enter Entry/Stop/Target', validOrder: false };
        }
        let validOrder = true;
        if (direction === 'bullish') validOrder = stop < entry && entry < target;
        else if (direction === 'bearish') validOrder = target < entry && entry < stop;
        if (!validOrder) {
            return { rr: null, label: 'Invalid level order', validOrder: false };
        }
        const risk = Math.abs(entry - stop);
        const reward = Math.abs(target - entry);
        if (!Number.isFinite(risk) || risk <= 0 || !Number.isFinite(reward)) {
            return { rr: null, label: 'Invalid risk values', validOrder: false };
        }
        const rr = reward / risk;
        let label = '<1.5R (warning)';
        if (rr > 2) label = '>2R (good)';
        else if (rr >= 1.5) label = '1.5-2R (acceptable)';
        return { rr, label, validOrder: true };
    };

    const build4HBarrierMap = (values) => ({
        swingHigh: parseLevel(values.swingHigh),
        swingLow: parseLevel(values.swingLow),
        pwh: parseLevel(values.pwh),
        pwl: parseLevel(values.pwl),
        dch20: parseLevel(values.dch20),
        dcl20: parseLevel(values.dcl20),
        rangeHigh: parseLevel(values.rangeHigh),
        rangeLow: parseLevel(values.rangeLow),
        resistanceLegacy: parseLevel(values.resistanceAuto),
        supportLegacy: parseLevel(values.supportAuto)
    });

    const deriveMajorSupportResistance = (barrierMap, close) => {
        const modern = [
            barrierMap.swingHigh, barrierMap.swingLow, barrierMap.pwh, barrierMap.pwl,
            barrierMap.dch20, barrierMap.dcl20, barrierMap.rangeHigh, barrierMap.rangeLow
        ].filter(Number.isFinite);
        const legacy = [barrierMap.resistanceLegacy, barrierMap.supportLegacy].filter(Number.isFinite);
        const all = modern.length ? modern : legacy;
        let support = null;
        let resistance = null;
        all.forEach((lv) => {
            if (lv <= close && (!Number.isFinite(support) || close - lv < close - support)) support = lv;
            if (lv >= close && (!Number.isFinite(resistance) || lv - close < resistance - close)) resistance = lv;
        });
        return { support, resistance };
    };

    const get4HBarrierCandidates = (setupType, planDirection, entry, barrierMap) => {
        const isBull = planDirection === 'bullish';
        const isBear = planDirection === 'bearish';
        if (!isBull && !isBear) return [];
        const out = [];
        const push = (key, label, value, quality) => {
            if (!Number.isFinite(value)) return;
            if (isBull && value <= entry) return;
            if (isBear && value >= entry) return;
            if (out.some((x) => x.key === key || Math.abs(x.value - value) < 1e-8)) return;
            out.push({ key, label, value, quality: quality || 'Major' });
        };
        const hasModern = [
            barrierMap.swingHigh, barrierMap.swingLow, barrierMap.pwh, barrierMap.pwl,
            barrierMap.dch20, barrierMap.dcl20, barrierMap.rangeHigh, barrierMap.rangeLow
        ].some(Number.isFinite);

        if (isBull) {
            if (setupType === 'range_play') {
                push('range_high', 'Range High', barrierMap.rangeHigh, 'Range');
                push('swing_high', 'Swing High 4H', barrierMap.swingHigh, 'Structure');
                push('pwh', 'PWH', barrierMap.pwh, 'Major HTF');
                push('dch20', 'DCH20', barrierMap.dch20, 'Indicator');
            } else {
                push('swing_high', 'Swing High 4H', barrierMap.swingHigh, 'Structure');
                push('pwh', 'PWH', barrierMap.pwh, 'Major HTF');
                push('dch20', 'DCH20', barrierMap.dch20, 'Indicator');
                push('range_high', 'Range High', barrierMap.rangeHigh, 'Range');
            }
            if (!hasModern) push('resistance_legacy', 'Resistance (legacy)', barrierMap.resistanceLegacy, 'Legacy');
        } else {
            if (setupType === 'range_play') {
                push('range_low', 'Range Low', barrierMap.rangeLow, 'Range');
                push('swing_low', 'Swing Low 4H', barrierMap.swingLow, 'Structure');
                push('pwl', 'PWL', barrierMap.pwl, 'Major HTF');
                push('dcl20', 'DCL20', barrierMap.dcl20, 'Indicator');
            } else {
                push('swing_low', 'Swing Low 4H', barrierMap.swingLow, 'Structure');
                push('pwl', 'PWL', barrierMap.pwl, 'Major HTF');
                push('dcl20', 'DCL20', barrierMap.dcl20, 'Indicator');
                push('range_low', 'Range Low', barrierMap.rangeLow, 'Range');
            }
            if (!hasModern) push('support_legacy', 'Support (legacy)', barrierMap.supportLegacy, 'Legacy');
        }
        return out;
    };

    const pick4HRoomBarrier = ({
        setupType,
        planDirection,
        entry,
        atr,
        barrierMap,
        barrierChoice,
        noiseAtr,
        roomMinAtr
    }) => {
        const candidates = get4HBarrierCandidates(setupType, planDirection, entry, barrierMap);
        if (!candidates.length || !Number.isFinite(entry) || !Number.isFinite(atr) || atr <= 0) {
            return {
                barrier: null,
                key: '',
                label: '',
                quality: '',
                distAtr: null,
                skippedNoise: 0,
                skippedTooClose: 0,
                forcedLimited: false,
                levelsSource: 'unknown'
            };
        }

        let ordered = candidates;
        const choice = String(barrierChoice || 'auto');
        if (choice !== 'auto') {
            const chosen = candidates.find((c) => c.key === choice);
            if (chosen) {
                ordered = [chosen, ...candidates.filter((c) => c.key !== choice)];
            }
        }

        const minNoiseAtr = Number.isFinite(noiseAtr) && noiseAtr >= 0 ? noiseAtr : 0.3;
        const minRoomAtr = Number.isFinite(roomMinAtr) && roomMinAtr >= 0 ? roomMinAtr : 0.8;
        let skippedNoise = 0;
        let skippedTooClose = 0;
        for (const c of ordered) {
            const distAtr = Math.abs(c.value - entry) / atr;
            if (distAtr < minNoiseAtr) {
                skippedNoise += 1;
                continue;
            }
            if (distAtr < minRoomAtr) {
                skippedTooClose += 1;
                continue;
            }
            return {
                barrier: c.value,
                key: c.key,
                label: c.label,
                quality: c.quality,
                distAtr,
                skippedNoise,
                skippedTooClose,
                forcedLimited: false,
                levelsSource: c.quality === 'Legacy' ? 'legacy' : 'candidates'
            };
        }

        const firstBeyondNoise = ordered.find((c) => (Math.abs(c.value - entry) / atr) >= minNoiseAtr) || null;
        const first = firstBeyondNoise || ordered[0];
        return first
            ? {
                barrier: first.value,
                key: first.key,
                label: first.label,
                quality: first.quality,
                distAtr: Math.abs(first.value - entry) / atr,
                skippedNoise,
                skippedTooClose,
                forcedLimited: true,
                levelsSource: first.quality === 'Legacy' ? 'legacy' : 'candidates'
            }
            : {
                barrier: null,
                key: '',
                label: '',
                quality: '',
                distAtr: null,
                skippedNoise,
                skippedTooClose,
                forcedLimited: false,
                levelsSource: 'unknown'
            };
    };

    const derive15mTargetCandidates = ({
        entry,
        stop,
        direction,
        support4h,
        resistance4h,
        pwh4h,
        pwl4h
    }) => {
        if (!Number.isFinite(entry) || !Number.isFinite(stop) || (direction !== 'bullish' && direction !== 'bearish')) {
            return { t1: null, t2: null };
        }
        const risk = Math.abs(entry - stop);
        if (!Number.isFinite(risk) || risk <= 0) return { t1: null, t2: null };

        const t1 = direction === 'bullish' ? entry + (risk * 1.5) : entry - (risk * 1.5);

        let t2 = null;
        if (direction === 'bullish') {
            const candidates = [resistance4h, pwh4h].filter((v) => Number.isFinite(v) && v > entry);
            if (candidates.length) t2 = Math.min(...candidates);
        } else {
            const candidates = [support4h, pwl4h].filter((v) => Number.isFinite(v) && v < entry);
            if (candidates.length) t2 = Math.max(...candidates);
        }
        return { t1, t2 };
    };

    const deriveStock4HSuggestions = (values) => {
        const setupLabelMap = {
            pullback_continuation: 'Pullback continuation',
            breakout_continuation: 'Breakout continuation',
            range_play: 'Range play',
            breakdown_continuation: 'Breakdown continuation',
            reversal_attempt: 'Reversal attempt'
        };
        const confirmationLabelMap = {
            close_above_level: '4H close above level',
            strong_bull_candle: 'Strong bull candle',
            reclaim_level: 'Reclaim level',
            break_hold: 'Break + hold'
        };
        const invalidationLabelMap = {
            below_last_hl: 'Below last HL',
            above_last_lh: 'Above last LH',
            below_4h_support: 'Below 4H support',
            above_4h_resistance: 'Above 4H resistance',
            close_back_inside_range: 'Close back inside range'
        };

        const biasForPlan = values.bias4hAuto || values.bias1dAuto || 'neutral';
        let setup = '';
        if (values.structureAuto === 'compression') setup = 'breakout_continuation';
        else if (values.regimeAuto === 'range' && (values.locationHint === 'at_4h_support' || values.locationHint === 'at_4h_resistance')) setup = 'range_play';
        else if (values.structureAuto === 'hh_hl' && (values.locationHint === 'at_4h_support' || values.locationHint === 'at_htf_level')) setup = 'pullback_continuation';
        else if (values.structureAuto === 'll_lh' && (values.locationHint === 'at_4h_resistance' || values.locationHint === 'at_htf_level')) setup = 'breakdown_continuation';
        else if (values.trendQualityAuto === 'exhausted' && (values.liquidityHint === 'sweep_low' || values.liquidityHint === 'sweep_high')) setup = 'reversal_attempt';
        else if (
            values.trendStrengthAuto === 'chop_around_mas' &&
            (values.structureAuto === 'range' || values.structureAuto === 'transition' || values.structureAuto === 'mixed')
        ) setup = 'range_play';
        else if (biasForPlan === 'bullish') setup = 'pullback_continuation';
        else if (biasForPlan === 'bearish') setup = 'breakdown_continuation';
        else setup = 'range_play';

        let confirmation = '';
        if (values.structureAuto === 'compression') confirmation = 'close_above_level';
        else if (values.trendQualityAuto === 'overlapping_messy') confirmation = 'reclaim_level';
        else if (setup === 'pullback_continuation') confirmation = 'reclaim_level';
        else if (setup === 'breakout_continuation' || setup === 'breakdown_continuation') confirmation = 'close_above_level';
        else confirmation = 'break_hold';

        let invalidation = '';
        if (setup === 'breakout_continuation' || setup === 'breakdown_continuation') invalidation = 'close_back_inside_range';
        else if (setup === 'pullback_continuation') {
            if (values.locationHint === 'at_4h_support') invalidation = 'below_4h_support';
            else invalidation = biasForPlan === 'bearish' ? 'above_last_lh' : 'below_last_hl';
        } else if (setup === 'range_play') {
            invalidation = values.locationHint === 'at_4h_resistance' ? 'above_4h_resistance' : 'below_4h_support';
        } else if (setup === 'reversal_attempt') {
            invalidation = values.regimeAuto === 'range' ? 'close_back_inside_range' : (biasForPlan === 'bearish' ? 'above_4h_resistance' : 'below_4h_support');
        } else if (values.locationHint === 'at_4h_support') invalidation = 'below_4h_support';
        else if (values.locationHint === 'at_4h_resistance') invalidation = 'above_4h_resistance';
        else invalidation = biasForPlan === 'bearish' ? 'above_4h_resistance' : 'below_4h_support';

        const barrierMap = build4HBarrierMap(values);
        const majorSR = deriveMajorSupportResistance(barrierMap, parseLevel(values.close));
        const supportNum = majorSR.support;
        const resistanceNum = majorSR.resistance;
        const pwhNum = barrierMap.pwh;
        const pwlNum = barrierMap.pwl;
        const closeNum = parseLevel(values.close);
        const atrNum = parseLevel(values.atr14);
        const stopBuffer = Number.isFinite(atrNum) ? atrNum * 0.2 : 0;
        const round2 = (n) => String(Math.round(n * 100) / 100);
        let targetHint = 'No target hint';
        let entryValue = '';
        let stopValue = '';
        let targetValue = '';
        const breakBuf = Number.isFinite(atrNum) ? atrNum * 0.05 : 0;
        const entryRef = Number.isFinite(closeNum) ? closeNum : 0;
        const bullishCandidatesRaw = setup === 'range_play'
            ? [barrierMap.rangeHigh, barrierMap.swingHigh, pwhNum, barrierMap.dch20]
            : [barrierMap.swingHigh, pwhNum, barrierMap.dch20, barrierMap.rangeHigh];
        const bearishCandidatesRaw = setup === 'range_play'
            ? [barrierMap.rangeLow, barrierMap.swingLow, pwlNum, barrierMap.dcl20]
            : [barrierMap.swingLow, pwlNum, barrierMap.dcl20, barrierMap.rangeLow];
        const bullishCandidates = [...bullishCandidatesRaw, resistanceNum]
            .filter((v) => Number.isFinite(v) && v >= entryRef)
            .sort((a, b) => a - b);
        const bearishCandidates = [...bearishCandidatesRaw, supportNum]
            .filter((v) => Number.isFinite(v) && v <= entryRef)
            .sort((a, b) => b - a);
        const bullishLevel = bullishCandidates.length ? bullishCandidates[0] : closeNum;
        const bearishLevel = bearishCandidates.length ? bearishCandidates[0] : closeNum;
        if (Number.isFinite(closeNum)) entryValue = round2(closeNum);

        if (biasForPlan === 'bullish') {
            if (Number.isFinite(resistanceNum)) {
                targetHint = `Resistance (auto): ${resistanceNum}`;
                targetValue = String(resistanceNum);
            } else if (Number.isFinite(pwhNum)) {
                targetHint = `PWH: ${pwhNum}`;
                targetValue = String(pwhNum);
            }
            if (confirmation === 'close_above_level' && Number.isFinite(bullishLevel)) entryValue = round2(bullishLevel);
            else if (confirmation === 'reclaim_level' && Number.isFinite(supportNum)) entryValue = round2(supportNum);
            else if (confirmation === 'break_hold' && Number.isFinite(bullishLevel)) entryValue = round2(bullishLevel + breakBuf);
            if (invalidation === 'below_4h_support' && Number.isFinite(supportNum)) stopValue = round2(supportNum - stopBuffer);
            else if (invalidation === 'below_last_hl' && Number.isFinite(supportNum)) stopValue = round2(supportNum - stopBuffer);
            else if (Number.isFinite(supportNum)) stopValue = round2(supportNum - stopBuffer);
        } else if (biasForPlan === 'bearish') {
            if (Number.isFinite(supportNum)) {
                targetHint = `Support (auto): ${supportNum}`;
                targetValue = String(supportNum);
            } else if (Number.isFinite(pwlNum)) {
                targetHint = `PWL: ${pwlNum}`;
                targetValue = String(pwlNum);
            }
            if (confirmation === 'close_above_level' && Number.isFinite(bearishLevel)) entryValue = round2(bearishLevel);
            else if (confirmation === 'reclaim_level' && Number.isFinite(resistanceNum)) entryValue = round2(resistanceNum);
            else if (confirmation === 'break_hold' && Number.isFinite(bearishLevel)) entryValue = round2(bearishLevel - breakBuf);
            if (invalidation === 'above_4h_resistance' && Number.isFinite(resistanceNum)) stopValue = round2(resistanceNum + stopBuffer);
            else if (invalidation === 'above_last_lh' && Number.isFinite(resistanceNum)) stopValue = round2(resistanceNum + stopBuffer);
            else if (Number.isFinite(resistanceNum)) stopValue = round2(resistanceNum + stopBuffer);
        } else {
            if (Number.isFinite(resistanceNum) && Number.isFinite(supportNum)) {
                targetHint = `Range edge: ${supportNum} / ${resistanceNum}`;
                targetValue = String(resistanceNum);
            }
            if (Number.isFinite(supportNum)) stopValue = round2(supportNum - stopBuffer);
        }

        return {
            setup,
            setupText: setupLabelMap[setup] || '-',
            confirmation,
            confirmationText: confirmationLabelMap[confirmation] || '-',
            invalidation,
            invalidationText: invalidationLabelMap[invalidation] || '-',
            entryValue,
            stopValue,
            targetHint,
            targetValue
        };
    };

    const calculateStock4H = (values, stock1dResult) => {
        const closeNum = parseLevel(values.close);
        const atrNumBase = parseLevel(values.atr14);
        const barrierMapBase = build4HBarrierMap(values);
        const majorSRBase = deriveMajorSupportResistance(barrierMapBase, closeNum);
        const supportNumBase = majorSRBase.support;
        const resistanceNumBase = majorSRBase.resistance;
        const pwhNumBase = barrierMapBase.pwh;
        const pwlNumBase = barrierMapBase.pwl;
        const hasAnyMajorBarrier = [
            barrierMapBase.swingHigh, barrierMapBase.swingLow, barrierMapBase.pwh, barrierMapBase.pwl,
            barrierMapBase.dch20, barrierMapBase.dcl20, barrierMapBase.rangeHigh, barrierMapBase.rangeLow
        ].some(Number.isFinite);
        const hasCoreData = Number.isFinite(closeNum) &&
            Number.isFinite(atrNumBase) &&
            atrNumBase > 0 &&
            hasAnyMajorBarrier;
        if (!hasCoreData) {
            return {
                score20: 0,
                grade: 'No data',
                status: 'No data',
                rrText: 'No data',
                roomText: 'No data',
                planDirectionText: 'No data',
                planSourceText: 'No data',
                warningsText: 'none',
                structureScore: 0,
                setupScore: 0,
                riskScore: 0,
                penalties: 0,
                setupType: '',
                roomForcedLimited: false,
                roomLevelsSource: 'unknown',
                roomBarrierUsed: '',
                roomSkippedNoiseCount: 0,
                roomSkippedTooCloseCount: 0,
                levels: {
                    support: supportNumBase,
                    resistance: resistanceNumBase,
                    pwh: pwhNumBase,
                    pwl: pwlNumBase
                }
            };
        }

        const effectiveValues = { ...values };
        const hasText = (v) => String(v ?? '').trim() !== '';
        const source = {
            setupType: hasText(values.setupType) ? 'manual' : 'auto',
            confirmation: hasText(values.confirmation) ? 'manual' : 'auto',
            invalidationLogic: hasText(values.invalidationLogic) ? 'manual' : 'auto',
            entry: hasText(values.entry) ? 'manual' : 'auto',
            stop: hasText(values.stop) ? 'manual' : 'auto',
            target: hasText(values.target) ? 'manual' : 'auto'
        };
        const sugg = deriveStock4HSuggestions(effectiveValues);
        if (!effectiveValues.setupType && sugg.setup) effectiveValues.setupType = sugg.setup;
        if (!effectiveValues.confirmation && sugg.confirmation) effectiveValues.confirmation = sugg.confirmation;
        if (!effectiveValues.invalidationLogic && sugg.invalidation) effectiveValues.invalidationLogic = sugg.invalidation;
        if (!hasText(values.setupType) && sugg.setup) source.setupType = 'auto';
        if (!hasText(values.confirmation) && sugg.confirmation) source.confirmation = 'auto';
        if (!hasText(values.invalidationLogic) && sugg.invalidation) source.invalidationLogic = 'auto';
        if (parseLevel(effectiveValues.entry) === null && sugg.entryValue) {
            effectiveValues.entry = sugg.entryValue;
            source.entry = 'auto';
        }
        if (parseLevel(effectiveValues.stop) === null && sugg.stopValue) {
            effectiveValues.stop = sugg.stopValue;
            source.stop = 'auto';
        }
        if (parseLevel(effectiveValues.target) === null && sugg.targetValue) {
            effectiveValues.target = sugg.targetValue;
            source.target = 'auto';
        }
        if (!effectiveValues.bias4hAuto) effectiveValues.bias4hAuto = effectiveValues.bias1dAuto || 'neutral';
        if (!effectiveValues.structureAuto) effectiveValues.structureAuto = 'range';
        if (!effectiveValues.trendQualityAuto) effectiveValues.trendQualityAuto = 'overlapping_messy';
        if (!effectiveValues.regimeAuto) effectiveValues.regimeAuto = 'range';

        const planDirection = getPlanDirection(effectiveValues.setupType, effectiveValues.bias4hAuto || effectiveValues.bias1dAuto);
        const warnings = [];
        const levelBasedConfirmation = effectiveValues.confirmation === 'close_above_level' ||
            effectiveValues.confirmation === 'reclaim_level' ||
            effectiveValues.confirmation === 'break_hold';
        const barrierMap = build4HBarrierMap(effectiveValues);
        const majorSR = deriveMajorSupportResistance(barrierMap, closeNum);
        const hasAnyLevel = [
            barrierMap.swingHigh, barrierMap.swingLow, barrierMap.pwh, barrierMap.pwl,
            barrierMap.dch20, barrierMap.dcl20, barrierMap.rangeHigh, barrierMap.rangeLow
        ].some(Number.isFinite);
        let levelFallbackUsed = false;
        if (levelBasedConfirmation && !hasAnyLevel) {
            warnings.push('Level-based confirmation without valid levels, fallback entry=close');
            if (parseLevel(effectiveValues.entry) === null && Number.isFinite(closeNum)) {
                effectiveValues.entry = String(Math.round(closeNum * 100) / 100);
                source.entry = 'auto';
                levelFallbackUsed = true;
            }
        }
        const rrInfo = calculateRR(effectiveValues.entry, effectiveValues.stop, effectiveValues.target, planDirection);
        const entryNum = parseLevel(effectiveValues.entry);
        const atrNum = parseLevel(effectiveValues.atr14);
        const supportNum = majorSR.support;
        const resistanceNum = majorSR.resistance;
        const pwhNum = barrierMap.pwh;
        const pwlNum = barrierMap.pwl;
        let roomClass = '';
        let roomText = 'No data';
        let roomBarrier = null;
        let roomLevelsSource = 'unknown';
        let roomForcedLimited = false;
        let roomBarrierLabel = '';
        let roomSkippedNoiseCount = 0;
        let roomSkippedTooCloseCount = 0;
        if (Number.isFinite(entryNum) && Number.isFinite(atrNum) && atrNum > 0) {
            const roomPick = pick4HRoomBarrier({
                setupType: effectiveValues.setupType,
                planDirection,
                entry: entryNum,
                atr: atrNum,
                barrierMap,
                barrierChoice: effectiveValues.roomBarrierChoice,
                noiseAtr: parseLevel(effectiveValues.roomNoiseAtr),
                roomMinAtr: parseLevel(effectiveValues.roomMinAtr)
            });
            roomBarrier = roomPick.barrier;
            roomLevelsSource = roomPick.levelsSource || 'unknown';
            roomForcedLimited = Boolean(roomPick.forcedLimited);
            roomBarrierLabel = roomPick.label || '';
            roomSkippedNoiseCount = Number(roomPick.skippedNoise || 0);
            roomSkippedTooCloseCount = Number(roomPick.skippedTooClose || 0);
            if (Number.isFinite(roomPick.distAtr)) {
                roomClass = roomForcedLimited ? 'limited' : (classifyRoomFromAtr(roomPick.distAtr) || '');
                if (roomClass) {
                    const details = [];
                    if (roomPick.quality) details.push(`type ${roomPick.quality}`);
                    if (roomPick.levelsSource) details.push(`source ${roomPick.levelsSource}`);
                    if (roomForcedLimited) details.push('forced limited');
                    if (roomPick.skippedNoise > 0) details.push(`skipped ${roomPick.skippedNoise} noise`);
                    if (roomPick.skippedTooClose > 0) details.push(`skipped ${roomPick.skippedTooClose} too-close`);
                    const suffix = details.length ? `, ${details.join(', ')}` : '';
                    roomText = `${roomClass} (${roomPick.distAtr.toFixed(2)} ATR, barrier ${roomPick.label || 'N/A'} ${roomBarrier.toFixed(2)}${suffix})`;
                }
            }
        }

        let structureScore = 0;
        structureScore += effectiveValues.biasVs1DHint === 'in_direction_1d' ? 2 : effectiveValues.biasVs1DHint === 'neutral' ? 1 : 0;
        structureScore += (effectiveValues.structureAuto === 'hh_hl' || effectiveValues.structureAuto === 'll_lh') ? 3
            : effectiveValues.structureAuto === 'compression' ? 2
                : (effectiveValues.structureAuto === 'transition' || effectiveValues.structureAuto === 'range') ? 1 : 0;
        structureScore += effectiveValues.trendQualityAuto === 'clean_trend' ? 3 : effectiveValues.trendQualityAuto === 'overlapping_messy' ? 1 : 0;
        structureScore = clamp(structureScore, 0, 8);

        let setupScore = 0;
        setupScore += effectiveValues.confirmation ? 1 : 0;
        setupScore += effectiveValues.invalidationLogic ? 1 : 0;
        if (effectiveValues.setupType === 'range_play' && effectiveValues.regimeAuto === 'range' &&
            (effectiveValues.locationHint === 'at_4h_support' || effectiveValues.locationHint === 'at_4h_resistance')) setupScore += 2;
        else if ((effectiveValues.setupType === 'breakout_continuation' || effectiveValues.setupType === 'breakdown_continuation') &&
            (effectiveValues.structureAuto === 'compression' || effectiveValues.structureAuto === 'range')) setupScore += 2;
        else if ((effectiveValues.setupType === 'pullback_continuation' && effectiveValues.structureAuto === 'hh_hl' &&
            (effectiveValues.locationHint === 'at_4h_support' || effectiveValues.locationHint === 'at_htf_level')) ||
            (effectiveValues.setupType === 'breakdown_continuation' && effectiveValues.structureAuto === 'll_lh' &&
            (effectiveValues.locationHint === 'at_4h_resistance' || effectiveValues.locationHint === 'at_htf_level'))) setupScore += 2;
        else if (effectiveValues.setupType === 'reversal_attempt' && effectiveValues.trendQualityAuto === 'exhausted' &&
            (effectiveValues.liquidityHint === 'sweep_low' || effectiveValues.liquidityHint === 'sweep_high')) setupScore += 2;
        setupScore += effectiveValues.locationHint === 'at_htf_level' ? 1 : 0;
        setupScore += (effectiveValues.liquidityHint && effectiveValues.liquidityHint !== 'none' &&
            (effectiveValues.setupType === 'reversal_attempt' || effectiveValues.setupType === 'breakout_continuation' || effectiveValues.setupType === 'breakdown_continuation')) ? 1 : 0;
        if (effectiveValues.setupType && setupScore === 0) setupScore = 1;
        setupScore = clamp(setupScore, 0, 6);

        let riskScore = 0;
        riskScore += rrInfo.validOrder ? 2 : 0;
        riskScore += rrInfo.rr > 2 ? 3 : rrInfo.rr >= 1.5 ? 2 : rrInfo.rr >= 1.3 ? 1 : 0;
        riskScore += roomClass === 'large' || roomClass === 'medium' || roomClass === 'limited' ? 1 : 0;
        riskScore = clamp(riskScore, 0, 6);

        let penalties = 0;
        if (effectiveValues.structureAuto === 'range' && effectiveValues.setupType === 'pullback_continuation') {
            penalties -= 2;
            warnings.push('Range structure with pullback continuation');
        }
        if (effectiveValues.trendQualityAuto === 'exhausted' && effectiveValues.setupType === 'breakout_continuation') {
            penalties -= 3;
            warnings.push('Exhausted trend with breakout continuation');
        }
        if (effectiveValues.trendQualityAuto === 'overlapping_messy' && effectiveValues.locationHint === 'middle_of_structure') {
            penalties -= 2;
            warnings.push('Messy trend in middle of structure');
        }
        if (
            effectiveValues.invalidationLogic === 'below_4h_support' &&
            effectiveValues.locationHint === 'at_4h_resistance'
        ) warnings.push('Invalidation below support mismatched with location at resistance');
        if (
            effectiveValues.invalidationLogic === 'above_4h_resistance' &&
            effectiveValues.locationHint === 'at_4h_support'
        ) warnings.push('Invalidation above resistance mismatched with location at support');

        if (
            effectiveValues.regimeAuto === 'range' &&
            effectiveValues.confirmation === 'break_hold' &&
            effectiveValues.locationHint !== 'at_4h_support' &&
            effectiveValues.locationHint !== 'at_4h_resistance'
        ) warnings.push('Range + Break+hold should be at support/resistance');
        if (levelFallbackUsed) penalties -= 1;

        const qualityScore = clamp(structureScore + setupScore + riskScore + penalties, 0, 20);
        let score = qualityScore;
        let status = score >= 16 ? 'Allowed' : score >= 12 ? 'Reduced' : 'No-trade';
        const capReasons = [];

        if (!rrInfo.validOrder || rrInfo.rr === null) {
            status = 'No-trade';
            capReasons.push('No-trade: incomplete or invalid Entry/Stop/Target');
        }
        if (rrInfo.rr !== null && rrInfo.rr < 1.3) {
            status = 'No-trade';
            capReasons.push('No-trade: R:R below 1.3R');
        }
        if (rrInfo.rr !== null && rrInfo.rr < 1.5 && status === 'Allowed') {
            status = 'Reduced';
            capReasons.push('Cap Reduced: R:R between 1.3R and 1.5R');
        }
        if (effectiveValues.trendQualityAuto === 'exhausted' && effectiveValues.setupType === 'reversal_attempt') {
            status = 'No-trade';
            capReasons.push('No-trade: exhausted trend + reversal attempt');
        }
        if (effectiveValues.biasVs1DHint === 'counter_trend' && status === 'Allowed') {
            status = 'Reduced';
            capReasons.push('Counter-trend vs 1D cannot be Allowed');
        }
        if (roomClass === 'none') {
            if (effectiveValues.setupType === 'range_play' || effectiveValues.setupType === 'reversal_attempt') {
                if (status === 'Allowed') status = 'Reduced';
                capReasons.push('Cap Reduced: room to move = none');
            } else {
                status = 'No-trade';
                capReasons.push('No-trade: room to move = none');
            }
        }
        if (
            roomClass === 'limited' &&
            effectiveValues.setupType !== 'range_play' &&
            effectiveValues.setupType !== 'reversal_attempt' &&
            rrInfo.rr !== null &&
            rrInfo.rr < 2 &&
            status === 'Allowed'
        ) {
            status = 'Reduced';
            capReasons.push('Cap Reduced: limited room on continuation setup requires >=2R');
        }
        if (
            effectiveValues.regimeAuto === 'range' &&
            effectiveValues.confirmation === 'break_hold' &&
            effectiveValues.locationHint !== 'at_4h_support' &&
            effectiveValues.locationHint !== 'at_4h_resistance' &&
            status === 'Allowed'
        ) {
            status = 'Reduced';
            capReasons.push('Cap Reduced: range + break/hold outside edge location');
        }
        const allPlanFieldsAuto = source.setupType === 'auto' &&
            source.confirmation === 'auto' &&
            source.invalidationLogic === 'auto' &&
            source.entry === 'auto' &&
            source.stop === 'auto' &&
            source.target === 'auto';
        if (!values.manualPlanOverride && allPlanFieldsAuto && status === 'Allowed') {
            status = 'Reduced';
            capReasons.push('Cap Reduced: fully auto Part 2 plan');
        }
        if (stock1dResult && stock1dResult.permission === 'No-trade') {
            score = Math.min(score, 8);
            status = 'No-trade';
            capReasons.push('Blocked by 1D: Permission = No-trade');
        }
        if (roomLevelsSource === 'legacy' && status === 'Allowed') {
            status = 'Reduced';
            capReasons.push('Cap Reduced: room barrier from legacy fallback');
        }
        if (roomForcedLimited && status === 'Allowed') {
            const isContinuationSetup = effectiveValues.setupType === 'pullback_continuation' ||
                effectiveValues.setupType === 'breakout_continuation' ||
                effectiveValues.setupType === 'breakdown_continuation';
            const isRangeOrReversal = effectiveValues.setupType === 'range_play' || effectiveValues.setupType === 'reversal_attempt';
            if (isContinuationSetup) {
                status = 'Reduced';
                capReasons.push('Cap Reduced: forced limited room on continuation setup');
            } else if (isRangeOrReversal && (rrInfo.rr === null || rrInfo.rr < 2.0)) {
                status = 'Reduced';
                capReasons.push('Cap Reduced: forced limited room on range/reversal requires >=2R');
            }
        }

        let grade = 'Invalid';
        if (qualityScore >= 16) grade = 'A-Grade';
        else if (qualityScore >= 12) grade = 'B-Grade';
        else if (qualityScore > 0) grade = 'C-Grade';

        const rrText = rrInfo.rr === null ? rrInfo.label : `${rrInfo.rr.toFixed(2)}R (${rrInfo.label})`;
        const planDirectionText = planDirection ? `${planDirection.charAt(0).toUpperCase()}${planDirection.slice(1)}` : 'No data';
        const planSourceText = `S:${source.setupType} C:${source.confirmation} I:${source.invalidationLogic} R:${source.entry}/${source.stop}/${source.target}`;
        const statusText = capReasons.length ? `${status} | ${capReasons.join('; ')}` : status;

        return {
            score20: score,
            grade,
            status,
            statusText,
            rrText,
            roomText,
            planDirectionText,
            planSourceText,
            warningsText: warnings.length ? warnings.join(' | ') : 'none',
            structureScore,
            setupScore,
            riskScore,
            penalties,
            setupType: effectiveValues.setupType || '',
            roomForcedLimited,
            roomLevelsSource,
            roomBarrierUsed: roomBarrierLabel || '',
            roomSkippedNoiseCount,
            roomSkippedTooCloseCount,
            levels: {
                support: supportNum,
                resistance: resistanceNum,
                pwh: pwhNum,
                pwl: pwlNum
            }
        };
    };

    const calculateStock4HFromInputs = (inputs) => {
        const safeInputs = inputs && typeof inputs === 'object' ? inputs : {};
        const stock1dResult = calculateStock1DFromInputs(safeInputs);
        const baseValues = {
            biasVs1DHint: String(safeInputs.score_stk4h_bias_vs_1d_hint || ''),
            bias1dAuto: String(safeInputs.score_stk4h_bias_1d_auto || ''),
            bias4hAuto: String(safeInputs.score_stk4h_bias_4h_auto || ''),
            structureAuto: String(safeInputs.score_stk4h_structure_auto || ''),
            trendStrengthAuto: String(safeInputs.score_stk4h_trend_strength_auto || ''),
            trendQualityAuto: String(safeInputs.score_stk4h_trend_quality_auto || ''),
            regimeAuto: String(safeInputs.score_stk4h_regime_auto || ''),
            vwapStateAuto: String(safeInputs.score_stk4h_vwap_state_auto || ''),
            locationHint: String(safeInputs.score_stk4h_location_hint || ''),
            liquidityHint: String(safeInputs.score_stk4h_liquidity_hint || ''),
            setupType: String(safeInputs.score_stk4h_setup_type || ''),
            confirmation: String(safeInputs.score_stk4h_confirmation || ''),
            invalidationLogic: String(safeInputs.score_stk4h_invalidation_logic || ''),
            close: safeInputs.score_stk4h_close,
            atr14: safeInputs.score_stk4h_atr14,
            supportAuto: safeInputs.score_stk4h_support_auto,
            resistanceAuto: safeInputs.score_stk4h_resistance_auto,
            swingHigh: safeInputs.score_stk4h_swing_high,
            swingLow: safeInputs.score_stk4h_swing_low,
            pwh: safeInputs.score_stk4h_pwh,
            pwl: safeInputs.score_stk4h_pwl,
            dch20: safeInputs.score_stk4h_dch20,
            dcl20: safeInputs.score_stk4h_dcl20,
            rangeHigh: safeInputs.score_stk4h_range_high,
            rangeLow: safeInputs.score_stk4h_range_low,
            roomBarrierChoice: String(safeInputs.score_stk4h_room_barrier_choice || 'auto'),
            roomNoiseAtr: safeInputs.score_stk4h_room_noise_atr,
            roomMinAtr: safeInputs.score_stk4h_room_min_atr,
            entry: safeInputs.score_stk4h_entry,
            stop: safeInputs.score_stk4h_stop,
            target: safeInputs.score_stk4h_target
        };

        const manualPlan = Boolean(safeInputs.score_stk4h_plan_manual_override);

        return calculateStock4H({
            ...baseValues,
            manualPlanOverride: manualPlan,
            hasRiskLevels: Boolean(
                parseLevel(baseValues.entry) !== null &&
                parseLevel(baseValues.stop) !== null &&
                parseLevel(baseValues.target) !== null
            )
        }, stock1dResult);
    };

    const calculateStock15M = (values, stock4hResult) => {
        const hasMinimumData = Boolean(
            values.bias &&
            values.triggerStatus &&
            parseLevel(values.entry) !== null &&
            parseLevel(values.stop) !== null
        );
        if (!hasMinimumData) {
            return {
                score20: 0,
                grade: 'No data',
                status: 'No data',
                statusText: 'No data',
                rrText: 'No data',
                breakdownText: 'Context: 0/5 | Trigger: 0/5 | Entry: 0/5 | Risk: 0/5 | Penalties: 0',
                contextScore: 0,
                triggerScore: 0,
                entryScore: 0,
                riskScore: 0,
                penalties: 0,
                autoTargetUsed: false
            };
        }

        let planDirection = values.planDirection;
        if (planDirection !== 'bullish' && planDirection !== 'bearish') {
            planDirection = values.bias === 'bullish' ? 'bullish' : values.bias === 'bearish' ? 'bearish' : '';
        }

        const entryNum = parseLevel(values.entry);
        const stopNum = parseLevel(values.stop);
        const userTargetNum = parseLevel(values.target);
        const levels4h = stock4hResult && stock4hResult.levels ? stock4hResult.levels : {};
        const support4h = parseLevel(levels4h.support);
        const resistance4h = parseLevel(levels4h.resistance);
        const pwh4h = parseLevel(levels4h.pwh);
        const pwl4h = parseLevel(levels4h.pwl);
        const targetCandidates = derive15mTargetCandidates({
            entry: entryNum,
            stop: stopNum,
            direction: planDirection,
            support4h,
            resistance4h,
            pwh4h,
            pwl4h
        });
        const preferT1 = values.locationVs4h === 'late_extended' ||
            values.locationVs4h === 'chasing_breakout' ||
            values.volume === 'weak' ||
            values.triggerStatus !== 'confirmed';
        const autoTargetNum = preferT1
            ? (Number.isFinite(targetCandidates.t1) ? targetCandidates.t1 : targetCandidates.t2)
            : (Number.isFinite(targetCandidates.t2) ? targetCandidates.t2 : targetCandidates.t1);
        const effectiveTargetNum = Number.isFinite(userTargetNum) ? userTargetNum : autoTargetNum;
        const rrInfo = calculateRR(values.entry, values.stop, effectiveTargetNum, planDirection);
        const capReasons = [];
        const warnings = [];
        let autoTargetUsed = false;
        if (!Number.isFinite(userTargetNum) && Number.isFinite(effectiveTargetNum)) {
            autoTargetUsed = true;
            warnings.push(`Auto target (${preferT1 ? 'T1 local' : 'T2 HTF'}) used`);
        }
        const counterTrend = Boolean(
            (planDirection === 'bullish' && values.bias === 'bearish') ||
            (planDirection === 'bearish' && values.bias === 'bullish')
        );

        let contextScore = 0;
        if (!counterTrend && values.bias && planDirection) contextScore += 2;
        if ((planDirection === 'bullish' && values.structure === 'hh_hl') || (planDirection === 'bearish' && values.structure === 'll_lh')) contextScore += 1;
        if ((planDirection === 'bullish' && values.vwap === 'above') || (planDirection === 'bearish' && values.vwap === 'below')) contextScore += 1;
        if (values.locationVs4h === 'planned_zone' || values.locationVs4h === 'early') contextScore += 1;
        contextScore = clamp(contextScore, 0, 5);

        let triggerScore = 0;
        const hasEntryType = Boolean(values.entryType) && values.entryType !== '-';
        triggerScore += values.triggerStatus === 'confirmed' ? 2 : 0;
        triggerScore += hasEntryType ? 2 : 0;
        triggerScore += (values.volume === 'increasing_move' || values.volume === 'reduced_pullbacks') ? 1 : 0;
        triggerScore = clamp(triggerScore, 0, 5);

        let entryScore = 0;
        entryScore += values.locationVs4h === 'planned_zone' ? 2 : values.locationVs4h === 'early' ? 1 : 0;
        entryScore += rrInfo.rr >= 2 ? 2 : rrInfo.rr >= 1.5 ? 1 : 0;
        entryScore += values.stopLogic ? 1 : 0;
        entryScore = clamp(entryScore, 0, 5);

        let riskScore = 0;
        riskScore += values.stopLogic ? 2 : 0;
        riskScore += values.timeOfDay && values.timeOfDay !== 'midday' ? 1 : 0;
        riskScore += values.liquidityEvent !== 'failed_breakout' ? 1 : 0;
        riskScore += (values.locationVs4h !== 'late_extended' && values.locationVs4h !== 'chasing_breakout') ? 1 : 0;
        riskScore = clamp(riskScore, 0, 5);

        let penalties = 0;
        if (counterTrend) penalties -= 2;
        if (values.triggerStatus === 'failed') penalties -= 2;
        if (values.locationVs4h === 'chasing_breakout') penalties -= 2;
        if (values.locationVs4h === 'late_extended') penalties -= 1;
        if (values.liquidityEvent === 'failed_breakout') penalties -= 2;

        const raw = clamp(contextScore + triggerScore + entryScore + riskScore + penalties, 0, 20);
        let status = raw >= 16 ? 'Allowed' : raw >= 12 ? 'Reduced' : 'No-trade';
        if (rrInfo.rr === null || !rrInfo.validOrder) {
            status = 'No-trade';
            capReasons.push('No-trade: invalid Entry/Stop/Target');
        }
        if (rrInfo.rr !== null && rrInfo.rr < 1.3) {
            status = 'No-trade';
            capReasons.push('No-trade: R:R below 1.3R');
        }
        if (rrInfo.rr !== null && rrInfo.rr < 1.5 && status === 'Allowed') {
            status = 'Reduced';
            capReasons.push('Cap Reduced: R:R below 1.5R');
        }
        if (values.triggerStatus === 'no_trigger') {
            status = 'No-trade';
            capReasons.push('No-trade: no trigger');
        }
        if (values.triggerStatus === 'failed' && status === 'Allowed') {
            status = 'Reduced';
            capReasons.push('Cap Reduced: failed trigger');
        }
        if (values.locationVs4h === 'chasing_breakout' && status === 'Allowed') {
            status = 'Reduced';
            capReasons.push('Cap Reduced: chasing breakout');
        }
        if (counterTrend && status === 'Allowed') {
            status = 'Reduced';
            capReasons.push('Cap Reduced: counter-trend vs 4H');
        }
        if (stock4hResult && stock4hResult.status === 'No-trade') {
            status = 'No-trade';
            capReasons.push('Blocked by 4H: No-trade');
        }
        if (values.timeOfDay === 'midday' && status === 'Allowed') {
            status = 'Reduced';
            capReasons.push('Cap Reduced: midday liquidity');
        }
        if (Number.isFinite(entryNum) && Number.isFinite(stopNum) && Number.isFinite(effectiveTargetNum)) {
            const riskDist = Math.abs(entryNum - stopNum);
            const targetDist = Math.abs(effectiveTargetNum - entryNum);
            if (riskDist > 0 && targetDist > riskDist * 3) {
                warnings.push('Ambitious target: above 3R distance');
                if (status === 'Allowed') {
                    status = 'Reduced';
                    capReasons.push('Cap Reduced: target too far (>3R)');
                }
            }
        }
        if (counterTrend) warnings.push('15m counter-trend vs 4H');
        if (values.liquidityEvent === 'failed_breakout') warnings.push('Failed breakout liquidity event');

        let grade = 'Invalid';
        if (raw >= 16) grade = 'A-Grade';
        else if (raw >= 12) grade = 'B-Grade';
        else if (raw >= 8) grade = 'C-Grade';
        const rrText = rrInfo.rr === null ? rrInfo.label : `${rrInfo.rr.toFixed(2)}R (${rrInfo.label})`;
        const statusText = capReasons.length ? `${status} | ${capReasons.join('; ')}` : status;
        const breakdownText = `Context: ${contextScore}/5 | Trigger: ${triggerScore}/5 | Entry: ${entryScore}/5 | Risk: ${riskScore}/5 | Penalties: ${penalties}`;
        return {
            score20: raw,
            grade,
            status,
            statusText,
            rrText,
            warningsText: warnings.length ? warnings.join(' | ') : 'none',
            breakdownText,
            contextScore,
            triggerScore,
            entryScore,
            riskScore,
            penalties,
            autoTargetUsed
        };
    };

    const calculateStock15MFromInputs = (inputs) => {
        const safeInputs = inputs && typeof inputs === 'object' ? inputs : {};
        const stock4hResult = calculateStock4HFromInputs(safeInputs);
        const planDirection = stock4hResult.planDirectionText === 'Bullish'
            ? 'bullish'
            : stock4hResult.planDirectionText === 'Bearish'
                ? 'bearish'
                : '';
        return calculateStock15M({
            bias: String(safeInputs.score_stk15m_bias || ''),
            structure: String(safeInputs.score_stk15m_structure || ''),
            vwap: String(safeInputs.score_stk15m_vwap || ''),
            locationVs4h: String(safeInputs.score_stk15m_location_vs_4h || ''),
            entryType: String(safeInputs.score_stk15m_entry_type || ''),
            triggerStatus: String(safeInputs.score_stk15m_trigger_status || ''),
            volume: String(safeInputs.score_stk15m_volume || ''),
            stopLogic: String(safeInputs.score_stk15m_stop_logic || ''),
            timeOfDay: String(safeInputs.score_stk15m_time_of_day || ''),
            liquidityEvent: String(safeInputs.score_stk15m_liquidity_event || ''),
            entry: safeInputs.score_stk15m_entry,
            stop: safeInputs.score_stk15m_stop,
            target: safeInputs.score_stk15m_target,
            planDirection
        }, stock4hResult);
    };

    const buildSnapshotModules = (item) => {
        const modules = [];
        const marketScore = Number(item && item.score);
        if (Number.isFinite(marketScore)) {
            modules.push({
                key: 'spy_1d',
                label: 'SPY 1D',
                score: marketScore,
                max: 100,
                permission: item.permission || 'No data'
            });
        }

        const stockResult = calculateStock1DFromInputs(item && item.inputs);
        if (stockResult.permission !== 'No data') {
            const rawTicker = String((item && item.inputs && item.inputs.score_stk1d_ticker) || '').trim();
            const tickerLabel = rawTicker ? `${rawTicker.toUpperCase()} 1D` : 'Ticker 1D';
            modules.push({
                key: 'ticker_1d',
                label: tickerLabel,
                score: stockResult.score100,
                max: 100,
                permission: stockResult.permission
            });
        }

        const stock4hResult = calculateStock4HFromInputs(item && item.inputs);
        if (stock4hResult.grade !== 'No data') {
            const rawTicker = String((item && item.inputs && item.inputs.score_stk1d_ticker) || '').trim();
            const tickerLabel = rawTicker ? `${rawTicker.toUpperCase()} 4H` : 'Ticker 4H';
            modules.push({
                key: 'ticker_4h',
                label: tickerLabel,
                score: stock4hResult.score20,
                max: 20,
                permission: stock4hResult.grade
            });
        }
        const stock15mResult = calculateStock15MFromInputs(item && item.inputs);
        if (stock15mResult.grade !== 'No data') {
            const rawTicker = String((item && item.inputs && item.inputs.score_stk1d_ticker) || '').trim();
            const tickerLabel = rawTicker ? `${rawTicker.toUpperCase()} 15m` : 'Ticker 15m';
            modules.push({
                key: 'ticker_15m',
                label: tickerLabel,
                score: stock15mResult.score20,
                max: 20,
                permission: stock15mResult.grade
            });
        }

        return modules;
    };

    const collectFormInputs = () => {
        const data = {};
        const fields = form.querySelectorAll('input[name], select[name], textarea[name]');
        // Ensure snapshot always contains all score_* keys, even when empty/unselected.
        const seen = new Set();
        fields.forEach((field) => {
            if (!field.name.startsWith('score_')) return;
            if (seen.has(field.name)) return;
            seen.add(field.name);
            if (field.type === 'checkbox') {
                data[field.name] = false;
            } else {
                data[field.name] = '';
            }
        });
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
        if (values.roomLevelsSource === 'legacy' && permission === 'Allowed') {
            permission = 'Reduced';
            if (size === '1.0x') size = '0.5x';
            reasons.push('Cap Reduced: room barrier from legacy fallback');
        }
        if (values.roomForced && permission === 'Allowed') {
            permission = 'Reduced';
            if (size === '1.0x') size = '0.5x';
            reasons.push('Cap Reduced: forced limited room fallback');
        }

        let riskState = 'Neutral';
        const riskOff = (values.vixLevel === 'gt25' && values.vixTrend === 'rising') || values.trendStrength === 'below_key_mas' || values.qqq200 === 'below';
        const riskOn = values.trendStrength === 'above_key_mas' && values.qqq200 === 'above' && !(values.vixLevel === 'gt25' && values.vixTrend === 'rising');
        if (riskOff) riskState = 'Risk-off';
        else if (riskOn) riskState = 'Risk-on';

        let macroMode = 'Normal';
        if (values.regime === 'volatile' || (values.vixLevel === 'gt25' && values.vixTrend === 'rising')) macroMode = 'Defensive';
        else if ((values.vixLevel === '20_25' && values.vixTrend === 'rising') || values.vixLevel === 'gt25') macroMode = 'Cautious';
        if (values.breadth === 'strong' && macroMode === 'Cautious') macroMode = 'Normal';

        const macroRequiredRr15 = macroMode === 'Defensive' ? 2.2 : macroMode === 'Cautious' ? 1.8 : 1.5;
        const macroRequiredRr4h = macroMode === 'Defensive' ? 1.6 : macroMode === 'Cautious' ? 1.4 : 1.3;
        const macroSizeCap = macroMode === 'Defensive' ? '0.4x' : macroMode === 'Cautious' ? '0.7x' : '1.0x';

        let edgeType = 'No Clear Edge';
        if ((values.regime === 'trend_up' || values.regime === 'trend_down') && values.location === 'post_break_retest') edgeType = 'Trend Continuation';
        else if ((values.location === 'breakout_attempt' || values.location === 'breakdown_attempt') && values.momentumCondition === 'expanding') edgeType = 'Breakout Expansion';
        else if (values.momentumCondition === 'exhausted' && (values.location === 'at_support' || values.location === 'at_resistance')) edgeType = 'Mean Reversion';

        return {
            rawScore,
            aScore,
            bScore,
            cScore,
            permission,
            size,
            reasons,
            riskState,
            edgeType,
            macroMode,
            macroRequiredRr15,
            macroRequiredRr4h,
            macroSizeCap,
            roomLevelsSource: values.roomLevelsSource || 'unknown'
        };
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

    const parseRRNumber = (rrText) => {
        const m = String(rrText || '').match(/([0-9]+(?:\.[0-9]+)?)R/);
        if (!m) return null;
        const n = Number(m[1]);
        return Number.isFinite(n) ? n : null;
    };

    const findPatternStat = (rows, name) => {
        const key = String(name || '').trim();
        if (!key || !Array.isArray(rows)) return null;
        return rows.find((r) => String(r?.name || '') === key) || null;
    };

    const renderDecisionChecklist = (rows) => {
        if (!decisionChecklistBodyEl) return;
        if (!Array.isArray(rows) || !rows.length) {
            decisionChecklistBodyEl.innerHTML = '<tr><td colspan="5">No data</td></tr>';
            return;
        }
        const mark = (ok) => ok
            ? '<span class="decision-check-pass">✓</span>'
            : '<span class="decision-check-fail">-</span>';
        decisionChecklistBodyEl.innerHTML = rows.map((r) => `
            <tr>
                <td>${r.condition}</td>
                <td>${r.current || '-'}</td>
                <td>${mark(r.short)}</td>
                <td>${mark(r.medium)}</td>
                <td>${mark(r.swing)}</td>
            </tr>
        `).join('');
    };

    const renderDecision = ({
        spyReady,
        spyResult,
        stockResult,
        stock4hResult,
        stock15mResult,
        stock15mInputs
    }) => {
        const spyStatus = spyReady ? spyResult.permission : 'No data';
        const oneDStatus = stockResult.permission || 'No data';
        const fourHStatus = stock4hResult.status || 'No data';
        const fifteenStatus = stock15mResult.status || 'No data';
        const trigger = stock15mInputs.triggerStatus || '';
        const entryType = stock15mInputs.entryType || '';

        const spyLine = spyReady
            ? `${spyResult.permission}, ${spyResult.riskState}, size ${spyResult.size}`
            : 'No data';
        const oneDLine = oneDStatus === 'No data' ? 'No data' : oneDStatus;
        const fourHLine = fourHStatus === 'No data'
            ? 'No data'
            : `${fourHStatus}, direction ${stock4hResult.planDirectionText || 'No data'}, R:R ${stock4hResult.rrText}`;
        const fifteenLine = fifteenStatus === 'No data'
            ? 'No data'
            : `${fifteenStatus}, trigger ${trigger || 'No data'}, location ${stock15mInputs.locationVs4h || 'No data'}, R:R ${stock15mResult.rrText}`;

        const direction = (stock4hResult.planDirectionText || '').toLowerCase();
        const rr15 = parseRRNumber(stock15mResult.rrText);
        const rr4h = parseRRNumber(stock4hResult.rrText);
        const macroMode = spyReady ? (spyResult.macroMode || 'Normal') : 'No data';
        const macroRequiredRr15 = spyReady ? Number(spyResult.macroRequiredRr15 || 1.5) : null;
        const macroRequiredRr4h = spyReady ? Number(spyResult.macroRequiredRr4h || 1.3) : null;
        const macroSizeCap = spyReady ? (spyResult.macroSizeCap || '1.0x') : '-';

        let setupSuggestion = 'No data';

        const notes = [];
        if (spyStatus === 'No-trade') notes.push('Blocked by SPY gatekeeper.');
        if (oneDStatus === 'No-trade') notes.push('Blocked by Ticker 1D.');
        if (fourHStatus === 'No-trade') notes.push('Blocked by Ticker 4H.');
        if (fifteenStatus === 'No-trade') notes.push('Blocked by Ticker 15m.');
        if (trigger === 'no_trigger') notes.push('15m trigger not confirmed.');
        if (trigger === 'failed') notes.push('15m trigger failed.');
        if (stock15mInputs.locationVs4h === 'chasing_breakout') notes.push('15m location is chasing breakout.');
        if (stock4hResult.warningsText && stock4hResult.warningsText !== 'none') notes.push(`4H warnings: ${stock4hResult.warningsText}`);
        if (stock15mResult.warningsText && stock15mResult.warningsText !== 'none') notes.push(`15m warnings: ${stock15mResult.warningsText}`);

        let optionSide = 'No data';
        const setupLc = String(setupSuggestion || '').toLowerCase();
        if (setupLc.includes('call')) optionSide = 'CALL';
        else if (setupLc.includes('put')) optionSide = 'PUT';
        else if (direction === 'bullish') optionSide = 'CALL';
        else if (direction === 'bearish') optionSide = 'PUT';

        const spyOk = spyStatus !== 'No-trade' && spyStatus !== 'No data';
        const oneDOk = oneDStatus !== 'No-trade' && oneDStatus !== 'No data';
        const fourHOk = fourHStatus !== 'No-trade' && fourHStatus !== 'No data';
        const fifteenOk = fifteenStatus !== 'No-trade' && fifteenStatus !== 'No data';
        const triggerConfirmed = trigger === 'confirmed';
        const directionDefined = direction === 'bullish' || direction === 'bearish';
        const noChase = stock15mInputs.locationVs4h !== 'chasing_breakout' && Boolean(stock15mInputs.locationVs4h);
        const goodLocation = stock15mInputs.locationVs4h === 'planned_zone' || stock15mInputs.locationVs4h === 'early';
        const rr4h13 = rr4h !== null && rr4h >= 1.3;
        const rr4h14 = rr4h !== null && rr4h >= 1.4;
        const rr4h15 = rr4h !== null && rr4h >= 1.5;
        const rr1515 = rr15 !== null && rr15 >= 1.5;
        const rr1517 = rr15 !== null && rr15 >= 1.7;
        const rr1520 = rr15 !== null && rr15 >= 2.0;
        const notMidday = stock15mInputs.timeOfDay ? stock15mInputs.timeOfDay !== 'midday' : false;
        const liqNotFailed = stock15mResult.warningsText ? !String(stock15mResult.warningsText).toLowerCase().includes('failed breakout') : true;
        const shortEntryTypeOk = ['break_hold', 'range_breakout', 'sweep_reclaim'].includes(entryType);
        const mediumEntryTypeOk = ['break_hold', 'reclaim_level', 'pullback_vwap', 'range_breakout', 'sweep_reclaim'].includes(entryType);
        const swingEntryTypeOk = entryType !== '-' && Boolean(entryType);
        const shortStrictStatus = (fourHStatus === 'Allowed') && (fifteenStatus === 'Allowed');
        const mediumStrictStatus = (fourHStatus === 'Allowed' || fourHStatus === 'Reduced') && (fifteenStatus === 'Allowed' || fifteenStatus === 'Reduced');
        const swingStrictStatus = fourHOk && fifteenOk;
        const shortTimeOk = stock15mInputs.timeOfDay === 'open' || stock15mInputs.timeOfDay === 'power_hour';
        const mediumTimeOk = stock15mInputs.timeOfDay !== 'midday' && Boolean(stock15mInputs.timeOfDay);
        const swingTimeOk = Boolean(stock15mInputs.timeOfDay);

        const rr4hMacroOk = rr4h !== null && macroRequiredRr4h !== null && rr4h >= macroRequiredRr4h;
        const rr15MacroOk = rr15 !== null && macroRequiredRr15 !== null && rr15 >= macroRequiredRr15;
        const macroLocationOk = macroMode !== 'Defensive' || goodLocation;
        const spyVeto = spyStatus === 'No-trade' || spyStatus === 'No data';
        // Overfitting guardrail:
        // Keep one hard gate ("edge exists"), treat everything else as modifiers.
        const edgeExists = !spyVeto &&
            fourHOk &&
            fifteenOk &&
            directionDefined &&
            triggerConfirmed &&
            rr4hMacroOk &&
            rr15MacroOk &&
            macroLocationOk;

        let modifierPenalty = 0;
        if (macroMode === 'Cautious') modifierPenalty += 1;
        if (macroMode === 'Defensive') modifierPenalty += 2;
        if (spyStatus === 'Reduced') modifierPenalty += 1;
        if (oneDStatus === 'Reduced') modifierPenalty += 1;
        if (oneDStatus === 'No-trade') modifierPenalty += 2;
        if (fourHStatus === 'Reduced') modifierPenalty += 1;
        if (fifteenStatus === 'Reduced') modifierPenalty += 1;
        if (!noChase) modifierPenalty += 1;
        if (!liqNotFailed) modifierPenalty += 1;
        if (!notMidday) modifierPenalty += 1;
        if (stock15mInputs.locationVs4h === 'late_extended') modifierPenalty += 1;

        const setupTypeCurrent = String(stock4hResult.setupType || getChoiceValue('score_stk4h_setup_type') || '');
        const continuationSetups = ['pullback_continuation', 'breakout_continuation', 'breakdown_continuation'];
        const rangeReversalSetups = ['range_play', 'reversal_attempt'];
        const isContinuationSetup = continuationSetups.includes(setupTypeCurrent);
        const isRangeReversalSetup = rangeReversalSetups.includes(setupTypeCurrent);
        const roomForced4h = Boolean(stock4hResult.roomForcedLimited);
        const strong15mTrigger = triggerConfirmed &&
            (stock15mInputs.volume === 'increasing_move' || stock15mInputs.volume === 'reduced_pullbacks' || stock15mInputs.volume === 'normal');

        let overall = 'No data';
        if (spyReady && oneDStatus !== 'No data' && fourHStatus !== 'No data' && fifteenStatus !== 'No data') {
            if (!edgeExists) overall = 'No-trade';
            else overall = modifierPenalty <= 1 ? 'Allowed' : 'Reduced';
        }
        if (overall === 'Allowed' && roomForced4h) {
            if (isContinuationSetup) {
                overall = 'Reduced';
                notes.push('Forced limited room on continuation setup: max Reduced.');
            } else if (isRangeReversalSetup && !(rr15 !== null && rr15 >= 2.0 && strong15mTrigger)) {
                overall = 'Reduced';
                notes.push('Forced limited room on range/reversal without RR>=2 + strong 15m trigger: max Reduced.');
            }
        }
        const overallAllowed = overall === 'Allowed';
        const overallAllowedOrReduced = overall === 'Allowed' || overall === 'Reduced';

        const shortReady = edgeExists && shortStrictStatus && shortEntryTypeOk && rr4h15 && rr1520 && shortTimeOk && noChase && liqNotFailed && macroMode === 'Normal';
        const mediumReady = edgeExists && mediumStrictStatus && mediumEntryTypeOk && rr4h14 && rr1517 && mediumTimeOk && noChase && liqNotFailed && macroMode !== 'Defensive';
        const swingReady = edgeExists && swingStrictStatus && swingEntryTypeOk && rr4h13 && rr1515 && swingTimeOk;
        const entryStats = findPatternStat(patternStatsCache?.entry_type, entryType);
        const triggerStats = findPatternStat(patternStatsCache?.trigger_status, trigger);
        const setupStats = findPatternStat(patternStatsCache?.setup_type, setupTypeCurrent);
        const winrates = [entryStats?.winrate, triggerStats?.winrate, setupStats?.winrate].filter((v) => Number.isFinite(v));
        const resolvedCounts = [entryStats?.resolved, triggerStats?.resolved, setupStats?.resolved].filter((v) => Number.isFinite(v));
        const avgWinrate = winrates.length ? (winrates.reduce((a, b) => a + b, 0) / winrates.length) : null;
        const resolvedDepth = resolvedCounts.length ? Math.max(...resolvedCounts) : 0;

        let confidence = 0;
        if (!edgeExists) confidence = 20;
        else {
            confidence = 72 - (modifierPenalty * 8);
            if (shortReady) confidence += 8;
            else if (mediumReady) confidence += 4;
            if (avgWinrate !== null && resolvedDepth >= 5) confidence += (avgWinrate - 50) * 0.25;
            if (resolvedDepth < 5) confidence -= 6;
            if (resolvedDepth >= 20) confidence += 4;
        }
        confidence = Math.max(5, Math.min(95, Math.round(confidence)));

        let preferredDteNow = 'No clear DTE';
        if (shortReady) preferredDteNow = '7-14 DTE';
        else if (mediumReady) preferredDteNow = '15-30 DTE';
        else if (swingReady) preferredDteNow = '30-60 DTE';

        if (overall === 'No-trade') {
            setupSuggestion = 'No setup: wait for alignment (SPY, 1D, 4H, 15m) and valid trigger.';
        } else if (direction === 'bullish' || direction === 'bearish') {
            const isBull = direction === 'bullish';
            const triggerTxt = trigger === 'confirmed'
                ? 'Entry allowed on confirmed 15m trigger'
                : 'Wait for 15m confirmed trigger';
            const entryTxt = entryType ? `Entry model: ${entryType}` : 'Entry model: n/a';
            if (shortReady) {
                setupSuggestion = `${isBull ? 'Short-term Bull Call' : 'Short-term Bear Call'} | 7-14 DTE | ${triggerTxt} | ${entryTxt}`;
            } else if (mediumReady) {
                setupSuggestion = `${isBull ? 'Bull Call' : 'Bear Put'} | 15-30 DTE | ${triggerTxt} | ${entryTxt}`;
            } else if (swingReady) {
                setupSuggestion = `${isBull ? 'Bull call debit spread' : 'Bear put debit spread'} | 30-60 DTE | ${triggerTxt} | ${entryTxt}`;
            } else {
                setupSuggestion = 'No setup: conditions are not met for any DTE bucket yet.';
            }
        } else {
            setupSuggestion = 'No clear directional setup: prefer wait/no-trade for options.';
        }

        const checklistRows = [
            {
                condition: 'Horizon readiness (final gate)',
                current: `Preferred now: ${preferredDteNow}`,
                short: shortReady,
                medium: mediumReady,
                swing: swingReady
            },
            {
                condition: 'EDGE EXISTS (main gate)',
                current: edgeExists ? 'TRUE' : 'FALSE',
                short: edgeExists,
                medium: edgeExists,
                swing: edgeExists
            },
            {
                condition: 'Modifiers penalty (not a gate)',
                current: `${modifierPenalty} (<=1 Allowed, >=2 Reduced)`,
                short: modifierPenalty <= 1,
                medium: modifierPenalty <= 3,
                swing: true
            },
            {
                condition: 'Macro mode',
                current: `${macroMode} | RR15>=${macroRequiredRr15 ?? '-'} | RR4H>=${macroRequiredRr4h ?? '-'} | size cap ${macroSizeCap}`,
                short: macroMode === 'Normal',
                medium: macroMode === 'Normal' || macroMode === 'Cautious',
                swing: macroMode !== 'No data'
            },
            {
                condition: 'SPY gatekeeper active (not No-trade)',
                current: spyStatus,
                short: spyOk,
                medium: spyOk,
                swing: spyOk
            },
            {
                condition: 'Ticker 1D active (not No-trade)',
                current: oneDStatus,
                short: oneDOk,
                medium: oneDOk,
                swing: oneDOk
            },
            {
                condition: '4H status strictness',
                current: fourHStatus,
                short: fourHStatus === 'Allowed',
                medium: fourHStatus === 'Allowed' || fourHStatus === 'Reduced',
                swing: fourHOk
            },
            {
                condition: '15m status strictness',
                current: fifteenStatus,
                short: fifteenStatus === 'Allowed',
                medium: fifteenStatus === 'Allowed' || fifteenStatus === 'Reduced',
                swing: fifteenOk
            },
            {
                condition: 'Direction from 4H is defined',
                current: direction || 'No data',
                short: directionDefined,
                medium: directionDefined,
                swing: directionDefined
            },
            {
                condition: '15m trigger confirmed',
                current: trigger || 'No data',
                short: triggerConfirmed,
                medium: triggerConfirmed,
                swing: triggerConfirmed
            },
            {
                condition: '15m location requirement',
                current: stock15mInputs.locationVs4h || 'No data',
                short: goodLocation,
                medium: goodLocation || noChase,
                swing: noChase
            },
            {
                condition: '15m entry model fit',
                current: entryType || 'No data',
                short: shortEntryTypeOk,
                medium: mediumEntryTypeOk,
                swing: swingEntryTypeOk
            },
            {
                condition: '4H R:R threshold',
                current: rr4h === null ? 'No data' : `${rr4h.toFixed(2)}R`,
                short: rr4h15,
                medium: rr4h14,
                swing: rr4h13
            },
            {
                condition: '15m R:R threshold',
                current: rr15 === null ? 'No data' : `${rr15.toFixed(2)}R`,
                short: rr1520,
                medium: rr1517,
                swing: rr1515
            },
            {
                condition: 'Overall decision quality',
                current: overall,
                short: overallAllowed,
                medium: overallAllowedOrReduced,
                swing: overallAllowedOrReduced
            },
            {
                condition: 'Time-of-day requirement',
                current: stock15mInputs.timeOfDay || 'No data',
                short: shortTimeOk,
                medium: mediumTimeOk,
                swing: swingTimeOk
            },
            {
                condition: 'No failed-breakout warning',
                current: stock15mResult.warningsText || 'none',
                short: liqNotFailed,
                medium: liqNotFailed,
                swing: liqNotFailed
            }
        ];
        renderDecisionChecklist(checklistRows);

        const drivers = [];
        if (edgeExists) drivers.push('Main edge gate is TRUE');
        if (spyOk) drivers.push('SPY gatekeeper is active');
        if (oneDOk) drivers.push('Ticker 1D is active');
        if (fourHOk) drivers.push('Ticker 4H is active');
        if (triggerConfirmed) drivers.push('15m trigger is confirmed');
        if (goodLocation) drivers.push('15m entry location is planned/early');
        if (rr4hMacroOk) drivers.push(`4H R:R meets macro threshold (${macroRequiredRr4h}R)`);
        if (rr15MacroOk) drivers.push(`15m R:R meets macro threshold (${macroRequiredRr15}R)`);
        if (noChase) drivers.push('15m is not chasing breakout');

        const blockers = [];
        if (!edgeExists) blockers.push('Main edge gate is FALSE');
        if (spyVeto) blockers.push('SPY veto is active (No-trade or No data)');
        if (!spyOk) blockers.push('SPY gatekeeper is not active');
        if (!oneDOk) blockers.push('Ticker 1D is not active');
        if (!fourHOk) blockers.push('Ticker 4H is not active');
        if (!fifteenOk) blockers.push('Ticker 15m is not active');
        if (!triggerConfirmed) blockers.push('15m trigger is not confirmed');
        if (!directionDefined) blockers.push('4H plan direction is not defined');
        if (!rr4hMacroOk) blockers.push(`4H R:R is below macro threshold (${macroRequiredRr4h}R)`);
        if (!rr15MacroOk) blockers.push(`15m R:R is below macro threshold (${macroRequiredRr15}R)`);
        if (!noChase) blockers.push('15m is chasing breakout');
        if (!notMidday) blockers.push('Entry is in midday liquidity');
        if (!liqNotFailed) blockers.push('Failed-breakout warning is present');
        if (!macroLocationOk) blockers.push('Defensive macro mode requires planned/early location');
        if (modifierPenalty >= 2) blockers.push(`Modifiers penalty is high (${modifierPenalty}), status downgraded to Reduced`);
        if (notes.length) blockers.push(...notes);

        const driverLines = (drivers.length ? drivers : ['No strong positive drivers yet'])
            .slice(0, 6)
            .map((x) => `- ${x}`)
            .join('\n');
        const blockerLines = (blockers.length ? blockers : ['No major blockers'])
            .slice(0, 6)
            .map((x) => `- ${x}`)
            .join('\n');
        const setupSuggestionLines = String(setupSuggestion || 'No data')
            .split('|')
            .map((s) => s.trim())
            .filter(Boolean)
            .map((s) => `- ${s}`)
            .join('\n') || '- No data';

        const unifiedDecision = [
            `Decision: ${overall}`,
            ``,
            `Confidence: ${confidence}%`,
            ``,
            `Option side: ${optionSide}`,
            ``,
            `Suggested options setup`,
            `${setupSuggestionLines}`,
            ``,
            `Macro risk modulator`,
            `- Mode: ${macroMode}`,
            `- Required RR (15m): >= ${macroRequiredRr15 ?? '-'}`,
            `- Required RR (4H): >= ${macroRequiredRr4h ?? '-'}`,
            `- Size cap: ${macroSizeCap}`,
            `- Modifiers penalty: ${modifierPenalty} (<=1 Allowed, >=2 Reduced)`,
            ``,
            `Probabilistic pattern stats (realized)`,
            `- Entry type (${entryType || 'n/a'}): ${entryStats && Number.isFinite(entryStats.winrate) ? `${entryStats.winrate}% winrate` : 'no resolved history yet'} | samples ${entryStats?.samples ?? 0}, resolved ${entryStats?.resolved ?? 0}`,
            `- Trigger (${trigger || 'n/a'}): ${triggerStats && Number.isFinite(triggerStats.winrate) ? `${triggerStats.winrate}% winrate` : 'no resolved history yet'} | samples ${triggerStats?.samples ?? 0}, resolved ${triggerStats?.resolved ?? 0}`,
            `- Setup (${setupTypeCurrent || 'n/a'}): ${setupStats && Number.isFinite(setupStats.winrate) ? `${setupStats.winrate}% winrate` : 'no resolved history yet'} | samples ${setupStats?.samples ?? 0}, resolved ${setupStats?.resolved ?? 0}`,
            ``,
            `Context`,
            `- SPY: ${spyLine}`,
            `- Ticker 1D: ${oneDLine}`,
            `- Ticker 4H: ${fourHLine}`,
            `- Ticker 15m: ${fifteenLine}`,
            ``,
            `Most Important Drivers`,
            `${driverLines}`,
            ``,
            `Main Risks / Blockers`,
            `${blockerLines}`
        ].join('\n');
        if (decisionOverallHeadEl) decisionOverallHeadEl.textContent = overall;
        if (decisionTextEl) decisionTextEl.textContent = unifiedDecision;
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

        const stockValues = {
            manualBias: getRadio('score_stk1d_bias'),
            biasManualOverride: isChecked('score_stk1d_bias_manual_override'),
            alignment: getRadio('score_stk1d_alignment'),
            regime: getRadio('score_stk1d_regime'),
            structure: getRadio('score_stk1d_structure'),
            trendStrength: getRadio('score_stk1d_trend_strength'),
            momentumCondition: getRadio('score_stk1d_momentum'),
            rsState: getRadio('score_stk1d_rs_state'),
            rsTrend: getRadio('score_stk1d_rs_trend'),
        };
        const getInput = (name) => form.querySelector(`[name="${name}"]`)?.value || '';
        const stock4hValues = {
            biasVs1DHint: getChoiceValue('score_stk4h_bias_vs_1d_hint'),
            bias1dAuto: getChoiceValue('score_stk4h_bias_1d_auto'),
            bias4hAuto: getChoiceValue('score_stk4h_bias_4h_auto'),
            structureAuto: getChoiceValue('score_stk4h_structure_auto'),
            trendStrengthAuto: getChoiceValue('score_stk4h_trend_strength_auto'),
            trendQualityAuto: getChoiceValue('score_stk4h_trend_quality_auto'),
            regimeAuto: getChoiceValue('score_stk4h_regime_auto'),
            vwapStateAuto: getChoiceValue('score_stk4h_vwap_state_auto'),
            locationHint: getChoiceValue('score_stk4h_location_hint'),
            liquidityHint: getChoiceValue('score_stk4h_liquidity_hint'),
            setupType: getChoiceValue('score_stk4h_setup_type'),
            confirmation: getChoiceValue('score_stk4h_confirmation'),
            invalidationLogic: getChoiceValue('score_stk4h_invalidation_logic'),
            close: getInput('score_stk4h_close'),
            atr14: getInput('score_stk4h_atr14'),
            supportAuto: getInput('score_stk4h_support_auto'),
            resistanceAuto: getInput('score_stk4h_resistance_auto'),
            swingHigh: getInput('score_stk4h_swing_high'),
            swingLow: getInput('score_stk4h_swing_low'),
            pwh: getInput('score_stk4h_pwh'),
            pwl: getInput('score_stk4h_pwl'),
            dch20: getInput('score_stk4h_dch20'),
            dcl20: getInput('score_stk4h_dcl20'),
            rangeHigh: getInput('score_stk4h_range_high'),
            rangeLow: getInput('score_stk4h_range_low'),
            roomBarrierChoice: getInput('score_stk4h_room_barrier_choice'),
            roomNoiseAtr: getInput('score_stk4h_room_noise_atr'),
            roomMinAtr: getInput('score_stk4h_room_min_atr'),
            entry: getInput('score_stk4h_entry'),
            stop: getInput('score_stk4h_stop'),
            target: getInput('score_stk4h_target')
        };
        const stock4hSuggestions = deriveStock4HSuggestions(stock4hValues);
        const stk4hPlanManual = Boolean(stk4hPlanOverrideEl && stk4hPlanOverrideEl.checked);
        if (!stk4hPlanManual) {
            setChoiceValue('score_stk4h_setup_type', stock4hSuggestions.setup);
            setChoiceValue('score_stk4h_confirmation', stock4hSuggestions.confirmation);
            setChoiceValue('score_stk4h_invalidation_logic', stock4hSuggestions.invalidation);
            if (stk4hEntryEl && stock4hSuggestions.entryValue) stk4hEntryEl.value = stock4hSuggestions.entryValue;
            if (stk4hStopEl && stock4hSuggestions.stopValue) stk4hStopEl.value = stock4hSuggestions.stopValue;
            if (stk4hTargetEl && stock4hSuggestions.targetValue) stk4hTargetEl.value = stock4hSuggestions.targetValue;
        }
        const autoStockBias = computeAutoBiasFromState(
            stockValues.regime,
            stockValues.structure,
            stockValues.trendStrength,
            stockValues.momentumCondition
        );
        const effectiveStockBias = stockValues.biasManualOverride && stockValues.manualBias ? stockValues.manualBias : autoStockBias;
        stockValues.bias = effectiveStockBias;
        stockValues.biasMode = stockValues.biasManualOverride ? 'manual_override' : 'auto';
        stockValues.momentum = stockValues.momentumCondition;
        const autoStockRoomOut = updateStockRoomSuggestionManual(effectiveStockBias);
        const autoStockRoom = autoStockRoomOut ? autoStockRoomOut.room : null;
        const manualStockRoom = getRadio('score_stk1d_room_to_move');
        const stockManualRoomOverride = isChecked('score_stk1d_bias_manual_override');
        stockValues.room = stockManualRoomOverride && manualStockRoom ? manualStockRoom : autoStockRoom;
        stockValues.roomLevelsSource = stockManualRoomOverride ? 'manual' : (autoStockRoomOut ? autoStockRoomOut.levelsSource : 'unknown');
        stockValues.roomForced = !stockManualRoomOverride && Boolean(autoStockRoomOut && autoStockRoomOut.forcedLimited);
        if (stk1dRoomEffectiveEl) {
            const modeLabel = stockManualRoomOverride ? 'Manual override' : 'Auto';
            stk1dRoomEffectiveEl.textContent = `Auto room: ${roomLabel(autoStockRoom)} | Effective: ${roomLabel(stockValues.room)} (${modeLabel}, source ${stockValues.roomLevelsSource})`;
        }

        if (stk1dBiasAutoEl) {
            const modeLabel = stockValues.biasManualOverride ? 'Manual override' : 'Auto';
            stk1dBiasAutoEl.textContent = `Auto bias: ${autoStockBias} | Effective: ${effectiveStockBias} (${modeLabel})`;
        }

        const stockResult = calculateStock1D(stockValues);
        if (stk1dScoreHeadEl) stk1dScoreHeadEl.textContent = stockResult.permission === 'No data' ? 'No data' : `${stockResult.score100} / 100`;
        if (stk1dPermissionHeadEl) stk1dPermissionHeadEl.textContent = stockResult.permission;
        if (stk1dPermissionEl) stk1dPermissionEl.textContent = stockResult.permission === 'No data' ? 'No data' : `${stockResult.permission} (${stockResult.score100}/100)`;
        if (stk1dInvalidationEl) stk1dInvalidationEl.textContent = stockResult.invalidation;

        const stock4hResult = calculateStock4H({
            biasVs1DHint: stock4hValues.biasVs1DHint,
            bias1dAuto: stock4hValues.bias1dAuto,
            bias4hAuto: stock4hValues.bias4hAuto,
            structureAuto: stock4hValues.structureAuto,
            trendStrengthAuto: stock4hValues.trendStrengthAuto,
            trendQualityAuto: stock4hValues.trendQualityAuto,
            regimeAuto: stock4hValues.regimeAuto,
            vwapStateAuto: stock4hValues.vwapStateAuto,
            locationHint: stock4hValues.locationHint,
            liquidityHint: stock4hValues.liquidityHint,
            setupType: stock4hValues.setupType,
            confirmation: stock4hValues.confirmation,
            invalidationLogic: stock4hValues.invalidationLogic,
            close: stock4hValues.close,
            atr14: stock4hValues.atr14,
            supportAuto: stock4hValues.supportAuto,
            resistanceAuto: stock4hValues.resistanceAuto,
            pwh: stock4hValues.pwh,
            pwl: stock4hValues.pwl,
            entry: stock4hValues.entry,
            stop: stock4hValues.stop,
            target: stock4hValues.target,
            manualPlanOverride: stk4hPlanManual,
            hasRiskLevels: Boolean(
                parseLevel(stock4hValues.entry) !== null &&
                parseLevel(stock4hValues.stop) !== null &&
                parseLevel(stock4hValues.target) !== null
            )
        }, stockResult);
        if (stk4hScoreHeadEl) stk4hScoreHeadEl.textContent = stock4hResult.grade === 'No data' ? 'No data' : `${stock4hResult.score20} / 20`;
        if (stk4hGradeHeadEl) stk4hGradeHeadEl.textContent = stock4hResult.grade;
        if (stk4hStatusHeadEl) stk4hStatusHeadEl.textContent = stock4hResult.status;
        if (stk4hRrEl) stk4hRrEl.textContent = `R:R: ${stock4hResult.rrText}`;
        if (stk4hRoomEl) stk4hRoomEl.textContent = `Room: ${stock4hResult.roomText || 'No data'}`;
        if (stk4hPlanDirectionEl) stk4hPlanDirectionEl.textContent = `Plan direction: ${stock4hResult.planDirectionText || 'No data'}`;
        if (stk4hPlanSourceEl) stk4hPlanSourceEl.textContent = `Plan source: ${stock4hResult.planSourceText || 'No data'}`;
        if (stk4hBreakdownEl) stk4hBreakdownEl.textContent = stock4hResult.grade === 'No data'
            ? 'Structure: 0/8 | Setup: 0/6 | Risk: 0/6 | Penalties: 0'
            : `Structure: ${stock4hResult.structureScore}/8 | Setup: ${stock4hResult.setupScore}/6 | Risk: ${stock4hResult.riskScore}/6 | Penalties: ${stock4hResult.penalties}`;
        if (stk4hStatusEl) {
            const statusPart = stock4hResult.grade === 'No data' ? 'No data' : stock4hResult.statusText;
            const warnPart = stock4hResult.warningsText || 'none';
            stk4hStatusEl.textContent = `Status: ${statusPart} | Warnings: ${warnPart}`;
        }

        const planDirection15m = stock4hResult.planDirectionText === 'Bullish'
            ? 'bullish'
            : stock4hResult.planDirectionText === 'Bearish'
                ? 'bearish'
                : '';
        const stk15mEntryRaw = getInput('score_stk15m_entry');
        const stk15mStopRaw = getInput('score_stk15m_stop');
        const stk15mTargetRaw = getInput('score_stk15m_target');
        if (parseLevel(stk15mTargetRaw) === null && parseLevel(stk15mEntryRaw) !== null && parseLevel(stk15mStopRaw) !== null) {
            const location15 = getChoiceValue('score_stk15m_location_vs_4h');
            const volume15 = getChoiceValue('score_stk15m_volume');
            const trigger15 = getChoiceValue('score_stk15m_trigger_status');
            const candidates = derive15mTargetCandidates({
                entry: parseLevel(stk15mEntryRaw),
                stop: parseLevel(stk15mStopRaw),
                direction: planDirection15m,
                support4h: parseLevel(stock4hResult?.levels?.support),
                resistance4h: parseLevel(stock4hResult?.levels?.resistance),
                pwh4h: parseLevel(stock4hResult?.levels?.pwh),
                pwl4h: parseLevel(stock4hResult?.levels?.pwl)
            });
            const preferT1 = location15 === 'late_extended' ||
                location15 === 'chasing_breakout' ||
                volume15 === 'weak' ||
                trigger15 !== 'confirmed';
            const chosen = preferT1
                ? (Number.isFinite(candidates.t1) ? candidates.t1 : candidates.t2)
                : (Number.isFinite(candidates.t2) ? candidates.t2 : candidates.t1);
            if (Number.isFinite(chosen)) {
                const targetInput = form.querySelector('[name="score_stk15m_target"]');
                if (targetInput) targetInput.value = String(Math.round(chosen * 100) / 100);
            }
        }
        const stock15mResult = calculateStock15M({
            bias: getChoiceValue('score_stk15m_bias'),
            structure: getChoiceValue('score_stk15m_structure'),
            vwap: getChoiceValue('score_stk15m_vwap'),
            locationVs4h: getChoiceValue('score_stk15m_location_vs_4h'),
            entryType: getChoiceValue('score_stk15m_entry_type'),
            triggerStatus: getChoiceValue('score_stk15m_trigger_status'),
            volume: getChoiceValue('score_stk15m_volume'),
            stopLogic: getChoiceValue('score_stk15m_stop_logic'),
            timeOfDay: getChoiceValue('score_stk15m_time_of_day'),
            liquidityEvent: getChoiceValue('score_stk15m_liquidity_event'),
            entry: getInput('score_stk15m_entry'),
            stop: getInput('score_stk15m_stop'),
            target: getInput('score_stk15m_target'),
            planDirection: planDirection15m
        }, stock4hResult);
        const stock15mInputs = {
            triggerStatus: getChoiceValue('score_stk15m_trigger_status'),
            entryType: getChoiceValue('score_stk15m_entry_type'),
            locationVs4h: getChoiceValue('score_stk15m_location_vs_4h'),
            timeOfDay: getChoiceValue('score_stk15m_time_of_day'),
            volume: getChoiceValue('score_stk15m_volume')
        };
        if (stk15mScoreHeadEl) stk15mScoreHeadEl.textContent = stock15mResult.grade === 'No data' ? 'No data' : `${stock15mResult.score20} / 20`;
        if (stk15mGradeHeadEl) stk15mGradeHeadEl.textContent = stock15mResult.grade;
        if (stk15mStatusHeadEl) stk15mStatusHeadEl.textContent = stock15mResult.status;
        if (stk15mRrEl) stk15mRrEl.textContent = `R:R: ${stock15mResult.rrText}`;
        if (stk15mBreakdownEl) stk15mBreakdownEl.textContent = stock15mResult.breakdownText;
        if (stk15mStatusEl) {
            const statusPart = stock15mResult.grade === 'No data' ? 'No data' : stock15mResult.statusText;
            const warnPart = stock15mResult.warningsText || 'none';
            stk15mStatusEl.textContent = `Status: ${statusPart} | Warnings: ${warnPart}`;
        }

        const autoBias = computeAutoBias(values);
        const effectiveBias = values.biasManualOverride && values.manualBias ? values.manualBias : autoBias;
        values.bias = effectiveBias;
        values.biasMode = values.biasManualOverride ? 'manual_override' : 'auto';
        const roomSuggestionOut = updateRoomSuggestionManual(effectiveBias);
        values.roomSuggestion = roomSuggestionOut ? roomSuggestionOut.room : null;
        values.roomLevelsSource = roomSuggestionOut ? roomSuggestionOut.levelsSource : 'unknown';
        values.roomForced = Boolean(roomSuggestionOut && roomSuggestionOut.forcedLimited);
        const manualRoom = getRadio('score_spy_room_to_move');
        const manualRoomOverride = isChecked('score_spy_bias_manual_override');
        values.roomToMove = manualRoomOverride && manualRoom ? manualRoom : values.roomSuggestion;
        if (manualRoomOverride) {
            values.roomLevelsSource = 'manual';
            values.roomForced = false;
        }
        if (roomEffectiveEl) {
            const modeLabel = manualRoomOverride ? 'Manual override' : 'Auto';
            roomEffectiveEl.textContent = `Auto room: ${roomLabel(values.roomSuggestion)} | Effective: ${roomLabel(values.roomToMove)} (${modeLabel}, source ${values.roomLevelsSource})`;
        }

        if (biasAutoEl) {
            const modeLabel = values.biasManualOverride ? 'Manual override' : 'Auto';
            biasAutoEl.textContent = `Auto bias: ${autoBias} | Effective: ${effectiveBias} (${modeLabel})`;
        }

        if (!hasMinimumData(values)) {
            renderDecision({
                spyReady: false,
                spyResult: { permission: 'No data', rawScore: 0, riskState: 'No data', size: '-' },
                stockResult,
                stock4hResult,
                stock15mResult,
                stock15mInputs
            });
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
        renderDecision({
            spyReady: true,
            spyResult: result,
            stockResult,
            stock4hResult,
            stock15mResult,
            stock15mInputs
        });
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
            stock15m_score: stock15mResult.score20,
            stock15m_grade: stock15mResult.grade,
            stock15m_status: stock15mResult.status,
            stock15m_rr: stock15mResult.rrText,
            stock15m_breakdown: stock15mResult.breakdownText,
            spy_room_levels_source: values.roomLevelsSource || 'unknown',
            spy_room_forced_limited: Boolean(values.roomForced),
            spy_room_barrier_used: roomSuggestionOut?.label || '',
            spy_room_skipped_noise_count: Number(roomSuggestionOut?.skippedNoise || 0),
            spy_room_skipped_too_close_count: Number(roomSuggestionOut?.skippedTooClose || 0),
            stk1d_room_levels_source: stockValues.roomLevelsSource || 'unknown',
            stk1d_room_forced_limited: Boolean(stockValues.roomForced),
            stk1d_room_barrier_used: autoStockRoomOut?.label || '',
            stk1d_room_skipped_noise_count: Number(autoStockRoomOut?.skippedNoise || 0),
            stk1d_room_skipped_too_close_count: Number(autoStockRoomOut?.skippedTooClose || 0),
            stk4h_room_levels_source: stock4hResult.roomLevelsSource || 'unknown',
            stk4h_room_forced_limited: Boolean(stock4hResult.roomForcedLimited),
            stk4h_room_barrier_used: stock4hResult.roomBarrierUsed || '',
            stk4h_room_skipped_noise_count: Number(stock4hResult.roomSkippedNoiseCount || 0),
            stk4h_room_skipped_too_close_count: Number(stock4hResult.roomSkippedTooCloseCount || 0),
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
            historyBodyEl.innerHTML = '<tr><td colspan="6">No data</td></tr>';
            return;
        }
        historyBodyEl.innerHTML = items.map((item) => {
            const modules = buildSnapshotModules(item);
            const totalScore = modules.reduce((sum, m) => sum + m.score, 0);
            const totalMax = modules.reduce((sum, m) => sum + m.max, 0);
            const totalText = modules.length ? `${totalScore} / ${totalMax}` : '-';
            const inputs = item && item.inputs && typeof item.inputs === 'object' ? item.inputs : {};
            const roomMeta = [
                `SPY: ${inputs.score_meta_spy_room_levels_source || '-'}/${inputs.score_meta_spy_room_forced_limited ? 'forced' : 'normal'}`,
                `1D: ${inputs.score_meta_stk1d_room_levels_source || '-'}/${inputs.score_meta_stk1d_room_forced_limited ? 'forced' : 'normal'}`,
                `4H: ${inputs.score_meta_stk4h_room_levels_source || '-'}/${inputs.score_meta_stk4h_room_forced_limited ? 'forced' : 'normal'}`
            ].join(' | ');
            const modulesText = modules.length
                ? modules.map((m) => `${m.label}: ${m.score}/${m.max} (${m.permission})`).join('<br>')
                : '-';
            return `
                <tr data-id="${item.id}">
                    <td>${item.session_date || '-'}</td>
                    <td>${totalText}</td>
                    <td>${modulesText}<br><small>Room source: ${roomMeta}</small></td>
                    <td>${item.size_modifier || '-'}</td>
                    <td>${item.risk_state || '-'}</td>
                    <td>
                        <button type="button" class="btn btn-secondary btn-sm score-history-load" data-id="${item.id}">Load all</button>
                        <button type="button" class="btn btn-secondary btn-sm score-history-load-spy" data-id="${item.id}">Load SPY</button>
                    </td>
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

    const fetchPatternStats = async () => {
        try {
            const res = await fetch('/api/score/pattern-stats?symbol=SPY&timeframe=1D&limit=800');
            const data = await res.json();
            if (!res.ok) throw new Error(data?.detail || `HTTP ${res.status}`);
            patternStatsCache = data;
            render();
        } catch (_) {
            patternStatsCache = null;
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

        const snapshotInputs = collectFormInputs();
        snapshotInputs.score_meta_spy_room_levels_source = latestComputed.spy_room_levels_source || 'unknown';
        snapshotInputs.score_meta_spy_room_forced_limited = Boolean(latestComputed.spy_room_forced_limited);
        snapshotInputs.score_meta_spy_room_barrier_used = latestComputed.spy_room_barrier_used || '';
        snapshotInputs.score_meta_spy_room_skipped_noise_count = Number(latestComputed.spy_room_skipped_noise_count || 0);
        snapshotInputs.score_meta_spy_room_skipped_too_close_count = Number(latestComputed.spy_room_skipped_too_close_count || 0);
        snapshotInputs.score_meta_stk1d_room_levels_source = latestComputed.stk1d_room_levels_source || 'unknown';
        snapshotInputs.score_meta_stk1d_room_forced_limited = Boolean(latestComputed.stk1d_room_forced_limited);
        snapshotInputs.score_meta_stk1d_room_barrier_used = latestComputed.stk1d_room_barrier_used || '';
        snapshotInputs.score_meta_stk1d_room_skipped_noise_count = Number(latestComputed.stk1d_room_skipped_noise_count || 0);
        snapshotInputs.score_meta_stk1d_room_skipped_too_close_count = Number(latestComputed.stk1d_room_skipped_too_close_count || 0);
        snapshotInputs.score_meta_stk4h_room_levels_source = latestComputed.stk4h_room_levels_source || 'unknown';
        snapshotInputs.score_meta_stk4h_room_forced_limited = Boolean(latestComputed.stk4h_room_forced_limited);
        snapshotInputs.score_meta_stk4h_room_barrier_used = latestComputed.stk4h_room_barrier_used || '';
        snapshotInputs.score_meta_stk4h_room_skipped_noise_count = Number(latestComputed.stk4h_room_skipped_noise_count || 0);
        snapshotInputs.score_meta_stk4h_room_skipped_too_close_count = Number(latestComputed.stk4h_room_skipped_too_close_count || 0);

        const snapshotTicker = String(snapshotInputs.score_stk1d_ticker || '').trim().toUpperCase();
        const snapshotSymbol = snapshotTicker ? `SPY|${snapshotTicker}` : 'SPY';

        const payload = {
            symbol: snapshotSymbol,
            timeframe: '1D',
            session_date: sessionDate,
            score: latestComputed.score,
            permission: latestComputed.permission,
            size_modifier: latestComputed.size_modifier,
            risk_state: latestComputed.risk_state,
            section_a: latestComputed.section_a,
            section_b: latestComputed.section_b,
            section_c: latestComputed.section_c,
            stock15m_score: latestComputed.stock15m_score,
            stock15m_grade: latestComputed.stock15m_grade,
            stock15m_status: latestComputed.stock15m_status,
            stock15m_rr: latestComputed.stock15m_rr,
            stock15m_breakdown: latestComputed.stock15m_breakdown,
            warnings: latestWarnings,
            inputs: snapshotInputs,
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
            await fetchPatternStats();
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
            const modules = buildSnapshotModules(data);
            const totalScore = modules.reduce((sum, m) => sum + m.score, 0);
            const totalMax = modules.reduce((sum, m) => sum + m.max, 0);
            const modulesText = modules.length
                ? modules.map((m) => `${m.label} ${m.score}/${m.max} (${m.permission})`).join(' | ')
                : 'No sector data';
            const inputs = data && data.inputs && typeof data.inputs === 'object' ? data.inputs : {};
            const roomMeta = `Room source SPY/1D/4H: ${inputs.score_meta_spy_room_levels_source || '-'} / ${inputs.score_meta_stk1d_room_levels_source || '-'} / ${inputs.score_meta_stk4h_room_levels_source || '-'} | forced: ${inputs.score_meta_spy_room_forced_limited ? 'Y' : 'N'}/${inputs.score_meta_stk1d_room_forced_limited ? 'Y' : 'N'}/${inputs.score_meta_stk4h_room_forced_limited ? 'Y' : 'N'}`;
            if (historyStatusEl) {
                historyStatusEl.textContent = `View ${data.session_date}: Total ${totalScore}/${totalMax}, Modules: ${modulesText}. ${roomMeta}. SPY Permission ${data.permission}, Size ${data.size_modifier}, Risk ${data.risk_state}${warnings ? `, Warnings: ${warnings}` : ''}`;
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
            updateBiasOverrideUI();
            updateStockBiasOverrideUI();
            updateRoomAtrLocks();
            updateRoomOverrideUI();
            updateStockRoomOverrideUI();
            updateStock4HPlanOverrideUI();
            render();
            await fetchPatternStats();
            if (historyStatusEl) historyStatusEl.textContent = `Loaded snapshot ${data.session_date} into form.`;
        } catch (err) {
            if (historyStatusEl) historyStatusEl.textContent = `Load failed: ${String(err)}`;
        }
    };

    const loadSnapshotSpyOnly = async (snapshotId) => {
        try {
            const res = await fetch(`/api/score/snapshots/${snapshotId}`);
            const data = await res.json();
            if (!res.ok) throw new Error(data?.detail || `HTTP ${res.status}`);
            const rawInputs = data.inputs && typeof data.inputs === 'object' ? data.inputs : {};
            const spyOnlyInputs = Object.fromEntries(
                Object.entries(rawInputs).filter(([key]) => key.startsWith('score_spy_') || key === 'score_qqq_200_state')
            );
            applyFormInputs(spyOnlyInputs);
            if (sessionDateEl) sessionDateEl.value = data.session_date || sessionDateEl.value;
            updateBiasOverrideUI();
            updateRoomAtrLocks();
            updateRoomOverrideUI();
            render();
            await fetchPatternStats();
            if (historyStatusEl) historyStatusEl.textContent = `Loaded SPY only from snapshot ${data.session_date}.`;
        } catch (err) {
            if (historyStatusEl) historyStatusEl.textContent = `Load SPY failed: ${String(err)}`;
        }
    };

    if (biasOverrideEl) biasOverrideEl.addEventListener('change', () => {
        updateBiasOverrideUI();
        updateRoomAtrLocks();
        render();
    });
    if (stk1dBiasOverrideEl) stk1dBiasOverrideEl.addEventListener('change', () => {
        updateStockBiasOverrideUI();
        updateRoomAtrLocks();
        render();
    });
    if (stk4hPlanOverrideEl) stk4hPlanOverrideEl.addEventListener('change', () => {
        updateStock4HPlanOverrideUI();
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
            if (target.classList.contains('score-history-load')) {
                loadSnapshot(id);
            } else if (target.classList.contains('score-history-load-spy')) {
                loadSnapshotSpyOnly(id);
            }
        });
    }

    setTodayDate();
    updateBiasOverrideUI();
    updateStockBiasOverrideUI();
    updateRoomAtrLocks();
    updateRoomOverrideUI();
    updateStockRoomOverrideUI();
    updateStock4HPlanOverrideUI();
    form.addEventListener('change', render);
    form.addEventListener('input', render);
    render();
    fetchHistory();
    fetchPatternStats();
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
    stk1d_rate: { tooltipText: 'Ticker Score 0-100 dla etapu 1D (ocena kandydata po Direction/Context).' },
    stk4h_rate: { tooltipText: 'Twoja ocena jakoĹ›ci ukĹ‚adu na 4H (0-99).' },
    stk1h_rate: { tooltipText: 'Twoja ocena jakoĹ›ci ukĹ‚adu na 1H (0-99).' },
    stk1d_bias: { tooltipText: 'Bias = preferowany kierunek swingĂłw dla tickera na D1.' },
    stk1d_spy_alignment: { tooltipText: 'Aligned/Mixed/Contra: zgodnoĹ›Ä‡ tickera z biasem SPY.' },
    stk1d_regime: { tooltipText: 'Regime = Trend Up, Trend Down, Range lub Volatile.' },
    stk1d_structure: { tooltipText: 'HH/HL, LL/LH, Mixed lub Range dla struktury D1.' },
    stk1d_trend_strength: { tooltipText: 'Pozycja ceny wzglÄ™dem kluczowych MA: Above/Below/Chop.' },
    stk1d_momentum_condition: { tooltipText: 'Momentum D1: Expanding, Stable, Diverging, Exhausted.' },
    stk1d_vwap: { tooltipText: 'VWAP na D1 traktuj jako filtr pomocniczy (opcjonalny).' },
    stk1d_relative_vs_spy: { tooltipText: 'RS state vs SPY: Strong/Neutral/Weak.' },
    stk1d_rs_trend: { tooltipText: 'RS trend vs SPY: Rising/Flat/Falling.' },
    stk1d_level_position: { tooltipText: 'Lokalizacja ceny vs poziomy: support/resistance/middle/break attempts/retest.' },
    stk1d_support_status: { tooltipText: 'Status supportu: holding/broken/reclaimed/rejecting/not tested.' },
    stk1d_resistance_status: { tooltipText: 'Status oporu: holding/broken/reclaimed/rejecting/not tested.' },
    stk1d_room_to_move: { tooltipText: 'Room to move = dystans do najbliĹĽszego poziomu wyraĹĽony w ATR.' },
    stk1d_manual_close: { tooltipText: 'Przepisz Close z TV/Pine do obliczenia room suggestion.' },
    stk1d_manual_atr: { tooltipText: 'Przepisz ATR(14) z TV/Pine do obliczenia room suggestion.' },
    stk1d_atr_env: { tooltipText: 'ATR% environment: Low/Normal/High.' },
    stk1d_earnings_days: { tooltipText: 'Liczba dni do earnings; uĹĽyj -1, gdy brak danych.' },
    stk1d_gap_risk: { tooltipText: 'Najpierw ocen AUTO proxy (srednie luki z historii), potem zrob MANUAL override gdy sa catalysty (earnings/makro/news).', source: 'SEMI' },
    stk1d_options_liquidity: { tooltipText: 'Sprawdz chain: 1) bid/ask spread % (ATM i +/- 1-2 strike), 2) OI i volume, 3) czy fill na mid jest realistyczny. Good: zwykle <=5% spread i sensowna plynnosc; Poor: szerokie spready i slabe OI/vol.' },
    stk1d_event_earnings: { tooltipText: 'Wyniki mogÄ… wywoĹ‚aÄ‡ gwaĹ‚towny ruch i zmieniÄ‡ kontekst (ryzyko dla swing options).' },
    stk1d_event_dividends: { tooltipText: 'Dywidenda moĹĽe zmieniÄ‡ cenÄ™ odniesienia i zachowanie kursu w krĂłtkim terminie.' },
    stk1d_event_other: { tooltipText: 'Inny zaplanowany katalizator (np. decyzja sÄ…dowa, FDA, makro, split).' },
    stk1d_support: { tooltipText: 'NajbliĹĽszy istotny poziom wsparcia na 1D.' },
    stk1d_resistance: { tooltipText: 'NajbliĹĽszy istotny poziom oporu na 1D.' },
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
        'stk1d_spy_alignment',
        'stk1d_regime',
        'stk1d_structure',
        'stk1d_trend_strength',
        'stk1d_momentum_condition',
        'stk1d_vwap',
        'stk1d_relative_vs_spy',
        'stk1d_rs_trend',
        'stk1d_support_status',
        'stk1d_resistance_status',
        'stk1d_gap_risk',
        'stk1d_options_liquidity',
        'stk1d_support',
        'stk1d_resistance',
        'stk1d_level_position',
        'stk1d_room_to_move',
        'stk1d_manual_close',
        'stk1d_manual_atr',
        'stk1d_atr_env',
        'stk1d_earnings_days',
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
    directionScore += hasDirectionalBias ? 2 : 1;
    directionScore += (values.structure === 'hh_hl' || values.structure === 'll_lh') ? 2 : values.structure === 'range' ? 1 : 0;
    if (hasDirectionalBias) {
        if (
            (values.bias === 'bullish' && values.trendStrength === 'above_key_mas') ||
            (values.bias === 'bearish' && values.trendStrength === 'below_key_mas')
        ) directionScore += 2;
        else if (values.trendStrength === 'chop_around_mas') directionScore += 1;

        if (
            (values.bias === 'bullish' && values.regime === 'trend_up') ||
            (values.bias === 'bearish' && values.regime === 'trend_down')
        ) directionScore += 1;

        if (values.momentumCondition === 'expanding' || values.momentumCondition === 'stable') directionScore += 1;
    } else {
        if (values.regime === 'range') directionScore += 1;
    }
    directionScore = clamp(directionScore, 0, 8);

    let contextScore = 0;
    contextScore += values.rate >= 80 ? 2 : values.rate >= 60 ? 1 : 0;
    contextScore += values.spyAlignment === 'aligned' ? 2 : values.spyAlignment === 'mixed' ? 1 : 0;
    contextScore += values.relativeVsSpy === 'strong' ? 2 : values.relativeVsSpy === 'neutral' ? 1 : 0;
    contextScore += values.rsTrend === 'rising' ? 2 : values.rsTrend === 'flat' ? 1 : 0;
    contextScore += values.atrEnv === 'normal' ? 1 : 0;
    contextScore += (values.vwap === 'above' || values.vwap === 'below') ? 1 : 0;
    contextScore = clamp(contextScore, 0, 8);

    let riskLevelsScore = 0;
    riskLevelsScore += values.roomToMove === 'large' ? 2 : values.roomToMove === 'medium' ? 1 : 0;
    riskLevelsScore += values.gapRisk === 'low' ? 2 : values.gapRisk === 'medium' ? 1 : 0;
    riskLevelsScore += values.optionsLiquidity === 'good' ? 2 : values.optionsLiquidity === 'medium' ? 1 : 0;
    if (hasDirectionalBias) {
        if (
            (values.bias === 'bullish' && values.levelPosition === 'at_support') ||
            (values.bias === 'bearish' && values.levelPosition === 'at_resistance')
        ) {
            riskLevelsScore += 1;
        }
    }
    riskLevelsScore = clamp(riskLevelsScore, 0, 4);

    let penalties = 0;
    if (values.bias === 'bullish' && values.relativeVsSpy === 'weak') penalties -= 2;
    if (values.bias === 'bearish' && values.relativeVsSpy === 'strong') penalties -= 2;
    if (values.bias === 'neutral') penalties -= 1;
    if (values.roomToMove === 'none') penalties -= 2;
    if (values.spyAlignment === 'contra') penalties -= 2;
    if (values.momentumCondition === 'exhausted') penalties -= 1;
    if (values.momentumCondition === 'diverging') penalties -= 1;
    if (values.earningsSoon) penalties -= 2;
    if (values.dividendSoon) penalties -= 1;
    if (values.otherCatalyst) penalties -= 1;

    const rawTotalUnbounded = directionScore + contextScore + riskLevelsScore + penalties;
    const boundedRawTotal = clamp(rawTotalUnbounded, 0, 20);

    let cap = 20;
    const capReasons = [];
    if (values.roomToMove === 'none') {
        cap = Math.min(cap, 10);
        capReasons.push('Room to move: None (cap 10)');
    }
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
    if (values.spyAlignment === 'contra') {
        cap = Math.min(cap, 10);
        capReasons.push('Contra vs SPY (cap 10)');
    }
    if (
        (values.bias === 'bullish' && values.regime === 'trend_down') ||
        (values.bias === 'bearish' && values.regime === 'trend_up')
    ) {
        cap = Math.min(cap, 12);
        capReasons.push('Bias and regime mismatch (cap 12)');
    }

    const total = Math.min(boundedRawTotal, cap);
    const capApplied = total < boundedRawTotal;

    // Keep "No data" until core directional context is provided.
    const hasMinimumDirectionContext = Boolean(values.bias && values.structure && values.regime && values.trendStrength && values.relativeVsSpy && values.roomToMove);

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
    const stock1dPermissionEl = document.getElementById('stk1d_permission');
    const stock1dAlignmentAutoEl = document.getElementById('stk1d_alignment_auto');
    const stock1dInvalidationEl = document.getElementById('stk1d_invalidation_tomorrow');
    const stock1dRoomAutoEl = document.getElementById('stk1d_room_auto');
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
            { name: 'stk1d_rate', min: 0, max: 100 },
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
            regime: getStockRadioValue('stk1d_regime'),
            structure: getStockRadioValue('stk1d_structure'),
            trendStrength: getStockRadioValue('stk1d_trend_strength'),
            momentumCondition: getStockRadioValue('stk1d_momentum_condition'),
            vwap: getStockRadioValue('stk1d_vwap'),
            roomToMove: getStockRadioValue('stk1d_room_to_move'),
            gapRisk: getStockRadioValue('stk1d_gap_risk'),
            optionsLiquidity: getStockRadioValue('stk1d_options_liquidity'),
            levelPosition: getStockRadioValue('stk1d_level_position'),
            atrEnv: getStockRadioValue('stk1d_atr_env'),
            earningsSoon: isStockChecked('stk1d_event_earnings'),
            dividendSoon: isStockChecked('stk1d_event_dividends'),
            otherCatalyst: isStockChecked('stk1d_event_other'),
            rate: parseRate('stk1d_rate', 0, 100)
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

        const closeVal1D = parseLevel(getFieldValue('stk1d_manual_close'));
        const atrVal1D = parseLevel(getFieldValue('stk1d_manual_atr'));
        const supportVal1D = parseLevel(getFieldValue('stk1d_support'));
        const resistanceVal1D = parseLevel(getFieldValue('stk1d_resistance'));
        const bias1D = getStockRadioValue('stk1d_bias');

        let roomAutoText = 'Enter Close + ATR + key levels to compute auto room suggestion';
        if (Number.isFinite(closeVal1D) && Number.isFinite(atrVal1D) && atrVal1D > 0) {
            let dist = null;
            if (bias1D === 'bullish' && Number.isFinite(resistanceVal1D)) dist = Math.abs(resistanceVal1D - closeVal1D);
            else if (bias1D === 'bearish' && Number.isFinite(supportVal1D)) dist = Math.abs(closeVal1D - supportVal1D);
            else {
                const candidates = [];
                if (Number.isFinite(supportVal1D)) candidates.push(Math.abs(closeVal1D - supportVal1D));
                if (Number.isFinite(resistanceVal1D)) candidates.push(Math.abs(resistanceVal1D - closeVal1D));
                if (candidates.length) dist = Math.min(...candidates);
            }
            if (Number.isFinite(dist)) {
                const room = classifyRoomFromAtr(dist / atrVal1D);
                roomAutoText = room ? `Auto suggestion: ${room} (${(dist / atrVal1D).toFixed(2)} ATR)` : roomAutoText;
            }
        }
        if (stock1dRoomAutoEl) stock1dRoomAutoEl.textContent = roomAutoText;
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

        if (stock1dPermissionEl) {
            let permission = 'No trade';
            if (stockScore.hasMinimumData) {
                if (stockScore.total >= 16) permission = 'Allowed';
                else if (stockScore.total >= 12) permission = 'Reduced';
                else permission = 'No trade';
            }
            stock1dPermissionEl.textContent = permission;
        }
        if (stock1dAlignmentAutoEl) {
            const alignment = getStockRadioValue('stk1d_spy_alignment');
            stock1dAlignmentAutoEl.textContent = alignment ? alignment : 'No data';
        }
        if (stock1dInvalidationEl) {
            const bias1d = getStockRadioValue('stk1d_bias');
            const sLvl = getFieldValue('stk1d_support').trim();
            const rLvl = getFieldValue('stk1d_resistance').trim();
            let inv = 'No data';
            if (bias1d === 'bullish') inv = sLvl ? `Invalidation: daily close below support (${sLvl})` : 'Invalidation: daily close below support zone';
            else if (bias1d === 'bearish') inv = rLvl ? `Invalidation: daily close above resistance (${rLvl})` : 'Invalidation: daily close above resistance zone';
            else if (bias1d === 'neutral') inv = 'Invalidation: break from range with follow-through opposite to planned direction';
            stock1dInvalidationEl.textContent = inv;
        }

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
            const vol = getStockRadioValue('stk1d_atr_env');
            const gap = getStockRadioValue('stk1d_gap_risk');
            volGapGuardrailEl.textContent = (vol === 'high' && gap === 'high')
                ? 'Warning: High ATR% and high gap risk increase jump risk.'
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
                regime: getRadioLabel('stk1d_regime'),
                structure: getRadioLabel('stk1d_structure'),
                trendStrength: getRadioLabel('stk1d_trend_strength'),
                momentum: getRadioLabel('stk1d_momentum_condition'),
                spyAlignment: getRadioLabel('stk1d_spy_alignment'),
                relative: getRadioLabel('stk1d_relative_vs_spy'),
                room: getRadioLabel('stk1d_room_to_move')
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
            `Bias ${facts.d1.bias} | Regime ${facts.d1.regime} | Structure ${facts.d1.structure} | Trend ${facts.d1.trendStrength} | Momentum ${facts.d1.momentum} | Room ${facts.d1.room}`,
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





