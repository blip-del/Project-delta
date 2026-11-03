import React, { useState, useMemo } from "react";
import { GreekBenchContract, StrategyLeg, OrderAction } from "../types";
import { calculateGreekEfficiency } from "../utils/optionsMath";
import {
  Scale,
  Trash2,
  TrendingUp,
  Percent,
  DollarSign,
  Flame,
  Award,
  Layers,
  Sparkles,
  Shield,
  HelpCircle,
  Sliders,
  ExternalLink,
  Zap,
  Clock,
  Activity,
  ArrowRight,
  Filter,
  BarChart2,
  ChevronDown,
  Info,
  Calendar,
} from "lucide-react";

interface GreekBenchViewProps {
  currentTicker: string;
  currentPrice: number;
  contracts: GreekBenchContract[];
  onUpdateContractPrice: (id: string, price: number, mode: "BID" | "ASK" | "MID" | "CUSTOM") => void;
  onUpdateAction: (id: string, action: OrderAction) => void;
  onUpdateQuantity: (id: string, quantity: number) => void;
  onRemoveContract: (id: string) => void;
  onClearAll: () => void;
  onSelectLegsForStrategy: (legs: StrategyLeg[], strategyName: string) => void;
  onNavigateToChain?: () => void;
}

export const GreekBenchView: React.FC<GreekBenchViewProps> = ({
  currentTicker,
  currentPrice,
  contracts,
  onUpdateContractPrice,
  onUpdateAction,
  onUpdateQuantity,
  onRemoveContract,
  onClearAll,
  onSelectLegsForStrategy,
  onNavigateToChain,
}) => {
  const [selectedTickerFilter, setSelectedTickerFilter] = useState<string>("ALL");
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<"ALL" | "CALL" | "PUT">("ALL");
  const [selectedActionFilter, setSelectedActionFilter] = useState<"ALL" | "BUY" | "SELL">("ALL");
  const [sortBy, setSortBy] = useState<
    "deltaPerDollar" | "thetaBurnPct" | "dtePerDollar" | "vegaPerDollar" | "leverage" | "dte" | "price"
  >("deltaPerDollar");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  // What-If Scenario Simulators
  const [showSimulator, setShowSimulator] = useState(false);
  const [simPriceMovePct, setSimPriceMovePct] = useState<number>(0); // e.g. +3%
  const [simIvShiftPct, setSimIvShiftPct] = useState<number>(0); // e.g. +5% IV
  const [simDaysElapsed, setSimDaysElapsed] = useState<number>(0); // e.g. 7 days

  // Unique tickers in bench
  const availableTickers = useMemo(() => {
    const set = new Set<string>();
    contracts.forEach((c) => set.add(c.ticker));
    return Array.from(set);
  }, [contracts]);

  // Filtered contracts
  const filteredContracts = useMemo(() => {
    return contracts.filter((c) => {
      if (selectedTickerFilter !== "ALL" && c.ticker !== selectedTickerFilter) return false;
      if (selectedTypeFilter !== "ALL" && c.optionType !== selectedTypeFilter) return false;
      if (selectedActionFilter !== "ALL" && c.action !== selectedActionFilter) return false;
      return true;
    });
  }, [contracts, selectedTickerFilter, selectedTypeFilter, selectedActionFilter]);

  // Calculate efficiency metrics for all filtered contracts
  const calculatedRows = useMemo(() => {
    return filteredContracts.map((c) => {
      // Use current live price if ticker matches current active ticker
      const livePrice = c.ticker === currentTicker ? currentPrice : c.underlyingPriceAtPin;
      const metrics = calculateGreekEfficiency(c, livePrice);

      // What-If Scenario Estimator
      // Price delta impact = netDeltaExposure * (livePrice * simPriceMovePct / 100)
      // Vega impact = netVegaExposure * simIvShiftPct
      // Theta decay impact = metrics.dailyThetaDollars * simDaysElapsed
      const simulatedPriceChangeDollars = livePrice * (simPriceMovePct / 100);
      const deltaProfitEstimate = (metrics.netDeltaExposure / 100) * simulatedPriceChangeDollars * 100;
      const vegaProfitEstimate = (metrics.netVegaExposure / 100) * simIvShiftPct * 100;
      const thetaDecayEstimate = metrics.dailyThetaDollars * simDaysElapsed;
      const totalSimulatedPnL = deltaProfitEstimate + vegaProfitEstimate + thetaDecayEstimate;
      const simulatedPnLPct =
        metrics.capitalRequired > 0
          ? Number(((totalSimulatedPnL / metrics.capitalRequired) * 100).toFixed(1))
          : 0;

      return {
        contract: c,
        metrics,
        simulated: {
          totalSimulatedPnL: Number(totalSimulatedPnL.toFixed(2)),
          simulatedPnLPct,
        },
      };
    });
  }, [
    filteredContracts,
    currentTicker,
    currentPrice,
    simPriceMovePct,
    simIvShiftPct,
    simDaysElapsed,
  ]);

  // Sorted rows
  const sortedRows = useMemo(() => {
    return [...calculatedRows].sort((a, b) => {
      let valA = 0;
      let valB = 0;

      switch (sortBy) {
        case "deltaPerDollar":
          valA = a.metrics.deltaPerDollar;
          valB = b.metrics.deltaPerDollar;
          break;
        case "thetaBurnPct":
          // For theta burn, lower is usually better for buyers, higher for sellers
          valA = a.metrics.thetaBurnDailyPct;
          valB = b.metrics.thetaBurnDailyPct;
          break;
        case "dtePerDollar":
          valA = a.metrics.dtePerDollarSpent;
          valB = b.metrics.dtePerDollarSpent;
          break;
        case "vegaPerDollar":
          valA = a.metrics.vegaPerDollar;
          valB = b.metrics.vegaPerDollar;
          break;
        case "leverage":
          valA = a.metrics.leverageRatio;
          valB = b.metrics.leverageRatio;
          break;
        case "dte":
          valA = a.contract.dte;
          valB = b.contract.dte;
          break;
        case "price":
          valA = a.metrics.effectivePrice;
          valB = b.metrics.effectivePrice;
          break;
      }

      return sortDirection === "desc" ? valB - valA : valA - valB;
    });
  }, [calculatedRows, sortBy, sortDirection]);

  // Top performers badges
  const leaders = useMemo(() => {
    if (calculatedRows.length === 0) return null;

    let bestDelta = calculatedRows[0];
    let bestTheta = calculatedRows[0]; // lowest burn % for buyers
    let bestDte = calculatedRows[0];
    let bestVega = calculatedRows[0];

    calculatedRows.forEach((r) => {
      if (r.metrics.deltaPerDollar > bestDelta.metrics.deltaPerDollar) bestDelta = r;
      if (r.metrics.thetaBurnDailyPct < bestTheta.metrics.thetaBurnDailyPct) bestTheta = r;
      if (r.metrics.dtePerDollarSpent > bestDte.metrics.dtePerDollarSpent) bestDte = r;
      if (r.metrics.vegaPerDollar > bestVega.metrics.vegaPerDollar) bestVega = r;
    });

    return { bestDelta, bestTheta, bestDte, bestVega };
  }, [calculatedRows]);

  // Load contract directly into Strategy Builder
  const handleLoadContractToStrategy = (c: GreekBenchContract, effectivePrice: number) => {
    const leg: StrategyLeg = {
      id: `greek-leg-${Date.now()}`,
      type: c.optionType,
      strike: c.strike,
      action: c.action,
      quantity: c.quantity || 1,
      entryPrice: effectivePrice,
      delta: c.delta,
      contractSymbol: c.contractSymbol,
      expirationDate: c.expirationDate,
      impliedVolatility: c.impliedVolatility,
    };
    onSelectLegsForStrategy(
      [leg],
      `${c.ticker} ${c.strike}${c.optionType[0]} ${c.action === "BUY" ? "Long" : "Short"}`
    );
  };

  const toggleSort = (field: typeof sortBy) => {
    if (sortBy === field) {
      setSortDirection((prev) => (prev === "desc" ? "asc" : "desc"));
    } else {
      setSortBy(field);
      setSortDirection("desc");
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner / Explainer */}
      <div className="bg-gradient-to-r from-[#0d1624] via-[#0e1c2d] to-[#0a121c] border border-cyan-500/30 rounded-2xl p-5 shadow-xl relative overflow-hidden">
        <div className="absolute -right-12 -top-12 w-48 h-48 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
                <Scale className="w-5 h-5" />
              </div>
              <h2 className="text-lg font-black text-white tracking-wide flex items-center gap-2">
                Capital Efficiency & Greeks-per-Dollar Bench
                <span className="px-2 py-0.5 rounded-full text-xs font-mono font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                  {contracts.length} Pinned
                </span>
              </h2>
            </div>
            <p className="text-xs text-slate-300 max-w-3xl leading-relaxed">
              Compare options across <strong className="text-white">different strikes</strong>,{" "}
              <strong className="text-white">expiration dates</strong>, and{" "}
              <strong className="text-white">multiple tickers</strong> without needing to own stock.
              Pin standalone Long Calls/Puts or Short options to analyze exact{" "}
              <span className="text-cyan-300 font-semibold">DTE per $</span>,{" "}
              <span className="text-amber-300 font-semibold">Daily Theta Burn %</span>, and{" "}
              <span className="text-emerald-300 font-semibold">Delta / Vega leverage per dollar</span>.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setShowSimulator(!showSimulator)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-mono font-bold transition-all border ${
                showSimulator
                  ? "bg-purple-500/20 text-purple-300 border-purple-500/40 shadow-lg shadow-purple-500/10"
                  : "bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700"
              }`}
            >
              <Zap className="w-3.5 h-3.5" />
              <span>{showSimulator ? "Hide What-If" : "What-If Simulator"}</span>
            </button>

            {contracts.length > 0 && (
              <button
                onClick={onClearAll}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-mono font-bold bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 transition-all"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Clear All ({contracts.length})</span>
              </button>
            )}
          </div>
        </div>

        {/* Quick Ticker Filter Pills */}
        {availableTickers.length > 0 && (
          <div className="mt-4 pt-3 border-t border-cyan-500/20 flex flex-wrap items-center gap-2 text-xs font-mono">
            <span className="text-slate-400 flex items-center gap-1">
              <Filter className="w-3 h-3 text-cyan-400" />
              <span>Filter Ticker:</span>
            </span>
            <button
              onClick={() => setSelectedTickerFilter("ALL")}
              className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all ${
                selectedTickerFilter === "ALL"
                  ? "bg-cyan-500 text-slate-950 shadow-md"
                  : "bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700"
              }`}
            >
              All Tickers ({contracts.length})
            </button>
            {availableTickers.map((sym) => {
              const count = contracts.filter((c) => c.ticker === sym).length;
              return (
                <button
                  key={sym}
                  onClick={() => setSelectedTickerFilter(sym)}
                  className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all ${
                    selectedTickerFilter === sym
                      ? "bg-cyan-500 text-slate-950 shadow-md"
                      : "bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700"
                  }`}
                >
                  {sym} ({count})
                </button>
              );
            })}

            <div className="ml-auto flex items-center gap-2">
              <span className="text-slate-400">Type:</span>
              {(["ALL", "CALL", "PUT"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setSelectedTypeFilter(t)}
                  className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                    selectedTypeFilter === t
                      ? "bg-slate-200 text-slate-900"
                      : "bg-slate-800/80 text-slate-400 hover:text-slate-200 border border-slate-700"
                  }`}
                >
                  {t}
                </button>
              ))}

              <span className="text-slate-400 ml-2">Action:</span>
              {(["ALL", "BUY", "SELL"] as const).map((a) => (
                <button
                  key={a}
                  onClick={() => setSelectedActionFilter(a)}
                  className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                    selectedActionFilter === a
                      ? "bg-slate-200 text-slate-900"
                      : "bg-slate-800/80 text-slate-400 hover:text-slate-200 border border-slate-700"
                  }`}
                >
                  {a}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* What-If Scenario Simulator Panel */}
      {showSimulator && (
        <div className="bg-[#0b121e] border border-purple-500/30 rounded-xl p-4 shadow-lg animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center justify-between pb-3 border-b border-purple-500/20 mb-3">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-purple-400" />
              <h3 className="text-xs font-mono font-bold text-purple-300 uppercase tracking-wider">
                Simulated Market Shock & What-If Stress Test
              </h3>
            </div>
            <button
              onClick={() => {
                setSimPriceMovePct(0);
                setSimIvShiftPct(0);
                setSimDaysElapsed(0);
              }}
              className="text-[11px] font-mono text-purple-400 hover:text-purple-300 underline"
            >
              Reset Scenarios
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs font-mono">
            {/* Underlying Move */}
            <div className="p-3 bg-slate-900/60 rounded-lg border border-slate-800 space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-slate-400 font-bold">Stock Move:</span>
                <span
                  className={`font-black ${
                    simPriceMovePct > 0
                      ? "text-emerald-400"
                      : simPriceMovePct < 0
                      ? "text-rose-400"
                      : "text-slate-300"
                  }`}
                >
                  {simPriceMovePct > 0 ? `+${simPriceMovePct}%` : `${simPriceMovePct}%`}
                </span>
              </div>
              <input
                type="range"
                min="-15"
                max="15"
                step="1"
                value={simPriceMovePct}
                onChange={(e) => setSimPriceMovePct(Number(e.target.value))}
                className="w-full accent-purple-500 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-slate-500">
                <span>-15% Drop</span>
                <span>Unchanged</span>
                <span>+15% Rally</span>
              </div>
            </div>

            {/* IV Shift */}
            <div className="p-3 bg-slate-900/60 rounded-lg border border-slate-800 space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-slate-400 font-bold">Implied Volatility Shift:</span>
                <span
                  className={`font-black ${
                    simIvShiftPct > 0
                      ? "text-cyan-400"
                      : simIvShiftPct < 0
                      ? "text-rose-400"
                      : "text-slate-300"
                  }`}
                >
                  {simIvShiftPct > 0 ? `+${simIvShiftPct}%` : `${simIvShiftPct}%`}
                </span>
              </div>
              <input
                type="range"
                min="-20"
                max="20"
                step="2"
                value={simIvShiftPct}
                onChange={(e) => setSimIvShiftPct(Number(e.target.value))}
                className="w-full accent-cyan-500 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-slate-500">
                <span>-20% IV Crush</span>
                <span>Baseline</span>
                <span>+20% Vol Spike</span>
              </div>
            </div>

            {/* Days Elapsed */}
            <div className="p-3 bg-slate-900/60 rounded-lg border border-slate-800 space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-slate-400 font-bold">Holding Days Elapsed:</span>
                <span className="font-black text-amber-400">+{simDaysElapsed} Days</span>
              </div>
              <input
                type="range"
                min="0"
                max="45"
                step="1"
                value={simDaysElapsed}
                onChange={(e) => setSimDaysElapsed(Number(e.target.value))}
                className="w-full accent-amber-500 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-slate-500">
                <span>Today (T+0)</span>
                <span>+15 Days</span>
                <span>+45 Days</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Leaders Highlights Cards */}
      {leaders && calculatedRows.length > 1 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs font-mono">
          {/* Best Delta Efficiency */}
          <div className="p-3.5 bg-[#09121c] border border-emerald-500/30 rounded-xl relative overflow-hidden shadow">
            <div className="flex items-center justify-between text-slate-400 mb-1">
              <span className="font-bold flex items-center gap-1 text-emerald-300">
                <Award className="w-3.5 h-3.5" /> Highest Delta / $
              </span>
              <span className="text-[10px] text-emerald-400/80 font-bold">Directional Bang</span>
            </div>
            <div className="text-base font-black text-white">
              {leaders.bestDelta.contract.ticker} ${leaders.bestDelta.contract.strike}{" "}
              {leaders.bestDelta.contract.optionType}
            </div>
            <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-800 text-[11px]">
              <span className="text-slate-400">Delta / $1:</span>
              <span className="text-emerald-400 font-black">
                {leaders.bestDelta.metrics.deltaPerDollar.toFixed(3)}
              </span>
            </div>
          </div>

          {/* Lowest Theta Burn % */}
          <div className="p-3.5 bg-[#09121c] border border-amber-500/30 rounded-xl relative overflow-hidden shadow">
            <div className="flex items-center justify-between text-slate-400 mb-1">
              <span className="font-bold flex items-center gap-1 text-amber-300">
                <Clock className="w-3.5 h-3.5" /> Lowest Theta Burn %
              </span>
              <span className="text-[10px] text-amber-400/80 font-bold">Long Shelf-Life</span>
            </div>
            <div className="text-base font-black text-white">
              {leaders.bestTheta.contract.ticker} ${leaders.bestTheta.contract.strike}{" "}
              {leaders.bestTheta.contract.optionType}
            </div>
            <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-800 text-[11px]">
              <span className="text-slate-400">Daily Decay:</span>
              <span className="text-amber-400 font-black">
                {leaders.bestTheta.metrics.thetaBurnDailyPct.toFixed(2)}% / day
              </span>
            </div>
          </div>

          {/* Highest DTE per $ */}
          <div className="p-3.5 bg-[#09121c] border border-cyan-500/30 rounded-xl relative overflow-hidden shadow">
            <div className="flex items-center justify-between text-slate-400 mb-1">
              <span className="font-bold flex items-center gap-1 text-cyan-300">
                <Calendar className="w-3.5 h-3.5" /> Highest DTE / $
              </span>
              <span className="text-[10px] text-cyan-400/80 font-bold">Cheapest Time</span>
            </div>
            <div className="text-base font-black text-white">
              {leaders.bestDte.contract.ticker} ${leaders.bestDte.contract.strike}{" "}
              {leaders.bestDte.contract.optionType}
            </div>
            <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-800 text-[11px]">
              <span className="text-slate-400">Days / $1:</span>
              <span className="text-cyan-300 font-black">
                {leaders.bestDte.metrics.dtePerDollarSpent.toFixed(1)} days
              </span>
            </div>
          </div>

          {/* Highest Vega Leverage */}
          <div className="p-3.5 bg-[#09121c] border border-purple-500/30 rounded-xl relative overflow-hidden shadow">
            <div className="flex items-center justify-between text-slate-400 mb-1">
              <span className="font-bold flex items-center gap-1 text-purple-300">
                <Activity className="w-3.5 h-3.5" /> Highest Vega / $
              </span>
              <span className="text-[10px] text-purple-400/80 font-bold">Vol Sensitivity</span>
            </div>
            <div className="text-base font-black text-white">
              {leaders.bestVega.contract.ticker} ${leaders.bestVega.contract.strike}{" "}
              {leaders.bestVega.contract.optionType}
            </div>
            <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-800 text-[11px]">
              <span className="text-slate-400">Vega / $1:</span>
              <span className="text-purple-300 font-black">
                {leaders.bestVega.metrics.vegaPerDollar.toFixed(3)}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Empty State */}
      {contracts.length === 0 ? (
        <div className="bg-[#0a101a] border border-[#172436] rounded-2xl p-12 text-center shadow-lg">
          <div className="w-16 h-16 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 flex items-center justify-center mx-auto mb-4">
            <Scale className="w-8 h-8" />
          </div>
          <h3 className="text-base font-bold text-white mb-2">
            No Contracts Pinned to the Greek Bench Yet
          </h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto mb-6">
            Head to the <strong className="text-slate-200">Options Chain Table</strong> and click the{" "}
            <span className="text-cyan-300 font-mono font-bold">[+ Pin Greek]</span> button on any
            call or put contract to analyze its Greek efficiency and compare it across DTEs and tickers!
          </p>
          {onNavigateToChain && (
            <button
              onClick={onNavigateToChain}
              className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-mono font-bold inline-flex items-center gap-2 shadow-lg shadow-cyan-500/20 transition-all"
            >
              <span>Go to Options Chain Table</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>
      ) : (
        /* Main Comparative Ranking & Greek Efficiency Table */
        <div className="bg-[#0a101a] border border-[#172436] rounded-2xl overflow-hidden shadow-2xl">
          {/* Table Header Controls */}
          <div className="bg-[#0c1421] border-b border-[#172436] px-4 py-3 flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
            <div className="flex items-center gap-2">
              <span className="font-black text-cyan-400 uppercase tracking-wider flex items-center gap-1.5">
                <BarChart2 className="w-4 h-4" />
                Options Greek Efficiency Comparison ({sortedRows.length})
              </span>
            </div>

            <div className="flex items-center gap-2 text-[11px] text-slate-400">
              <span className="hidden sm:inline">Sort By:</span>
              <div className="flex items-center gap-1">
                {[
                  { key: "deltaPerDollar", label: "Delta / $" },
                  { key: "thetaBurnPct", label: "Theta Burn %" },
                  { key: "dtePerDollar", label: "DTE / $" },
                  { key: "vegaPerDollar", label: "Vega / $" },
                  { key: "leverage", label: "Leverage" },
                  { key: "dte", label: "DTE" },
                ].map((s) => (
                  <button
                    key={s.key}
                    onClick={() => toggleSort(s.key as any)}
                    className={`px-2 py-1 rounded font-bold transition-all ${
                      sortBy === s.key
                        ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40"
                        : "bg-slate-800/80 text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    {s.label} {sortBy === s.key ? (sortDirection === "desc" ? "↓" : "↑") : ""}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Table Content */}
          <div className="overflow-x-auto max-h-[650px] overflow-y-auto">
            <table className="w-full text-xs font-mono border-collapse select-none">
              <thead className="sticky top-0 bg-[#0d1624] text-[11px] text-slate-400 border-b border-[#19273a] z-10">
                <tr>
                  <th className="py-2.5 px-3 text-left">Contract / Ticker</th>
                  <th className="py-2.5 px-3 text-center">Action</th>
                  <th className="py-2.5 px-3 text-right">DTE</th>
                  <th className="py-2.5 px-3 text-right">Fill Price</th>
                  <th className="py-2.5 px-3 text-right bg-[#091524] text-cyan-300 font-extrabold border-x border-cyan-900/30">
                    DTE / $ Spent
                  </th>
                  <th className="py-2.5 px-3 text-right bg-[#1a140b] text-amber-300 font-extrabold border-r border-amber-900/30">
                    Daily Theta %
                  </th>
                  <th className="py-2.5 px-3 text-right bg-[#0b1c16] text-emerald-300 font-extrabold border-r border-emerald-900/30">
                    Delta / $ Spent
                  </th>
                  <th className="py-2.5 px-3 text-right bg-[#181126] text-purple-300 font-extrabold border-r border-purple-900/30">
                    Vega / $ Spent
                  </th>
                  <th className="py-2.5 px-3 text-right hidden md:table-cell">Capital Req</th>
                  <th className="py-2.5 px-3 text-right hidden lg:table-cell">Breakeven</th>
                  {showSimulator && (
                    <th className="py-2.5 px-3 text-right bg-purple-950/40 text-purple-300 font-bold border-l border-purple-800/40">
                      Sim P&L
                    </th>
                  )}
                  <th className="py-2.5 px-3 text-center w-24">Actions</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-[#131d2b]">
                {sortedRows.map(({ contract: c, metrics, simulated }) => {
                  const isCall = c.optionType === "CALL";
                  const isBuy = c.action === "BUY";

                  return (
                    <tr
                      key={c.id}
                      className="hover:bg-[#111e30] transition-colors group"
                    >
                      {/* Contract & Ticker info */}
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2">
                          <span className="px-1.5 py-0.5 rounded bg-slate-800 text-white font-black text-[11px] border border-slate-700">
                            {c.ticker}
                          </span>
                          <div>
                            <div className="font-black text-slate-100 flex items-center gap-1.5">
                              <span>${c.strike.toFixed(1)}</span>
                              <span
                                className={`px-1 rounded text-[10px] font-bold ${
                                  isCall
                                    ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                                    : "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                                }`}
                              >
                                {c.optionType}
                              </span>
                            </div>
                            <div className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
                              <span>{c.formattedDate}</span>
                              <span>•</span>
                              <span>IV: {c.impliedVolatility.toFixed(1)}%</span>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Action Toggle (BUY vs SELL) */}
                      <td className="py-3 px-3 text-center">
                        <button
                          onClick={() => onUpdateAction(c.id, isBuy ? "SELL" : "BUY")}
                          className={`px-2 py-1 rounded text-[11px] font-black transition-all ${
                            isBuy
                              ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 hover:bg-cyan-500/30"
                              : "bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30"
                          }`}
                          title="Click to toggle between BUY (Long) and SELL (Short)"
                        >
                          {c.action}
                        </button>
                      </td>

                      {/* DTE */}
                      <td className="py-3 px-3 text-right">
                        <span className="font-bold text-slate-200">{c.dte}d</span>
                      </td>

                      {/* Fill Price & Mode Controls */}
                      <td className="py-3 px-3 text-right">
                        <div className="flex flex-col items-end gap-1">
                          <div className="flex items-center gap-1">
                            <span className="text-[10px] text-slate-500">$</span>
                            <input
                              type="number"
                              step="0.05"
                              min="0.01"
                              value={metrics.effectivePrice}
                              onChange={(e) => {
                                const val = parseFloat(e.target.value);
                                if (!isNaN(val) && val > 0) {
                                  onUpdateContractPrice(c.id, val, "CUSTOM");
                                }
                              }}
                              className="w-16 px-1.5 py-0.5 rounded bg-slate-900 border border-slate-700 text-right text-xs font-bold text-white focus:border-cyan-400 focus:outline-none"
                            />
                          </div>

                          <div className="flex items-center gap-1 text-[9px]">
                            <button
                              onClick={() => onUpdateContractPrice(c.id, c.bid, "BID")}
                              className={`px-1 py-0.2 rounded ${
                                c.priceMode === "BID"
                                  ? "bg-cyan-500/30 text-cyan-300 font-bold"
                                  : "text-slate-400 hover:text-slate-200"
                              }`}
                              title={`Bid: $${c.bid.toFixed(2)}`}
                            >
                              Bid
                            </button>
                            <span>|</span>
                            <button
                              onClick={() => onUpdateContractPrice(c.id, c.mid, "MID")}
                              className={`px-1 py-0.2 rounded ${
                                c.priceMode === "MID"
                                  ? "bg-cyan-500/30 text-cyan-300 font-bold"
                                  : "text-slate-400 hover:text-slate-200"
                              }`}
                              title={`Mid: $${c.mid.toFixed(2)}`}
                            >
                              Mid
                            </button>
                            <span>|</span>
                            <button
                              onClick={() => onUpdateContractPrice(c.id, c.ask, "ASK")}
                              className={`px-1 py-0.2 rounded ${
                                c.priceMode === "ASK"
                                  ? "bg-cyan-500/30 text-cyan-300 font-bold"
                                  : "text-slate-400 hover:text-slate-200"
                              }`}
                              title={`Ask: $${c.ask.toFixed(2)}`}
                            >
                              Ask
                            </button>
                          </div>
                        </div>
                      </td>

                      {/* 1. DTE PER DOLLAR SPENT */}
                      <td className="py-3 px-3 text-right bg-[#091524] border-x border-cyan-900/30">
                        <div className="font-black text-cyan-300 text-sm">
                          {metrics.dtePerDollarSpent.toFixed(2)}
                          <span className="text-[10px] text-cyan-400/80 font-normal ml-0.5">d/$</span>
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {metrics.dtePerDollarSpent > 15 ? "High Value" : "Concentrated"}
                        </div>
                      </td>

                      {/* 2. DAILY THETA AS % OF PREMIUM */}
                      <td className="py-3 px-3 text-right bg-[#1a140b] border-r border-amber-900/30">
                        <div className="font-black text-amber-300 text-sm flex items-center justify-end gap-1">
                          <Flame className="w-3 h-3 text-amber-400 shrink-0" />
                          <span>{metrics.thetaBurnDailyPct.toFixed(2)}%</span>
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {metrics.dailyThetaDollars >= 0 ? "+" : ""}${metrics.dailyThetaDollars.toFixed(2)}/day
                        </div>
                      </td>

                      {/* 3. DELTA EXPOSURE PER DOLLAR SPENT */}
                      <td className="py-3 px-3 text-right bg-[#0b1c16] border-r border-emerald-900/30">
                        <div className="font-black text-emerald-300 text-sm">
                          {metrics.deltaPerDollar.toFixed(3)}
                          <span className="text-[10px] text-emerald-400/80 font-normal ml-0.5">Δ/$</span>
                        </div>
                        <div className="text-[10px] text-slate-400">
                          Net: {metrics.netDeltaExposure >= 0 ? "+" : ""}{metrics.netDeltaExposure.toFixed(0)} shares
                        </div>
                      </td>

                      {/* 4. VEGA EXPOSURE PER DOLLAR SPENT */}
                      <td className="py-3 px-3 text-right bg-[#181126] border-r border-purple-900/30">
                        <div className="font-black text-purple-300 text-sm">
                          {metrics.vegaPerDollar.toFixed(3)}
                          <span className="text-[10px] text-purple-400/80 font-normal ml-0.5">ν/$</span>
                        </div>
                        <div className="text-[10px] text-slate-400">
                          ${metrics.netVegaExposure.toFixed(1)} / 1% IV
                        </div>
                      </td>

                      {/* Capital Required */}
                      <td className="py-3 px-3 text-right hidden md:table-cell">
                        <div className="font-bold text-slate-200">
                          ${metrics.capitalRequired.toLocaleString()}
                        </div>
                        <div className="text-[10px] text-slate-500">
                          {isBuy ? "Premium cost" : "Collateral / Cash"}
                        </div>
                      </td>

                      {/* Breakeven */}
                      <td className="py-3 px-3 text-right hidden lg:table-cell">
                        <div className="font-bold text-slate-300">
                          ${metrics.breakevenPrice.toFixed(2)}
                        </div>
                        <div className="text-[10px] text-slate-500">
                          {metrics.leverageRatio.toFixed(1)}x leverage
                        </div>
                      </td>

                      {/* Simulator Output (if open) */}
                      {showSimulator && (
                        <td className="py-3 px-3 text-right bg-purple-950/30 border-l border-purple-800/40">
                          <div
                            className={`font-black text-sm ${
                              simulated.totalSimulatedPnL >= 0 ? "text-emerald-400" : "text-rose-400"
                            }`}
                          >
                            {simulated.totalSimulatedPnL >= 0 ? "+" : ""}${simulated.totalSimulatedPnL.toFixed(0)}
                          </div>
                          <div
                            className={`text-[10px] font-bold ${
                              simulated.simulatedPnLPct >= 0 ? "text-emerald-400" : "text-rose-400"
                            }`}
                          >
                            {simulated.simulatedPnLPct >= 0 ? "+" : ""}{simulated.simulatedPnLPct}%
                          </div>
                        </td>
                      )}

                      {/* Actions */}
                      <td className="py-3 px-3 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => handleLoadContractToStrategy(c, metrics.effectivePrice)}
                            className="p-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 transition-all"
                            title="Load into Strategy & Payoff Chart"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => onRemoveContract(c.id)}
                            className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 transition-all"
                            title="Remove from Bench"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Table Footer with Summary & Metrics Explanations */}
          <div className="bg-[#0c1421] border-t border-[#172436] p-4 text-[11px] text-slate-400 flex flex-col md:flex-row md:items-center justify-between gap-3 font-mono">
            <div className="flex flex-wrap items-center gap-4">
              <span className="flex items-center gap-1 text-cyan-300">
                <span className="w-2 h-2 rounded-full bg-cyan-400" />
                <strong>DTE / $ Spent</strong> = Days of optionality purchased per $1 of premium
              </span>
              <span className="flex items-center gap-1 text-amber-300">
                <span className="w-2 h-2 rounded-full bg-amber-400" />
                <strong>Daily Theta %</strong> = (|Theta| / Premium) * 100% (Decay velocity per day)
              </span>
              <span className="flex items-center gap-1 text-emerald-300">
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                <strong>Delta / $</strong> = Directional exposure per $1 capital committed
              </span>
              <span className="flex items-center gap-1 text-purple-300">
                <span className="w-2 h-2 rounded-full bg-purple-400" />
                <strong>Vega / $</strong> = Sensitivity to 1% IV change per $1 premium
              </span>
            </div>

            <div className="text-slate-500 text-[10px]">
              Multi-ticker persistent comparison bench • Auto-saved locally
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
