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
    const clearBtn = document.getElementById('analysis-clear');

    const getValue = (id) => {
        const el = document.getElementById(id);
        return el ? el.value.trim() : '';
    };

    const getRadio = (name) => {
        const el = document.querySelector(`input[name="${name}"]:checked`);
        return el ? el.value : '';
    };

    const withFallback = (value, fallback) => (value && value.length ? value : fallback);


    const buildTemplateOutput = () => {
        const setup = withFallback(getValue('setup_number'), '1');
        const ticker = withFallback(getValue('ticker'), '_____');
        const status = withFallback(getRadio('status'), 'Observation-only');

        const spyBias = withFallback(getValue('spy_bias'), 'Not defined');
        const spyRate = withFallback(getValue('spy_rate'), 'Not defined');
        const spyStructure = withFallback(getValue('spy_structure'), 'Not defined');
        const spyVwap = withFallback(getValue('spy_vwap'), 'Not defined');
        const spySupport = withFallback(getValue('spy_support'), 'Not defined');
        const spyResistance = withFallback(getValue('spy_resistance'), 'Not defined');
        const spyNote = withFallback(getValue('spy_note'), 'Not defined');
        const marketAligned = withFallback(getRadio('market_aligned'), 'Yes (trade allowed)');

        const trigger = withFallback(getValue('trigger'), 'Not defined');
        const entryPlan = withFallback(getValue('entry_plan'), 'Not defined');
        const stopLoss = withFallback(getValue('stop_loss'), 'Not defined');
        const tp1 = withFallback(getValue('tp1'), 'Not defined');
        const tp2 = withFallback(getValue('tp2'), 'Not defined');

        const d1Bias = withFallback(getValue('d1_bias'), 'Not defined');
        const d1Structure = withFallback(getValue('d1_structure'), 'Not defined');
        const d1Support = withFallback(getValue('d1_support'), 'Not defined');
        const d1Resistance = withFallback(getValue('d1_resistance'), 'Not defined');
        const d1Vwap = withFallback(getValue('d1_vwap'), 'Not defined');
        const d1Relative = withFallback(getValue('d1_relative'), 'Not defined');
        const d1Note = withFallback(getValue('d1_note'), 'Not defined');
        const d1Rate = withFallback(getValue('d1_rate'), 'Not defined');

        const h4Bias = withFallback(getValue('h4_bias'), 'Not defined');
        const h4Structure = withFallback(getValue('h4_structure'), 'Not defined');
        const h4Support = withFallback(getValue('h4_support'), 'Not defined');
        const h4Resistance = withFallback(getValue('h4_resistance'), 'Not defined');
        const h4Vwap = withFallback(getValue('h4_vwap'), 'Not defined');
        const h4Relative = withFallback(getValue('h4_relative'), 'Not defined');
        const h4Note = withFallback(getValue('h4_note'), 'Not defined');
        const h4Rate = withFallback(getValue('h4_rate'), 'Not defined');

        const h1Bias = withFallback(getValue('h1_bias'), 'Not defined');
        const h1Structure = withFallback(getValue('h1_structure'), 'Not defined');
        const h1Support = withFallback(getValue('h1_support'), 'Not defined');
        const h1Resistance = withFallback(getValue('h1_resistance'), 'Not defined');
        const h1Vwap = withFallback(getValue('h1_vwap'), 'Not defined');
        const h1Relative = withFallback(getValue('h1_relative'), 'Not defined');
        const h1Note = withFallback(getValue('h1_note'), 'Not defined');
        const h1Rate = withFallback(getValue('h1_rate'), 'Not defined');

        const m15Bias = withFallback(getValue('m15_bias'), 'Not defined');
        const m15Structure = withFallback(getValue('m15_structure'), 'Not defined');
        const m15Support = withFallback(getValue('m15_support'), 'Not defined');
        const m15Resistance = withFallback(getValue('m15_resistance'), 'Not defined');
        const m15Vwap = withFallback(getValue('m15_vwap'), 'Not defined');
        const m15Relative = withFallback(getValue('m15_relative'), 'Not defined');
        const m15Note = withFallback(getValue('m15_note'), 'Not defined');
        const m15Rate = withFallback(getValue('m15_rate'), 'Not defined');

        const optTicker = getValue('ticker');
        const optExpiry = getValue('opt_expiry');
        const optCp = getValue('opt_cp');
        const optStrike = getValue('opt_strike');
        const optPrice = getValue('opt_price');
        const optVolume = getValue('opt_volume');
        const optionsEmpty = !optTicker && !optExpiry && !optCp && !optStrike && !optPrice && !optVolume;

        const optContractParts = [optTicker, optExpiry, optCp, optStrike].filter(Boolean);
        const optContractOut = optionsEmpty ? 'Not selected' : (optContractParts.length ? optContractParts.join(' ') : 'Not defined');
        const optPriceOut = optionsEmpty ? '-' : withFallback(optPrice, 'Not defined');
        const optVolumeOut = optionsEmpty ? '-' : withFallback(optVolume, 'Not defined');

        const riskMain = withFallback(getValue('risk_main'), 'Not defined');
        const riskWhy = withFallback(getValue('risk_why'), 'Not defined');
        const riskWrong = withFallback(getValue('risk_wrong'), 'Not defined');

        const statusLine = (label) => `[${status === label ? 'X' : ' '}] ${label}`;
        const marketAlignedLine = (label) => `[${marketAligned === label ? 'X' : ' '}] ${label}`;

        return [
            'DAY CONTEXT (SPY FIRST):',
            `Bias: ${spyBias}`,
            `Rate: ${spyRate}`,
            `Structure: ${spyStructure}`,
            `VWAP: ${spyVwap}`,
            `Key Resistance: ${spyResistance}`,
            `Key Support: ${spySupport}`,
            `Note: ${spyNote}`,
            '',
            'MARKET ALIGNED?',
            marketAlignedLine('Yes (trade allowed)'),
            marketAlignedLine('No (observation-only / smaller size / wait)'),
            '',
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
            'TRIGGER (what must happen to enter):',
            `→ ${trigger}`,
            '',
            'ENTRY PLAN:',
            `Entry: ${entryPlan}`,
            `Stop Loss (invalidation): ${stopLoss}`,
            `TP1: ${tp1}`,
            `TP2 / Runner: ${tp2}`,
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
            `Relative: ${d1Relative}`,
            `Note: ${d1Note}`,
            `Rate: ${d1Rate}`,
            '',
            '4H:',
            `Bias: ${h4Bias}`,
            `Structure: ${h4Structure}`,
            `Resistance: ${h4Resistance}`,
            `Support: ${h4Support}`,
            `VWAP: ${h4Vwap}`,
            `Relative: ${h4Relative}`,
            `Note: ${h4Note}`,
            `Rate: ${h4Rate}`,
            '',
            '1H:',
            `Bias: ${h1Bias}`,
            `Structure: ${h1Structure}`,
            `Resistance: ${h1Resistance}`,
            `Support: ${h1Support}`,
            `VWAP: ${h1Vwap}`,
            `Relative: ${h1Relative}`,
            `Note: ${h1Note}`,
            `Rate: ${h1Rate}`,
            '',
            '15m (TIMING ONLY):',
            `Bias: ${m15Bias}`,
            `Structure: ${m15Structure}`,
            `Resistance: ${m15Resistance}`,
            `Support: ${m15Support}`,
            `VWAP: ${m15Vwap}`,
            `Relative: ${m15Relative}`,
            `Note: ${m15Note}`,
            `Rate: ${m15Rate}`,
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

        const spyBias = withFallback(getValue('spy_bias'), 'Not defined');
        const spyRate = withFallback(getValue('spy_rate'), 'Not defined');
        const spyStructure = withFallback(getValue('spy_structure'), 'Not defined');
        const spyVwap = withFallback(getValue('spy_vwap'), 'Not defined');
        const spySupport = withFallback(getValue('spy_support'), 'Not defined');
        const spyResistance = withFallback(getValue('spy_resistance'), 'Not defined');
        const spyNote = withFallback(getValue('spy_note'), '');

        const d1Bias = withFallback(getValue('d1_bias'), 'Not defined');
        const d1Structure = withFallback(getValue('d1_structure'), 'Not defined');
        const d1Resistance = withFallback(getValue('d1_resistance'), 'Not defined');
        const d1Support = withFallback(getValue('d1_support'), 'Not defined');
        const d1Vwap = withFallback(getValue('d1_vwap'), 'Not defined');
        const d1Relative = withFallback(getValue('d1_relative'), 'Not defined');
        const d1Note = withFallback(getValue('d1_note'), '');
        const d1Rate = withFallback(getValue('d1_rate'), '');

        const h4Bias = withFallback(getValue('h4_bias'), 'Not defined');
        const h4Structure = withFallback(getValue('h4_structure'), 'Not defined');
        const h4Resistance = withFallback(getValue('h4_resistance'), 'Not defined');
        const h4Support = withFallback(getValue('h4_support'), 'Not defined');
        const h4Vwap = withFallback(getValue('h4_vwap'), 'Not defined');
        const h4Relative = withFallback(getValue('h4_relative'), 'Not defined');
        const h4Note = withFallback(getValue('h4_note'), '');
        const h4Rate = withFallback(getValue('h4_rate'), '');

        const h1Bias = withFallback(getValue('h1_bias'), 'Not defined');
        const h1Structure = withFallback(getValue('h1_structure'), 'Not defined');
        const h1Resistance = withFallback(getValue('h1_resistance'), 'Not defined');
        const h1Support = withFallback(getValue('h1_support'), 'Not defined');
        const h1Vwap = withFallback(getValue('h1_vwap'), 'Not defined');
        const h1Relative = withFallback(getValue('h1_relative'), 'Not defined');
        const h1Note = withFallback(getValue('h1_note'), '');
        const h1Rate = withFallback(getValue('h1_rate'), '');

        const m15Bias = withFallback(getValue('m15_bias'), 'Not defined');
        const m15Structure = withFallback(getValue('m15_structure'), 'Not defined');
        const m15Resistance = withFallback(getValue('m15_resistance'), 'Not defined');
        const m15Support = withFallback(getValue('m15_support'), 'Not defined');
        const m15Vwap = withFallback(getValue('m15_vwap'), 'Not defined');
        const m15Relative = withFallback(getValue('m15_relative'), 'Not defined');
        const m15Note = withFallback(getValue('m15_note'), '');
        const m15Rate = withFallback(getValue('m15_rate'), '');

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
            d1Relative,
            d1Note ? d1Note : '',
            d1Rate ? `Rate: ${d1Rate}` : '',
            '4H',
            `${h4Bias.toLowerCase()} - ${h4Structure}`,
            `Resistance - ${h4Resistance}`,
            `Support - ${h4Support}`,
            `${h4Vwap} VWAP + holding`,
            h4Relative,
            h4Note ? h4Note : '',
            h4Rate ? `Rate: ${h4Rate}` : '',
            '1H',
            `${h1Bias.toLowerCase()} - ${h1Structure}`,
            `Resistance - ${h1Resistance}`,
            `Support - ${h1Support}`,
            `${h1Vwap} VWAP + holding`,
            h1Relative,
            h1Note ? h1Note : '',
            h1Rate ? `Rate: ${h1Rate}` : '',
            '15m',
            `${m15Bias.toLowerCase()} - ${m15Structure}`,
            `Resistance - ${m15Resistance}`,
            `Support - ${m15Support}`,
            `${m15Vwap} VWAP + holding`,
            m15Relative,
            m15Note ? m15Note : '',
            m15Rate ? `Rate: ${m15Rate}` : '',
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
}
