/* ══════════════════════════════════════════════════════════════════
   DASHBOARD.JS — Core Rendering Engine & Cycle Orchestrator
   ══════════════════════════════════════════════════════════════════ */

(() => {
    'use strict';

    // ── Configuration ───────────────────────────────────────────────
    const CYCLE_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
    const BOOT_DURATION_MS = 3200;

    // ── State ───────────────────────────────────────────────────────
    let cycleCount = 0;
    let countdownSeconds = 300;
    let countdownInterval = null;
    let cycleInterval = null;
    let latestResults = [];

    // ── DOM References ──────────────────────────────────────────────
    const $ = id => document.getElementById(id);

    // ── Boot Sequence ───────────────────────────────────────────────
    function runBootSequence() {
        const bootLog = $('boot-log');
        const progressBar = $('boot-progress-bar');

        const steps = [
            { msg: '> Initializing TradingAgents container…', cls: 'info', pct: 10 },
            { msg: '  ✓ LangGraph state graph loaded', cls: 'ok', pct: 18 },
            { msg: '> Connecting to GKE cluster…', cls: 'info', pct: 25 },
            { msg: '  ✓ Cloud Run orchestrator online', cls: 'ok', pct: 32 },
            { msg: '> Loading Qlib factor library…', cls: 'info', pct: 40 },
            { msg: '  ✓ RD-Agent pipeline initialized (GPU: L4)', cls: 'ok', pct: 48 },
            { msg: '> Booting FinMem TGI inference endpoint…', cls: 'info', pct: 55 },
            { msg: '  ✓ Memorystore (Redis) connected', cls: 'ok', pct: 62 },
            { msg: '  ✓ AlloyDB pgvector ready', cls: 'ok', pct: 68 },
            { msg: '> Loading portfolio universe (50 assets)…', cls: 'info', pct: 75 },
            { msg: '  ✓ Market data engine seeded', cls: 'ok', pct: 82 },
            { msg: '> Arming 4 analysis agents…', cls: 'info', pct: 88 },
            { msg: '  ✓ Momentum | Reversion | Liquidity | Options', cls: 'ok', pct: 94 },
            { msg: '> System ready. Starting first cycle…', cls: 'ok', pct: 100 },
        ];

        let delay = 0;
        steps.forEach((step, i) => {
            delay += 150 + Math.random() * 100;
            setTimeout(() => {
                const line = document.createElement('div');
                line.className = `log-line ${step.cls}`;
                line.textContent = step.msg;
                bootLog.appendChild(line);
                bootLog.scrollTop = bootLog.scrollHeight;
                progressBar.style.width = step.pct + '%';
            }, delay);
        });

        setTimeout(() => {
            $('boot-overlay').classList.add('hidden');
            $('terminal-container').classList.add('visible');
            initDashboard();
        }, BOOT_DURATION_MS);
    }

    // ── Initialize Dashboard ────────────────────────────────────────
    function initDashboard() {
        MarketData.init();
        OptionsAnalyzer.init();

        updateClock();
        setInterval(updateClock, 1000);

        updateMarketHours();
        setInterval(updateMarketHours, 30000);

        // Run first cycle immediately
        runAnalysisCycle();

        // Start countdown
        startCountdown();

        // Schedule subsequent cycles
        cycleInterval = setInterval(() => {
            runAnalysisCycle();
            resetCountdown();
        }, CYCLE_INTERVAL_MS);
    }

    // ── Analysis Cycle ──────────────────────────────────────────────
    function runAnalysisCycle() {
        cycleCount++;
        $('cycle-number').textContent = cycleCount;
        $('header-status').textContent = 'ANALYZING';
        $('status-dot').textContent = '🟡';

        // Simulate analysis delay (1.5s)
        setTimeout(() => {
            // Tick market data
            MarketData.tick();
            OptionsAnalyzer.tick();

            // Run agents
            latestResults = AgentFramework.runCycle();

            // Update all panels
            updateLiquidityPanel();
            updateSignalsTable();
            updateOptionsPanel();
            updateFinMemPanel();

            // Set status back to active
            $('header-status').textContent = 'ACTIVE';
            $('status-dot').textContent = '🟢';
        }, 1500);
    }

    // ── Panel Updates ───────────────────────────────────────────────

    function updateLiquidityPanel() {
        const score = MarketData.getLiquidityScore();
        const spread = MarketData.getSpreadStatus();
        const volRate = MarketData.getVolumeRunRate();
        const vix = MarketData.getVIX();

        $('liquidity-score').textContent = score.toFixed(1);
        $('liquidity-bar').style.width = (score * 10) + '%';

        // Color the score
        const scoreEl = $('liquidity-score');
        if (score >= 7) scoreEl.style.color = 'var(--green)';
        else if (score >= 4) scoreEl.style.color = 'var(--yellow)';
        else scoreEl.style.color = 'var(--red)';

        $('spread-status').textContent = spread;
        $('spread-status').style.color = spread === 'Tight' ? 'var(--green)' :
            spread === 'Normal' ? 'var(--yellow)' : 'var(--red)';

        $('volume-runrate').textContent = volRate + ' vs avg';
        $('volume-runrate').style.color = volRate.startsWith('+') ? 'var(--green)' : 'var(--red)';

        $('vix-level').textContent = vix.toFixed(2);
        $('vix-level').style.color = vix > 25 ? 'var(--red)' : vix > 18 ? 'var(--yellow)' : 'var(--green)';

        $('macro-flow').textContent = OptionsAnalyzer.getMacroFlowSummary();

        // System impact
        const impact = score < 4 ? 'High volatility & slippage expected. Reduce position sizes.' :
            score < 7 ? 'Moderate conditions. Normal execution expected.' :
                'Excellent liquidity. Low slippage, tight spreads.';
        $('system-impact').textContent = impact;
    }

    function updateSignalsTable() {
        const tbody = $('signals-tbody');
        const significant = AgentFramework.getSignificantSignals(latestResults);

        // Clear table
        tbody.innerHTML = '';

        if (significant.length === 0) {
            tbody.innerHTML = '<tr class="placeholder-row"><td colspan="8">No significant signals this cycle. All assets within normal range.</td></tr>';
            $('signal-count').textContent = '0 signals';
            return;
        }

        significant.forEach((result, i) => {
            const row = document.createElement('tr');
            row.className = 'row-enter';
            row.style.animationDelay = (i * 0.05) + 's';

            const ag1 = result.agents.ag1;
            const ag2 = result.agents.ag2;
            const ag3 = result.agents.ag3;
            const ag4 = result.agents.ag4;

            row.innerHTML = `
                <td class="ticker-cell">${result.ticker}</td>
                <td class="${_signalClass(ag1.signal)}">${_signalEmoji(ag1.signal)} ${_signalLabel(ag1.signal)}</td>
                <td class="${_signalClass(ag2.signal)}">${_signalEmoji(ag2.signal)} ${_signalLabel(ag2.signal)}</td>
                <td class="${_signalClass(ag3.signal)}">${_signalEmoji(ag3.signal)} ${_signalLabel(ag3.signal)}</td>
                <td class="${_signalClass(ag4.signal)}">${_signalEmoji(ag4.signal)} ${_signalLabel(ag4.signal)}</td>
                <td class="${_consensusClass(result.consensus)}">${result.consensus}</td>
                <td class="${_confClass(result.confidence)}">${result.confidence}%</td>
                <td>${result.action}</td>
            `;

            tbody.appendChild(row);
        });

        $('signal-count').textContent = `${significant.length} signal${significant.length !== 1 ? 's' : ''}`;
    }

    function updateOptionsPanel() {
        const list = $('options-list');
        const events = OptionsAnalyzer.getSpotlightEvents();

        list.innerHTML = '';

        if (events.length === 0) {
            list.innerHTML = '<li class="options-item placeholder">No notable options activity this cycle.</li>';
            return;
        }

        events.forEach(event => {
            const li = document.createElement('li');
            li.className = 'options-item';
            li.innerHTML = `<span class="ticker-highlight">${event.ticker}:</span> ${event.message}`;
            list.appendChild(li);
        });
    }

    function updateFinMemPanel() {
        // Memory recall
        const recalls = AgentFramework.getMemoryRecall();
        $('memory-recall').textContent = recalls[0];

        // Risk alert
        const risk = AgentFramework.getRiskAlert(latestResults);
        const riskEl = $('risk-alert');
        riskEl.textContent = risk.message;
        riskEl.className = 'finmem-quote risk-quote';
        if (risk.level === 'alert') riskEl.classList.add('risk-alert');
        if (risk.level === 'warning') riskEl.classList.add('risk-alert');

        // Anomaly badge
        const badge = $('anomaly-badge');
        badge.textContent = risk.level === 'nominal' ? 'NOMINAL' :
            risk.level === 'warning' ? 'WARNING' : 'ALERT';
        badge.className = 'panel-badge badge-' + risk.level;

        // Debate log
        const debateLog = $('debate-log');
        const conflicts = AgentFramework.getDebateConflicts();

        if (conflicts.length === 0) {
            debateLog.innerHTML = '<div class="log-entry placeholder">No debate conflicts recorded.</div>';
        } else {
            debateLog.innerHTML = conflicts.map(c =>
                `<div class="log-entry"><span class="log-time">[${c.time}]</span> <span class="log-conflict">${c.ticker}:</span> ${c.agents}</div>`
            ).join('');
        }
    }

    // ── Signal Formatting Helpers ───────────────────────────────────
    function _signalEmoji(signal) {
        if (signal === 'BULLISH' || signal === 'STR BUY') return '🟢';
        if (signal === 'BEARISH' || signal === 'STR SELL') return '🔴';
        if (signal === 'N/A') return '⬛';
        return '⚪';
    }

    function _signalLabel(signal) {
        const map = {
            'STR BUY': 'Bullish',
            'BULLISH': 'Bullish',
            'NEUTRAL': 'Neutral',
            'BEARISH': 'Bearish',
            'STR SELL': 'Bearish',
            'N/A': 'N/A'
        };
        return map[signal] || signal;
    }

    function _signalClass(signal) {
        if (signal === 'BULLISH' || signal === 'STR BUY') return 'signal-bullish';
        if (signal === 'BEARISH' || signal === 'STR SELL') return 'signal-bearish';
        if (signal === 'N/A') return 'signal-na';
        return 'signal-neutral';
    }

    function _consensusClass(consensus) {
        const map = {
            'STR BUY': 'consensus-str-buy',
            'BUY': 'consensus-buy',
            'HOLD': 'consensus-hold',
            'SELL': 'consensus-sell',
            'STR SELL': 'consensus-str-sell'
        };
        return map[consensus] || '';
    }

    function _confClass(conf) {
        if (conf >= 80) return 'conf-high';
        if (conf >= 65) return 'conf-med';
        return 'conf-low';
    }

    // ── Clock & Countdown ───────────────────────────────────────────
    function updateClock() {
        const now = new Date();
        const ts = now.getFullYear() + '-' +
            String(now.getMonth() + 1).padStart(2, '0') + '-' +
            String(now.getDate()).padStart(2, '0') + ' ' +
            String(now.getHours()).padStart(2, '0') + ':' +
            String(now.getMinutes()).padStart(2, '0') + ':' +
            String(now.getSeconds()).padStart(2, '0');
        $('header-timestamp').textContent = ts;
    }

    function startCountdown() {
        countdownSeconds = 300;
        updateCountdownDisplay();
        countdownInterval = setInterval(() => {
            countdownSeconds--;
            if (countdownSeconds < 0) countdownSeconds = 300;
            updateCountdownDisplay();
        }, 1000);
    }

    function resetCountdown() {
        countdownSeconds = 300;
        updateCountdownDisplay();
    }

    function updateCountdownDisplay() {
        const mins = Math.floor(countdownSeconds / 60);
        const secs = countdownSeconds % 60;
        const display = `${mins}:${String(secs).padStart(2, '0')}`;
        $('countdown-timer').textContent = display;

        // Turn yellow at < 30s, red at < 10s
        const el = $('countdown-timer');
        if (countdownSeconds < 10) { el.style.color = 'var(--red)'; el.style.textShadow = '0 0 12px var(--red-glow)'; }
        else if (countdownSeconds < 30) { el.style.color = 'var(--yellow)'; el.style.textShadow = '0 0 12px var(--yellow-glow)'; }
        else { el.style.color = 'var(--green)'; el.style.textShadow = '0 0 12px var(--green-glow)'; }
    }

    function updateMarketHours() {
        const status = MarketData.getMarketStatus();
        const el = $('market-hours-status');
        el.textContent = status === 'OPEN' ? '● MARKET OPEN' :
            status === 'PRE-MARKET' ? '◐ PRE-MARKET' :
                status === 'AFTER-HOURS' ? '◑ AFTER-HOURS' :
                    '○ MARKET CLOSED';
        el.className = 'footer-item market-' + status.toLowerCase().replace('-', '');
        if (status === 'PRE-MARKET' || status === 'AFTER-HOURS') el.classList.add('market-pre');
        if (status === 'CLOSED') el.classList.add('market-closed');
        if (status === 'OPEN') el.classList.add('market-open');
    }

    // ── Launch ──────────────────────────────────────────────────────
    document.addEventListener('DOMContentLoaded', runBootSequence);

})();
