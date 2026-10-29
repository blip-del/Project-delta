import React, { useState, useEffect, useMemo } from "react";
import {
  DteComparisonData,
  DteComparisonRow,
  DteStrategyType,
  PinnedOptionContract,
  StrategyLeg,
} from "../types";
import { fetchStrikeDteComparison } from "../services/optionsService";
import { PinnedComparisonBench } from "./PinnedComparisonBench";
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
  ReferenceLine,
} from "recharts";
import {
  Calendar,
  TrendingUp,
  Percent,
  DollarSign,
  ShieldAlert,
  ArrowRight,
  Flame,
  Award,
  Layers,
  ChevronDown,
  RefreshCw,
  Sparkles,
  Zap,
  Info,
  Check,
  Bookmark,
  BookmarkCheck,
} from "lucide-react";

interface DteComparisonViewProps {
  ticker: string;
  currentPrice: number;
  initialStrike?: number;
  initialStrategy?: DteStrategyType;
  onSelectLegsForStrategy: (legs: StrategyLeg[], strategyName: string) => void;
}

export const DteComparisonView: React.FC<DteComparisonViewProps> = ({
  ticker,
  currentPrice,
  initialStrike,
  initialStrategy = "COVERED_CALL",
  onSelectLegsForStrategy,
}) => {
  const [strategy, setStrategy] = useState<DteStrategyType>(initialStrategy);
  const [selectedStrike, setSelectedStrike] = useState<number | undefined>(initialStrike);
  const [dteLimit, setDteLimit] = useState<number>(10);
  const [data, setData] = useState<DteComparisonData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Multiplier: contracts count (1 contract = 100 shares)
  const [contractCount, setContractCount] = useState<number>(1);
  // Custom stock purchase price / cost basis for Covered Call (defaults to current market price)
  const [costBasis, setCostBasis] = useState<number>(currentPrice);
  const [isCustomCostBasis, setIsCustomCostBasis] = useState<boolean>(false);

  // Sort state
  const [sortBy, setSortBy] = useState<"dte" | "apr" | "premium" | "maxReturn" | "cushion">("dte");

  // Keep costBasis updated if currentPrice changes and user hasn't overridden it
  useEffect(() => {
    if (!isCustomCostBasis && currentPrice > 0) {
      setCostBasis(currentPrice);
    }
  }, [currentPrice, isCustomCostBasis]);

  // Pinned comparison bench state (persists across strike/strategy changes and saved in localStorage)
  const [pinnedContracts, setPinnedContracts] = useState<PinnedOptionContract[]>(() => {
    try {
      const saved = localStorage.getItem(`ais_pinned_${ticker}`);
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(`ais_pinned_${ticker}`, JSON.stringify(pinnedContracts));
    } catch (e) {
      // ignore
    }
  }, [pinnedContracts, ticker]);

  // Load comparison data
  const loadComparison = async (
    targetStrike?: number,
    targetStrategy: DteStrategyType = strategy,
    targetLimit: number = dteLimit
  ) => {
    setIsLoading(true);
    setError(null);
    try {
      const optionType = targetStrategy === "COVERED_CALL" ? "CALL" : "PUT";
      const result = await fetchStrikeDteComparison(ticker, targetStrike, optionType, targetLimit);
      setData(result);
      if (selectedStrike === undefined || (targetStrike !== undefined && targetStrike !== selectedStrike)) {
        setSelectedStrike(result.strike);
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to load DTE strike comparison");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadComparison(selectedStrike, strategy, dteLimit);
  }, [ticker, strategy, dteLimit]);

  const handleStrikeChange = (newStrike: number) => {
    setSelectedStrike(newStrike);
    loadComparison(newStrike, strategy, dteLimit);
  };

  // Re-calculate row metrics if user specified a custom stock cost basis for Covered Call or changed contractCount
  const processedRows = useMemo(() => {
    if (!data || !data.rows) return [];

    const S = isCustomCostBasis ? costBasis : (data.quote.regularMarketPrice || currentPrice);
    const multiplier = contractCount * 100;

    return data.rows.map((row) => {
      const B = row.bid > 0 ? row.bid : (row.lastPrice > 0 ? row.lastPrice : 0.05);
      const K = row.strike;
      const dte = Math.max(1, row.dte);

      let capitalRequired = 0;
      let premiumCollected = Number((B * multiplier).toFixed(2));
      let premiumYieldPercent = 0;
      let premiumAnnualizedApr = 0;
      let maxProfitPerContract = 0;
      let maxReturnPercent = 0;
      let maxAnnualizedApr = 0;
      let breakEven = 0;
      let downsideBufferPercent = 0;

      if (strategy === "COVERED_CALL") {
        // Net capital outlay: (Cost Basis - Bid) * shares
        capitalRequired = Math.max(1, Number(((S - B) * multiplier).toFixed(2)));
        // Premium yield relative to cost basis
        premiumYieldPercent = Number(((B / S) * 100).toFixed(2));
        premiumAnnualizedApr = Number(((premiumYieldPercent * 365) / dte).toFixed(1));

        // Max profit if assigned at strike K:
        // Capital appreciation: (K - S) + Option Premium B
        const profitPerShare = K >= S ? (K - S + B) : B;
        maxProfitPerContract = Number((profitPerShare * multiplier).toFixed(2));
        maxReturnPercent = Number(((profitPerShare / S) * 100).toFixed(2));
        maxAnnualizedApr = Number(((maxReturnPercent * 365) / dte).toFixed(1));

        breakEven = Number((S - B).toFixed(2));
        downsideBufferPercent = Number(((B / S) * 100).toFixed(2));
      } else {
        // Cash-Secured Put: Collateral is K * shares
        capitalRequired = Number((K * multiplier).toFixed(2));
        premiumYieldPercent = Number(((B / K) * 100).toFixed(2));
        premiumAnnualizedApr = Number(((premiumYieldPercent * 365) / dte).toFixed(1));

        maxProfitPerContract = premiumCollected;
        maxReturnPercent = premiumYieldPercent;
        maxAnnualizedApr = premiumAnnualizedApr;

        breakEven = Number((K - B).toFixed(2));
        downsideBufferPercent = Number((((S - (K - B)) / S) * 100).toFixed(2));
      }

      return {
        ...row,
        capitalRequired,
        premiumCollected,
        premiumYieldPercent,
        premiumAnnualizedApr,
        maxProfitPerContract,
        maxReturnPercent,
        maxAnnualizedApr,
        breakEven,
        downsideBufferPercent,
      };
    });
  }, [data, strategy, costBasis, isCustomCostBasis, contractCount, currentPrice]);

  // Sorted rows
  const sortedRows = useMemo(() => {
    const rows = [...processedRows];
    switch (sortBy) {
      case "apr":
        return rows.sort((a, b) => b.premiumAnnualizedApr - a.premiumAnnualizedApr);
      case "premium":
        return rows.sort((a, b) => b.premiumCollected - a.premiumCollected);
      case "maxReturn":
        return rows.sort((a, b) => b.maxAnnualizedApr - a.maxAnnualizedApr);
      case "cushion":
        return rows.sort((a, b) => b.downsideBufferPercent - a.downsideBufferPercent);
      case "dte":
      default:
        return rows.sort((a, b) => a.dte - b.dte);
    }
  }, [processedRows, sortBy]);

  // Statistics Highlights
  const highestAprRow = useMemo(() => {
    if (!processedRows.length) return null;
    return [...processedRows].sort((a, b) => b.premiumAnnualizedApr - a.premiumAnnualizedApr)[0];
  }, [processedRows]);

  const sweetSpotRow = useMemo(() => {
    if (!processedRows.length) return null;
    // Sweet spot: 20 to 60 DTE with the highest APR
    const candidates = processedRows.filter((r) => r.dte >= 14 && r.dte <= 60);
    if (candidates.length > 0) {
      return [...candidates].sort((a, b) => b.premiumAnnualizedApr - a.premiumAnnualizedApr)[0];
    }
    return highestAprRow;
  }, [processedRows, highestAprRow]);

  const highestPremiumRow = useMemo(() => {
    if (!processedRows.length) return null;
    return [...processedRows].sort((a, b) => b.premiumCollected - a.premiumCollected)[0];
  }, [processedRows]);

  // Strikes list helper
  const availableStrikes = data?.availableStrikes || [];
  const currentStrike = selectedStrike ?? data?.strike ?? currentPrice;

  // Find ATM strike and adjacent strikes
  const atmStrike = useMemo(() => {
    if (!availableStrikes.length) return currentPrice;
    return availableStrikes.reduce((prev, curr) =>
      Math.abs(curr - currentPrice) < Math.abs(prev - currentPrice) ? curr : prev
    );
  }, [availableStrikes, currentPrice]);

  // Stepper helper
  const handleStepStrike = (direction: -1 | 1) => {
    if (!availableStrikes.length) return;
    const sorted = [...availableStrikes].sort((a, b) => a - b);
    const currentIndex = sorted.findIndex((k) => Math.abs(k - currentStrike) < 0.01);
    if (currentIndex >= 0) {
      const nextIndex = Math.max(0, Math.min(sorted.length - 1, currentIndex + direction));
      handleStrikeChange(sorted[nextIndex]);
    }
  };

  // Handler to load a specific DTE row into Strategy Builder
  const handleLoadInBuilder = (row: DteComparisonRow) => {
    const legs: StrategyLeg[] = [];
    const stockPrice = isCustomCostBasis ? costBasis : currentPrice;

    if (strategy === "COVERED_CALL") {
      // 1. Long 100 shares of stock per contract
      legs.push({
        id: `stock-${Date.now()}`,
        type: "STOCK",
        strike: stockPrice,
        action: "BUY",
        quantity: contractCount,
        entryPrice: stockPrice,
        delta: 1.0,
        contractSymbol: `${ticker} (SHARES)`,
        expirationDate: row.expirationDate,
      });

      // 2. Short 1 Call contract per contract
      legs.push({
        id: `call-${Date.now()}`,
        type: "CALL",
        strike: row.strike,
        action: "SELL",
        quantity: contractCount,
        entryPrice: row.bid > 0 ? row.bid : row.lastPrice,
        delta: row.delta,
        contractSymbol: row.contractSymbol,
        expirationDate: row.expirationDate,
        impliedVolatility: row.impliedVolatility,
      });

      onSelectLegsForStrategy(legs, `Covered Call (${row.formattedDate} $${row.strike}C)`);
    } else {
      // Cash-Secured Put: Short 1 Put contract per contract
      legs.push({
        id: `put-${Date.now()}`,
        type: "PUT",
        strike: row.strike,
        action: "SELL",
        quantity: contractCount,
        entryPrice: row.bid > 0 ? row.bid : row.lastPrice,
        delta: row.delta,
        contractSymbol: row.contractSymbol,
        expirationDate: row.expirationDate,
        impliedVolatility: row.impliedVolatility,
      });

      onSelectLegsForStrategy(legs, `Cash-Secured Put (${row.formattedDate} $${row.strike}P)`);
    }
  };

  // Pinning Handlers
  const handleTogglePinContract = (row: DteComparisonRow) => {
    const contractId = `${strategy}-${row.contractSymbol || `${ticker}-${row.strike}-${row.expirationDate}`}`;
    setPinnedContracts((prev) => {
      const exists = prev.some((c) => c.id === contractId);
      if (exists) {
        return prev.filter((c) => c.id !== contractId);
      } else {
        const defaultFill = row.bid > 0 ? row.bid : (row.lastPrice > 0 ? row.lastPrice : 0.05);
        const newPinned: PinnedOptionContract = {
          id: contractId,
          strategy,
          symbol: ticker,
          contractSymbol: row.contractSymbol,
          expirationDate: row.expirationDate,
          formattedDate: row.formattedDate,
          dte: row.dte,
          strike: row.strike,
          bid: row.bid,
          ask: row.ask,
          mid: row.mid,
          spread: row.spread,
          lastPrice: row.lastPrice,
          volume: row.volume,
          openInterest: row.openInterest,
          impliedVolatility: row.impliedVolatility,
          delta: row.delta,
          inTheMoney: row.inTheMoney,
          customFillPrice: defaultFill,
          priceMode: "BID",
        };
        return [...prev, newPinned];
      }
    });
  };

  const handleUpdateContractPrice = (id: string, price: number, mode: "BID" | "MID" | "CUSTOM") => {
    setPinnedContracts((prev) =>
      prev.map((c) => (c.id === id ? { ...c, customFillPrice: price, priceMode: mode } : c))
    );
  };

  const handleSetAllPricesMode = (mode: "BID" | "MID") => {
    setPinnedContracts((prev) =>
      prev.map((c) => ({
        ...c,
        customFillPrice: mode === "MID" ? c.mid : c.bid,
        priceMode: mode,
      }))
    );
  };

  const handleRemovePinned = (id: string) => {
    setPinnedContracts((prev) => prev.filter((c) => c.id !== id));
  };

  const handleClearAllPinned = () => {
    setPinnedContracts([]);
  };

  return (
    <div className="space-y-6">
      {/* Control Card */}
      <div className="bg-[#0b1320] border border-[#17253b] rounded-xl p-5 shadow-xl">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-[#17253b]">
          {/* Strategy Toggle */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-mono font-bold text-slate-400 uppercase tracking-wider mr-1 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-emerald-400" />
              Strategy:
            </span>
            <div className="inline-flex rounded-lg bg-[#070d17] p-1 border border-[#1b2b42]">
              <button
                onClick={() => setStrategy("COVERED_CALL")}
                className={`px-3 py-1.5 rounded-md text-xs font-mono font-bold transition-all ${
                  strategy === "COVERED_CALL"
                    ? "bg-emerald-500 text-slate-950 shadow-sm"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                Covered Call (Sell Call)
              </button>
              <button
                onClick={() => setStrategy("CASH_SECURED_PUT")}
                className={`px-3 py-1.5 rounded-md text-xs font-mono font-bold transition-all ${
                  strategy === "CASH_SECURED_PUT"
                    ? "bg-emerald-500 text-slate-950 shadow-sm"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                Cash-Secured Put (Sell Put)
              </button>
            </div>

            {/* DTE Horizon Limit */}
            <div className="flex items-center gap-1.5 ml-0 sm:ml-4 text-xs font-mono">
              <span className="text-slate-400">Expirations:</span>
              {[5, 10, 15].map((cnt) => (
                <button
                  key={cnt}
                  onClick={() => setDteLimit(cnt)}
                  className={`px-2 py-1 rounded text-xs font-mono font-bold border ${
                    dteLimit === cnt
                      ? "bg-cyan-500/20 text-cyan-300 border-cyan-500/50"
                      : "bg-[#070d17] text-slate-400 border-[#1a2b40] hover:text-slate-200"
                  }`}
                >
                  {cnt} DTEs
                </button>
              ))}
            </div>
          </div>

          {/* Quick Refresh & Stock Quote Pill */}
          <div className="flex items-center gap-3">
            <div className="px-3 py-1.5 rounded-lg bg-[#08101d] border border-[#1b2c45] text-xs font-mono flex items-center gap-2">
              <span className="text-slate-400">Underlying:</span>
              <span className="text-white font-bold">{ticker}</span>
              <span className="text-emerald-400 font-bold">${currentPrice.toFixed(2)}</span>
            </div>

            <button
              onClick={() => loadComparison(currentStrike, strategy, dteLimit)}
              disabled={isLoading}
              title="Refresh DTE Data"
              className="p-2 rounded-lg bg-[#08101d] border border-[#1b2c45] text-slate-300 hover:text-emerald-400 hover:border-emerald-500/40 transition-all disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>

        {/* Strike Selection Bar & Position Settings */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 mt-4 pt-1 items-center">
          {/* Strike Selector */}
          <div className="md:col-span-5 flex flex-col gap-1.5">
            <label className="text-xs font-mono text-slate-300 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                Selected Strike Price:
              </span>
              <span className="text-cyan-400 font-bold">${currentStrike.toFixed(2)}</span>
            </label>

            <div className="flex items-center gap-2">
              <button
                onClick={() => handleStepStrike(-1)}
                className="px-2.5 py-1.5 rounded bg-[#070d17] border border-[#1a2c42] text-slate-300 hover:text-white hover:border-cyan-500 text-xs font-mono font-bold"
                title="Previous lower strike"
              >
                -
              </button>

              <div className="relative flex-1">
                <select
                  value={currentStrike}
                  onChange={(e) => handleStrikeChange(Number(e.target.value))}
                  className="w-full bg-[#070d17] border border-[#1a2c42] rounded-lg px-3 py-1.5 text-xs font-mono font-bold text-white focus:outline-none focus:border-cyan-400 appearance-none cursor-pointer"
                >
                  {availableStrikes.map((k) => {
                    const diff = k - currentPrice;
                    const diffPct = ((diff / currentPrice) * 100).toFixed(1);
                    const tag =
                      Math.abs(diff) < 0.5
                        ? "ATM"
                        : diff > 0
                        ? `+${diffPct}% OTM`
                        : `${diffPct}% ITM`;
                    return (
                      <option key={k} value={k}>
                        ${k.toFixed(2)} ({tag})
                      </option>
                    );
                  })}
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>

              <button
                onClick={() => handleStepStrike(1)}
                className="px-2.5 py-1.5 rounded bg-[#070d17] border border-[#1a2c42] text-slate-300 hover:text-white hover:border-cyan-500 text-xs font-mono font-bold"
                title="Next higher strike"
              >
                +
              </button>
            </div>

            {/* Quick Strike Chips */}
            <div className="flex items-center gap-1.5 mt-1 overflow-x-auto py-0.5">
              <button
                onClick={() => handleStrikeChange(atmStrike)}
                className={`px-2 py-0.5 rounded text-[11px] font-mono border transition-all ${
                  Math.abs(currentStrike - atmStrike) < 0.01
                    ? "bg-cyan-500/20 text-cyan-300 border-cyan-400 font-bold"
                    : "bg-[#08101d] text-slate-400 border-[#1a2c42] hover:text-slate-200"
                }`}
              >
                ATM (${atmStrike.toFixed(1)})
              </button>

              {availableStrikes
                .filter((k) => k > currentPrice)
                .slice(0, 3)
                .map((k, idx) => (
                  <button
                    key={k}
                    onClick={() => handleStrikeChange(k)}
                    className={`px-2 py-0.5 rounded text-[11px] font-mono border transition-all ${
                      Math.abs(currentStrike - k) < 0.01
                        ? "bg-emerald-500/20 text-emerald-300 border-emerald-400 font-bold"
                        : "bg-[#08101d] text-slate-400 border-[#1a2c42] hover:text-slate-200"
                    }`}
                  >
                    +{idx + 1} OTM (${k.toFixed(1)})
                  </button>
                ))}
            </div>
          </div>

          {/* Position Multiplier / Contracts */}
          <div className="md:col-span-3 flex flex-col gap-1.5">
            <label className="text-xs font-mono text-slate-300 flex items-center justify-between">
              <span>Position Size:</span>
              <span className="text-slate-400 font-mono">
                {contractCount} {contractCount === 1 ? "Contract" : "Contracts"} (
                {contractCount * 100} shares)
              </span>
            </label>
            <div className="flex items-center gap-1.5">
              {[1, 2, 5, 10].map((cnt) => (
                <button
                  key={cnt}
                  onClick={() => setContractCount(cnt)}
                  className={`flex-1 py-1.5 rounded text-xs font-mono font-bold border transition-all ${
                    contractCount === cnt
                      ? "bg-emerald-500/20 text-emerald-300 border-emerald-400"
                      : "bg-[#070d17] text-slate-400 border-[#1a2c42] hover:text-slate-200"
                  }`}
                >
                  {cnt}x
                </button>
              ))}
            </div>
          </div>

          {/* Cost Basis (Covered Call) or Cash Basis (Put) */}
          <div className="md:col-span-4 flex flex-col gap-1.5">
            {strategy === "COVERED_CALL" ? (
              <>
                <label className="text-xs font-mono text-slate-300 flex items-center justify-between">
                  <span>Stock Cost Basis:</span>
                  <span className="text-slate-400 text-[11px]">
                    {isCustomCostBasis ? "Custom Basis" : "Market Price"}
                  </span>
                </label>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500 text-xs font-mono">
                      $
                    </span>
                    <input
                      type="number"
                      step="0.05"
                      value={costBasis}
                      onChange={(e) => {
                        setCostBasis(Number(e.target.value));
                        setIsCustomCostBasis(true);
                      }}
                      className="w-full bg-[#070d17] border border-[#1a2c42] rounded-lg pl-6 pr-3 py-1.5 text-xs font-mono font-bold text-white focus:outline-none focus:border-emerald-400"
                    />
                  </div>
                  {isCustomCostBasis && (
                    <button
                      onClick={() => {
                        setCostBasis(currentPrice);
                        setIsCustomCostBasis(false);
                      }}
                      className="px-2 py-1.5 rounded text-[11px] font-mono text-slate-400 hover:text-white bg-[#070d17] border border-[#1a2c42]"
                      title="Reset to current market price"
                    >
                      Reset
                    </button>
                  )}
                </div>
              </>
            ) : (
              <>
                <label className="text-xs font-mono text-slate-300 flex items-center justify-between">
                  <span>Cash Collateral Required:</span>
                  <span className="text-emerald-400 font-bold">
                    ${(currentStrike * contractCount * 100).toLocaleString()}
                  </span>
                </label>
                <div className="px-3 py-1.5 rounded-lg bg-[#070d17] border border-[#1a2c42] text-xs font-mono text-slate-400 flex items-center justify-between">
                  <span>100% Cash-Secured:</span>
                  <span className="text-slate-200">
                    ${currentStrike.toFixed(2)} × {contractCount * 100} shs
                  </span>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* STATS SUMMARY HIGHLIGHTS */}
      {processedRows.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Sweet Spot (Optimal Velocity) */}
          <div className="bg-[#0b1320] border border-emerald-500/30 rounded-xl p-4 shadow-lg relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full blur-xl pointer-events-none" />
            <div className="flex items-center justify-between text-xs font-mono text-slate-400 mb-2">
              <span className="flex items-center gap-1.5 text-emerald-400 font-bold">
                <Flame className="w-4 h-4 text-emerald-400" />
                Sweet Spot Velocity
              </span>
              <span className="px-1.5 py-0.5 rounded text-[10px] bg-emerald-500/20 text-emerald-300 font-bold">
                {sweetSpotRow?.dte} DTE
              </span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-mono font-black text-white">
                {sweetSpotRow?.premiumAnnualizedApr.toFixed(1)}%
              </span>
              <span className="text-xs font-mono text-slate-400">APR</span>
            </div>
            <div className="mt-2 text-[11px] font-mono text-slate-400 flex items-center justify-between border-t border-[#17253b] pt-2">
              <span>{sweetSpotRow?.formattedDate} Exp</span>
              <span className="text-emerald-300 font-bold">
                Bid: ${sweetSpotRow?.bid.toFixed(2)} (${sweetSpotRow?.premiumCollected.toFixed(0)})
              </span>
            </div>
          </div>

          {/* Card 2: Highest Annualized APR */}
          <div className="bg-[#0b1320] border border-cyan-500/30 rounded-xl p-4 shadow-lg relative overflow-hidden">
            <div className="flex items-center justify-between text-xs font-mono text-slate-400 mb-2">
              <span className="flex items-center gap-1.5 text-cyan-400 font-bold">
                <Zap className="w-4 h-4 text-cyan-400" />
                Peak Annualized APR
              </span>
              <span className="px-1.5 py-0.5 rounded text-[10px] bg-cyan-500/20 text-cyan-300 font-bold">
                {highestAprRow?.dte} DTE
              </span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-mono font-black text-white">
                {highestAprRow?.premiumAnnualizedApr.toFixed(1)}%
              </span>
              <span className="text-xs font-mono text-cyan-300 font-bold">
                ({highestAprRow?.premiumYieldPercent.toFixed(1)}% raw)
              </span>
            </div>
            <div className="mt-2 text-[11px] font-mono text-slate-400 flex items-center justify-between border-t border-[#17253b] pt-2">
              <span>{highestAprRow?.formattedDate} Exp</span>
              <span className="text-cyan-300 font-bold">
                Bid: ${highestAprRow?.bid.toFixed(2)}
              </span>
            </div>
          </div>

          {/* Card 3: Max Dollar Premium */}
          <div className="bg-[#0b1320] border border-purple-500/30 rounded-xl p-4 shadow-lg relative overflow-hidden">
            <div className="flex items-center justify-between text-xs font-mono text-slate-400 mb-2">
              <span className="flex items-center gap-1.5 text-purple-400 font-bold">
                <DollarSign className="w-4 h-4 text-purple-400" />
                Highest Total Premium
              </span>
              <span className="px-1.5 py-0.5 rounded text-[10px] bg-purple-500/20 text-purple-300 font-bold">
                {highestPremiumRow?.dte} DTE
              </span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-mono font-black text-white">
                ${highestPremiumRow?.premiumCollected.toLocaleString()}
              </span>
              <span className="text-xs font-mono text-purple-300">
                (${highestPremiumRow?.bid.toFixed(2)}/sh)
              </span>
            </div>
            <div className="mt-2 text-[11px] font-mono text-slate-400 flex items-center justify-between border-t border-[#17253b] pt-2">
              <span>{highestPremiumRow?.formattedDate} Exp</span>
              <span className="text-purple-300 font-bold">
                {highestPremiumRow?.premiumAnnualizedApr.toFixed(1)}% APR
              </span>
            </div>
          </div>

          {/* Card 4: Strategy Basis & Protection */}
          <div className="bg-[#0b1320] border border-[#17253b] rounded-xl p-4 shadow-lg">
            <div className="flex items-center justify-between text-xs font-mono text-slate-400 mb-2">
              <span className="flex items-center gap-1.5 text-amber-400 font-bold">
                <ShieldAlert className="w-4 h-4 text-amber-400" />
                {strategy === "COVERED_CALL" ? "Downside Cushion" : "Collateral Basis"}
              </span>
              <span className="text-[11px] text-slate-400 font-bold">
                ${currentStrike.toFixed(2)} Strike
              </span>
            </div>
            <div className="flex items-baseline gap-2">
              {strategy === "COVERED_CALL" ? (
                <>
                  <span className="text-2xl font-mono font-black text-white">
                    {sweetSpotRow?.downsideBufferPercent.toFixed(1)}%
                  </span>
                  <span className="text-xs font-mono text-slate-400">
                    (BE: ${sweetSpotRow?.breakEven.toFixed(2)})
                  </span>
                </>
              ) : (
                <>
                  <span className="text-2xl font-mono font-black text-white">
                    ${(currentStrike * contractCount * 100).toLocaleString()}
                  </span>
                  <span className="text-xs font-mono text-slate-400">Cash</span>
                </>
              )}
            </div>
            <div className="mt-2 text-[11px] font-mono text-slate-400 flex items-center justify-between border-t border-[#17253b] pt-2">
              <span>Contracts: {contractCount}</span>
              <span className="text-slate-300">
                {strategy === "COVERED_CALL"
                  ? `Outlay: $${sweetSpotRow?.capitalRequired.toLocaleString()}`
                  : `BE: $${sweetSpotRow?.breakEven.toFixed(2)}`}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* INTERACTIVE APR & YIELD CURVE CHART */}
      {processedRows.length > 0 && (
        <div className="bg-[#0a101a] border border-[#172436] rounded-xl p-5 shadow-lg">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-3 border-b border-[#172436]">
            <div>
              <h3 className="text-sm font-mono font-bold text-white flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-emerald-400" />
                Annualized APR % Curve Across Expirations (DTE)
              </h3>
              <p className="text-xs font-mono text-slate-400 mt-0.5">
                Evaluates decay velocity: steeper curve indicates higher return per day held for ${currentStrike.toFixed(2)}{" "}
                {strategy === "COVERED_CALL" ? "Calls" : "Puts"}
              </p>
            </div>

            <div className="flex items-center gap-3 text-xs font-mono">
              <span className="flex items-center gap-1.5 text-emerald-400">
                <span className="w-2.5 h-0.5 bg-emerald-400 rounded" />
                Annualized APR %
              </span>
              <span className="flex items-center gap-1.5 text-cyan-400">
                <span className="w-2.5 h-0.5 bg-cyan-400 rounded" />
                Max APR %
              </span>
              <span className="flex items-center gap-1.5 text-purple-400">
                <span className="w-2.5 h-0.5 bg-purple-400 rounded" />
                Raw Yield %
              </span>
            </div>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={processedRows}
                margin={{ top: 10, right: 20, left: 0, bottom: 20 }}
              >
                <CartesianGrid stroke="#152233" strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="dte"
                  stroke="#475569"
                  tick={{ fill: "#94a3b8", fontSize: 11, fontFamily: "monospace" }}
                  tickFormatter={(val) => `${val}d`}
                  label={{
                    value: "Days to Expiration (DTE)",
                    position: "insideBottom",
                    offset: -10,
                    fill: "#64748b",
                    fontSize: 11,
                    fontFamily: "monospace",
                  }}
                />
                <YAxis
                  yAxisId="left"
                  stroke="#475569"
                  tick={{ fill: "#94a3b8", fontSize: 11, fontFamily: "monospace" }}
                  tickFormatter={(val) => `${val}%`}
                  domain={["auto", "auto"]}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  stroke="#475569"
                  tick={{ fill: "#c084fc", fontSize: 11, fontFamily: "monospace" }}
                  tickFormatter={(val) => `${val}%`}
                  domain={["auto", "auto"]}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload || !payload.length) return null;
                    const r = payload[0].payload as DteComparisonRow;
                    return (
                      <div className="bg-[#0b1320] border border-[#1e3049] rounded-lg p-3 shadow-2xl font-mono text-xs text-white space-y-1.5 min-w-[220px]">
                        <div className="font-bold text-slate-200 border-b border-[#1e3049] pb-1 flex justify-between">
                          <span>{r.formattedDate} ({r.dte} DTE)</span>
                          <span className="text-cyan-400">${r.strike} Strike</span>
                        </div>
                        <div className="flex justify-between text-slate-300">
                          <span>Bid Price:</span>
                          <span className="text-emerald-400 font-bold">${r.bid.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-slate-300">
                          <span>Ask / Mid:</span>
                          <span>${r.ask.toFixed(2)} / ${r.mid.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-slate-300">
                          <span>Premium Collected:</span>
                          <span className="text-emerald-300 font-bold">${r.premiumCollected.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-slate-300">
                          <span>Raw Yield %:</span>
                          <span className="text-purple-300 font-bold">{r.premiumYieldPercent.toFixed(2)}%</span>
                        </div>
                        <div className="flex justify-between text-emerald-400 font-bold border-t border-[#1e3049] pt-1">
                          <span>Annualized APR:</span>
                          <span>{r.premiumAnnualizedApr.toFixed(1)}%</span>
                        </div>
                        <div className="flex justify-between text-cyan-300">
                          <span>Max Return / APR:</span>
                          <span>{r.maxReturnPercent.toFixed(1)}% / {r.maxAnnualizedApr.toFixed(1)}%</span>
                        </div>
                        <div className="flex justify-between text-slate-400 text-[10px]">
                          <span>Breakeven:</span>
                          <span>${r.breakEven.toFixed(2)}</span>
                        </div>
                      </div>
                    );
                  }}
                />
                {highestAprRow && (
                  <ReferenceLine
                    yAxisId="left"
                    x={highestAprRow.dte}
                    stroke="#10b981"
                    strokeDasharray="4 4"
                    label={{
                      value: `Peak ${highestAprRow.premiumAnnualizedApr.toFixed(0)}%`,
                      fill: "#10b981",
                      fontSize: 10,
                      position: "top",
                      fontFamily: "monospace",
                    }}
                  />
                )}
                <Bar
                  yAxisId="right"
                  dataKey="premiumYieldPercent"
                  fill="#9333ea"
                  opacity={0.3}
                  radius={[3, 3, 0, 0]}
                  name="Raw Yield %"
                />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="premiumAnnualizedApr"
                  stroke="#10b981"
                  strokeWidth={2.5}
                  dot={{ r: 4, fill: "#10b981" }}
                  activeDot={{ r: 6, fill: "#34d399", stroke: "#064e3b" }}
                  name="Annualized APR %"
                />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="maxAnnualizedApr"
                  stroke="#06b6d4"
                  strokeWidth={1.5}
                  strokeDasharray="3 3"
                  dot={{ r: 3, fill: "#06b6d4" }}
                  name="Max Annualized APR %"
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* COMPARATIVE RANKING TABLE */}
      <div className="bg-[#0a101a] border border-[#172436] rounded-xl overflow-hidden shadow-xl">
        <div className="bg-[#0c1421] border-b border-[#172436] px-5 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs font-mono">
          <div className="flex items-center gap-2">
            <span className="font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              {strategy === "COVERED_CALL" ? "Covered Call" : "Cash-Secured Put"} DTE Ranking (Strike: ${currentStrike.toFixed(2)})
            </span>
            <span className="text-slate-400">({sortedRows.length} Expirations)</span>
          </div>

          {/* Right controls: Pinned Jump button & Sort Controls */}
          <div className="flex items-center gap-3">
            {pinnedContracts.length > 0 && (
              <button
                onClick={() => {
                  const el = document.getElementById("pinned-comparison-bench");
                  el?.scrollIntoView({ behavior: "smooth" });
                }}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/30 text-xs font-mono font-bold transition-all shadow-sm"
                title="Scroll down to Pinned Comparison Bench"
              >
                <BookmarkCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>Bench ({pinnedContracts.length}) ↓</span>
              </button>
            )}

            <div className="flex items-center gap-2">
              <span className="text-slate-400">Sort by:</span>
              <select
                value={sortBy}
                onChange={(e: any) => setSortBy(e.target.value)}
                className="bg-[#070d17] border border-[#1a2c42] rounded px-2.5 py-1 text-xs font-mono text-slate-300 focus:outline-none focus:border-emerald-400"
              >
                <option value="dte">DTE (Chronological)</option>
                <option value="apr">Annualized APR % (Highest First)</option>
                <option value="premium">Premium Collected ($)</option>
                <option value="maxReturn">Max Annualized APR %</option>
                <option value="cushion">Downside Cushion %</option>
              </select>
            </div>
          </div>
        </div>

        {/* Loading / Error States */}
        {isLoading && (
          <div className="py-16 text-center text-xs font-mono text-slate-400 flex flex-col items-center justify-center gap-2">
            <RefreshCw className="w-5 h-5 text-emerald-400 animate-spin" />
            <span>Analyzing option chain across 10 closest expiration dates...</span>
          </div>
        )}

        {error && !isLoading && (
          <div className="p-6 text-center text-xs font-mono text-rose-400">
            <span>{error}</span>
          </div>
        )}

        {/* Main Table */}
        {!isLoading && !error && sortedRows.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-xs font-mono border-collapse select-none">
              <thead className="bg-[#0c1421] text-[11px] text-slate-400 border-b border-[#19273a]">
                <tr>
                  <th className="py-3 px-3 text-center">Rank</th>
                  <th className="py-3 px-3 text-left">Expiration</th>
                  <th className="py-3 px-3 text-center">DTE</th>
                  <th className="py-3 px-3 text-right bg-emerald-950/20 text-emerald-300 font-bold">
                    Bid Price
                  </th>
                  <th className="py-3 px-3 text-right">Ask / Mid</th>
                  <th className="py-3 px-3 text-right">Spread</th>
                  <th className="py-3 px-3 text-right">Premium ($)</th>
                  <th className="py-3 px-3 text-right">Raw Yield %</th>
                  <th className="py-3 px-3 text-right bg-emerald-950/30 text-emerald-300 font-black">
                    Annualized APR %
                  </th>
                  <th className="py-3 px-3 text-right">Max Return %</th>
                  <th className="py-3 px-3 text-right">Max APR %</th>
                  <th className="py-3 px-3 text-right">Downside Cushion</th>
                  <th className="py-3 px-3 text-right">Breakeven</th>
                  <th className="py-3 px-3 text-center">Pin</th>
                  <th className="py-3 px-3 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#152233]">
                {sortedRows.map((row, idx) => {
                  const isTopApr = highestAprRow && row.expirationDate === highestAprRow.expirationDate;
                  const isSweetSpot = sweetSpotRow && row.expirationDate === sweetSpotRow.expirationDate;
                  const isTopPremium = highestPremiumRow && row.expirationDate === highestPremiumRow.expirationDate;
                  const contractId = `${strategy}-${row.contractSymbol || `${ticker}-${row.strike}-${row.expirationDate}`}`;
                  const isPinned = pinnedContracts.some((c) => c.id === contractId);

                  return (
                    <tr
                      key={row.expirationDate}
                      className={`hover:bg-[#0e1929] transition-colors ${
                        isSweetSpot ? "bg-emerald-500/[0.04]" : ""
                      } ${isPinned ? "bg-emerald-950/20" : ""}`}
                    >
                      {/* Rank */}
                      <td className="py-2.5 px-3 text-center font-bold">
                        {isTopApr ? (
                          <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-emerald-400 text-slate-950 text-[10px] font-black">
                            #1
                          </span>
                        ) : (
                          <span className="text-slate-500">#{idx + 1}</span>
                        )}
                      </td>

                      {/* Expiration Date */}
                      <td className="py-2.5 px-3 text-left font-bold text-white">
                        <div className="flex items-center gap-1.5">
                          <span>{row.formattedDate}</span>
                          {isSweetSpot && (
                            <span className="px-1 py-0.5 rounded text-[9px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold">
                              SWEET SPOT
                            </span>
                          )}
                          {isTopPremium && !isSweetSpot && (
                            <span className="px-1 py-0.5 rounded text-[9px] bg-purple-500/20 text-purple-300 border border-purple-500/30 font-bold">
                              MAX $
                            </span>
                          )}
                        </div>
                      </td>

                      {/* DTE */}
                      <td className="py-2.5 px-3 text-center">
                        <span className="px-1.5 py-0.5 rounded bg-[#101b2b] text-slate-300 border border-[#1a2d47] font-bold">
                          {row.dte}d
                        </span>
                      </td>

                      {/* Bid Price (User highlighted requirement) */}
                      <td className="py-2.5 px-3 text-right bg-emerald-950/20 font-black text-emerald-400 text-sm">
                        ${row.bid.toFixed(2)}
                      </td>

                      {/* Ask / Mid */}
                      <td className="py-2.5 px-3 text-right text-slate-400">
                        ${row.ask.toFixed(2)}{" "}
                        <span className="text-slate-500 text-[10px]">(${row.mid.toFixed(2)})</span>
                      </td>

                      {/* Spread */}
                      <td className="py-2.5 px-3 text-right">
                        <span
                          className={`text-[11px] ${
                            row.spread <= 0.1
                              ? "text-emerald-400"
                              : row.spread <= 0.25
                              ? "text-slate-400"
                              : "text-amber-400"
                          }`}
                        >
                          ${row.spread.toFixed(2)}
                        </span>
                      </td>

                      {/* Premium Collected ($) */}
                      <td className="py-2.5 px-3 text-right font-bold text-slate-200">
                        ${row.premiumCollected.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                      </td>

                      {/* Raw Yield % */}
                      <td className="py-2.5 px-3 text-right text-purple-300 font-bold">
                        {row.premiumYieldPercent.toFixed(2)}%
                      </td>

                      {/* Annualized APR % */}
                      <td className="py-2.5 px-3 text-right bg-emerald-950/30">
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
                      <td className="py-2.5 px-3 text-right text-cyan-300 font-bold">
                        {row.maxReturnPercent.toFixed(2)}%
                      </td>

                      {/* Max APR % */}
                      <td className="py-2.5 px-3 text-right text-cyan-400 font-black">
                        {row.maxAnnualizedApr.toFixed(1)}%
                      </td>

                      {/* Downside Cushion % */}
                      <td className="py-2.5 px-3 text-right">
                        <span className="px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20 font-bold text-[11px]">
                          {row.downsideBufferPercent.toFixed(1)}%
                        </span>
                      </td>

                      {/* Breakeven */}
                      <td className="py-2.5 px-3 text-right text-slate-300 font-mono">
                        ${row.breakEven.toFixed(2)}
                      </td>

                      {/* Pin to Comparison Bench Button */}
                      <td className="py-2.5 px-3 text-center">
                        <button
                          onClick={() => handleTogglePinContract(row)}
                          className={`px-2 py-1 rounded text-[11px] font-mono font-bold transition-all flex items-center gap-1 mx-auto ${
                            isPinned
                              ? "bg-emerald-400 text-slate-950 font-black shadow-md border border-emerald-300"
                              : "bg-[#101b2b] hover:bg-emerald-500/20 text-slate-300 hover:text-emerald-300 border border-[#1a2d47] hover:border-emerald-500/40"
                          }`}
                          title={
                            isPinned
                              ? "Pinned to Comparison Bench below (click to unpin)"
                              : "Pin this contract to the Comparison Bench below across strikes/DTEs"
                          }
                        >
                          {isPinned ? <BookmarkCheck className="w-3.5 h-3.5 text-slate-950" /> : <Bookmark className="w-3.5 h-3.5" />}
                          <span>{isPinned ? "Pinned" : "+ Pin"}</span>
                        </button>
                      </td>

                      {/* Load in Builder Button */}
                      <td className="py-2.5 px-3 text-center">
                        <button
                          onClick={() => handleLoadInBuilder(row)}
                          className="px-2.5 py-1 rounded bg-emerald-500/20 hover:bg-emerald-500 text-emerald-300 hover:text-slate-950 border border-emerald-500/40 text-[11px] font-mono font-bold transition-all flex items-center gap-1 mx-auto"
                          title="Load this contract into Strategy Builder and Payoff Chart"
                        >
                          <span>Build</span>
                          <ArrowRight className="w-3 h-3" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* PINNED CONTRACTS COMPARISON BENCH */}
      <div id="pinned-comparison-bench">
        <PinnedComparisonBench
          ticker={ticker}
          currentPrice={currentPrice}
          pinnedContracts={pinnedContracts}
          costBasis={costBasis}
          isCustomCostBasis={isCustomCostBasis}
          contractCount={contractCount}
          onUpdateCostBasis={(newBasis) => {
            setCostBasis(newBasis);
            setIsCustomCostBasis(true);
          }}
          onResetCostBasis={() => {
            setCostBasis(currentPrice);
            setIsCustomCostBasis(false);
          }}
          onUpdateContractPrice={handleUpdateContractPrice}
          onSetAllPricesMode={handleSetAllPricesMode}
          onRemoveContract={handleRemovePinned}
          onClearAll={handleClearAllPinned}
          onSelectLegsForStrategy={onSelectLegsForStrategy}
        />
      </div>

      {/* FOOTER EXPLANATION & FORMULAS CARD */}
      <div className="bg-[#0b1320] border border-[#17253b] rounded-xl p-4 text-xs font-mono text-slate-400 space-y-2">
        <div className="flex items-center gap-2 font-bold text-slate-300">
          <Info className="w-4 h-4 text-cyan-400" />
          <span>Understanding DTE Velocity & Return Math</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
          <div className="bg-[#070d17] p-3 rounded-lg border border-[#152336] space-y-1">
            <span className="text-emerald-400 font-bold">Annualized Return (APR) Formula:</span>
            <p className="text-[11px] text-slate-400">
              <code className="text-slate-200">APR = (Premium / Capital Basis) × (365 / DTE) × 100</code>
            </p>
            <p className="text-[11px] text-slate-500">
              Shorter DTE options exhibit faster theta decay per day, resulting in a higher annualized rate of return, while longer DTE options capture larger total cash premiums.
            </p>
          </div>
          <div className="bg-[#070d17] p-3 rounded-lg border border-[#152336] space-y-1">
            <span className="text-cyan-400 font-bold">Max Return (Assignment at Strike):</span>
            <p className="text-[11px] text-slate-400">
              <code className="text-slate-200">
                {strategy === "COVERED_CALL"
                  ? "Max Return = ((Strike - Cost Basis + Bid) / Cost Basis) × 100"
                  : "Max Return = (Bid / Strike) × 100"}
              </code>
            </p>
            <p className="text-[11px] text-slate-500">
              Reflects total profit if the position is held until expiration and the option finishes at or in the money.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
