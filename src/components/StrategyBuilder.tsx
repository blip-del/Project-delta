import React from "react";
import { StrategyLeg, StrategyMetrics } from "../types";
import { Trash2, Plus, TrendingUp, TrendingDown, DollarSign, Percent, ShieldCheck, Scale } from "lucide-react";

interface StrategyBuilderProps {
  legs: StrategyLeg[];
  metrics: StrategyMetrics;
  dte: number;
  currentPrice: number;
  onUpdateLeg: (index: number, updated: Partial<StrategyLeg>) => void;
  onRemoveLeg: (index: number) => void;
  onClearAll: () => void;
}

export const StrategyBuilder: React.FC<StrategyBuilderProps> = ({
  legs,
  metrics,
  dte,
  currentPrice,
  onUpdateLeg,
  onRemoveLeg,
  onClearAll,
}) => {
  const isNetDebit = metrics.netPremium < 0;

  return (
    <div className="bg-[#0b131f] border border-[#182638] rounded-xl p-4 shadow-lg mb-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4 border-b border-[#182638] pb-3">
        <div>
          <h2 className="text-sm font-bold text-white flex items-center gap-2 font-mono">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
            Active Strategy Leg Configuration ({legs.length} leg{legs.length === 1 ? "" : "s"})
          </h2>
          <p className="text-xs text-slate-400">
            Customize buy/sell actions, contracts quantity, and limit prices.
          </p>
        </div>
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

      {legs.length === 0 ? (
        <div className="text-center py-8 border border-dashed border-[#1b2b40] rounded-lg">
          <p className="text-sm text-slate-400 font-mono">No option contracts selected yet.</p>
          <p className="text-xs text-slate-500 mt-1">
            Click on any Bid (Sell) or Ask (Buy) price in the options chain table, or pick a Strategy Preset in the sidebar.
          </p>
        </div>
      ) : (
        <>
          {/* List of Legs */}
          <div className="space-y-2 mb-5">
            {legs.map((leg, index) => {
              const isCall = leg.type === "CALL";
              const isBuy = leg.action === "BUY";

              return (
                <div
                  key={leg.id || index}
                  className="flex flex-wrap items-center justify-between gap-3 bg-[#080d15] border border-[#1a2b3f] rounded-lg p-2.5 text-xs font-mono"
                >
                  {/* Action & Type Badges */}
                  <div className="flex items-center gap-2 min-w-[170px]">
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
                        isCall
                          ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/30"
                          : "bg-purple-500/20 text-purple-300 border border-purple-500/30"
                      }`}
                    >
                      {leg.type}
                    </span>
                    <span className="font-black text-white text-sm">${leg.strike.toFixed(1)}</span>
                  </div>

                  {/* Quantity Input */}
                  <div className="flex items-center gap-2">
                    <span className="text-slate-400">Qty:</span>
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

                  {/* Price / Premium Input */}
                  <div className="flex items-center gap-2">
                    <span className="text-slate-400">Price ($):</span>
                    <input
                      type="number"
                      step="0.05"
                      min="0.01"
                      value={leg.entryPrice}
                      onChange={(e) =>
                        onUpdateLeg(index, { entryPrice: Math.max(0.01, parseFloat(e.target.value) || 0.01) })
                      }
                      className="w-20 bg-[#0d1622] border border-slate-700 rounded px-2 py-1 text-white font-mono text-xs focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  {/* Subtotal */}
                  <div className="text-right font-bold">
                    <span className="text-slate-400 text-[10px] block">CASH FLOW</span>
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

          {/* Strategy Calculated Metrics Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 bg-[#080d16] border border-[#162334] rounded-lg p-3">
            {/* Net Premium */}
            <div>
              <span className="text-[10px] text-slate-400 font-mono block">NET PREMIUM</span>
              <span
                className={`text-base font-black font-mono ${
                  isNetDebit ? "text-rose-400" : "text-emerald-400"
                }`}
              >
                {isNetDebit ? `-$${Math.abs(metrics.netPremium).toFixed(2)}` : `+$${metrics.netPremium.toFixed(2)}`}
              </span>
              <span className="text-[10px] text-slate-500 block">
                {isNetDebit ? "Net Debit" : "Net Credit"}
              </span>
            </div>

            {/* Max Profit */}
            <div>
              <span className="text-[10px] text-slate-400 font-mono block">MAX PROFIT</span>
              <span className="text-base font-black font-mono text-emerald-400">
                {typeof metrics.maxProfit === "number" ? `$${metrics.maxProfit.toFixed(2)}` : "Unlimited"}
              </span>
              <span className="text-[10px] text-slate-500 block">Upside Potential</span>
            </div>

            {/* Max Loss */}
            <div>
              <span className="text-[10px] text-slate-400 font-mono block">MAX LOSS</span>
              <span className="text-base font-black font-mono text-rose-400">
                {typeof metrics.maxLoss === "number" ? `$${Math.abs(metrics.maxLoss).toFixed(2)}` : "Unlimited"}
              </span>
              <span className="text-[10px] text-slate-500 block">Downside Risk</span>
            </div>

            {/* Breakevens */}
            <div>
              <span className="text-[10px] text-slate-400 font-mono block">BREAKEVEN</span>
              <span className="text-sm font-black font-mono text-amber-300">
                {metrics.breakevens.length > 0
                  ? metrics.breakevens.map((b) => `$${b.toFixed(1)}`).join(", ")
                  : "N/A"}
              </span>
              <span className="text-[10px] text-slate-500 block">At Expiry</span>
            </div>

            {/* Annualized Return / ROC */}
            <div>
              <span className="text-[10px] text-slate-400 font-mono block">ANNUALIZED RETURN</span>
              <span className="text-base font-black font-mono text-cyan-300">
                {metrics.annualizedReturn > 0 ? `${metrics.annualizedReturn}%` : "—"}
              </span>
              <span className="text-[10px] text-slate-500 block">{dte}d Holding Period</span>
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
