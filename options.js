/* ══════════════════════════════════════════════════════════════════
   OPTIONS.JS — Options & Volatility Analysis Module
   ══════════════════════════════════════════════════════════════════ */

const OptionsAnalyzer = (() => {

    // ── State ───────────────────────────────────────────────────────
    let impliedVols = {};        // current IV per ticker
    let previousIVs = {};        // IV from last cycle
    let putCallRatios = {};      // current P/C ratio
    let gammaExposure = {};      // GEX estimate
    let optionSweeps = [];       // recent sweep alerts
    let zeroDTEFlow = {};        // 0DTE flow data for SPY + major tech

    // Tickers with active 0DTE markets
    const ZERO_DTE_TICKERS = ['SPY', 'NVDA', 'MSFT', 'AMZN', 'GOOG', 'ASML'];

    // ── Initialize ──────────────────────────────────────────────────
    function init() {
        MarketData.PORTFOLIO.forEach(ticker => {
            if (MarketData.NO_OPTIONS.has(ticker)) return;

            const baseIV = _getBaseIV(ticker);
            impliedVols[ticker] = baseIV * (0.95 + Math.random() * 0.10);
            previousIVs[ticker] = impliedVols[ticker];
            putCallRatios[ticker] = 0.7 + Math.random() * 0.8; // 0.7 – 1.5
            gammaExposure[ticker] = _generateGEX(ticker);
        });
    }

    // ── Tick — Simulate options data update ─────────────────────────
    function tick() {
        optionSweeps = [];

        MarketData.PORTFOLIO.forEach(ticker => {
            if (MarketData.NO_OPTIONS.has(ticker)) return;

            previousIVs[ticker] = impliedVols[ticker];

            // IV mean-reverts toward base with noise
            const baseIV = _getBaseIV(ticker);
            const revert = 0.15;
            const noise = (Math.random() - 0.5) * 0.04;
            impliedVols[ticker] = impliedVols[ticker] * (1 - revert) + baseIV * revert + noise;
            impliedVols[ticker] = Math.max(0.08, Math.min(1.5, impliedVols[ticker]));

            // P/C ratio with momentum
            const pcShift = (Math.random() - 0.48) * 0.15; // slight bearish bias
            putCallRatios[ticker] = Math.max(0.3, Math.min(3.0,
                putCallRatios[ticker] + pcShift
            ));

            // GEX
            gammaExposure[ticker] = _generateGEX(ticker);

            // Random sweep event (5% chance per ticker per cycle)
            if (Math.random() < 0.05) {
                optionSweeps.push(_generateSweep(ticker));
            }
        });

        // 0DTE flow
        ZERO_DTE_TICKERS.forEach(ticker => {
            zeroDTEFlow[ticker] = _generateZeroDTE(ticker);
        });
    }

    // ── Base IV from volatility profile ─────────────────────────────
    function _getBaseIV(ticker) {
        const vol = MarketData.VOLATILITY ? 0.25 : 0.25;
        // Use a rough mapping from realized vol
        const mapping = {
            SPY: 0.16, NVDA: 0.50, AMZN: 0.30, MSFT: 0.24, GOOG: 0.28,
            LLY: 0.35, RBLX: 0.55, BCRX: 0.70, KOS: 0.55, LYFT: 0.52,
            RIG: 0.58, NU: 0.50, NBIS: 0.52, ASML: 0.35, LULU: 0.34,
            FANG: 0.40, NUE: 0.38, UAN: 0.48, PFE: 0.30, COST: 0.20,
            WMT: 0.18, V: 0.22, MA: 0.22, UNH: 0.22, DHR: 0.24,
            'BRK.B': 0.18, RTX: 0.22, ACGL: 0.24, ABCB: 0.30,
            SLV: 0.32, IAU: 0.16, GLDM: 0.16, TLT: 0.20,
            XLP: 0.14, XLU: 0.16, XLV: 0.16, KO: 0.16,
            SGOV: 0.04, TAIL: 0.22, SH: 0.20, PSQ: 0.20, DOG: 0.20,
            DBMF: 0.14, 'CWEN.A': 0.28, USMV: 0.14, RSP: 0.18, UPS: 0.24
        };
        return mapping[ticker] || 0.25;
    }

    // ── GEX (Gamma Exposure) ────────────────────────────────────────
    function _generateGEX(ticker) {
        const price = MarketData.getPrice(ticker) || 100;
        // Simulate GEX as $ millions
        const scale = ['SPY', 'NVDA', 'MSFT', 'AMZN', 'GOOG'].includes(ticker) ? 500 : 20;
        const gex = (Math.random() - 0.45) * scale; // slight positive bias
        return {
            value: gex,
            level: price * (1 + (Math.random() - 0.5) * 0.02), // nearby strike
            isWall: Math.abs(gex) > scale * 0.4
        };
    }

    // ── Sweep Event Generator ───────────────────────────────────────
    function _generateSweep(ticker) {
        const price = MarketData.getPrice(ticker) || 100;
        const isBullish = Math.random() > 0.45;
        const otm = isBullish ? price * (1.02 + Math.random() * 0.05)
            : price * (0.93 + Math.random() * 0.05);
        const premium = (Math.random() * 2 + 0.5).toFixed(1);
        const contracts = Math.round(500 + Math.random() * 4500);
        const expiry = _nextExpiry();

        return {
            ticker,
            type: isBullish ? 'CALL' : 'PUT',
            strike: Math.round(otm),
            premium: parseFloat(premium),
            contracts,
            expiry,
            notional: (contracts * parseFloat(premium) * 100 / 1_000_000).toFixed(2),
            sentiment: isBullish ? 'BULLISH' : 'BEARISH'
        };
    }

    // ── 0DTE Flow ───────────────────────────────────────────────────
    function _generateZeroDTE(ticker) {
        const price = MarketData.getPrice(ticker) || 100;
        const callVol = Math.round(50000 + Math.random() * 200000);
        const putVol = Math.round(40000 + Math.random() * 180000);
        const netDelta = (callVol - putVol) / 1000;

        return {
            callVolume: callVol,
            putVolume: putVol,
            ratio: (putVol / callVol).toFixed(2),
            netDelta: netDelta.toFixed(1),
            dominantStrike: Math.round(price / 5) * 5, // nearest $5 strike
            sentiment: callVol > putVol * 1.2 ? 'BULLISH' :
                putVol > callVol * 1.2 ? 'BEARISH' : 'NEUTRAL'
        };
    }

    // ── Next expiry helper ──────────────────────────────────────────
    function _nextExpiry() {
        const now = new Date();
        const daysAhead = [2, 5, 7, 14, 30][Math.floor(Math.random() * 5)];
        const exp = new Date(now.getTime() + daysAhead * 86400000);
        return exp.toISOString().slice(0, 10);
    }

    // ── Analysis: IV Spike Detection ────────────────────────────────
    function getIVSpike(ticker) {
        if (MarketData.NO_OPTIONS.has(ticker)) return null;
        const curr = impliedVols[ticker];
        const prev = previousIVs[ticker];
        if (!curr || !prev) return null;
        const change = ((curr - prev) / prev) * 100;
        return {
            currentIV: (curr * 100).toFixed(1),
            change: change.toFixed(1),
            isSpike: Math.abs(change) > 8,
            direction: change > 0 ? 'RISING' : 'FALLING'
        };
    }

    // ── Analysis: Options Signal for Agent 4 ────────────────────────
    function getOptionsSignal(ticker) {
        if (MarketData.NO_OPTIONS.has(ticker)) {
            return { signal: 'N/A', confidence: 0, reason: 'No Options Data' };
        }

        const iv = getIVSpike(ticker);
        const pcr = putCallRatios[ticker] || 1.0;
        const gex = gammaExposure[ticker] || { value: 0, isWall: false };
        const zeroDTE = zeroDTEFlow[ticker] || null;

        let bullPoints = 0;
        let bearPoints = 0;
        let reasons = [];

        // P/C Ratio
        if (pcr < 0.65) { bullPoints += 2; reasons.push(`P/C ratio extremely bullish (${pcr.toFixed(2)})`); }
        else if (pcr < 0.85) { bullPoints += 1; reasons.push(`P/C ratio bullish (${pcr.toFixed(2)})`); }
        else if (pcr > 1.4) { bearPoints += 2; reasons.push(`P/C ratio bearish (${pcr.toFixed(2)})`); }
        else if (pcr > 1.15) { bearPoints += 1; reasons.push(`P/C ratio slightly bearish (${pcr.toFixed(2)})`); }

        // IV Spike
        if (iv && iv.isSpike) {
            if (iv.direction === 'RISING') {
                bearPoints += 1; // Rising IV → uncertainty/fear
                reasons.push(`IV spiking ${iv.change}%`);
            } else {
                bullPoints += 1;
                reasons.push(`IV compressing ${iv.change}%`);
            }
        }

        // GEX
        if (gex.isWall) {
            if (gex.value > 0) {
                reasons.push(`Positive gamma wall at $${gex.level.toFixed(0)} (resistance)`);
            } else {
                bearPoints += 1;
                reasons.push(`Negative gamma at $${gex.level.toFixed(0)} (amplified moves)`);
            }
        }

        // 0DTE
        if (zeroDTE) {
            if (zeroDTE.sentiment === 'BULLISH') bullPoints += 1;
            if (zeroDTE.sentiment === 'BEARISH') bearPoints += 1;
        }

        const net = bullPoints - bearPoints;
        let signal, confidence;
        if (net >= 2) { signal = 'BULLISH'; confidence = 70 + Math.random() * 20; }
        else if (net >= 1) { signal = 'BULLISH'; confidence = 55 + Math.random() * 15; }
        else if (net <= -2) { signal = 'BEARISH'; confidence = 70 + Math.random() * 20; }
        else if (net <= -1) { signal = 'BEARISH'; confidence = 55 + Math.random() * 15; }
        else { signal = 'NEUTRAL'; confidence = 40 + Math.random() * 15; }

        return {
            signal,
            confidence: Math.round(confidence),
            reason: reasons.join('; ') || 'Normal options activity',
            iv: iv ? parseFloat(iv.currentIV) : null,
            pcr: pcr.toFixed(2),
            gex: gex.value.toFixed(1),
            zeroDTE
        };
    }

    // ── Spotlight: Top options events this cycle ─────────────────────
    function getSpotlightEvents() {
        const events = [];

        // IV spikes
        MarketData.PORTFOLIO.forEach(ticker => {
            if (MarketData.NO_OPTIONS.has(ticker)) return;
            const iv = getIVSpike(ticker);
            if (iv && iv.isSpike) {
                events.push({
                    ticker,
                    type: 'IV_SPIKE',
                    message: `IV ${iv.direction === 'RISING' ? 'spiking' : 'compressing'} ${Math.abs(parseFloat(iv.change)).toFixed(1)}% in the last 5 mins. Current IV: ${iv.currentIV}%.`
                });
            }
        });

        // GEX walls
        MarketData.PORTFOLIO.forEach(ticker => {
            if (MarketData.NO_OPTIONS.has(ticker)) return;
            const gex = gammaExposure[ticker];
            if (gex && gex.isWall) {
                const price = MarketData.getPrice(ticker) || 100;
                const pcr = putCallRatios[ticker] || 1.0;
                events.push({
                    ticker,
                    type: 'GEX_WALL',
                    message: `Gamma wall acting as ${gex.value > 0 ? 'resistance' : 'amplifier'} at $${gex.level.toFixed(0)}. Call/Put ratio: ${pcr.toFixed(2)}.`
                });
            }
        });

        // Sweeps
        optionSweeps.forEach(sweep => {
            events.push({
                ticker: sweep.ticker,
                type: 'SWEEP',
                message: `Large ${sweep.type} sweep detected: ${sweep.contracts} contracts at $${sweep.strike} strike, $${sweep.notional}M notional, expiring ${sweep.expiry}. Sentiment: ${sweep.sentiment}.`
            });
        });

        // 0DTE notable
        ZERO_DTE_TICKERS.forEach(ticker => {
            const flow = zeroDTEFlow[ticker];
            if (flow && flow.sentiment !== 'NEUTRAL') {
                events.push({
                    ticker,
                    type: '0DTE',
                    message: `Heavy 0DTE ${flow.sentiment === 'BULLISH' ? 'call' : 'put'} buying detected at $${flow.dominantStrike} strike. Net delta: ${flow.netDelta}K.`
                });
            }
        });

        // Sort by importance and limit
        return events.slice(0, 6);
    }

    // ── Macro Flow Summary ──────────────────────────────────────────
    function getMacroFlowSummary() {
        const spyFlow = zeroDTEFlow['SPY'];
        if (!spyFlow) return 'No significant 0DTE activity detected.';

        const spyIV = getIVSpike('SPY');
        let msg = '';
        if (spyFlow.sentiment === 'BULLISH') {
            msg = `Heavy 0DTE call buying at $${spyFlow.dominantStrike} strike (${spyFlow.callVolume.toLocaleString()} calls vs ${spyFlow.putVolume.toLocaleString()} puts).`;
        } else if (spyFlow.sentiment === 'BEARISH') {
            msg = `Elevated 0DTE put activity at $${spyFlow.dominantStrike} strike (${spyFlow.putVolume.toLocaleString()} puts vs ${spyFlow.callVolume.toLocaleString()} calls).`;
        } else {
            msg = `Balanced 0DTE flow around $${spyFlow.dominantStrike}. P/C ratio: ${spyFlow.ratio}.`;
        }

        if (spyIV && spyIV.isSpike) {
            msg += ` SPY IV ${spyIV.direction === 'RISING' ? 'rising' : 'falling'} ${Math.abs(parseFloat(spyIV.change)).toFixed(1)}%.`;
        }

        return msg;
    }

    // ── Public API ──────────────────────────────────────────────────
    return {
        init,
        tick,
        getIVSpike,
        getOptionsSignal,
        getSpotlightEvents,
        getMacroFlowSummary,
        getPutCallRatio: t => putCallRatios[t],
        getGammaExposure: t => gammaExposure[t],
        getZeroDTEFlow: t => zeroDTEFlow[t],
        getSweeps: () => [...optionSweeps]
    };
})();
