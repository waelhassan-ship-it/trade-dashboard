/* ══════════════════════════════════════════════════════════════════
   MARKET-DATA.JS — Portfolio Universe & Simulated Price Engine
   ══════════════════════════════════════════════════════════════════ */

const MarketData = (() => {

    // ── Portfolio Universe ───────────────────────────────────────────
    const PORTFOLIO = [
        'UAN','SLV','RTX','COST','IAU','LLY','FANG','WMT','RNMBF','PFE',
        'THLEF','GLDM','DBMF','CWEN.A','TAIL','SH','ACGL','PSQ','KOS','LYFT',
        'DOG','KLAR','XLP','KO','SGOV','BCRX','ABCB','RBLX','XLU','TLT',
        'SPY','XLV','V','MSFT','USMV','RSP','NUE','RIG','LULU','UPS',
        'MA','BRK.B','NBIS','UNH','NU','AMZN','DHR','GOOG','NVDA','ASML'
    ];

    // Tickers that lack options chains (OTC / illiquid)
    const NO_OPTIONS = new Set(['RNMBF', 'THLEF', 'KLAR']);

    // Sector assignments for correlation analysis
    const SECTORS = {
        'Tech':       ['MSFT','GOOG','NVDA','AMZN','ASML','RBLX','NBIS'],
        'Financial':  ['V','MA','BRK.B','NU','ACGL','ABCB'],
        'Healthcare': ['LLY','PFE','UNH','DHR','BCRX','XLV'],
        'Consumer':   ['COST','WMT','LULU','KO','XLP','LYFT','UPS'],
        'Energy':     ['FANG','KOS','RIG','UAN'],
        'Defense':    ['RTX'],
        'Metals':     ['SLV','IAU','GLDM','NUE'],
        'Bonds/Hedge':['TLT','SGOV','TAIL','SH','PSQ','DOG','DBMF','USMV','RSP'],
        'Utilities':  ['XLU','CWEN.A'],
        'Index':      ['SPY']
    };

    // Realistic baseline prices (approximate)
    const BASE_PRICES = {
        UAN: 72, SLV: 28, RTX: 122, COST: 915, IAU: 52, LLY: 820,
        FANG: 165, WMT: 185, RNMBF: 0.45, PFE: 26, THLEF: 3.20,
        GLDM: 48, DBMF: 26, 'CWEN.A': 28, TAIL: 8, SH: 13, ACGL: 105,
        PSQ: 11, KOS: 4.5, LYFT: 15, DOG: 30, KLAR: 12, XLP: 82,
        KO: 62, SGOV: 100, BCRX: 8, ABCB: 52, RBLX: 55, XLU: 78,
        TLT: 88, SPY: 575, XLV: 148, V: 310, MSFT: 430, USMV: 90,
        RSP: 170, NUE: 145, RIG: 4.8, LULU: 380, UPS: 130, MA: 510,
        'BRK.B': 440, NBIS: 42, UNH: 510, NU: 13, AMZN: 210,
        DHR: 245, GOOG: 175, NVDA: 135, ASML: 710
    };

    // Volatility profiles (annualized σ, roughly mapped)
    const VOLATILITY = {
        UAN: 0.45, SLV: 0.30, RTX: 0.20, COST: 0.18, IAU: 0.15, LLY: 0.30,
        FANG: 0.38, WMT: 0.16, RNMBF: 0.70, PFE: 0.28, THLEF: 0.60,
        GLDM: 0.14, DBMF: 0.12, 'CWEN.A': 0.25, TAIL: 0.20, SH: 0.18,
        ACGL: 0.22, PSQ: 0.18, KOS: 0.55, LYFT: 0.50, DOG: 0.18,
        KLAR: 0.55, XLP: 0.12, KO: 0.14, SGOV: 0.02, BCRX: 0.65,
        ABCB: 0.28, RBLX: 0.55, XLU: 0.14, TLT: 0.18, SPY: 0.15,
        XLV: 0.14, V: 0.20, MSFT: 0.22, USMV: 0.12, RSP: 0.16,
        NUE: 0.35, RIG: 0.55, LULU: 0.32, UPS: 0.22, MA: 0.20,
        'BRK.B': 0.16, NBIS: 0.50, UNH: 0.20, NU: 0.48, AMZN: 0.28,
        DHR: 0.22, GOOG: 0.25, NVDA: 0.45, ASML: 0.32
    };

    // ── State ───────────────────────────────────────────────────────
    let prices = {};          // current simulated prices
    let previousPrices = {};  // prices from last cycle
    let priceHistory = {};    // last N prices for each ticker
    let volumes = {};         // simulated volume data
    let bidAskSpreads = {};   // simulated bid-ask spreads
    let initialized = false;
    const HISTORY_LENGTH = 30; // 30 cycles = 2.5 hours of history

    // ── Initialize ──────────────────────────────────────────────────
    function init() {
        PORTFOLIO.forEach(ticker => {
            const base = BASE_PRICES[ticker] || 100;
            // Add slight randomization on init
            prices[ticker] = base * (1 + (Math.random() - 0.5) * 0.005);
            previousPrices[ticker] = prices[ticker];
            priceHistory[ticker] = [prices[ticker]];
            volumes[ticker] = _generateVolume(ticker);
            bidAskSpreads[ticker] = _generateSpread(ticker);
        });
        initialized = true;
    }

    // ── Simulate Next 5-Min Tick ────────────────────────────────────
    function tick() {
        if (!initialized) init();

        // SPY drives correlated moves
        const spyDrift = _gbmReturn('SPY');

        PORTFOLIO.forEach(ticker => {
            previousPrices[ticker] = prices[ticker];

            // Geometric Brownian Motion with SPY correlation
            const ownReturn = _gbmReturn(ticker);
            const correlation = _getCorrelation(ticker);
            const blendedReturn = correlation * spyDrift + (1 - correlation) * ownReturn;

            prices[ticker] = prices[ticker] * (1 + blendedReturn);

            // Enforce non-negative
            if (prices[ticker] < 0.01) prices[ticker] = 0.01;

            // History
            priceHistory[ticker].push(prices[ticker]);
            if (priceHistory[ticker].length > HISTORY_LENGTH) {
                priceHistory[ticker].shift();
            }

            // Refresh volume & spread
            volumes[ticker] = _generateVolume(ticker);
            bidAskSpreads[ticker] = _generateSpread(ticker);
        });
    }

    // ── GBM Return (5-min interval) ─────────────────────────────────
    function _gbmReturn(ticker) {
        const sigma = VOLATILITY[ticker] || 0.25;
        // Scale annualized vol to 5-min: σ_5m = σ_annual / sqrt(252 * 78)
        const sigma5m = sigma / Math.sqrt(252 * 78);
        const drift = -0.5 * sigma5m * sigma5m; // risk-neutral drift
        const z = _normalRandom();
        return drift + sigma5m * z;
    }

    // ── SPY Correlation (sector-based) ──────────────────────────────
    function _getCorrelation(ticker) {
        if (ticker === 'SPY') return 1.0;
        const sectorMap = {
            'Tech': 0.80, 'Financial': 0.70, 'Healthcare': 0.55,
            'Consumer': 0.65, 'Energy': 0.45, 'Defense': 0.50,
            'Metals': 0.25, 'Bonds/Hedge': -0.30, 'Utilities': 0.35,
            'Index': 1.0
        };
        for (const [sector, tickers] of Object.entries(SECTORS)) {
            if (tickers.includes(ticker)) return sectorMap[sector] || 0.5;
        }
        return 0.5;
    }

    // ── Volume Simulation ───────────────────────────────────────────
    function _generateVolume(ticker) {
        const baseVol = ticker === 'SPY' ? 85_000_000 :
                        ['NVDA','AMZN','MSFT','GOOG'].includes(ticker) ? 30_000_000 :
                        NO_OPTIONS.has(ticker) ? 50_000 :
                        2_000_000;
        const noise = 0.7 + Math.random() * 0.6; // ±30%
        return Math.round(baseVol * noise);
    }

    // ── Bid-Ask Spread ──────────────────────────────────────────────
    function _generateSpread(ticker) {
        const price = prices[ticker] || 100;
        // Tighter spreads on liquid names
        const bps = NO_OPTIONS.has(ticker) ? 80 + Math.random() * 120 :
                    price > 200 ? 1 + Math.random() * 3 :
                    price > 50  ? 2 + Math.random() * 5 :
                    price > 10  ? 3 + Math.random() * 8 :
                    10 + Math.random() * 20;
        return (bps / 10000) * price; // spread in $
    }

    // ── Liquidity Score (1-10) ──────────────────────────────────────
    function getLiquidityScore() {
        const spyVol = volumes['SPY'] || 85_000_000;
        const avgVol = 85_000_000;
        const volRatio = spyVol / avgVol;
        const spread = bidAskSpreads['SPY'] || 0.05;
        const spreadScore = Math.max(0, 10 - spread * 200);
        const volScore = Math.min(10, volRatio * 7);
        return Math.round((spreadScore * 0.4 + volScore * 0.6) * 10) / 10;
    }

    // ── Spread status ───────────────────────────────────────────────
    function getSpreadStatus() {
        const spread = bidAskSpreads['SPY'] || 0.05;
        const bps = (spread / (prices['SPY'] || 575)) * 10000;
        if (bps < 1.5) return 'Tight';
        if (bps < 4)   return 'Normal';
        return 'Wide';
    }

    // ── Volume run-rate vs average ──────────────────────────────────
    function getVolumeRunRate() {
        const spyVol = volumes['SPY'] || 85_000_000;
        const avg = 85_000_000;
        const pct = ((spyVol - avg) / avg) * 100;
        return pct >= 0 ? `+${pct.toFixed(1)}%` : `${pct.toFixed(1)}%`;
    }

    // ── EMA Calculator ──────────────────────────────────────────────
    function getEMA(ticker, periods) {
        const hist = priceHistory[ticker] || [];
        if (hist.length === 0) return null;
        const k = 2 / (periods + 1);
        let ema = hist[0];
        for (let i = 1; i < hist.length; i++) {
            ema = hist[i] * k + ema * (1 - k);
        }
        return ema;
    }

    // ── RSI Calculator ──────────────────────────────────────────────
    function getRSI(ticker, periods = 14) {
        const hist = priceHistory[ticker] || [];
        if (hist.length < 2) return 50;

        let gains = 0, losses = 0;
        const len = Math.min(periods, hist.length - 1);
        for (let i = hist.length - len; i < hist.length; i++) {
            const change = hist[i] - hist[i - 1];
            if (change > 0) gains += change;
            else losses -= change;
        }
        if (losses === 0) return 100;
        const rs = gains / losses;
        return 100 - 100 / (1 + rs);
    }

    // ── Standard Deviation ──────────────────────────────────────────
    function getStdDev(ticker, periods = 14) {
        const hist = priceHistory[ticker] || [];
        const len = Math.min(periods, hist.length);
        if (len < 2) return 0;
        const slice = hist.slice(-len);
        const mean = slice.reduce((a, b) => a + b, 0) / len;
        const variance = slice.reduce((a, b) => a + (b - mean) ** 2, 0) / len;
        return Math.sqrt(variance);
    }

    // ── Price Change % (this cycle) ─────────────────────────────────
    function getChangePercent(ticker) {
        const curr = prices[ticker];
        const prev = previousPrices[ticker];
        if (!prev || !curr) return 0;
        return ((curr - prev) / prev) * 100;
    }

    // ── Market Hours Detection ──────────────────────────────────────
    function getMarketStatus() {
        const now = new Date();
        const et = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
        const h = et.getHours();
        const m = et.getMinutes();
        const day = et.getDay();
        const mins = h * 60 + m;

        if (day === 0 || day === 6) return 'CLOSED';
        if (mins >= 570 && mins < 960) return 'OPEN';       // 9:30–16:00
        if (mins >= 540 && mins < 570) return 'PRE-MARKET';  // 9:00–9:30
        if (mins >= 960 && mins < 1020) return 'AFTER-HOURS'; // 16:00–17:00
        return 'CLOSED';
    }

    // ── Normal Random (Box-Muller) ──────────────────────────────────
    function _normalRandom() {
        let u = 0, v = 0;
        while (u === 0) u = Math.random();
        while (v === 0) v = Math.random();
        return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
    }

    // ── VIX Simulation ──────────────────────────────────────────────
    function getVIX() {
        // Simulate a VIX between 12 and 35 with some persistence
        if (!MarketData._vix) MarketData._vix = 18 + Math.random() * 6;
        MarketData._vix += (Math.random() - 0.5) * 1.5;
        MarketData._vix = Math.max(11, Math.min(38, MarketData._vix));
        return MarketData._vix;
    }

    // ── Public API ──────────────────────────────────────────────────
    return {
        PORTFOLIO,
        NO_OPTIONS,
        SECTORS,
        init,
        tick,
        getPrice:        t => prices[t],
        getPreviousPrice:t => previousPrices[t],
        getVolume:       t => volumes[t],
        getSpread:       t => bidAskSpreads[t],
        getHistory:      t => priceHistory[t] || [],
        getChangePercent,
        getLiquidityScore,
        getSpreadStatus,
        getVolumeRunRate,
        getEMA,
        getRSI,
        getStdDev,
        getMarketStatus,
        getVIX,
        _vix: null
    };
})();
