// Auto-uppercase ticker input
document.addEventListener('DOMContentLoaded', function() {
    const tickerInputs = document.querySelectorAll('input[name="ticker"]');
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

function initScoringFieldHelp(form) {
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

    const appendToGroupLabel = (inputName) => {
        const input = form.querySelector(`input[name="${inputName}"]`);
        if (!input) return;
        const label = input.closest('.form-group')?.querySelector(':scope > label');
        appendMeta(label, inputName, SPY_SCORING_FIELD_HELP[inputName]);
    };

    const appendToOptionText = (inputName) => {
        const input = form.querySelector(`input[name="${inputName}"]`);
        if (!input) return;
        const text = input.closest('label.checkbox-label')?.querySelector('.checkbox-text');
        appendMeta(text, inputName, SPY_SCORING_FIELD_HELP[inputName]);
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
    ].forEach(appendToGroupLabel);

    [
        'sc_spy_volume_gt_20d',
        'sc_spy_volume_expansion',
        'sc_spy_behavior_above_20_50',
        'sc_spy_behavior_above_200',
        'sc_spy_behavior_pullback_in_progress',
        'sc_spy_behavior_compression',
        'sc_spy_behavior_expansion_up',
        'sc_spy_behavior_expansion_down'
    ].forEach(appendToOptionText);
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

    let interpretation = 'Observation only';
    if (total >= 20) interpretation = 'A+ Market (Full aggression)';
    else if (total >= 15) interpretation = 'Normal swing environment';
    else if (total >= 10) interpretation = 'Selective / reduced size';

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

function initScoringBuilder() {
    const form = document.getElementById('scoring-form');
    if (!form) return;
    initScoringFieldHelp(form);

    const totalEl = document.getElementById('scoring-total-score');
    const rawEl = document.getElementById('scoring-raw-score');
    const interpretationEl = document.getElementById('scoring-interpretation');
    const breakdownEl = document.getElementById('scoring-breakdown');
    const penVolSubtotalEl = document.getElementById('pen-vol-subtotal');
    const capNoteEl = document.getElementById('scoring-cap-note');

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

    const parseRate = () => {
        const el = form.querySelector('input[name="sc_spy_rate"]');
        if (!el) return 0;
        const normalized = (el.value || '').replace(',', '.').trim();
        const num = Number.parseFloat(normalized);
        return Number.isFinite(num) ? num : 0;
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
            rate: parseRate()
        });

        if (totalEl) totalEl.textContent = `${score.total} / 25`;
        if (rawEl) rawEl.textContent = `${score.rawTotal} / 25`;
        if (interpretationEl) interpretationEl.textContent = score.interpretation;
        if (breakdownEl) {
            breakdownEl.textContent = `Direction: ${score.directionScore}/5 | Strength: ${score.strengthScore}/8 | Volatility Regime: ${score.volatilityRegimeScore}/6 | Location: ${score.locationScore}/6 | Behavior bonus: ${score.behaviorBonus} | Penalties: ${score.penalties}`;
        }
        if (penVolSubtotalEl) {
            penVolSubtotalEl.textContent = `Volatility penalties subtotal: ${score.penBuckets.penVol}`;
        }
        if (capNoteEl) {
            capNoteEl.textContent = score.capApplied
                ? `Cap active: max ${score.cap}. Reason: ${score.capReasons.join('; ')}.`
                : '';
        }
    };

    bindMutualExclusiveGroup(['sc_spy_behavior_expansion_up', 'sc_spy_behavior_expansion_down']);
    bindVolumeValidation();

    form.addEventListener('change', renderScore);
    form.addEventListener('input', renderScore);
    renderScore();
}



