import React from "react";
import { StrategyLeg, StrategyMetrics } from "../types";
import { Trash2, Plus, TrendingUp, TrendingDown, DollarSign, Percent, ShieldCheck, Scale, Zap, Info, ArrowUpRight } from "lucide-react";

interface StrategyBuilderProps {
  legs: StrategyLeg[];
  metrics: StrategyMetrics;
  dte: number;
  currentPrice: number;
  ticker?: string;
  activePreset?: string | null;
  onUpdateLeg: (index: number, updated: Partial<StrategyLeg>) => void;
  onRemoveLeg: (index: number) => void;
  onClearAll: () => void;
  onAddStockLeg?: () => void;
}

export const StrategyBuilder: React.FC<StrategyBuilderProps> = ({
  legs,
  metrics,
  dte,
  currentPrice,
  ticker = "Asset",
  activePreset,
  onUpdateLeg,
  onRemoveLeg,
  onClearAll,
  onAddStockLeg,
}) => {
  const isNetDebit = metrics.netPremium < 0;
  const hasStockLeg = legs.some((l) => l.type === "STOCK");
  const stockLegIndex = legs.findIndex((l) => l.type === "STOCK");
  const stockLeg = stockLegIndex >= 0 ? legs[stockLegIndex] : null;

  return (
    <div className="bg-[#0b131f] border border-[#182638] rounded-xl p-4 shadow-lg mb-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4 border-b border-[#182638] pb-3">
        <div>
          <h2 className="text-sm font-bold text-white flex items-center gap-2 font-mono">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
            Strategy Leg Configuration ({legs.length} leg{legs.length === 1 ? "" : "s"})
            {activePreset && (
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/30">
                Preset: {activePreset.replace(/_/g, " ")}
              </span>
            )}
          </h2>
          <p className="text-xs text-slate-400">
            Adjust entry purchase price, contract quantities, or underlying share cost basis to model exact real returns.
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          {!hasStockLeg && onAddStockLeg && (
            <button
              onClick={onAddStockLeg}
              className="flex items-center gap-1.5 text-xs text-cyan-300 hover:text-cyan-200 font-mono px-2.5 py-1 rounded bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 transition-all"
              title="Add 100 shares of underlying stock to convert into Covered Call or Collar"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>+ Add Underlying Shares</span>
            </button>
          )}

          {legs.length > 0 && (
            <button
              onClick={onClearAll}
              className="flex items-center gap-1 text-xs text-rose-400 hover:text-rose-300 font-mono px-2.5 py-1 rounded bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 transition-all"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Reset All</span>
            </button>
          )}
        </div>
      </div>

      {/* Preset Contextual Quick-Input Banner for Covered Call */}
      {hasStockLeg && stockLeg && (
        <div className="mb-4 p-3 rounded-lg bg-[#0e1a2b] border border-cyan-500/30 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <span className="p-2 rounded bg-cyan-500/10 text-cyan-400">
              <Zap className="w-4 h-4" />
            </span>
            <div>
              <div className="text-xs font-mono font-bold text-white flex items-center gap-2">
                <span>Covered Position: Underlying Stock Cost Basis</span>
                <span className="text-[10px] text-cyan-300 bg-cyan-500/20 px-1.5 py-0.2 rounded">
                  Active
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Did you buy {ticker} earlier at a different price? Enter your actual entry cost per share:
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 bg-[#080d16] border border-slate-700 rounded-md px-2.5 py-1">
              <span className="text-xs text-slate-400 font-mono">My Stock Entry: $</span>
              <input
                type="text"
                value={stockLeg.entryPrice}
                onChange={(e) => {
                  const cleaned = e.target.value.replace(",", ".");
                  const val = parseFloat(cleaned);
                  if (!isNaN(val)) {
                    onUpdateLeg(stockLegIndex, { entryPrice: val, strike: val });
                  }
                }}
                className="w-24 bg-transparent text-emerald-400 font-mono font-bold text-sm focus:outline-none"
              />
            </div>

            <button
              onClick={() => onUpdateLeg(stockLegIndex, { entryPrice: currentPrice, strike: currentPrice })}
              className="text-[11px] font-mono px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-all"
              title="Reset cost basis to current market price"
            >
              Reset to Current (${currentPrice.toFixed(2)})
            </button>
          </div>
        </div>
      )}

      {legs.length === 0 ? (
        <div className="text-center py-8 border border-dashed border-[#1b2b40] rounded-lg">
          <p className="text-sm text-slate-400 font-mono">No contracts or shares selected yet.</p>
          <p className="text-xs text-slate-500 mt-1">
            Click on any Bid (Sell) or Ask (Buy) price in the options chain table, or pick a Strategy Preset in the sidebar.
          </p>
        </div>
      ) : (
        <>
          {/* List of Legs */}
          <div className="space-y-2 mb-5">
            {legs.map((leg, index) => {
              const isStock = leg.type === "STOCK";
              const isCall = leg.type === "CALL";
              const isBuy = leg.action === "BUY";

              return (
                <div
                  key={leg.id || index}
                  className={`flex flex-wrap items-center justify-between gap-3 border rounded-lg p-2.5 text-xs font-mono transition-all ${
                    isStock
                      ? "bg-[#091522] border-cyan-500/30"
                      : "bg-[#080d15] border-[#1a2b3f]"
                  }`}
                >
                  {/* Action & Type Badges */}
                  <div className="flex items-center gap-2 min-w-[200px]">
                    <span className="text-slate-500 font-bold">#{index + 1}</span>
                    <button
                      onClick={() => onUpdateLeg(index, { action: isBuy ? "SELL" : "BUY" })}
                      className={`px-2 py-0.5 rounded font-bold transition-all ${
                        isBuy
                          ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                          : "bg-rose-500/20 text-rose-300 border border-rose-500/40"
                      }`}
                    >
                      {leg.action}
                    </button>
                    <span
                      className={`px-2 py-0.5 rounded font-bold ${
                        isStock
                          ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                          : isCall
                          ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/30"
                          : "bg-purple-500/20 text-purple-300 border border-purple-500/30"
                      }`}
                    >
                      {isStock ? "SHARES (100x)" : leg.type}
                    </span>
                    <span className="font-black text-white text-sm">
                      {isStock ? `@ $${leg.entryPrice.toFixed(2)}` : `$${leg.strike.toFixed(1)}`}
                    </span>
                  </div>

                  {/* Quantity Input */}
                  <div className="flex items-center gap-2">
                    <span className="text-slate-400">{isStock ? "Lots (100sh):" : "Contracts:"}</span>
                    <div className="flex items-center border border-slate-700 rounded bg-[#0d1622] overflow-hidden">
                      <button
                        onClick={() => onUpdateLeg(index, { quantity: Math.max(1, leg.quantity - 1) })}
                        className="px-2 py-1 hover:bg-slate-700 text-slate-300"
                      >
                        -
                      </button>
                      <span className="px-2 text-white font-bold">{leg.quantity}</span>
                      <button
                        onClick={() => onUpdateLeg(index, { quantity: leg.quantity + 1 })}
                        className="px-2 py-1 hover:bg-slate-700 text-slate-300"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  {/* Price / Entry Cost Input */}
                  <div className="flex items-center gap-2">
                    <span className="text-slate-400">
                      {isStock ? "Basis / Share:" : "Price ($):"}
                    </span>
                    <input
                      type="text"
                      value={leg.entryPrice}
                      onChange={(e) => {
                        const cleaned = e.target.value.replace(",", ".");
                        const val = parseFloat(cleaned);
                        if (!isNaN(val)) {
                          onUpdateLeg(index, { entryPrice: val, ...(isStock ? { strike: val } : {}) });
                        }
                      }}
                      className="w-20 bg-[#0d1622] border border-slate-700 rounded px-2 py-1 text-white font-mono text-xs focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  {/* Subtotal */}
                  <div className="text-right font-bold">
                    <span className="text-slate-400 text-[10px] block">
                      {isStock ? "CAPITAL OUTLAY" : "CASH FLOW"}
                    </span>
                    <span className={isBuy ? "text-rose-400" : "text-emerald-400"}>
                      {isBuy ? "-" : "+"}
                      ${(leg.entryPrice * 100 * leg.quantity).toFixed(2)}
                    </span>
                  </div>

                  {/* Delete Button */}
                  <button
                    onClick={() => onRemoveLeg(index)}
                    className="p-1 text-slate-500 hover:text-rose-400 transition-colors"
                    title="Remove Leg"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
          </div>

          {/* Strategy Calculated Metrics Bar with Prominent Annualized Return Pace */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3 bg-[#080d16] border border-[#162334] rounded-lg p-3">
            {/* Capital / Net Premium */}
            <div>
              <span className="text-[10px] text-slate-400 font-mono block">
                {hasStockLeg ? "NET CAPITAL OUTLAY" : "NET PREMIUM"}
              </span>
              <span
                className={`text-base font-black font-mono ${
                  hasStockLeg
                    ? "text-white"
                    : isNetDebit
                    ? "text-rose-400"
                    : "text-emerald-400"
                }`}
              >
                {hasStockLeg
                  ? `$${metrics.totalCapitalRequired.toFixed(2)}`
                  : isNetDebit
                  ? `-$${Math.abs(metrics.netPremium).toFixed(2)}`
                  : `+$${metrics.netPremium.toFixed(2)}`}
              </span>
              <span className="text-[10px] text-slate-500 block">
                {hasStockLeg
                  ? "Stock - Option Premium"
                  : isNetDebit
                  ? "Net Debit"
                  : "Net Credit"}
              </span>
            </div>

            {/* Max Profit */}
            <div>
              <span className="text-[10px] text-slate-400 font-mono block">MAX PROFIT</span>
              <span className="text-base font-black font-mono text-emerald-400">
                {typeof metrics.maxProfit === "number" ? `$${metrics.maxProfit.toFixed(2)}` : "Unlimited"}
              </span>
              <span className="text-[10px] text-slate-500 block">
                {metrics.rawReturn > 0 ? `+${metrics.rawReturn}% total gain` : "Upside Potential"}
              </span>
            </div>

            {/* Max Loss */}
            <div>
              <span className="text-[10px] text-slate-400 font-mono block">MAX LOSS</span>
              <span className="text-base font-black font-mono text-rose-400">
                {typeof metrics.maxLoss === "number" ? `$${Math.abs(metrics.maxLoss).toFixed(2)}` : "Unlimited"}
              </span>
              <span className="text-[10px] text-slate-500 block">
                {hasStockLeg ? "If Stock goes to $0" : "Downside Risk"}
              </span>
            </div>

            {/* Breakevens */}
            <div>
              <span className="text-[10px] text-slate-400 font-mono block">BREAKEVEN</span>
              <span className="text-sm font-black font-mono text-amber-300">
                {metrics.breakevens.length > 0
                  ? metrics.breakevens.map((b) => `$${b.toFixed(2)}`).join(", ")
                  : "N/A"}
              </span>
              <span className="text-[10px] text-slate-500 block">At Expiration</span>
            </div>

            {/* Premium Annualized Return */}
            <div className="bg-cyan-500/5 border border-cyan-500/20 rounded p-1.5 -m-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-cyan-400 font-mono font-bold block">
                  PREMIUM YIELD (APR)
                </span>
                <span className="text-[9px] font-mono px-1 rounded bg-cyan-500/20 text-cyan-300">
                  {dte}d pace
                </span>
              </div>
              <div className="flex items-baseline gap-1 mt-0.5">
                <span className="text-lg font-black font-mono text-cyan-300">
                  {metrics.premiumAnnualizedReturn && metrics.premiumAnnualizedReturn > 0
                    ? `${metrics.premiumAnnualizedReturn}%`
                    : "—"}
                </span>
                <span className="text-[10px] text-slate-400 font-mono">APR</span>
              </div>
              <span className="text-[10px] text-slate-400 block truncate" title="Pure premium yield: (Premium / Capital) * (52 / weeks)">
                {metrics.premiumRawReturn && metrics.premiumRawReturn > 0
                  ? `+${metrics.premiumRawReturn}% in ${dte}d (Static)`
                  : "Premium yield"}
              </span>
            </div>

            {/* Max Annualized Return (Called Away) */}
            <div className="bg-emerald-500/5 border border-emerald-500/20 rounded p-1.5 -m-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-emerald-400 font-mono font-bold block">
                  MAX RETURN (APR)
                </span>
                <span className="text-[9px] font-mono px-1 rounded bg-emerald-500/20 text-emerald-300">
                  Target
                </span>
              </div>
              <div className="flex items-baseline gap-1 mt-0.5">
                <span className="text-lg font-black font-mono text-emerald-300">
                  {metrics.maxAnnualizedReturn && metrics.maxAnnualizedReturn > 0
                    ? `${metrics.maxAnnualizedReturn}%`
                    : "—"}
                </span>
                <span className="text-[10px] text-slate-400 font-mono">APR</span>
              </div>
              <span className="text-[10px] text-slate-400 block truncate" title="Max Return if called away: (Max Profit / Capital) * (52 / weeks)">
                {metrics.rawReturn > 0 ? `+${metrics.rawReturn}% in ${dte}d (Cap)` : "At strike"}
              </span>
            </div>

            {/* Position Delta */}
            <div>
              <span className="text-[10px] text-slate-400 font-mono block">POSITION DELTA</span>
              <span className="text-base font-black font-mono text-white">
                {metrics.positionDelta > 0 ? `+${metrics.positionDelta.toFixed(2)}` : metrics.positionDelta.toFixed(2)} Δ
              </span>
              <span className="text-[10px] text-slate-500 block">
                {metrics.positionDelta > 0 ? "Bullish bias" : metrics.positionDelta < 0 ? "Bearish bias" : "Delta Neutral"}
              </span>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
