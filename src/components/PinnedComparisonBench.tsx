import React, { useState, useMemo } from "react";
import { PinnedOptionContract, StrategyLeg, DteStrategyType } from "../types";
import {
  BookmarkCheck,
  Trash2,
  ArrowRight,
  TrendingUp,
  Percent,
  DollarSign,
  Flame,
  Award,
  Layers,
  ArrowUpDown,
  Sparkles,
  Shield,
  HelpCircle,
  RotateCcw,
  Sliders,
  ExternalLink,
} from "lucide-react";

interface PinnedComparisonBenchProps {
  ticker: string;
  currentPrice: number;
  pinnedContracts: PinnedOptionContract[];
  costBasis: number;
  isCustomCostBasis: boolean;
  contractCount: number;
  onUpdateCostBasis: (newCostBasis: number) => void;
  onResetCostBasis: () => void;
  onUpdateContractPrice: (id: string, price: number, mode: "BID" | "MID" | "CUSTOM") => void;
  onSetAllPricesMode: (mode: "BID" | "MID") => void;
  onRemoveContract: (id: string) => void;
  onClearAll: () => void;
  onSelectLegsForStrategy: (legs: StrategyLeg[], strategyName: string) => void;
}

export const PinnedComparisonBench: React.FC<PinnedComparisonBenchProps> = ({
  ticker,
  currentPrice,
  pinnedContracts,
  costBasis,
  isCustomCostBasis,
  contractCount,
  onUpdateCostBasis,
  onResetCostBasis,
  onUpdateContractPrice,
  onSetAllPricesMode,
  onRemoveContract,
  onClearAll,
  onSelectLegsForStrategy,
}) => {
  const [filterStrategy, setFilterStrategy] = useState<"ALL" | DteStrategyType>("ALL");
  const [sortBy, setSortBy] = useState<"apr" | "premium" | "maxReturn" | "dte" | "strike">("apr");

  // Filtered pinned contracts
  const filteredContracts = useMemo(() => {
    if (filterStrategy === "ALL") return pinnedContracts;
    return pinnedContracts.filter((c) => c.strategy === filterStrategy);
  }, [pinnedContracts, filterStrategy]);

  // Calculate live metrics for each pinned contract based on customFillPrice & costBasis
  const calculatedRows = useMemo(() => {
    const S = costBasis > 0 ? costBasis : currentPrice;
    const multiplier = Math.max(1, contractCount) * 100;

    return filteredContracts.map((c) => {
      const P = c.customFillPrice > 0 ? c.customFillPrice : (c.bid > 0 ? c.bid : (c.lastPrice > 0 ? c.lastPrice : 0.05));
      const K = c.strike;
      const dte = Math.max(1, c.dte);
      const isCoveredCall = c.strategy === "COVERED_CALL";

      let capitalRequired = 0;
      let premiumCollected = Number((P * multiplier).toFixed(2));
      let premiumYieldPercent = 0;
      let premiumAnnualizedApr = 0;
      let maxProfitPerContract = 0;
      let maxReturnPercent = 0;
      let maxAnnualizedApr = 0;
      let breakEven = 0;
      let downsideBufferPercent = 0;

      if (isCoveredCall) {
        capitalRequired = Math.max(1, Number(((S - P) * multiplier).toFixed(2)));
        premiumYieldPercent = Number(((P / S) * 100).toFixed(2));
        premiumAnnualizedApr = Number(((premiumYieldPercent * 365) / dte).toFixed(1));

        const profitPerShare = K >= S ? (K - S + P) : P;
        maxProfitPerContract = Number((profitPerShare * multiplier).toFixed(2));
        maxReturnPercent = Number(((profitPerShare / S) * 100).toFixed(2));
        maxAnnualizedApr = Number(((maxReturnPercent * 365) / dte).toFixed(1));

        breakEven = Number((S - P).toFixed(2));
        downsideBufferPercent = Number(((P / S) * 100).toFixed(2));
      } else {
        // Cash-Secured Put
        capitalRequired = Number((K * multiplier).toFixed(2));
        premiumYieldPercent = Number(((P / K) * 100).toFixed(2));
        premiumAnnualizedApr = Number(((premiumYieldPercent * 365) / dte).toFixed(1));

        maxProfitPerContract = premiumCollected;
        maxReturnPercent = premiumYieldPercent;
        maxAnnualizedApr = premiumAnnualizedApr;

        breakEven = Number((K - P).toFixed(2));
        downsideBufferPercent = currentPrice > 0 ? Number((((currentPrice - (K - P)) / currentPrice) * 100).toFixed(2)) : 0;
      }

      // Delta from original Bid price
      const priceDeltaFromBid = Number((P - c.bid).toFixed(2));
      const priceDeltaFromBidPct = c.bid > 0 ? Number(((priceDeltaFromBid / c.bid) * 100).toFixed(1)) : 0;

      return {
        ...c,
        effectivePrice: P,
        capitalRequired,
        premiumCollected,
        premiumYieldPercent,
        premiumAnnualizedApr,
        maxProfitPerContract,
        maxReturnPercent,
        maxAnnualizedApr,
        breakEven,
        downsideBufferPercent,
        priceDeltaFromBid,
        priceDeltaFromBidPct,
      };
    });
  }, [filteredContracts, costBasis, currentPrice, contractCount]);

  // Sort rows
  const sortedRows = useMemo(() => {
    const rows = [...calculatedRows];
    switch (sortBy) {
      case "premium":
        return rows.sort((a, b) => b.premiumCollected - a.premiumCollected);
      case "maxReturn":
        return rows.sort((a, b) => b.maxAnnualizedApr - a.maxAnnualizedApr);
      case "dte":
        return rows.sort((a, b) => a.dte - b.dte);
      case "strike":
        return rows.sort((a, b) => a.strike - b.strike);
      case "apr":
      default:
        return rows.sort((a, b) => b.premiumAnnualizedApr - a.premiumAnnualizedApr);
    }
  }, [calculatedRows, sortBy]);

  // Top performers
  const topAprContract = useMemo(() => {
    if (!calculatedRows.length) return null;
    return [...calculatedRows].sort((a, b) => b.premiumAnnualizedApr - a.premiumAnnualizedApr)[0];
  }, [calculatedRows]);

  const topPremiumContract = useMemo(() => {
    if (!calculatedRows.length) return null;
    return [...calculatedRows].sort((a, b) => b.premiumCollected - a.premiumCollected)[0];
  }, [calculatedRows]);

  const topCushionContract = useMemo(() => {
    if (!calculatedRows.length) return null;
    return [...calculatedRows].sort((a, b) => b.downsideBufferPercent - a.downsideBufferPercent)[0];
  }, [calculatedRows]);

  // Handler to load in Strategy Builder
  const handleLoadInBuilder = (item: typeof calculatedRows[0]) => {
    const legs: StrategyLeg[] = [];
    const stockPrice = costBasis > 0 ? costBasis : currentPrice;
    const isCoveredCall = item.strategy === "COVERED_CALL";

    if (isCoveredCall) {
      // 1. Long shares at stockPrice
      legs.push({
        id: `stock-${Date.now()}`,
        type: "STOCK",
        strike: stockPrice,
        action: "BUY",
        quantity: contractCount,
        entryPrice: stockPrice,
        delta: 1.0,
        contractSymbol: `${ticker} (SHARES)`,
        expirationDate: item.expirationDate,
      });

      // 2. Short Call at item.effectivePrice
      legs.push({
        id: `call-${Date.now()}`,
        type: "CALL",
        strike: item.strike,
        action: "SELL",
        quantity: contractCount,
        entryPrice: item.effectivePrice,
        delta: item.delta,
        contractSymbol: item.contractSymbol,
        expirationDate: item.expirationDate,
        impliedVolatility: item.impliedVolatility,
      });

      onSelectLegsForStrategy(
        legs,
        `Covered Call (${item.formattedDate} $${item.strike}C @ $${item.effectivePrice.toFixed(2)})`
      );
    } else {
      // Cash-Secured Put: Short Put at item.effectivePrice
      legs.push({
        id: `put-${Date.now()}`,
        type: "PUT",
        strike: item.strike,
        action: "SELL",
        quantity: contractCount,
        entryPrice: item.effectivePrice,
        delta: item.delta,
        contractSymbol: item.contractSymbol,
        expirationDate: item.expirationDate,
        impliedVolatility: item.impliedVolatility,
      });

      onSelectLegsForStrategy(
        legs,
        `Cash-Secured Put (${item.formattedDate} $${item.strike}P @ $${item.effectivePrice.toFixed(2)})`
      );
    }
  };

  return (
    <div className="bg-[#0b1320] border-2 border-emerald-500/40 rounded-xl p-5 shadow-2xl space-y-5 relative">
      {/* Glow Top Accent */}
      <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-emerald-500 via-cyan-400 to-indigo-500 rounded-t-xl" />

      {/* HEADER SECTION */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-[#17253b]">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
            <BookmarkCheck className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-white font-mono tracking-tight">
                Selected Contracts Comparison Bench
              </h3>
              <span className="px-2 py-0.5 rounded-full bg-emerald-400 text-slate-950 font-mono font-black text-xs">
                {pinnedContracts.length} {pinnedContracts.length === 1 ? "Option" : "Options"} Staged
              </span>
            </div>
            <p className="text-xs text-slate-400 font-sans mt-0.5">
              Compare options across <strong className="text-slate-200">different strikes & DTEs</strong> in one place. Adjust your actual fill price & cost basis to see live APR velocity.
            </p>
          </div>
        </div>

        {/* Global Toolbar Controls */}
        <div className="flex flex-wrap items-center gap-2 font-mono text-xs">
          {/* Quick Pricing Mode for All */}
          <div className="flex items-center gap-1 bg-[#070d17] p-1 rounded-lg border border-[#17253b]">
            <span className="text-[11px] text-slate-400 px-1.5">Fill Prices:</span>
            <button
              onClick={() => onSetAllPricesMode("BID")}
              className="px-2 py-1 rounded bg-[#101b2b] hover:bg-[#1a2d47] text-slate-300 font-bold hover:text-white transition-all"
              title="Set all pinned contracts to their current Bid price"
            >
              All Bid
            </button>
            <button
              onClick={() => onSetAllPricesMode("MID")}
              className="px-2 py-1 rounded bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 font-bold transition-all border border-cyan-500/30"
              title="Set all pinned contracts to their current Midpoint price"
            >
              All Mid (Mark)
            </button>
          </div>

          {/* Strategy filter if mixed */}
          {pinnedContracts.some((c) => c.strategy === "COVERED_CALL") &&
            pinnedContracts.some((c) => c.strategy === "CASH_SECURED_PUT") && (
              <div className="flex items-center bg-[#070d17] p-1 rounded-lg border border-[#17253b]">
                <button
                  onClick={() => setFilterStrategy("ALL")}
                  className={`px-2 py-1 rounded font-bold transition-all ${
                    filterStrategy === "ALL" ? "bg-slate-700 text-white" : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  All ({pinnedContracts.length})
                </button>
                <button
                  onClick={() => setFilterStrategy("COVERED_CALL")}
                  className={`px-2 py-1 rounded font-bold transition-all ${
                    filterStrategy === "COVERED_CALL" ? "bg-emerald-500/30 text-emerald-300 border border-emerald-500/40" : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  Calls
                </button>
                <button
                  onClick={() => setFilterStrategy("CASH_SECURED_PUT")}
                  className={`px-2 py-1 rounded font-bold transition-all ${
                    filterStrategy === "CASH_SECURED_PUT" ? "bg-cyan-500/30 text-cyan-300 border border-cyan-500/40" : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  Puts
                </button>
              </div>
            )}

          {/* Clear All Button */}
          {pinnedContracts.length > 0 && (
            <button
              onClick={onClearAll}
              className="px-2.5 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 font-bold transition-all flex items-center gap-1.5"
              title="Clear all pinned contracts"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear All</span>
            </button>
          )}
        </div>
      </div>

      {/* COST BASIS & CONTROLS SUB-BAR */}
      <div className="bg-[#070d17] border border-[#17253b] rounded-xl p-3.5 flex flex-wrap items-center justify-between gap-4 font-mono text-xs">
        <div className="flex flex-wrap items-center gap-4">
          {/* Stock Cost Basis Input */}
          <div className="flex items-center gap-2">
            <span className="text-slate-400 font-bold flex items-center gap-1">
              <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
              Stock Cost Basis:
            </span>
            <div className="relative">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500 font-bold">$</span>
              <input
                type="number"
                step="0.05"
                min="0.01"
                value={costBasis}
                onChange={(e) => onUpdateCostBasis(parseFloat(e.target.value) || 0)}
                className={`w-28 pl-6 pr-2 py-1.5 bg-[#0b1320] border rounded font-bold font-mono text-sm focus:outline-none transition-all ${
                  isCustomCostBasis
                    ? "border-amber-500/50 text-amber-300 focus:border-amber-400"
                    : "border-[#1e304b] text-white focus:border-emerald-400"
                }`}
                title="Your purchase price or cost basis for the underlying shares"
              />
            </div>
            {isCustomCostBasis && (
              <button
                onClick={onResetCostBasis}
                className="px-2 py-1 rounded bg-[#101b2b] hover:bg-[#1a2d47] text-slate-400 hover:text-white border border-[#1a2d47] text-[11px] flex items-center gap-1"
                title="Reset cost basis to current market stock price"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Market (${currentPrice.toFixed(2)})</span>
              </button>
            )}
          </div>

          {/* Position Multiplier Info */}
          <div className="flex items-center gap-2 text-slate-400 border-l border-[#17253b] pl-4">
            <span>Size:</span>
            <span className="text-white font-bold">
              {contractCount} contract{contractCount > 1 ? "s" : ""} ({contractCount * 100} shares)
            </span>
          </div>
        </div>

        {/* Sort Switcher */}
        <div className="flex items-center gap-1.5">
          <span className="text-slate-400 font-bold flex items-center gap-1">
            <ArrowUpDown className="w-3 h-3 text-cyan-400" />
            Sort:
          </span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="bg-[#0b1320] border border-[#1a2d47] text-white rounded px-2 py-1 font-mono text-xs focus:outline-none focus:border-cyan-400"
          >
            <option value="apr">Highest APR %</option>
            <option value="premium">Highest Premium ($)</option>
            <option value="maxReturn">Highest Max APR %</option>
            <option value="dte">Shortest DTE</option>
            <option value="strike">Strike Price</option>
          </select>
        </div>
      </div>

      {/* TOP PERFORMERS SUMMARY CARDS (If >= 2 contracts pinned) */}
      {calculatedRows.length >= 2 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 font-mono">
          {/* Top APR Card */}
          {topAprContract && (
            <div className="bg-[#070e1a] border border-emerald-500/40 rounded-lg p-3 relative overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider flex items-center gap-1">
                  <Flame className="w-3.5 h-3.5 text-emerald-400" />
                  Velocity Winner (Top APR)
                </span>
                <span className="px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 text-[10px] font-black border border-emerald-500/30">
                  {topAprContract.dte} DTE
                </span>
              </div>
              <div className="mt-1 flex items-baseline justify-between">
                <div>
                  <span className="text-white font-black text-sm">
                    ${topAprContract.strike} {topAprContract.strategy === "COVERED_CALL" ? "Call" : "Put"}
                  </span>
                  <span className="text-slate-400 text-xs ml-1.5">({topAprContract.formattedDate})</span>
                </div>
                <div className="text-right">
                  <span className="text-emerald-300 font-black text-lg">
                    {topAprContract.premiumAnnualizedApr.toFixed(1)}%
                  </span>
                  <span className="text-slate-500 text-[10px] block">APR</span>
                </div>
              </div>
            </div>
          )}

          {/* Max Cash Inflow Card */}
          {topPremiumContract && (
            <div className="bg-[#070e1a] border border-purple-500/40 rounded-lg p-3 relative overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-purple-400 font-bold uppercase tracking-wider flex items-center gap-1">
                  <DollarSign className="w-3.5 h-3.5 text-purple-400" />
                  Max Dollar Premium
                </span>
                <span className="px-1.5 py-0.2 rounded bg-purple-500/20 text-purple-300 text-[10px] font-black border border-purple-500/30">
                  {topPremiumContract.dte} DTE
                </span>
              </div>
              <div className="mt-1 flex items-baseline justify-between">
                <div>
                  <span className="text-white font-black text-sm">
                    ${topPremiumContract.strike} {topPremiumContract.strategy === "COVERED_CALL" ? "Call" : "Put"}
                  </span>
                  <span className="text-slate-400 text-xs ml-1.5">({topPremiumContract.formattedDate})</span>
                </div>
                <div className="text-right">
                  <span className="text-purple-300 font-black text-lg">
                    ${topPremiumContract.premiumCollected.toLocaleString()}
                  </span>
                  <span className="text-slate-500 text-[10px] block">Cash</span>
                </div>
              </div>
            </div>
          )}

          {/* Cushion / Safety Winner */}
          {topCushionContract && (
            <div className="bg-[#070e1a] border border-amber-500/40 rounded-lg p-3 relative overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-amber-400 font-bold uppercase tracking-wider flex items-center gap-1">
                  <Shield className="w-3.5 h-3.5 text-amber-400" />
                  Max Downside Cushion
                </span>
                <span className="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 text-[10px] font-black border border-amber-500/30">
                  {topCushionContract.dte} DTE
                </span>
              </div>
              <div className="mt-1 flex items-baseline justify-between">
                <div>
                  <span className="text-white font-black text-sm">
                    ${topCushionContract.strike} {topCushionContract.strategy === "COVERED_CALL" ? "Call" : "Put"}
                  </span>
                  <span className="text-slate-400 text-xs ml-1.5">({topCushionContract.formattedDate})</span>
                </div>
                <div className="text-right">
                  <span className="text-amber-300 font-black text-lg">
                    {topCushionContract.downsideBufferPercent.toFixed(1)}%
                  </span>
                  <span className="text-slate-500 text-[10px] block">Cushion</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* BENCH TABLE */}
      {sortedRows.length === 0 ? (
        <div className="bg-[#070d17] border border-dashed border-[#1e304b] rounded-xl p-8 text-center space-y-3">
          <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
            <BookmarkCheck className="w-6 h-6" />
          </div>
          <h4 className="text-sm font-bold text-white font-mono">No Contracts Pinned Yet</h4>
          <p className="text-xs text-slate-400 max-w-md mx-auto font-sans leading-relaxed">
            Click the <span className="text-emerald-400 font-bold font-mono">+ Pin</span> button on any row in the matrix table above. You can roam freely across different strike prices and DTEs—they will all collect here for direct side-by-side comparison and custom fill price testing.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto border border-[#17253b] rounded-xl bg-[#070d17]">
          <table className="w-full text-xs font-mono border-collapse">
            <thead>
              <tr className="border-b border-[#17253b] bg-[#0a121d] text-slate-400 text-[11px] uppercase tracking-wider">
                <th className="py-2.5 px-3 text-center">Rank</th>
                <th className="py-2.5 px-3 text-left">Contract / Strike</th>
                <th className="py-2.5 px-3 text-left">Expiration (DTE)</th>
                <th className="py-2.5 px-3 text-center">Market Quote</th>
                <th className="py-2.5 px-3 text-center bg-cyan-950/20 border-x border-cyan-500/20">
                  <div className="flex items-center justify-center gap-1 text-cyan-300 font-bold">
                    <Sliders className="w-3.5 h-3.5" />
                    <span>Your Fill Price ($)</span>
                  </div>
                </th>
                <th className="py-2.5 px-3 text-right">Premium ($)</th>
                <th className="py-2.5 px-3 text-right">Yield %</th>
                <th className="py-2.5 px-3 text-right bg-emerald-950/30 text-emerald-300 font-bold">
                  Annualized APR
                </th>
                <th className="py-2.5 px-3 text-right text-cyan-300">Max Return %</th>
                <th className="py-2.5 px-3 text-right text-cyan-400">Max APR %</th>
                <th className="py-2.5 px-3 text-right">Cushion %</th>
                <th className="py-2.5 px-3 text-right">Breakeven</th>
                <th className="py-2.5 px-3 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#131f31]">
              {sortedRows.map((row, idx) => {
                const isTopApr = topAprContract?.id === row.id;
                const isTopPremium = topPremiumContract?.id === row.id;
                const isTopCushion = topCushionContract?.id === row.id;

                return (
                  <tr
                    key={row.id}
                    className={`hover:bg-[#0d1827] transition-colors ${
                      isTopApr ? "bg-emerald-950/10" : ""
                    }`}
                  >
                    {/* Rank */}
                    <td className="py-3 px-3 text-center font-bold">
                      {isTopApr ? (
                        <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-emerald-400 text-slate-950 text-[10px] font-black" title="Rank #1 Highest APR">
                          #1
                        </span>
                      ) : (
                        <span className="text-slate-500">#{idx + 1}</span>
                      )}
                    </td>

                    {/* Contract Symbol & Strategy */}
                    <td className="py-3 px-3 text-left">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-white text-sm">
                          ${row.strike.toFixed(2)}
                        </span>
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            row.strategy === "COVERED_CALL"
                              ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                              : "bg-cyan-500/20 text-cyan-300 border border-cyan-500/30"
                          }`}
                        >
                          {row.strategy === "COVERED_CALL" ? "CALL" : "PUT"}
                        </span>
                        {isTopApr && (
                          <span className="px-1.5 py-0.5 rounded text-[9px] bg-emerald-500/30 text-emerald-200 border border-emerald-400/50 font-black">
                            TOP APR
                          </span>
                        )}
                        {isTopPremium && !isTopApr && (
                          <span className="px-1.5 py-0.5 rounded text-[9px] bg-purple-500/30 text-purple-200 border border-purple-400/50 font-black">
                            MAX $
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-500 mt-0.5">
                        {row.strategy === "COVERED_CALL" ? "Covered Call" : "Cash-Secured Put"}
                        {row.delta !== 0 && ` · Δ ${row.delta > 0 ? "+" : ""}${row.delta.toFixed(2)}`}
                      </div>
                    </td>

                    {/* Expiration Date & DTE */}
                    <td className="py-3 px-3 text-left font-bold text-slate-200">
                      <div>{row.formattedDate}</div>
                      <div className="flex items-center gap-1 mt-0.5">
                        <span className="px-1.5 py-0.2 rounded bg-[#101b2b] text-cyan-300 border border-[#1a2d47] text-[10px] font-bold">
                          {row.dte} DTE
                        </span>
                        <span className="text-slate-500 text-[10px]">
                          ({(365 / row.dte).toFixed(1)}x / yr)
                        </span>
                      </div>
                    </td>

                    {/* Market Quote (Bid / Ask / Mid) */}
                    <td className="py-3 px-3 text-center text-slate-300">
                      <div className="text-[11px]">
                        <span className="text-slate-400">Bid: </span>
                        <strong className="text-emerald-400">${row.bid.toFixed(2)}</strong>
                        <span className="text-slate-600 mx-1">|</span>
                        <span className="text-slate-400">Ask: </span>
                        <strong className="text-rose-400">${row.ask.toFixed(2)}</strong>
                      </div>
                      <div className="text-[10px] text-slate-500 mt-0.5">
                        Mid: <span className="text-cyan-300 font-bold">${row.mid.toFixed(2)}</span>
                        {" · "}Spread: ${row.spread.toFixed(2)}
                      </div>
                    </td>

                    {/* EDITABLE FILL PRICE ($) */}
                    <td className="py-3 px-3 text-center bg-cyan-950/15 border-x border-cyan-500/20">
                      <div className="flex flex-col items-center gap-1">
                        {/* Number Input */}
                        <div className="relative">
                          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-cyan-500 font-bold text-xs">$</span>
                          <input
                            type="number"
                            step="0.05"
                            min="0.01"
                            value={row.effectivePrice}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value) || 0;
                              onUpdateContractPrice(row.id, val, "CUSTOM");
                            }}
                            className="w-24 pl-5 pr-1.5 py-1 bg-[#060c14] border border-cyan-500/50 rounded font-mono font-black text-sm text-cyan-300 text-center focus:outline-none focus:border-cyan-300 focus:ring-1 focus:ring-cyan-300 transition-all"
                            title="Edit option fill price to model limit order or market maker execution"
                          />
                        </div>

                        {/* Quick Presets: Bid / Mid */}
                        <div className="flex items-center gap-1 text-[10px]">
                          <button
                            onClick={() => onUpdateContractPrice(row.id, row.bid, "BID")}
                            className={`px-1.5 py-0.5 rounded font-bold transition-all ${
                              Math.abs(row.effectivePrice - row.bid) < 0.009
                                ? "bg-emerald-500/30 text-emerald-300 border border-emerald-500/50 font-black"
                                : "bg-[#101b2b] text-slate-400 hover:text-white"
                            }`}
                            title={`Use Bid price: $${row.bid.toFixed(2)}`}
                          >
                            Bid ${row.bid.toFixed(2)}
                          </button>
                          <button
                            onClick={() => onUpdateContractPrice(row.id, row.mid, "MID")}
                            className={`px-1.5 py-0.5 rounded font-bold transition-all ${
                              Math.abs(row.effectivePrice - row.mid) < 0.009
                                ? "bg-cyan-500/30 text-cyan-300 border border-cyan-500/50 font-black"
                                : "bg-[#101b2b] text-slate-400 hover:text-white"
                            }`}
                            title={`Use Midpoint price: $${row.mid.toFixed(2)}`}
                          >
                            Mid ${row.mid.toFixed(2)}
                          </button>
                        </div>

                        {/* Diff from bid */}
                        {row.priceDeltaFromBid !== 0 && (
                          <div className={`text-[9px] font-bold ${row.priceDeltaFromBid > 0 ? "text-emerald-400" : "text-rose-400"}`}>
                            {row.priceDeltaFromBid > 0 ? "+" : ""}${row.priceDeltaFromBid.toFixed(2)} ({row.priceDeltaFromBidPct > 0 ? "+" : ""}{row.priceDeltaFromBidPct}%)
                          </div>
                        )}
                      </div>
                    </td>

                    {/* Premium Collected ($) */}
                    <td className="py-3 px-3 text-right font-bold text-slate-200">
                      ${row.premiumCollected.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                    </td>

                    {/* Raw Yield % */}
                    <td className="py-3 px-3 text-right text-purple-300 font-bold">
                      {row.premiumYieldPercent.toFixed(2)}%
                    </td>

                    {/* Annualized APR % */}
                    <td className="py-3 px-3 text-right bg-emerald-950/30">
                      <div className="flex items-center justify-end gap-1.5">
                        <span className="font-mono font-black text-emerald-300 text-sm">
                          {row.premiumAnnualizedApr.toFixed(1)}%
                        </span>
                        {row.premiumAnnualizedApr >= 25 && (
                          <Flame className="w-3.5 h-3.5 text-emerald-400" />
                        )}
                      </div>
                    </td>

                    {/* Max Return % */}
                    <td className="py-3 px-3 text-right text-cyan-300 font-bold">
                      {row.maxReturnPercent.toFixed(2)}%
                    </td>

                    {/* Max APR % */}
                    <td className="py-3 px-3 text-right text-cyan-400 font-black">
                      {row.maxAnnualizedApr.toFixed(1)}%
                    </td>

                    {/* Downside Cushion % */}
                    <td className="py-3 px-3 text-right">
                      <span className="px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20 font-bold text-[11px]">
                        {row.downsideBufferPercent.toFixed(1)}%
                      </span>
                    </td>

                    {/* Breakeven */}
                    <td className="py-3 px-3 text-right text-slate-300 font-mono">
                      ${row.breakEven.toFixed(2)}
                    </td>

                    {/* Actions: Build & Delete */}
                    <td className="py-3 px-3 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => handleLoadInBuilder(row)}
                          className="px-2 py-1 rounded bg-emerald-500/20 hover:bg-emerald-500 text-emerald-300 hover:text-slate-950 border border-emerald-500/40 text-[11px] font-mono font-bold transition-all flex items-center gap-1"
                          title="Load this contract & custom fill price directly into Strategy Builder"
                        >
                          <span>Build</span>
                          <ArrowRight className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => onRemoveContract(row.id)}
                          className="p-1 rounded bg-[#101b2b] hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 border border-[#1a2d47] hover:border-rose-500/30 transition-all"
                          title="Remove from comparison bench"
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
      )}
    </div>
  );
};
