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
    sc_spy_behavior_above_20_50: { tooltipText: 'Zaznacz, gdy cena utrzymuje sie nad srednimi 20 i 50.' },
    sc_spy_behavior_above_200: { tooltipText: 'Zaznacz, gdy cena zamyka sie powyzej SMA200.' },
    sc_spy_behavior_trend: { tooltipText: 'Higher lows gdy dolki rosna, Lower highs gdy szczyty spadaja, None gdy nie ma czytelnego sygnalu.' },
    sc_spy_behavior_pullback_in_progress: { tooltipText: 'Zaznacz, gdy po ruchu kierunkowym trwa korekta, ale struktura nie zostala zanegowana.' },
    sc_spy_behavior_compression: { tooltipText: 'Zaznacz, gdy ostatnie swiece maja coraz mniejszy zakres ruchu.' },
    sc_spy_behavior_expansion_up: { tooltipText: 'Zaznacz, gdy swieca ma duzy zakres i zamyka sie blisko maksimum.' },
    sc_spy_behavior_expansion_down: { tooltipText: 'Zaznacz, gdy swieca ma duzy zakres i zamyka sie blisko minimum.' }
};

const STOCK_SCORING_FIELD_HELP = {
    stk1d_ticker: { tooltipText: 'Symbol akcji analizowanej na interwale dziennym (1D).' },
    stk1d_rate: { tooltipText: 'Twoja ocena jakoĹ›ci kandydata (0-99) na podstawie zewnÄ™trznej aplikacji lub wĹ‚asnej oceny.' },
    stk1d_bias: { tooltipText: 'Ostateczny kierunek po uwzglÄ™dnieniu struktury, 200 SMA, trend anchor i kontekstu SPY.' },
    stk1d_relative_vs_spy: { tooltipText: 'Relative = dziĹ› vs SPY (stan bieĹĽÄ…cy): Strength, Weakness albo Neutral.' },
    stk1d_rs_trend: { tooltipText: 'RS trend = czy relacja Relative vs SPY poprawia siÄ™, jest stabilna, czy pogarsza.' },
    stk1d_structure: { tooltipText: 'HH/HL = wyĹĽsze szczyty i doĹ‚ki, LL/LH = niĹĽsze szczyty i doĹ‚ki, Mixed = brak czytelnej struktury.' },
    stk1d_sma200: { tooltipText: 'Above = cena powyĹĽej SMA200 (czÄ™sto bullish kontekst), Below = poniĹĽej (czÄ™sto bearish kontekst).' },
    stk1d_trend_anchor: { tooltipText: 'PorĂłwnaj cenÄ™ do EMA20 na D1: Above = powyĹĽej, Middle = dotyka/krÄ…ĹĽy, Below = poniĹĽej.' },
    stk1d_spy_alignment: { tooltipText: 'Aligned = akcja idzie w tym samym kierunku co SPY, Diverging = wyraĹşnie inaczej, Opposite = przeciwnie do SPY.' },
    stk1d_beta_sensitivity: { tooltipText: 'High beta = mocno reaguje na ruch SPY, Defensive = mniej zaleĹĽna od rynku, Neutral = poĹ›rodku.' },
    stk1d_trend_state: { tooltipText: 'Intact = trend dziaĹ‚a, Weakening = traci impet/Ĺ‚amie zasady, Broken = struktura trendu jest naruszona.' },
    stk1d_trend_quality: { tooltipText: 'Wybierz Clean jeĹ›li ruch jest gĹ‚adki i respektuje poziomy; Choppy jeĹ›li duĹĽo szarpania i faĹ‚szywych Ĺ›wiec.' },
    stk1d_phase: { tooltipText: 'Impulse = silny ruch kierunkowy, Pullback = cofniÄ™cie, Base = konsolidacja/budowanie bazy.' },
    stk1d_pullback: { tooltipText: 'Within trend = cofniÄ™cie zgodne z kierunkiem biasu, Against = cofniÄ™cie przeciwne do biasu, None = brak cofniÄ™cia.' },
    stk1d_volatility_state: { tooltipText: 'Expanding gdy dzienne Ĺ›wiece/zakres rosnÄ…, Contracting gdy zmiennoĹ›Ä‡ siÄ™ zwija i rynek usypia.' },
    stk1d_extension_state: { tooltipText: 'Extended = daleko od EMA20/50 (Ĺ‚atwo o cofkÄ™), Reset = po mocnym cofniÄ™ciu, Balanced = poĹ›rodku.' },
    stk1d_gap_risk: { tooltipText: 'Ocena ryzyka luki cenowej (gap) na podstawie historii zachowania i bieĹĽÄ…cych katalizatorĂłw.' },
    stk1d_options_liquidity: { tooltipText: 'Good = wÄ…skie spready i duĹĽy obrĂłt, Poor = szerokie spready/niska pĹ‚ynnoĹ›Ä‡ (ryzyko pod swing options).' },
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
    stk4h_key_level_prior_day: { tooltipText: 'Zaznacz tylko poziomy, ktore realnie graja. To nie jest checklista wszystkiego.' },
    stk4h_key_level_weekly: { tooltipText: 'Zaznacz tylko poziomy, ktore realnie graja. To nie jest checklista wszystkiego.' },
    stk4h_key_level_range: { tooltipText: 'Zaznacz tylko poziomy, ktore realnie graja. To nie jest checklista wszystkiego.' },
    stk4h_key_level_major_ma: { tooltipText: 'Zaznacz tylko poziomy, ktore realnie graja. To nie jest checklista wszystkiego.' },
    stk4h_key_level_supply_demand: { tooltipText: 'Zaznacz tylko poziomy, ktore realnie graja. To nie jest checklista wszystkiego.' },
    stk4h_setup_type: { tooltipText: 'Typ planowanego schematu 4H (continuation, pullback, reversal, range). Okresla co chcesz grac, bez triggera.' },
    stk4h_trend_quality: { tooltipText: 'Jakosc trendu 4H: Clean, Acceptable lub Choppy. Choppy zwykle podnosi ryzyko theta i whipsaw.' },
    stk4h_volatility_profile: { tooltipText: 'Profil zmiennosci 4H: Expanding, Stable, Contracting. Wplywa na zachowanie premii opcyjnych.' },
    stk4h_invalidation_logic: { tooltipText: 'Logika uniewaznienia planu 4H. To nie jest stop-loss, tylko warunek utraty sensu setupu.' },
    stk4h_liquidity_check: { tooltipText: 'Ocena optionability: czy spready i plynnosc sa akceptowalne dla swing options.' },
    stk4h_notes: { tooltipText: 'Krotki opis planu 4H (1-2 linie), bez entry/stop/TP.' },
    stk1h_structure: { tooltipText: 'Struktura 1H opisuje lokalny swing i moze byc inna niz 4H.' },
    stk1h_anchor_state: { tooltipText: 'Pozycja ceny wzgledem anchor na 1H pomaga ocenic, czy momentum intraday wspiera plan 4H.' },
    stk1h_range_state: { tooltipText: 'Stan 1H wzgledem range: wybicie, handel w srodku, albo odrzucenie poziomu.' },
    stk1h_intraday_premarket: { tooltipText: 'Zaznacz tylko poziomy dnia, ktore realnie steruja ruchem (PMH/PML, OR, VWAP, PDH/PDL).' },
    stk1h_intraday_opening_range: { tooltipText: 'Zaznacz tylko poziomy dnia, ktore realnie steruja ruchem (PMH/PML, OR, VWAP, PDH/PDL).' },
    stk1h_intraday_vwap_reclaim_loss: { tooltipText: 'Zaznacz tylko poziomy dnia, ktore realnie steruja ruchem (PMH/PML, OR, VWAP, PDH/PDL).' },
    stk1h_intraday_pdh_pdl: { tooltipText: 'Zaznacz tylko poziomy dnia, ktore realnie steruja ruchem (PMH/PML, OR, VWAP, PDH/PDL).' },
    stk1h_alignment_with_4h: { tooltipText: 'Relacja 1H do planu 4H: Aligned, Minor pullback lub Counter-trend (wyzsze ryzyko fake move).' },
    stk1h_setup_type: { tooltipText: 'Mikroschemat 1H (bez execution): breakout hold, failed breakout, pullback continuation, rejection reversal.' },
    stk1h_risk_model: { tooltipText: 'Model ryzyka 1H: structure-based, level-based albo volatility-based.' },
    stk1h_notes: { tooltipText: 'Krotki opis, co na 1H musi sie wydarzyc, aby plan 4H byl gotowy.' }
};

