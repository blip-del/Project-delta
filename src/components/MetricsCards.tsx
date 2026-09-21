import React from "react";
import { StockQuote } from "../types";
import { Activity, Crosshair, ArrowUpDown, Shield, AlertTriangle } from "lucide-react";

interface MetricsCardsProps {
  quote: StockQuote;
  dte: number;
  atmIv: number;
  callWall: number;
  putWall: number;
  maxPain: number;
  putCallRatio: number;
  totalCallVol: number;
  totalPutVol: number;
}

export const MetricsCards: React.FC<MetricsCardsProps> = ({
  quote,
  dte,
  atmIv,
  callWall,
  putWall,
  maxPain,
  putCallRatio,
  totalCallVol,
  totalPutVol,
}) => {
  const currentPrice = quote.regularMarketPrice;

  // Expected move formula: StockPrice * (IV / 100) * sqrt(DTE / 365)
  const ivDecimal = atmIv / 100;
  const expectedMoveDollar = currentPrice * ivDecimal * Math.sqrt(Math.max(1, dte) / 365);
  const expectedMovePct = (expectedMoveDollar / currentPrice) * 100;
  const lower1Sigma = currentPrice - expectedMoveDollar;
  const upper1Sigma = currentPrice + expectedMoveDollar;

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
      {/* 1. Expected Move Card */}
      <div className="bg-[#0b131e] border border-[#172436] rounded-xl p-3 shadow-sm relative overflow-hidden">
        <div className="flex items-center justify-between text-slate-400 mb-1">
          <span className="text-[11px] font-mono uppercase tracking-wider font-semibold flex items-center gap-1">
            <Crosshair className="w-3.5 h-3.5 text-emerald-400" />
            Expected Move (±1σ)
          </span>
          <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">
            {dte}d DTE
          </span>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-xl font-black font-mono text-white">
            ±${expectedMoveDollar.toFixed(2)}
          </span>
          <span className="text-xs font-mono text-emerald-400 font-bold">
            ({expectedMovePct.toFixed(1)}%)
          </span>
        </div>
        <div className="mt-2 pt-2 border-t border-[#162334] flex items-center justify-between text-[11px] font-mono">
          <span className="text-slate-400">Band</span>
          <span className="text-slate-200">
            ${lower1Sigma.toFixed(1)} — ${upper1Sigma.toFixed(1)}
          </span>
        </div>
      </div>

      {/* 2. Key Gamma Levels (Call Wall & Put Wall) */}
      <div className="bg-[#0b131e] border border-[#172436] rounded-xl p-3 shadow-sm">
        <div className="flex items-center justify-between text-slate-400 mb-1">
          <span className="text-[11px] font-mono uppercase tracking-wider font-semibold flex items-center gap-1">
            <Shield className="w-3.5 h-3.5 text-cyan-400" />
            Key Open Interest Walls
          </span>
          <span className="text-[10px] font-mono text-slate-400">GEX Focus</span>
        </div>
        <div className="grid grid-cols-2 gap-2 mt-1">
          <div>
            <div className="text-[10px] text-slate-400 font-mono">CALL WALL</div>
            <div className="text-base font-black font-mono text-emerald-400">${callWall.toFixed(1)}</div>
          </div>
          <div>
            <div className="text-[10px] text-slate-400 font-mono">PUT WALL</div>
            <div className="text-base font-black font-mono text-rose-400">${putWall.toFixed(1)}</div>
          </div>
        </div>
        <div className="mt-2 pt-2 border-t border-[#162334] flex items-center justify-between text-[11px] font-mono">
          <span className="text-slate-400">Max Pain Strike</span>
          <span className="text-amber-300 font-bold">${maxPain.toFixed(1)}</span>
        </div>
      </div>

      {/* 3. Put / Call Sentiment */}
      <div className="bg-[#0b131e] border border-[#172436] rounded-xl p-3 shadow-sm">
        <div className="flex items-center justify-between text-slate-400 mb-1">
          <span className="text-[11px] font-mono uppercase tracking-wider font-semibold flex items-center gap-1">
            <ArrowUpDown className="w-3.5 h-3.5 text-amber-400" />
            Put / Call Ratio
          </span>
          <span className="text-[10px] font-mono text-slate-400">Volume</span>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-xl font-black font-mono text-white">{putCallRatio.toFixed(2)}</span>
          <span
            className={`text-xs font-mono font-bold px-1.5 py-0.5 rounded ${
              putCallRatio > 1.0
                ? "text-rose-400 bg-rose-500/10"
                : "text-emerald-400 bg-emerald-500/10"
            }`}
          >
            {putCallRatio > 1.1 ? "Bearish Bias" : putCallRatio < 0.8 ? "Bullish Bias" : "Neutral"}
          </span>
        </div>
        <div className="mt-2 pt-2 border-t border-[#162334] flex items-center justify-between text-[11px] font-mono">
          <span className="text-emerald-400">Calls: {totalCallVol.toLocaleString()}</span>
          <span className="text-rose-400">Puts: {totalPutVol.toLocaleString()}</span>
        </div>
      </div>

      {/* 4. Day & 52W Extreme Range */}
      <div className="bg-[#0b131e] border border-[#172436] rounded-xl p-3 shadow-sm">
        <div className="flex items-center justify-between text-slate-400 mb-1">
          <span className="text-[11px] font-mono uppercase tracking-wider font-semibold flex items-center gap-1">
            <Activity className="w-3.5 h-3.5 text-purple-400" />
            Trading Boundaries
          </span>
          <span className="text-[10px] font-mono text-slate-400">Day / 52W</span>
        </div>
        <div className="flex items-baseline justify-between text-xs font-mono mt-1">
          <div>
            <span className="text-[10px] text-slate-400 block">DAY RANGE</span>
            <span className="text-white font-semibold">
              ${quote.regularMarketDayLow.toFixed(1)} - ${quote.regularMarketDayHigh.toFixed(1)}
            </span>
          </div>
          <div className="text-right">
            <span className="text-[10px] text-slate-400 block">52-WEEK</span>
            <span className="text-white font-semibold">
              ${quote.fiftyTwoWeekLow.toFixed(1)} - ${quote.fiftyTwoWeekHigh.toFixed(1)}
            </span>
          </div>
        </div>
        <div className="mt-2 pt-2 border-t border-[#162334] flex items-center justify-between text-[11px] font-mono">
          <span className="text-slate-400">ATM Implied Vol</span>
          <span className="text-cyan-300 font-bold">{atmIv.toFixed(1)}%</span>
        </div>
      </div>
    </div>
  );
};
