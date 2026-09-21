import React, { useState } from "react";
import { Search, SlidersHorizontal, Layers, ChevronRight, BarChart3, Check } from "lucide-react";

interface SidebarProps {
  currentTicker: string;
  onSelectTicker: (ticker: string) => void;
  expirationDates: number[];
  selectedExpiration: number;
  onSelectExpiration: (ts: number) => void;
  strikeFilter: string;
  onChangeStrikeFilter: (filter: string) => void;
  onApplyPreset: (preset: string) => void;
  activePreset: string | null;
}

const WATCHLIST = [
  { symbol: "NVDA", name: "NVIDIA", price: 217.49, ivRank: 32, change: "+0.39%" },
  { symbol: "AAPL", name: "Apple", price: 232.15, ivRank: 24, change: "+0.71%" },
  { symbol: "TSLA", name: "Tesla", price: 248.80, ivRank: 48, change: "-1.12%" },
  { symbol: "SPY", name: "S&P 500 ETF", price: 565.40, ivRank: 18, change: "+0.15%" },
  { symbol: "MSFT", name: "Microsoft", price: 428.60, ivRank: 21, change: "+0.45%" },
  { symbol: "ORCL", name: "Oracle", price: 150.06, ivRank: 38, change: "-0.52%" },
  { symbol: "AMD", name: "AMD", price: 156.30, ivRank: 42, change: "+1.30%" },
  { symbol: "AMZN", name: "Amazon", price: 188.50, ivRank: 27, change: "+0.60%" },
  { symbol: "META", name: "Meta Platforms", price: 520.10, ivRank: 31, change: "-0.25%" },
];

