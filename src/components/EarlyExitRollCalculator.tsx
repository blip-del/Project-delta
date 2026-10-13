import React, { useState } from "react";
import { StrategyLeg, StrategyMetrics } from "../types";
import {
  calculateEarlyExitAnalysis,
  calculateRollScenarios,
  EarlyExitTarget,
  RollSimulation,
} from "../utils/optionsMath";
import {
  Zap,
  TrendingUp,
  RotateCw,
  Clock,
  ShieldCheck,
  ArrowRight,
  Sparkles,
  DollarSign,
  Percent,
  CheckCircle2,
  SlidersHorizontal as Sliders,
} from "lucide-react";

interface EarlyExitRollCalculatorProps {
  legs: StrategyLeg[];
  metrics: StrategyMetrics;
  dte: number;
  currentStockPrice: number;
  ticker?: string;
}

export const EarlyExitRollCalculator: React.FC<EarlyExitRollCalculatorProps> = ({
  legs,
  metrics,
  dte,
  currentStockPrice,
  ticker = "Asset",
}) => {
  const [activeSubTab, setActiveSubTab] = useState<"VELOCITY" | "ROLL">("VELOCITY");

  // Custom Early Exit State
  const [customProfitPct, setCustomProfitPct] = useState<number>(50);
  const [customDaysHeld, setCustomDaysHeld] = useState<number>(Math.max(1, Math.round(dte * 0.38)));

  // Custom Roll State
  const shortLeg = legs.find((l) => (l.type === "CALL" || l.type === "PUT") && l.action === "SELL");
  const defaultBuyback = shortLeg ? Number((shortLeg.entryPrice * 0.5).toFixed(2)) : 0.30;
  const defaultNewPremium = shortLeg ? Number((shortLeg.entryPrice * 0.85).toFixed(2)) : 0.55;

  const [customBuyback, setCustomBuyback] = useState<number>(defaultBuyback);
  const [customNewStrike, setCustomNewStrike] = useState<number>(shortLeg ? shortLeg.strike : currentStockPrice);
  const [customNewPremium, setCustomNewPremium] = useState<number>(defaultNewPremium);
  const [customAddedDte, setCustomAddedDte] = useState<number>(35);

  const safeDte = Math.max(1, dte);
  const analysis = calculateEarlyExitAnalysis(legs, metrics, safeDte);
  const rollScenarios = calculateRollScenarios(legs, metrics, safeDte, currentStockPrice);

  const capital = analysis.capitalAtRisk;
  const maxProfit = typeof metrics.maxProfit === "number" && metrics.maxProfit > 0
    ? metrics.maxProfit
    : (metrics.netPremium > 0 ? metrics.netPremium : 100);

  // Custom early exit calculations
  const customTargetProfitDollars = Number(((maxProfit * customProfitPct) / 100).toFixed(2));
  const customRawReturn = capital > 0 ? (customTargetProfitDollars / capital) * 100 : 0;
  const customApr = Number(((customRawReturn * (365 / Math.max(1, customDaysHeld)))).toFixed(1));
  const customDaysSaved = Math.max(0, safeDte - customDaysHeld);
  const customBuybackPrice = shortLeg ? Number((shortLeg.entryPrice * (1 - customProfitPct / 100)).toFixed(2)) : 0;

  // Custom roll calculations
  const stockLeg = legs.find((l) => l.type === "STOCK" && l.action === "BUY");
  const currentBasis = stockLeg ? stockLeg.entryPrice : currentStockPrice;
  const customNetRollCredit = Number((customNewPremium - customBuyback).toFixed(2));
  const customNetRollCreditTotal = customNetRollCredit * 100 * (shortLeg ? shortLeg.quantity : 1);
  const customAdjustedBasis = Number((currentBasis - (shortLeg ? shortLeg.entryPrice - customBuyback + customNetRollCredit : customNetRollCredit)).toFixed(2));
  const customTotalDays = safeDte + customAddedDte;
  const customDownsideBuffer = Number((((currentBasis - customAdjustedBasis) / currentBasis) * 100).toFixed(1));

  return (
    <div className="bg-[#0b131f] border border-[#1a2b3f] rounded-xl p-5 shadow-xl mb-6">
      {/* Header & Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#162537] pb-4 mb-5">
        <div>
          <h3 className="text-base font-bold text-white font-mono flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-cyan-400" />
            Trade Velocity & Management Desk
          </h3>
          <p className="text-xs text-slate-400">
            Model the Tastytrade 50% Profit Rule, holding velocity acceleration, and proactive rolling tactics.
          </p>
        </div>

        <div className="flex items-center gap-2 bg-[#070d16] p-1 rounded-lg border border-[#162537]">
          <button
            onClick={() => setActiveSubTab("VELOCITY")}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-mono font-bold transition-all ${
              activeSubTab === "VELOCITY"
                ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <Zap className="w-3.5 h-3.5" />
            <span>Close at 50% / Profit Velocity</span>
          </button>
          <button
            onClick={() => setActiveSubTab("ROLL")}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-mono font-bold transition-all ${
              activeSubTab === "ROLL"
                ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <RotateCw className="w-3.5 h-3.5" />
            <span>Roll Calculator</span>
          </button>
        </div>
      </div>

      {/* SUB-TAB 1: HOLDING VELOCITY & EARLY PROFIT TARGETS */}
      {activeSubTab === "VELOCITY" && (
        <div>
          {/* Key Insight Banner */}
          <div className="p-3.5 rounded-lg bg-[#0d1a29] border border-cyan-500/30 mb-5 flex items-start gap-3">
            <span className="p-2 rounded bg-cyan-500/10 text-cyan-400 mt-0.5">
              <Sparkles className="w-4 h-4" />
            </span>
            <div className="text-xs leading-relaxed">
              <span className="font-bold text-white font-mono block mb-0.5">
                The Holding Velocity Advantage (The 50% Rule)
              </span>
              <span className="text-slate-300">
                Option theta decay is non-linear. The first 50% of an option's premium typically decays in only{" "}
                <span className="text-cyan-300 font-bold">~35% of the total expiration time</span>. Closing at 50%
                profit locks in your gain, frees up 100% of your collateral weeks early, and eliminates tail-risk
                reversals—often yielding over{" "}
                <span className="text-emerald-400 font-bold">2× to 3× higher Annualized APR</span> than holding until
                expiration.
              </span>
            </div>
          </div>

          {/* Standard Target Cards Grid (25%, 50%, 75%, 100%) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 mb-6">
            {analysis.targets.map((target) => {
              const is50 = target.percent === 50;
              const is100 = target.percent === 100;

              return (
                <div
                  key={target.percent}
                  className={`rounded-xl p-4 border transition-all ${
                    is50
                      ? "bg-[#091724] border-cyan-500/50 shadow-lg shadow-cyan-950/40 ring-1 ring-cyan-500/30"
                      : "bg-[#080e18] border-[#16263a]"
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span
                      className={`text-xs font-mono font-black px-2 py-0.5 rounded ${
                        is50
                          ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40"
                          : "bg-slate-800 text-slate-300"
                      }`}
                    >
                      {target.percent}% Target
                    </span>
                    {is50 && (
                      <span className="text-[10px] font-mono text-cyan-400 font-bold flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        Sweet Spot
                      </span>
                    )}
                    {is100 && (
                      <span className="text-[10px] font-mono text-slate-500">
                        Full Expiration
                      </span>
                    )}
                  </div>

                  {/* Target Profit */}
                  <div className="mb-3">
                    <span className="text-[10px] text-slate-400 font-mono block">LOCKED PROFIT</span>
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-lg font-black font-mono text-emerald-400">
                        +${target.targetProfit.toFixed(2)}
                      </span>
                      <span className="text-xs font-mono text-slate-400">
                        (+{target.rawReturn}%)
                      </span>
                    </div>
                  </div>

                  {/* Action Trigger / Buyback */}
                  {analysis.hasShortOption && (
                    <div className="mb-3 bg-[#060b13] p-2 rounded border border-[#142030] text-[11px] font-mono">
                      <span className="text-slate-400 block text-[10px]">GTC BUYBACK LIMIT</span>
                      <span className="font-bold text-amber-300">
                        {is100 ? "Let Expire $0.00" : `Buy to Close @ $${target.buybackOptionPrice.toFixed(2)}`}
                      </span>
                    </div>
                  )}

                  {/* Duration & Holding Pace */}
                  <div className="space-y-1 text-xs font-mono border-t border-[#162537] pt-2.5">
                    <div className="flex justify-between text-slate-400 text-[11px]">
                      <span>Est. Holding:</span>
                      <span className="text-white font-bold">{target.daysHeld} days</span>
                    </div>
                    {!is100 && (
                      <div className="flex justify-between text-[11px] text-cyan-400">
                        <span>Capital Freed:</span>
                        <span>{target.capitalFreedDays} days early</span>
                      </div>
                    )}
                    <div className="flex justify-between items-baseline pt-1">
                      <span className="text-slate-400 text-[11px]">Annualized APR:</span>
                      <span className="text-base font-black text-cyan-300 font-mono">
                        {target.annualizedApr}%
                      </span>
                    </div>
                    {!is100 && target.velocityMultiplier > 1 && (
                      <div className="text-right text-[10px] text-emerald-400 font-bold">
                        +{Math.round((target.velocityMultiplier - 1) * 100)}% velocity boost
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Interactive Custom Early Exit Simulator */}
          <div className="bg-[#070d16] border border-[#172538] rounded-xl p-4">
            <h4 className="text-xs font-bold text-white font-mono flex items-center gap-2 mb-3">
              <Sliders className="w-4 h-4 text-cyan-400" />
              Interactive Custom Exit Simulator
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
              <div className="space-y-4 font-mono text-xs">
                {/* Target % Slider */}
                <div>
                  <div className="flex justify-between mb-1.5">
                    <span className="text-slate-400">Take Profit at % of Max Gain:</span>
                    <span className="text-cyan-300 font-bold">{customProfitPct}%</span>
                  </div>
                  <input
                    type="range"
                    min="10"
                    max="100"
                    step="5"
                    value={customProfitPct}
                    onChange={(e) => setCustomProfitPct(parseInt(e.target.value, 10))}
                    className="w-full accent-cyan-500 cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-slate-500 mt-1">
                    <span>10% (Scalp)</span>
                    <span>50% (Standard)</span>
                    <span>100% (Expiration)</span>
                  </div>
                </div>

                {/* Days Held Slider */}
                <div>
                  <div className="flex justify-between mb-1.5">
                    <span className="text-slate-400">Days Held Before Exiting:</span>
                    <span className="text-emerald-400 font-bold">{customDaysHeld} days (of {safeDte}d)</span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max={safeDte}
                    value={customDaysHeld}
                    onChange={(e) => setCustomDaysHeld(parseInt(e.target.value, 10))}
                    className="w-full accent-emerald-500 cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-slate-500 mt-1">
                    <span>1 Day</span>
                    <span>Halfway ({Math.round(safeDte / 2)}d)</span>
                    <span>Full Term ({safeDte}d)</span>
                  </div>
                </div>
              </div>

              {/* Dynamic Readout Box */}
              <div className="bg-[#0b131f] border border-[#1e3046] rounded-lg p-4 font-mono">
                <div className="text-[11px] text-slate-400 mb-2 border-b border-slate-800 pb-2 flex justify-between items-center">
                  <span>SCENARIO RESULT</span>
                  <span className="text-cyan-400 font-bold">{customDaysSaved} Days Freed</span>
                </div>

                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div>
                    <span className="text-[10px] text-slate-500 block">REALIZED PROFIT</span>
                    <span className="text-lg font-bold text-emerald-400">
                      +${customTargetProfitDollars.toFixed(2)}
                    </span>
                    <span className="text-[10px] text-slate-400 block">+{customRawReturn.toFixed(2)}% on capital</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 block">ANNUALIZED APR</span>
                    <div className="flex items-baseline gap-1">
                      <span className="text-2xl font-black text-cyan-300">
                        {customApr}%
                      </span>
                      <span className="text-xs text-slate-400">APR</span>
                    </div>
                    <span className="text-[10px] text-emerald-400 block">
                      ({customDaysHeld}d holding velocity)
                    </span>
                  </div>
                </div>

                {analysis.hasShortOption && (
                  <div className="bg-[#070e17] p-2 rounded text-[11px] text-slate-300 border border-slate-800">
                    <span className="text-slate-400">Order Instruction: </span>
                    <span className="text-amber-300 font-bold">
                      GTC Buy-To-Close Limit @ ${customBuybackPrice.toFixed(2)}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB 2: ROLL CALCULATOR */}
      {activeSubTab === "ROLL" && (
        <div>
          {/* Key Roll Concept Banner */}
          <div className="p-3.5 rounded-lg bg-[#0d1a29] border border-emerald-500/30 mb-5 flex items-start gap-3">
            <span className="p-2 rounded bg-emerald-500/10 text-emerald-400 mt-0.5">
              <RotateCw className="w-4 h-4" />
            </span>
            <div className="text-xs leading-relaxed">
              <span className="font-bold text-white font-mono block mb-0.5">
                Strategic Option Rolling (Defense & Basis Reduction)
              </span>
              <span className="text-slate-300">
                Rolling involves closing your expiring short option (often for a profit or near expiration) and
                simultaneously writing a new contract further out in time. Every net credit collected{" "}
                <span className="text-emerald-400 font-bold">permanently reduces your underlying share cost basis</span>,
                expands your downside protection cushion, and sustains compounding annual returns.
              </span>
            </div>
          </div>

          {/* Quick Roll Scenarios (Roll Out vs Roll Up & Out) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            {rollScenarios.map((roll, idx) => (
              <div
                key={idx}
                className="bg-[#080e18] border border-[#1a2d42] rounded-xl p-4 font-mono text-xs shadow-lg"
              >
                <div className="flex items-center justify-between mb-3 border-b border-[#142334] pb-2">
                  <span className="font-bold text-white text-sm flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-400" />
                    {roll.title}
                  </span>
                  <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] font-bold">
                    +{roll.addedDte} Days
                  </span>
                </div>

                {/* Roll Mechanics */}
                <div className="space-y-1.5 mb-3 text-slate-300 text-[11px]">
                  <div className="flex justify-between">
                    <span className="text-slate-400">1. Buy to Close Current:</span>
                    <span className="text-rose-400 font-bold">-${roll.buybackPrice.toFixed(2)}/sh</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">2. Sell to Open New (${roll.newStrike.toFixed(1)} strike):</span>
                    <span className="text-emerald-400 font-bold">+${roll.newPremium.toFixed(2)}/sh</span>
                  </div>
                  <div className="flex justify-between border-t border-[#162537] pt-1 font-bold">
                    <span className="text-white">Net Roll Credit:</span>
                    <span className="text-cyan-300">+${roll.netRollCredit.toFixed(2)}/sh (+${roll.netRollCreditDollars.toFixed(2)})</span>
                  </div>
                </div>

                {/* Impact Metrics Grid */}
                <div className="grid grid-cols-3 gap-2 bg-[#060b13] p-2.5 rounded border border-[#142030] text-center mb-3">
                  <div>
                    <span className="text-[10px] text-slate-500 block">NEW COST BASIS</span>
                    <span className="text-sm font-bold text-white font-mono">
                      ${roll.adjustedStockBasis.toFixed(2)}
                    </span>
                    <span className="text-[9px] text-emerald-400 block">
                      -{roll.downsideBufferPercent}% cushion
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 block">MAX PROFIT CAP</span>
                    <span className="text-sm font-bold text-emerald-400 font-mono">
                      ${roll.totalCumulativeProfitCap.toFixed(2)}
                    </span>
                    <span className="text-[9px] text-slate-400 block">Cumulative</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 block">EXTENDED APR</span>
                    <span className="text-sm font-bold text-cyan-300 font-mono">
                      {roll.extendedAnnualizedApr}%
                    </span>
                    <span className="text-[9px] text-slate-400 block">Over {roll.totalDurationDays}d</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Interactive Custom Roll Sandbox */}
          <div className="bg-[#070d16] border border-[#172538] rounded-xl p-4 font-mono">
            <h4 className="text-xs font-bold text-white mb-3 flex items-center gap-2">
              <Sliders className="w-4 h-4 text-emerald-400" />
              Custom Roll Sandbox
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
              {/* Buyback Price Input */}
              <div className="bg-[#0b131f] border border-[#1a2c3f] rounded-lg p-2.5">
                <span className="text-[10px] text-slate-400 block mb-1">BUYBACK CURRENT OPTION</span>
                <div className="flex items-center gap-1">
                  <span className="text-slate-400 text-xs">$</span>
                  <input
                    type="number"
                    step="0.05"
                    min="0.01"
                    value={customBuyback}
                    onChange={(e) => setCustomBuyback(parseFloat(e.target.value) || 0.01)}
                    className="w-full bg-transparent text-white font-bold text-xs focus:outline-none"
                  />
                </div>
              </div>

              {/* New Strike Input */}
              <div className="bg-[#0b131f] border border-[#1a2c3f] rounded-lg p-2.5">
                <span className="text-[10px] text-slate-400 block mb-1">NEW ROLL STRIKE</span>
                <div className="flex items-center gap-1">
                  <span className="text-slate-400 text-xs">$</span>
                  <input
                    type="number"
                    step="0.5"
                    min="0.5"
                    value={customNewStrike}
                    onChange={(e) => setCustomNewStrike(parseFloat(e.target.value) || 1)}
                    className="w-full bg-transparent text-white font-bold text-xs focus:outline-none"
                  />
                </div>
              </div>

              {/* New Premium Input */}
              <div className="bg-[#0b131f] border border-[#1a2c3f] rounded-lg p-2.5">
                <span className="text-[10px] text-slate-400 block mb-1">NEW PREMIUM COLLECTED</span>
                <div className="flex items-center gap-1">
                  <span className="text-slate-400 text-xs">$</span>
                  <input
                    type="number"
                    step="0.05"
                    min="0.01"
                    value={customNewPremium}
                    onChange={(e) => setCustomNewPremium(parseFloat(e.target.value) || 0.01)}
                    className="w-full bg-transparent text-emerald-400 font-bold text-xs focus:outline-none"
                  />
                </div>
              </div>

              {/* Added DTE Input */}
              <div className="bg-[#0b131f] border border-[#1a2c3f] rounded-lg p-2.5">
                <span className="text-[10px] text-slate-400 block mb-1">ADDED DAYS (DTE)</span>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    step="7"
                    min="7"
                    max="365"
                    value={customAddedDte}
                    onChange={(e) => setCustomAddedDte(parseInt(e.target.value, 10) || 7)}
                    className="w-full bg-transparent text-cyan-300 font-bold text-xs focus:outline-none"
                  />
                  <span className="text-slate-400 text-xs">days</span>
                </div>
              </div>
            </div>

            {/* Custom Roll Output Bar */}
            <div className="flex flex-wrap items-center justify-between gap-4 bg-[#091523] border border-emerald-500/30 rounded-lg p-3 text-xs">
              <div>
                <span className="text-slate-400 text-[10px] block">NET CREDIT ON ROLL</span>
                <span className={`font-black text-sm ${customNetRollCredit >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                  {customNetRollCredit >= 0 ? "+" : ""}${customNetRollCredit.toFixed(2)}/sh
                  <span className="text-slate-400 font-normal ml-1">(${customNetRollCreditTotal.toFixed(2)})</span>
                </span>
              </div>

              <div>
                <span className="text-slate-400 text-[10px] block">NEW ADJUSTED COST BASIS</span>
                <span className="font-bold text-white text-sm">
                  ${customAdjustedBasis.toFixed(2)}/share
                </span>
                <span className="text-slate-400 text-[10px] block">
                  (was ${currentBasis.toFixed(2)})
                </span>
              </div>

              <div>
                <span className="text-slate-400 text-[10px] block">DOWNSIDE BUFFER</span>
                <span className="font-bold text-emerald-400 text-sm">
                  {customDownsideBuffer}% Cushion
                </span>
                <span className="text-slate-400 text-[10px] block">
                  from entry price
                </span>
              </div>

              <div>
                <span className="text-slate-400 text-[10px] block">COMBINED EXTENDED TIMELINE</span>
                <span className="font-bold text-cyan-300 text-sm">
                  {customTotalDays} Days Total
                </span>
                <span className="text-slate-400 text-[10px] block">
                  ({safeDte}d initial + {customAddedDte}d roll)
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
