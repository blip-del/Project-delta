import React from "react";
import { StockQuote } from "../types";
import { Star, RefreshCw, Code2, ShieldAlert, Zap, TrendingUp, TrendingDown } from "lucide-react";

interface HeaderProps {
  quote: StockQuote;
  atmIv: number;
  ivRank?: number;
  hv30?: number;
  dte: number;
  isFallback?: boolean;
  isLoading: boolean;
  onRefresh: () => void;
  onOpenStreamlitCode: () => void;
  isFavorite: boolean;
  onToggleFavorite: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  quote,
  atmIv,
  ivRank = 28,
  hv30 = 34.5,
  isFallback,
  isLoading,
  onRefresh,
  onOpenStreamlitCode,
  isFavorite,
  onToggleFavorite,
}) => {
  const isPositive = quote.regularMarketChange >= 0;

  return (
    <header className="border-b border-[#172334] bg-[#090e17]/95 backdrop-blur px-4 py-2.5 sticky top-0 z-40">
      <div className="max-w-[1750px] mx-auto flex flex-wrap items-center justify-between gap-3">
        {/* Left: Brand + Ticker info */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-black text-xs">
              Ω
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-extrabold text-white tracking-tight flex items-center gap-1.5 font-mono">
                  {quote.symbol}
                  <button
                    onClick={onToggleFavorite}
                    className={`p-1 hover:text-amber-400 transition-colors ${
                      isFavorite ? "text-amber-400 fill-amber-400" : "text-slate-500"
                    }`}
                    title="Toggle Favorite"
                  >
                    <Star className="w-3.5 h-3.5" fill={isFavorite ? "currentColor" : "none"} />
                  </button>
                </h1>
                <span className="text-xs text-slate-400 max-w-[160px] truncate hidden sm:inline">
                  {quote.shortName}
                </span>
                <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                  {quote.exchange || "US"}
                </span>
              </div>
            </div>
          </div>

          <div className="h-6 w-[1px] bg-slate-800 hidden md:block" />

          {/* Current Price & Change */}
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black font-mono text-white tracking-tight">
              ${quote.regularMarketPrice.toFixed(2)}
            </span>
            <div
              className={`flex items-center gap-0.5 text-xs font-mono font-bold px-1.5 py-0.5 rounded ${
                isPositive
                  ? "text-emerald-400 bg-emerald-500/10"
                  : "text-rose-400 bg-rose-500/10"
              }`}
            >
              {isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
              <span>
                {isPositive ? "+" : ""}
                {quote.regularMarketChange.toFixed(2)} ({isPositive ? "+" : ""}
                {quote.regularMarketChangePercent.toFixed(2)}%)
              </span>
            </div>
          </div>
        </div>

        {/* Center: ApexVol Metrics Bar */}
        <div className="hidden lg:flex items-center gap-4 bg-[#0d1624] border border-[#1a283c] px-3 py-1.5 rounded-lg text-xs font-mono">
          <div className="flex flex-col">
            <span className="text-[10px] text-slate-400 font-sans uppercase tracking-wider">IV Rank (1y)</span>
            <span className="text-emerald-400 font-bold">{ivRank}%ile</span>
          </div>
          <div className="h-5 w-[1px] bg-slate-800" />
          <div className="flex flex-col">
            <span className="text-[10px] text-slate-400 font-sans uppercase tracking-wider">ATM IV (30d)</span>
            <span className="text-white font-bold">{atmIv.toFixed(1)}%</span>
          </div>
          <div className="h-5 w-[1px] bg-slate-800" />
          <div className="flex flex-col">
            <span className="text-[10px] text-slate-400 font-sans uppercase tracking-wider">HV 30D</span>
            <span className="text-slate-300 font-bold">{hv30.toFixed(1)}%</span>
          </div>
          <div className="h-5 w-[1px] bg-slate-800" />
          <div className="flex flex-col">
            <span className="text-[10px] text-slate-400 font-sans uppercase tracking-wider">Market</span>
            <span className="text-emerald-400 font-bold flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              LIVE
            </span>
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2">
          {isFallback ? (
            <span
              className="flex items-center gap-1.5 text-[11px] font-mono text-amber-400 bg-amber-500/10 border border-amber-500/30 px-2.5 py-1 rounded-md"
              title="Calculated Black-Scholes synthetic chain used as fallback"
            >
              <ShieldAlert className="w-3.5 h-3.5" />
              <span>Simulated Feed</span>
            </span>
          ) : (
            <span
              className="flex items-center gap-1.5 text-[11px] font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-1 rounded-md"
              title="Real-time live options chain from Yahoo Finance"
            >
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="font-bold">Real Yahoo Data</span>
            </span>
          )}

          <button
            onClick={onRefresh}
            disabled={isLoading}
            className="p-1.5 rounded bg-[#0f1a2a] hover:bg-[#16253b] text-slate-300 hover:text-white border border-[#1e2f46] transition-all disabled:opacity-50"
            title="Refresh Live Data"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin text-emerald-400" : ""}`} />
          </button>

          <button
            onClick={onOpenStreamlitCode}
            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded bg-gradient-to-r from-emerald-600/90 to-teal-600/90 hover:from-emerald-500 hover:to-teal-500 text-slate-950 font-mono shadow-sm transition-all"
            title="View ready-to-run Streamlit Python app.py"
          >
            <Code2 className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>Python Streamlit App</span>
          </button>
        </div>
      </div>
    </header>
  );
};