function initScoringFieldHelp(form, stockSection = form) {
    const getFieldMeta = (fieldId) => SPY_SCORING_FIELD_HELP[fieldId] || STOCK_SCORING_FIELD_HELP[fieldId];

    const appendMeta = (targetEl, fieldId, meta) => {
        if (!targetEl || !meta) return;
        if (targetEl.querySelector(`.help-icon[data-field-id="${fieldId}"]`)) return;

        const help = document.createElement('span');
        help.className = 'help-icon';
        help.dataset.fieldId = fieldId;
        help.dataset.tooltip = meta.tooltipText;
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

    [
        'sc_spy_bias',
        'sc_spy_regime',
        'sc_spy_structure',
        'sc_spy_vwap',
        'sc_spy_rate',
        'sc_spy_vix_trend',
        'sc_spy_vix_level',
        'sc_spy_breadth',
        'sc_spy_location',
        'sc_spy_room',
        'sc_spy_behavior_trend'
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
        'stk1h_anchor_state',
        'stk1h_range_state',
        'stk1h_intraday_premarket',
        'stk1h_alignment_with_4h',
        'stk1h_setup_type',
        'stk1h_risk_model',
        'stk1h_notes'
    ].forEach((name) => appendToGroupLabel(name, stockSection));

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
}

function calculateSpyScore(values) {
    const bias = values.bias;
    const structure = values.structure;
    const vwap = values.vwap;
    const regime = values.regime;
    const breadth = values.breadth;
    const vixTrend = values.vixTrend;
    const vixLevel = values.vixLevel;
    const room = values.room;
    const location = values.location;
    const behaviorTrend = values.behaviorTrend;

    let directionScore = 0;
    if (bias === 'bullish' || bias === 'bearish') directionScore += 1;
    if (structure === 'hh_hl' || structure === 'll_lh') directionScore += 2;
    if ((bias === 'bullish' && vwap === 'above') || (bias === 'bearish' && vwap === 'below')) directionScore += 1;
    if (values.behaviorAbove200) directionScore += 1;
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

    // Location consistency penalties
    if (bias === 'bullish' && location === 'at_resistance') penLoc -= 1;
    if (bias === 'bearish' && location === 'at_support') penLoc -= 1;

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
    const hasMinimumData = Boolean(values.structure && values.triggerType && values.triggerConfirmed && values.entryQuality);
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
    let generatedSpyPrompt = '';

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
        const stockFields = form.querySelectorAll('[name^="stk1d_"], [name^="stk4h_"], [name^="stk1h_"], [name^="m15_"]');
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
        const stockRate = form.querySelector('input[name="stk1d_rate"]');
        if (!stockRate) return;
        stockRate.addEventListener('input', () => {
            if (stockRate.value === '') return;
            const parsed = Number.parseFloat(stockRate.value.replace(',', '.'));
            if (!Number.isFinite(parsed)) return;
            stockRate.value = String(Math.max(0, Math.min(99, Math.round(parsed))));
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

        if (hasAllGlobal) {
            setText(stockGlobalTotalEl, formatScore(globalTotal, 80));
        } else {
            const missing = [];
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
    };

    const renderScore = () => {
        const score = calculateSpyScore({
            bias: getRadioValue('sc_spy_bias'),
            structure: getRadioValue('sc_spy_structure'),
            vwap: getRadioValue('sc_spy_vwap'),
            regime: getRadioValue('sc_spy_regime'),
            volumeGt20d: isChecked('sc_spy_volume_gt_20d'),
            volumeExpansion: isChecked('sc_spy_volume_expansion'),
            breadth: getRadioValue('sc_spy_breadth'),
            vixTrend: getRadioValue('sc_spy_vix_trend'),
            vixLevel: getRadioValue('sc_spy_vix_level'),
            location: getRadioValue('sc_spy_location'),
            room: getRadioValue('sc_spy_room'),
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

        renderGlobalStockScore({
            stock1d: stockScore,
            stock4h: stock4hScore,
            stock1h: stock1hScore,
            stock15m: stock15mScore
        });

        if (trendQualityGuardrailEl) {
            const trendQuality = getStockRadioValue('stk1d_trend_quality');
            trendQualityGuardrailEl.textContent = trendQuality === 'choppy'
                ? 'Uwaga: swing options czÄ™sto cierpiÄ… na theta w rynku choppy.'
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
                ? 'Uwaga: earnings + sĹ‚aba pĹ‚ynnoĹ›Ä‡ opcji, spready/IV/poĹ›lizg mogÄ… mocno pogorszyÄ‡ RR.'
                : '';
        }
        if (volGapGuardrailEl) {
            const vol = getStockRadioValue('stk1d_volatility_state');
            const gap = getStockRadioValue('stk1d_gap_risk');
            volGapGuardrailEl.textContent = (vol === 'expanding' && gap === 'high')
                ? 'Uwaga: ekspansja zmiennoĹ›ci i wysokie gap risk zwiÄ™kszajÄ… ryzyko skokĂłw ceny.'
                : '';
        }
        if (stk4hChoppyGuardrailEl) {
            const trendQuality4h = getRadioValue('stk4h_trend_quality');
            stk4hChoppyGuardrailEl.textContent = trendQuality4h === 'choppy'
                ? 'Szarpany rynek: rosnie theta + ryzyko whipsaw.'
                : '';
        }
        if (stk4hSetupLocationGuardrailEl) {
            const setupType4h = getRadioValue('stk4h_setup_type');
            const location4h = getRadioValue('stk4h_location');
            const breakoutLike = setupType4h === 'breakout_continuation' || setupType4h === 'breakdown_continuation';
            stk4hSetupLocationGuardrailEl.textContent = (breakoutLike && location4h === 'near_resistance')
                ? 'Uwaga: breakout przy Near resistance - sprawdĹş, czy to nie podwĂłjny szczyt.'
                : '';
        }
        if (stk1hAlignmentGuardrailEl) {
            const alignment1h = getRadioValue('stk1h_alignment_with_4h');
            stk1hAlignmentGuardrailEl.textContent = alignment1h === 'counter_trend'
                ? 'Ryzyko fake move: poczekaj na powrot 1H w kierunku 4H.'
                : '';
        }
        if (stk4hVolLiqGuardrailEl) {
            const volProfile4h = getRadioValue('stk4h_volatility_profile');
            const liq4h = getRadioValue('stk4h_liquidity_check');
            stk4hVolLiqGuardrailEl.textContent = (volProfile4h === 'expanding' && liq4h === 'poor')
                ? 'Uwaga: Expanding volatility + Poor liquidity = wysokie ryzyko szerokich spreadĂłw.'
                : '';
        }
        if (stk4hAnchorBiasGuardrailEl) {
            const bias4h = getRadioValue('stk4h_bias');
            const anchor4h = getRadioValue('stk4h_anchor_state');
            stk4hAnchorBiasGuardrailEl.textContent = (bias4h === 'bullish' && anchor4h === 'below_anchor')
                ? 'Uwaga: Bullish bias przy anchor below - momentum mismatch.'
                : '';
        }
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

    form.addEventListener('change', renderScore);
    form.addEventListener('input', renderScore);
    renderScore();
}