export const Sidebar: React.FC<SidebarProps> = ({
  currentTicker,
  onSelectTicker,
  expirationDates,
  selectedExpiration,
  onSelectExpiration,
  strikeFilter,
  onChangeStrikeFilter,
  onApplyPreset,
  activePreset,
}) => {
  const [searchInput, setSearchInput] = useState("");

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchInput.trim()) {
      onSelectTicker(searchInput.trim().toUpperCase());
      setSearchInput("");
    }
  };

  const formatExpDate = (timestamp: number) => {
    const d = new Date(timestamp * 1000);
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const now = new Date();
    const dte = Math.max(1, Math.round((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
    const dateStr = `${months[d.getUTCMonth()]} ${d.getUTCDate()} '${String(d.getUTCFullYear()).slice(2)}`;
    return { dateStr, dte };
  };

  return (
    <aside className="w-full lg:w-72 bg-[#090e17] border-r border-[#172334] p-3 flex flex-col gap-4 text-xs font-sans shrink-0">
      {/* Ticker Search Box */}
      <div>
        <div className="flex items-center justify-between mb-1.5 px-1">
          <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold">
            Ticker Symbol
          </span>
          <span className="text-[10px] text-emerald-400 font-mono">yfinance connected</span>
        </div>
        <form onSubmit={handleSearchSubmit} className="relative">
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value.toUpperCase())}
            placeholder="Enter symbol (e.g. AAPL, NVDA, SPY)..."
            className="w-full bg-[#0d1522] border border-[#1b2a3d] focus:border-emerald-500 rounded-lg py-2 pl-8 pr-3 text-white placeholder:text-slate-500 font-mono text-xs focus:outline-none transition-all"
          />
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
        </form>
      </div>

      {/* Watchlist Quick Switcher */}
      <div>
        <div className="flex items-center justify-between mb-1.5 px-1">
          <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold">
            Active Watchlist
          </span>
          <span className="text-[10px] text-slate-500 font-mono">IV%ile</span>
        </div>
        <div className="space-y-1 max-h-48 overflow-y-auto pr-1">
          {WATCHLIST.map((item) => {
            const isSelected = item.symbol === currentTicker.toUpperCase();
            const isPos = item.change.startsWith("+");
            return (
              <button
                key={item.symbol}
                onClick={() => onSelectTicker(item.symbol)}
                className={`w-full flex items-center justify-between p-2 rounded-lg border transition-all text-left ${
                  isSelected
                    ? "bg-[#112236] border-emerald-500/50 text-white font-semibold"
                    : "bg-[#0b121c] border-[#162334] text-slate-300 hover:bg-[#101b2a] hover:border-slate-700"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-xs">{item.symbol}</span>
                  <span className="text-[10px] text-slate-400 truncate max-w-[70px]">{item.name}</span>
                </div>
                <div className="flex items-center gap-2 font-mono text-[11px]">
                  <span>${item.price.toFixed(1)}</span>
                  <span
                    className={`text-[10px] px-1 rounded ${
                      isPos ? "text-emerald-400 bg-emerald-500/10" : "text-rose-400 bg-rose-500/10"
                    }`}
                  >
                    {item.change}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Expirations Section */}
      <div>
        <div className="flex items-center justify-between mb-1.5 px-1">
          <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold flex items-center gap-1">
            <Layers className="w-3 h-3 text-emerald-400" />
            Expiration Dates
          </span>
          <span className="text-[10px] text-slate-400 font-mono">
            {expirationDates.length} listed
          </span>
        </div>
        <div className="space-y-1 max-h-40 overflow-y-auto pr-1">
          {expirationDates.map((ts) => {
            const { dateStr, dte } = formatExpDate(ts);
            const isSelected = ts === selectedExpiration;
            return (
              <button
                key={ts}
                onClick={() => onSelectExpiration(ts)}
                className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded border transition-all text-xs font-mono ${
                  isSelected
                    ? "bg-emerald-500/15 border-emerald-500/60 text-emerald-300 font-bold shadow-sm"
                    : "bg-[#0c141f] border-[#152232] text-slate-300 hover:bg-[#111a28] hover:border-slate-700"
                }`}
              >
                <span>{dateStr}</span>
                <span className={`text-[11px] ${isSelected ? "text-emerald-400" : "text-slate-400"}`}>
                  {dte}d DTE
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Strike Filter */}
      <div>
        <div className="flex items-center justify-between mb-1.5 px-1">
          <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold flex items-center gap-1">
            <SlidersHorizontal className="w-3 h-3 text-cyan-400" />
            Strike Range
          </span>
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          {[
            { id: "ATM_15", label: "±15% ATM" },
            { id: "ATM_30", label: "±30% ATM" },
            { id: "TOP_25", label: "Top 25 Strikes" },
            { id: "ALL", label: "All Strikes" },
          ].map((opt) => (
            <button
              key={opt.id}
              onClick={() => onChangeStrikeFilter(opt.id)}
              className={`px-2 py-1.5 rounded text-center text-[11px] font-mono transition-all border ${
                strikeFilter === opt.id
                  ? "bg-[#14283f] border-cyan-500/50 text-cyan-300 font-semibold"
                  : "bg-[#0c141f] border-[#162334] text-slate-400 hover:text-slate-200"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Strategy Presets */}
      <div>
        <div className="flex items-center justify-between mb-1.5 px-1">
          <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold flex items-center gap-1">
            <BarChart3 className="w-3 h-3 text-amber-400" />
            Strategy Presets
          </span>
        </div>
        <div className="space-y-1">
          {[
            { id: "LONG_CALL", label: "Long Call (Bullish)" },
            { id: "LONG_PUT", label: "Long Put (Bearish)" },
            { id: "BULL_CALL_SPREAD", label: "Bull Call Spread" },
            { id: "BEAR_PUT_SPREAD", label: "Bear Put Spread" },
            { id: "COVERED_CALL", label: "Covered Call (Income)" },
            { id: "STRADDLE", label: "Long Straddle (High Vol)" },
            { id: "IRON_CONDOR", label: "Iron Condor (Rangebound)" },
          ].map((strat) => {
            const isActive = activePreset === strat.id;
            return (
              <button
                key={strat.id}
                onClick={() => onApplyPreset(strat.id)}
                className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded border text-left text-xs transition-all ${
                  isActive
                    ? "bg-amber-500/15 border-amber-500/50 text-amber-300 font-semibold"
                    : "bg-[#0b131e] border-[#142232] text-slate-300 hover:bg-[#101b2a] hover:border-slate-700"
                }`}
              >
                <span>{strat.label}</span>
                {isActive ? (
                  <Check className="w-3 h-3 text-amber-400" />
                ) : (
                  <ChevronRight className="w-3 h-3 text-slate-600" />
                )}
              </button>
            );
          })}
        </div>
      </div>
    </aside>
  );
};
