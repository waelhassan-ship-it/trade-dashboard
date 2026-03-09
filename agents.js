/* ══════════════════════════════════════════════════════════════════
   AGENTS.JS — Multi-Agent Prediction Framework & Consensus Engine
   ══════════════════════════════════════════════════════════════════ */

const AgentFramework = (() => {

    // ── Agent Signal Enum ───────────────────────────────────────────
    const SIGNAL = {
        STRONG_BULLISH: 'STR BUY',
        BULLISH: 'BULLISH',
        NEUTRAL: 'NEUTRAL',
        BEARISH: 'BEARISH',
        STRONG_BEARISH: 'STR SELL',
        NA: 'N/A'
    };

    // ── Memory Store (FinMem simulation) ────────────────────────────
    const memoryStore = {
        shortTerm: [],       // last 3 cycles
        mediumTerm: [],      // last 12 cycles (1 hour)
        longTerm: [],        // notable events that persist
        debateConflicts: []  // logged agent disagreements
    };

    const MAX_SHORT = 3;
    const MAX_MEDIUM = 12;
    const MAX_LONG = 50;

    // ── Agent 1: Order Flow & Momentum Specialist ───────────────────
    function momentumAgent(ticker) {
        const change = MarketData.getChangePercent(ticker);
        const ema5 = MarketData.getEMA(ticker, 5);
        const ema12 = MarketData.getEMA(ticker, 12);
        const price = MarketData.getPrice(ticker);
        const volume = MarketData.getVolume(ticker);
        const history = MarketData.getHistory(ticker);

        let score = 0;
        let reasons = [];

        // Price momentum
        if (change > 0.3) { score += 2; reasons.push(`Strong 5m gain +${change.toFixed(2)}%`); }
        else if (change > 0.1) { score += 1; reasons.push(`Positive momentum +${change.toFixed(2)}%`); }
        else if (change < -0.3) { score -= 2; reasons.push(`Sharp decline ${change.toFixed(2)}%`); }
        else if (change < -0.1) { score -= 1; reasons.push(`Negative momentum ${change.toFixed(2)}%`); }

        // EMA crossover
        if (ema5 && ema12) {
            if (ema5 > ema12 * 1.001) { score += 1; reasons.push('EMA5 > EMA12 (bullish cross)'); }
            else if (ema5 < ema12 * 0.999) { score -= 1; reasons.push('EMA5 < EMA12 (bearish cross)'); }
        }

        // Volume surge (proxy for order flow intensity)
        if (history.length > 3) {
            const recentChanges = history.slice(-3).map((p, i, a) =>
                i > 0 ? (p - a[i - 1]) / a[i - 1] : 0
            ).slice(1);
            const trend = recentChanges.reduce((a, b) => a + b, 0);
            if (trend > 0.002) { score += 1; reasons.push('Consistent upward tick trend'); }
            if (trend < -0.002) { score -= 1; reasons.push('Consistent downward tick trend'); }
        }

        const signal = _scoreToSignal(score);
        const confidence = 50 + Math.abs(score) * 12 + Math.random() * 10;

        return {
            agent: 'Momentum',
            signal: signal,
            confidence: Math.min(95, Math.round(confidence)),
            reasons
        };
    }

    // ── Agent 2: Statistical Reversion Specialist ───────────────────
    function reversionAgent(ticker) {
        const rsi = MarketData.getRSI(ticker, 14);
        const price = MarketData.getPrice(ticker);
        const stdDev = MarketData.getStdDev(ticker, 14);
        const history = MarketData.getHistory(ticker);

        let score = 0;
        let reasons = [];

        // RSI extremes
        if (rsi > 80) { score -= 2; reasons.push(`RSI extremely overbought (${rsi.toFixed(1)})`); }
        else if (rsi > 70) { score -= 1; reasons.push(`RSI overbought (${rsi.toFixed(1)})`); }
        else if (rsi < 20) { score += 2; reasons.push(`RSI extremely oversold (${rsi.toFixed(1)})`); }
        else if (rsi < 30) { score += 1; reasons.push(`RSI oversold (${rsi.toFixed(1)})`); }

        // Bollinger-like deviation
        if (history.length >= 5) {
            const mean = history.slice(-10).reduce((a, b) => a + b, 0) / Math.min(10, history.length);
            const zScore = stdDev > 0 ? (price - mean) / stdDev : 0;

            if (zScore > 2) { score -= 2; reasons.push(`Price >2σ above mean (z=${zScore.toFixed(2)})`); }
            else if (zScore > 1) { score -= 1; reasons.push(`Price elevated vs mean (z=${zScore.toFixed(2)})`); }
            else if (zScore < -2) { score += 2; reasons.push(`Price >2σ below mean (z=${zScore.toFixed(2)})`); }
            else if (zScore < -1) { score += 1; reasons.push(`Price depressed vs mean (z=${zScore.toFixed(2)})`); }
        }

        // Mean reversion tendency check
        const change = MarketData.getChangePercent(ticker);
        if (Math.abs(change) > 0.5) {
            // Large moves tend to revert
            score += change > 0 ? -1 : 1;
            reasons.push(`Large move (${change.toFixed(2)}%) suggests reversion potential`);
        }

        const signal = _scoreToSignal(score);
        const confidence = 50 + Math.abs(score) * 11 + Math.random() * 10;

        return {
            agent: 'Reversion',
            signal: signal,
            confidence: Math.min(95, Math.round(confidence)),
            reasons
        };
    }

    // ── Agent 3: Correlational & Liquidity Agent ────────────────────
    function liquidityAgent(ticker) {
        const liquidityScore = MarketData.getLiquidityScore();
        const spreadStatus = MarketData.getSpreadStatus();
        const spyChange = MarketData.getChangePercent('SPY');
        const tickerChange = MarketData.getChangePercent(ticker);
        const spread = MarketData.getSpread(ticker);
        const price = MarketData.getPrice(ticker) || 100;

        let score = 0;
        let reasons = [];

        // SPY correlation alignment
        if (ticker !== 'SPY') {
            const sameDir = (spyChange > 0 && tickerChange > 0) || (spyChange < 0 && tickerChange < 0);
            if (sameDir && Math.abs(spyChange) > 0.1) {
                score += spyChange > 0 ? 1 : -1;
                reasons.push(`Correlated with SPY ${spyChange > 0 ? 'up' : 'down'}trend`);
            }
            // Divergence from SPY
            if (!sameDir && Math.abs(spyChange) > 0.15 && Math.abs(tickerChange) > 0.15) {
                reasons.push(`Diverging from SPY (ticker: ${tickerChange.toFixed(2)}%, SPY: ${spyChange.toFixed(2)}%)`);
            }
        }

        // Spread quality
        const spreadBps = (spread / price) * 10000;
        if (spreadBps > 15) { score -= 1; reasons.push(`Wide spread (${spreadBps.toFixed(1)} bps) — execution risk`); }
        else if (spreadBps < 3) { score += 0; reasons.push(`Tight spread (${spreadBps.toFixed(1)} bps)`); }

        // Overall liquidity environment
        if (liquidityScore < 4) {
            score -= 1;
            reasons.push(`Low market liquidity (${liquidityScore}/10) — increased slippage risk`);
        } else if (liquidityScore > 7) {
            reasons.push(`Strong market liquidity (${liquidityScore}/10)`);
        }

        const signal = _scoreToSignal(score);
        const confidence = 45 + Math.abs(score) * 10 + Math.random() * 12;

        return {
            agent: 'Liquidity',
            signal: signal,
            confidence: Math.min(90, Math.round(confidence)),
            reasons
        };
    }

    // ── Agent 4: Options & Volatility Specialist ────────────────────
    function optionsAgent(ticker) {
        const optSignal = OptionsAnalyzer.getOptionsSignal(ticker);

        if (optSignal.signal === 'N/A') {
            return {
                agent: 'Options',
                signal: SIGNAL.NA,
                confidence: 0,
                reasons: ['N/A — No Options Data'],
                excluded: true
            };
        }

        const signalMap = {
            'BULLISH': SIGNAL.BULLISH,
            'BEARISH': SIGNAL.BEARISH,
            'NEUTRAL': SIGNAL.NEUTRAL
        };

        return {
            agent: 'Options',
            signal: signalMap[optSignal.signal] || SIGNAL.NEUTRAL,
            confidence: optSignal.confidence,
            reasons: [optSignal.reason],
            excluded: false,
            details: {
                iv: optSignal.iv,
                pcr: optSignal.pcr,
                gex: optSignal.gex
            }
        };
    }

    // ── Consensus Engine (Stateful Debate Resolution) ───────────────
    function resolveConsensus(ticker) {
        const ag1 = momentumAgent(ticker);
        const ag2 = reversionAgent(ticker);
        const ag3 = liquidityAgent(ticker);
        const ag4 = optionsAgent(ticker);

        const agents = [ag1, ag2, ag3, ag4];
        const votingAgents = agents.filter(a => !a.excluded);

        // Convert signals to numeric
        const signalToNum = s => {
            if (s === SIGNAL.STRONG_BULLISH || s === SIGNAL.BULLISH) return 1;
            if (s === SIGNAL.STRONG_BEARISH || s === SIGNAL.BEARISH) return -1;
            return 0;
        };

        const votes = votingAgents.map(a => signalToNum(a.signal));
        const totalVotes = votes.reduce((a, b) => a + b, 0);
        const avgConfidence = votingAgents.reduce((a, b) => a + b.confidence, 0) / votingAgents.length;

        // Check for strong disagreement
        const bullCount = votes.filter(v => v > 0).length;
        const bearCount = votes.filter(v => v < 0).length;
        const hasConflict = bullCount >= 2 && bearCount >= 2;

        let consensus, action, confidence;

        if (hasConflict) {
            consensus = 'HOLD';
            confidence = Math.max(40, avgConfidence - 20);
            action = 'Monitor';

            // Log conflict
            memoryStore.debateConflicts.push({
                ticker,
                time: new Date().toLocaleTimeString(),
                agents: agents.map(a => `${a.agent}: ${a.signal}`).join(', '),
                resolution: 'HOLD (strong disagreement)'
            });

            if (memoryStore.debateConflicts.length > 30) {
                memoryStore.debateConflicts.shift();
            }
        } else if (totalVotes >= 3) {
            consensus = 'STR BUY';
            confidence = Math.min(95, avgConfidence + 10);
            action = 'Aggressive Entry';
        } else if (totalVotes >= 1) {
            consensus = 'BUY';
            confidence = avgConfidence;
            action = 'Scale In';
        } else if (totalVotes <= -3) {
            consensus = 'STR SELL';
            confidence = Math.min(95, avgConfidence + 10);
            action = 'Exit Position';
        } else if (totalVotes <= -1) {
            consensus = 'SELL';
            confidence = avgConfidence;
            action = 'Reduce';
        } else {
            consensus = 'HOLD';
            confidence = Math.max(35, avgConfidence - 10);
            action = 'Monitor';
        }

        confidence = Math.round(confidence);

        return {
            ticker,
            agents: { ag1, ag2, ag3, ag4 },
            consensus,
            confidence,
            action,
            hasConflict,
            price: MarketData.getPrice(ticker),
            change: MarketData.getChangePercent(ticker)
        };
    }

    // ── Run Full Analysis Cycle ─────────────────────────────────────
    function runCycle() {
        const results = [];

        MarketData.PORTFOLIO.forEach(ticker => {
            const result = resolveConsensus(ticker);
            results.push(result);
        });

        // Sort by confidence descending
        results.sort((a, b) => b.confidence - a.confidence);

        // Update memory
        _updateMemory(results);

        return results;
    }

    // ── Filter to significant signals ───────────────────────────────
    function getSignificantSignals(results) {
        return results.filter(r =>
            r.confidence > 65 ||
            Math.abs(r.change) > 0.3 ||
            r.consensus === 'STR BUY' ||
            r.consensus === 'STR SELL' ||
            r.hasConflict
        );
    }

    // ── Memory Management (FinMem simulation) ───────────────────────
    function _updateMemory(results) {
        const cycleSummary = {
            time: new Date().toLocaleTimeString(),
            timestamp: Date.now(),
            signalCount: results.filter(r => r.consensus !== 'HOLD').length,
            topBull: results.filter(r => r.consensus.includes('BUY')).slice(0, 3).map(r => r.ticker),
            topBear: results.filter(r => r.consensus.includes('SELL')).slice(0, 3).map(r => r.ticker),
            spyChange: MarketData.getChangePercent('SPY'),
            liquidityScore: MarketData.getLiquidityScore()
        };

        // Short-term memory (FIFO)
        memoryStore.shortTerm.push(cycleSummary);
        if (memoryStore.shortTerm.length > MAX_SHORT) memoryStore.shortTerm.shift();

        // Medium-term memory
        memoryStore.mediumTerm.push(cycleSummary);
        if (memoryStore.mediumTerm.length > MAX_MEDIUM) memoryStore.mediumTerm.shift();

        // Long-term memory (only notable events)
        const notable = results.filter(r => r.confidence > 85 || Math.abs(r.change) > 0.8);
        notable.forEach(r => {
            memoryStore.longTerm.push({
                ticker: r.ticker,
                time: new Date().toLocaleTimeString(),
                date: new Date().toLocaleDateString(),
                signal: r.consensus,
                confidence: r.confidence,
                change: r.change.toFixed(2)
            });
        });
        if (memoryStore.longTerm.length > MAX_LONG) {
            memoryStore.longTerm = memoryStore.longTerm.slice(-MAX_LONG);
        }
    }

    // ── Memory Recall (for FinMem panel) ────────────────────────────
    function getMemoryRecall() {
        const recalls = [];

        // Check for similar patterns in long-term memory
        if (memoryStore.longTerm.length > 0) {
            const latest = memoryStore.longTerm[memoryStore.longTerm.length - 1];
            const similar = memoryStore.longTerm.filter(m =>
                m.ticker === latest.ticker && m !== latest
            );
            if (similar.length > 0) {
                const prev = similar[similar.length - 1];
                recalls.push(
                    `FinMem retrieved a similar signal on ${latest.ticker} from ${prev.date} (${prev.signal} at ${prev.confidence}% conf, move: ${prev.change}%). Current pattern may repeat.`
                );
            }
        }

        // Liquidity trend from medium-term
        if (memoryStore.mediumTerm.length >= 3) {
            const recent = memoryStore.mediumTerm.slice(-3);
            const avgLiq = recent.reduce((a, b) => a + b.liquidityScore, 0) / 3;
            if (avgLiq < 4) {
                recalls.push(
                    `FinMem detects sustained low liquidity (avg ${avgLiq.toFixed(1)}/10 over last 3 cycles). Widened spreads and increased slippage expected.`
                );
            }
        }

        // SPY momentum from short-term
        if (memoryStore.shortTerm.length >= 2) {
            const spyChanges = memoryStore.shortTerm.map(c => c.spyChange);
            const allDown = spyChanges.every(c => c < -0.1);
            const allUp = spyChanges.every(c => c > 0.1);
            if (allDown) {
                recalls.push(
                    `FinMem observes consecutive SPY declines over the last ${spyChanges.length} cycles. Possible trend acceleration.`
                );
            }
            if (allUp) {
                recalls.push(
                    `FinMem observes consecutive SPY advances over the last ${spyChanges.length} cycles. Bullish momentum persisting.`
                );
            }
        }

        if (recalls.length === 0) {
            recalls.push('FinMem scanning historical patterns. No strong pattern matches found for this cycle.');
        }

        return recalls;
    }

    // ── Risk Alert Generator ────────────────────────────────────────
    function getRiskAlert(results) {
        const alerts = [];

        // Check for extreme moves
        const extremeMoves = results.filter(r => Math.abs(r.change) > 1.0);
        if (extremeMoves.length > 0) {
            const tickers = extremeMoves.map(r => `${r.ticker} (${r.change > 0 ? '+' : ''}${r.change.toFixed(2)}%)`);
            alerts.push(`⚠️ Extreme moves detected: ${tickers.join(', ')}`);
        }

        // High confidence strong sells
        const strongSells = results.filter(r => r.consensus === 'STR SELL' && r.confidence > 80);
        if (strongSells.length >= 3) {
            alerts.push(`🔴 Multiple high-conviction sell signals (${strongSells.length} assets). Broad weakness detected.`);
        }

        // Liquidity drain
        const liq = MarketData.getLiquidityScore();
        if (liq < 3) {
            alerts.push(`🔴 Critical liquidity drain (${liq}/10). Consider halting new entries.`);
        }

        // Flash crash detection (any asset down >2% in 5 mins)
        const flashCrash = results.filter(r => r.change < -2.0);
        if (flashCrash.length > 0) {
            alerts.push(`🚨 FLASH CRASH ALERT: ${flashCrash.map(r => r.ticker).join(', ')} down >2% in one cycle.`);
        }

        if (alerts.length === 0) {
            return { level: 'nominal', message: '🟢 All systems nominal. No anomalies detected.' };
        }

        const level = alerts.some(a => a.includes('🚨')) ? 'alert' :
            alerts.some(a => a.includes('🔴')) ? 'warning' : 'warning';

        return { level, message: alerts.join(' ') };
    }

    // ── Get Debate Conflicts ────────────────────────────────────────
    function getDebateConflicts() {
        return [...memoryStore.debateConflicts].reverse().slice(0, 8);
    }

    // ── Score to Signal mapping ─────────────────────────────────────
    function _scoreToSignal(score) {
        if (score >= 3) return SIGNAL.STRONG_BULLISH;
        if (score >= 1) return SIGNAL.BULLISH;
        if (score <= -3) return SIGNAL.STRONG_BEARISH;
        if (score <= -1) return SIGNAL.BEARISH;
        return SIGNAL.NEUTRAL;
    }

    // ── Public API ──────────────────────────────────────────────────
    return {
        SIGNAL,
        runCycle,
        getSignificantSignals,
        getMemoryRecall,
        getRiskAlert,
        getDebateConflicts
    };
})();
