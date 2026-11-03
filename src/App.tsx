/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from "react";
import {
  OptionChainData,
  OptionContract,
  StrategyLeg,
  OptionType,
  OrderAction,
  GreekBenchContract,
  DteComparisonRow,
  DteStrategyType,
} from "./types";
import { fetchOptionsData } from "./services/optionsService";
import { calculateStrategyMetrics, calculateKeyLevels } from "./utils/optionsMath";
import { Header } from "./components/Header";
import { Sidebar } from "./components/Sidebar";
import { MetricsCards } from "./components/MetricsCards";
import { OptionsChainTable } from "./components/OptionsChainTable";
import { StrategyBuilder } from "./components/StrategyBuilder";
import { PayoffChart } from "./components/PayoffChart";
import { EarlyExitRollCalculator } from "./components/EarlyExitRollCalculator";
import { PythonStreamlitModal } from "./components/PythonStreamlitModal";
import { DteComparisonView } from "./components/DteComparisonView";
import { GreekBenchView } from "./components/GreekBenchView";
import {
  Table,
  TrendingUp,
  LineChart,
  Shield,
  Code2,
  AlertCircle,
  Sparkles,
  ChevronRight,
  HelpCircle,
  Layers,
  CalendarRange,
  Scale,
} from "lucide-react";

export default function App() {
  const [ticker, setTicker] = useState("NVDA");
  const [data, setData] = useState<OptionChainData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedExpiration, setSelectedExpiration] = useState<number>(0);
  const [strikeFilter, setStrikeFilter] = useState<string>("ATM_15");
  const [activeTab, setActiveTab] = useState<
    "CHAIN" | "DTE_MATRIX" | "GREEK_BENCH" | "STRATEGY" | "METRICS" | "STREAMLIT"
  >("CHAIN");
  const [compareStrike, setCompareStrike] = useState<number | undefined>(undefined);
  const [compareStrategy, setCompareStrategy] = useState<"COVERED_CALL" | "CASH_SECURED_PUT">("COVERED_CALL");

  const [selectedLegs, setSelectedLegs] = useState<StrategyLeg[]>([]);
  const [activePreset, setActivePreset] = useState<string | null>(null);
  const [isFavorite, setIsFavorite] = useState(false);
  const [showStreamlitModal, setShowStreamlitModal] = useState(false);

  // Persistent Greek & Capital Efficiency Bench State (multi-ticker enabled)
  const [greekBenchContracts, setGreekBenchContracts] = useState<GreekBenchContract[]>(() => {
    try {
      const saved = localStorage.getItem("ais_greek_capital_efficiency_bench");
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem("ais_greek_capital_efficiency_bench", JSON.stringify(greekBenchContracts));
    } catch (e) {
      // ignore
    }
  }, [greekBenchContracts]);

  // Load options data
  const loadData = async (targetTicker: string, expDate?: number) => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetchOptionsData(targetTicker, expDate);
      setData(res);
      setSelectedExpiration(res.selectedExpiration);

      // If no strategy legs yet, populate with a default single ATM Call
      if (selectedLegs.length === 0 && res.options?.[0]) {
        const currentPrice = res.quote.regularMarketPrice;
        const calls = res.options[0].calls;
        if (calls.length > 0) {
          const atmCall = [...calls].sort(
            (a, b) => Math.abs(a.strike - currentPrice) - Math.abs(b.strike - currentPrice)
          )[0];
          if (atmCall) {
            setSelectedLegs([
              {
                id: `leg-${Date.now()}-1`,
                type: "CALL",
                strike: atmCall.strike,
                action: "BUY",
                quantity: 1,
                entryPrice: atmCall.ask > 0 ? atmCall.ask : atmCall.lastPrice,
                delta: atmCall.delta,
                contractSymbol: atmCall.contractSymbol,
                expirationDate: res.selectedExpiration,
              },
            ]);
          }
        }
      }

      // If Greek bench is empty on first startup, seed 2 liquid options from the ticker
      const hasSeeded = localStorage.getItem("ais_greek_bench_seeded");
      if (!hasSeeded && greekBenchContracts.length === 0 && res.options?.[0]) {
        const currentP = res.quote.regularMarketPrice;
        const calls = res.options[0].calls;
        if (calls.length >= 2) {
          const sorted = [...calls].sort(
            (a, b) => Math.abs(a.strike - currentP) - Math.abs(b.strike - currentP)
          );
          const c1 = sorted[0];
          const c2 = sorted[1];
          const seedItems: GreekBenchContract[] = [c1, c2].filter(Boolean).map((c, idx) => ({
            id: `gb-${targetTicker}-${c.contractSymbol}-BUY-${idx}`,
            ticker: targetTicker,
            underlyingPriceAtPin: currentP,
            contractSymbol: c.contractSymbol,
            optionType: "CALL" as const,
            action: "BUY" as const,
            strike: c.strike,
            expirationDate: res.selectedExpiration,
            formattedDate: new Date(res.selectedExpiration * 1000).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "2-digit",
            }),
            dte: res.dte,
            bid: c.bid,
            ask: c.ask,
            mid: Number(((c.bid + c.ask) / 2).toFixed(2)),
            lastPrice: c.lastPrice,
            impliedVolatility: c.impliedVolatility,
            delta: c.delta,
            gamma: c.gamma,
            theta: c.theta,
            vega: c.vega,
            inTheMoney: c.inTheMoney,
            quantity: 1,
            customFillPrice: c.ask > 0 ? c.ask : c.lastPrice,
            priceMode: "ASK" as const,
          }));
          if (seedItems.length > 0) {
            setGreekBenchContracts(seedItems);
            localStorage.setItem("ais_greek_bench_seeded", "true");
          }
        }
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || `Failed to load options for ${targetTicker}`);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData(ticker);
  }, [ticker]);

  // Handle changing expiration date
  const handleSelectExpiration = (timestamp: number) => {
    setSelectedExpiration(timestamp);
    loadData(ticker, timestamp);
  };

  // Extract current option chain contracts for selected expiration
  const currentOptionSet = useMemo(() => {
    if (!data || !data.options || data.options.length === 0) {
      return { calls: [], puts: [] };
    }
    return data.options[0];
  }, [data]);

  const currentPrice = data?.quote?.regularMarketPrice || 150.0;
  const dte = data?.dte || 30;

  // Key Gamma & Open Interest Levels
  const keyLevels = useMemo(() => {
    if (!currentOptionSet.calls.length && !currentOptionSet.puts.length) {
      return {
        callWallStrike: currentPrice,
        putWallStrike: currentPrice,
        maxPainStrike: currentPrice,
        totalCallVol: 0,
        totalPutVol: 0,
        putCallVolRatio: 1.0,
        totalCallOi: 0,
        totalPutOi: 0,
        putCallOiRatio: 1.0,
      };
    }
    return calculateKeyLevels(currentOptionSet.calls, currentOptionSet.puts, currentPrice);
  }, [currentOptionSet, currentPrice]);

  // Strategy Calculated Metrics
  const strategyMetrics = useMemo(() => {
    return calculateStrategyMetrics(selectedLegs, currentPrice, dte);
  }, [selectedLegs, currentPrice, dte]);

  // Average ATM Implied Volatility
  const atmIv = useMemo(() => {
    if (!currentOptionSet.calls.length) return 32.0;
    const atmCall = [...currentOptionSet.calls].sort(
      (a, b) => Math.abs(a.strike - currentPrice) - Math.abs(b.strike - currentPrice)
    )[0];
    return atmCall ? atmCall.impliedVolatility : 32.0;
  }, [currentOptionSet, currentPrice]);

  // Toggle contract in strategy from options table
  const handleToggleContract = (
    contract: OptionContract,
    type: OptionType,
    defaultAction: OrderAction
  ) => {
    const existingIndex = selectedLegs.findIndex((l) => l.contractSymbol === contract.contractSymbol);

    if (existingIndex >= 0) {
      // Remove it
      setSelectedLegs((prev) => prev.filter((_, i) => i !== existingIndex));
    } else {
      // Add it
      const price =
        defaultAction === "BUY"
          ? contract.ask > 0
            ? contract.ask
            : contract.lastPrice
          : contract.bid > 0
          ? contract.bid
          : contract.lastPrice;

      const newLeg: StrategyLeg = {
        id: `leg-${Date.now()}-${Math.random()}`,
        type,
        strike: contract.strike,
        action: defaultAction,
        quantity: 1,
        entryPrice: Number(price.toFixed(2)),
        delta: contract.delta,
        contractSymbol: contract.contractSymbol,
        expirationDate: selectedExpiration,
        impliedVolatility: contract.impliedVolatility,
      };
      setSelectedLegs((prev) => [...prev, newLeg]);
      setActivePreset(null);
    }
  };

  // Update Leg parameters (Quantity, Action, Price)
  const handleUpdateLeg = (index: number, updated: Partial<StrategyLeg>) => {
    setSelectedLegs((prev) =>
      prev.map((leg, i) => (i === index ? { ...leg, ...updated } : leg))
    );
  };

  // Remove Leg
  const handleRemoveLeg = (index: number) => {
    setSelectedLegs((prev) => prev.filter((_, i) => i !== index));
  };

  // Add 100 shares of underlying stock
  const handleAddStockLeg = () => {
    const stockLeg: StrategyLeg = {
      id: `stock-${Date.now()}`,
      type: "STOCK",
      strike: currentPrice,
      action: "BUY",
      quantity: 1, // 1 lot = 100 shares
      entryPrice: currentPrice,
      delta: 1.0,
      contractSymbol: `${ticker}_SHARES`,
      expirationDate: selectedExpiration,
    };
    setSelectedLegs((prev) => [stockLeg, ...prev]);
  };

  // Jump directly to DTE Strike Comparison
  const handleCompareStrike = (strike: number, type?: "CALL" | "PUT") => {
    setCompareStrike(strike);
    if (type === "PUT") {
      setCompareStrategy("CASH_SECURED_PUT");
    } else {
      setCompareStrategy("COVERED_CALL");
    }
    setActiveTab("DTE_MATRIX");
  };

  // Select legs from DTE comparison view and load into Strategy Builder
  const handleSelectLegsForStrategy = (legs: StrategyLeg[], presetName: string) => {
    setSelectedLegs(legs);
    setActivePreset(presetName);
    setActiveTab("STRATEGY");
  };

  // Greek Bench Handlers
  const handlePinToGreekBench = (
    contract: OptionContract,
    type: "CALL" | "PUT",
    action: OrderAction = "BUY",
    customTicker?: string,
    customDte?: number,
    customExpDate?: number
  ) => {
    const sym = customTicker || ticker;
    const currentP = data?.quote?.regularMarketPrice || 150.0;
    const expDate = customExpDate || selectedExpiration;
    const daysDte = customDte || dte;
    const id = `gb-${sym}-${contract.contractSymbol}-${action}`;

    setGreekBenchContracts((prev) => {
      const exists = prev.find((c) => c.contractSymbol === contract.contractSymbol);
      if (exists) {
        // Toggle off if already pinned
        return prev.filter((c) => c.contractSymbol !== contract.contractSymbol);
      }

      const defaultFill =
        action === "BUY"
          ? (contract.ask > 0 ? contract.ask : (contract.lastPrice > 0 ? contract.lastPrice : 0.05))
          : (contract.bid > 0 ? contract.bid : (contract.lastPrice > 0 ? contract.lastPrice : 0.05));

      const newContract: GreekBenchContract = {
        id,
        ticker: sym,
        underlyingPriceAtPin: currentP,
        contractSymbol: contract.contractSymbol,
        optionType: type,
        action,
        strike: contract.strike,
        expirationDate: expDate,
        formattedDate: new Date(expDate * 1000).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "2-digit",
        }),
        dte: daysDte,
        bid: contract.bid,
        ask: contract.ask,
        mid: Number(((contract.bid + contract.ask) / 2).toFixed(2)),
        lastPrice: contract.lastPrice,
        impliedVolatility: contract.impliedVolatility,
        delta: contract.delta,
        gamma: contract.gamma,
        theta: contract.theta,
        vega: contract.vega,
        inTheMoney: contract.inTheMoney,
        quantity: 1,
        customFillPrice: defaultFill,
        priceMode: action === "BUY" ? "ASK" : "BID",
      };

      return [newContract, ...prev];
    });
  };

  const isContractPinnedToGreekBench = (contractSymbol: string) => {
    return greekBenchContracts.some((c) => c.contractSymbol === contractSymbol);
  };

  const handleUpdateGreekBenchPrice = (
    id: string,
    price: number,
    mode: "BID" | "ASK" | "MID" | "CUSTOM"
  ) => {
    setGreekBenchContracts((prev) =>
      prev.map((c) => (c.id === id ? { ...c, customFillPrice: price, priceMode: mode } : c))
    );
  };

  const handleUpdateGreekBenchAction = (id: string, action: OrderAction) => {
    setGreekBenchContracts((prev) =>
      prev.map((c) => (c.id === id ? { ...c, action } : c))
    );
  };

  const handleUpdateGreekBenchQuantity = (id: string, quantity: number) => {
    setGreekBenchContracts((prev) =>
      prev.map((c) => (c.id === id ? { ...c, quantity: Math.max(1, quantity) } : c))
    );
  };

  const handleRemoveGreekBenchContract = (id: string) => {
    setGreekBenchContracts((prev) => prev.filter((c) => c.id !== id));
  };

  const handleClearGreekBench = () => {
    setGreekBenchContracts([]);
    try {
      localStorage.setItem("ais_greek_bench_seeded", "true");
    } catch {}
  };

  const handlePinDteRowToGreekBench = (
    row: DteComparisonRow,
    targetTicker: string,
    strat: DteStrategyType
  ) => {
    const isCall = strat === "COVERED_CALL";
    const optionContract: OptionContract = {
      contractSymbol: row.contractSymbol,
      strike: row.strike,
      currency: "USD",
      lastPrice: row.lastPrice,
      change: 0,
      percentChange: 0,
      volume: row.volume,
      openInterest: row.openInterest,
      bid: row.bid,
      ask: row.ask,
      impliedVolatility: row.impliedVolatility,
      inTheMoney: row.inTheMoney,
      delta: row.delta,
      gamma: row.gamma,
      theta: row.theta,
      vega: row.vega,
    };

    handlePinToGreekBench(
      optionContract,
      isCall ? "CALL" : "PUT",
      "BUY",
      targetTicker,
      row.dte,
      row.expirationDate
    );
  };

  // Apply Strategy Preset
  const handleApplyPreset = (presetId: string) => {
    setActivePreset(presetId);
    if (!data || !currentOptionSet.calls.length) return;

    const calls = [...currentOptionSet.calls].sort((a, b) => a.strike - b.strike);
    const puts = [...currentOptionSet.puts].sort((a, b) => a.strike - b.strike);

    const atmIndex = calls.findIndex(
      (c) =>
        Math.abs(c.strike - currentPrice) ===
        Math.min(...calls.map((x) => Math.abs(x.strike - currentPrice)))
    );
    const safeAtmIdx = atmIndex >= 0 ? atmIndex : 0;

    const atmCall = calls[safeAtmIdx];
    const atmPut = puts[safeAtmIdx] || puts[0];

    const makeLeg = (c: OptionContract, type: OptionType, action: OrderAction): StrategyLeg => ({
      id: `leg-${Date.now()}-${Math.random()}`,
      type,
      strike: c.strike,
      action,
      quantity: 1,
      entryPrice: action === "BUY" ? (c.ask > 0 ? c.ask : c.lastPrice) : (c.bid > 0 ? c.bid : c.lastPrice),
      delta: c.delta,
      contractSymbol: c.contractSymbol,
      expirationDate: selectedExpiration,
      impliedVolatility: c.impliedVolatility,
    });

    switch (presetId) {
      case "LONG_CALL":
        if (atmCall) setSelectedLegs([makeLeg(atmCall, "CALL", "BUY")]);
        break;
      case "LONG_PUT":
        if (atmPut) setSelectedLegs([makeLeg(atmPut, "PUT", "BUY")]);
        break;
      case "BULL_CALL_SPREAD": {
        const higherCall = calls[Math.min(calls.length - 1, safeAtmIdx + 2)];
        if (atmCall && higherCall) {
          setSelectedLegs([
            makeLeg(atmCall, "CALL", "BUY"),
            makeLeg(higherCall, "CALL", "SELL"),
          ]);
        }
        break;
      }
      case "BEAR_PUT_SPREAD": {
        const lowerPut = puts[Math.max(0, safeAtmIdx - 2)];
        if (atmPut && lowerPut) {
          setSelectedLegs([
            makeLeg(atmPut, "PUT", "BUY"),
            makeLeg(lowerPut, "PUT", "SELL"),
          ]);
        }
        break;
      }
      case "COVERED_CALL": {
        const otmCall = calls[Math.min(calls.length - 1, safeAtmIdx + 1)];
        if (otmCall) {
          const stockLeg: StrategyLeg = {
            id: `stock-${Date.now()}`,
            type: "STOCK",
            strike: currentPrice,
            action: "BUY",
            quantity: 1, // 1 lot = 100 shares
            entryPrice: currentPrice,
            delta: 1.0,
            contractSymbol: `${ticker}_SHARES`,
            expirationDate: selectedExpiration,
          };
          setSelectedLegs([stockLeg, makeLeg(otmCall, "CALL", "SELL")]);
        }
        break;
      }
      case "CASH_SECURED_PUT": {
        const otmPut = puts[Math.max(0, safeAtmIdx - 1)];
        if (otmPut) {
          setSelectedLegs([makeLeg(otmPut, "PUT", "SELL")]);
        }
        break;
      }
      case "STRADDLE": {
        if (atmCall && atmPut) {
          setSelectedLegs([
            makeLeg(atmCall, "CALL", "BUY"),
            makeLeg(atmPut, "PUT", "BUY"),
          ]);
        }
        break;
      }
      case "IRON_CONDOR": {
        const otmPutSell = puts[Math.max(0, safeAtmIdx - 1)];
        const otmPutBuy = puts[Math.max(0, safeAtmIdx - 3)];
        const otmCallSell = calls[Math.min(calls.length - 1, safeAtmIdx + 1)];
        const otmCallBuy = calls[Math.min(calls.length - 1, safeAtmIdx + 3)];
        if (otmPutSell && otmPutBuy && otmCallSell && otmCallBuy) {
          setSelectedLegs([
            makeLeg(otmPutBuy, "PUT", "BUY"),
            makeLeg(otmPutSell, "PUT", "SELL"),
            makeLeg(otmCallSell, "CALL", "SELL"),
            makeLeg(otmCallBuy, "CALL", "BUY"),
          ]);
        }
        break;
      }
    }
  };

  return (
    <div className="min-h-screen bg-[#080d14] text-slate-200 flex flex-col font-sans selection:bg-emerald-500/30">
      {/* Top Apex Navigation Bar */}
      {data && (
        <Header
          quote={data.quote}
          atmIv={atmIv}
          dte={dte}
          isFallback={data.isFallback}
          isLoading={isLoading}
          onRefresh={() => loadData(ticker, selectedExpiration)}
          onOpenStreamlitCode={() => setShowStreamlitModal(true)}
          isFavorite={isFavorite}
          onToggleFavorite={() => setIsFavorite(!isFavorite)}
        />
      )}

      {/* Main Terminal Workspace Layout */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* Left Sidebar */}
        <Sidebar
          currentTicker={ticker}
          onSelectTicker={(t) => setTicker(t)}
          expirationDates={data?.expirationDates || []}
          selectedExpiration={selectedExpiration}
          onSelectExpiration={handleSelectExpiration}
          strikeFilter={strikeFilter}
          onChangeStrikeFilter={(f) => setStrikeFilter(f)}
          onApplyPreset={handleApplyPreset}
          activePreset={activePreset}
        />

        {/* Center Main Area */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6 bg-[#070c13]">
          <div className="max-w-[1750px] mx-auto">
            {/* Error Message if Ticker Not Found */}
            {error && (
              <div className="mb-6 p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <div className="font-bold text-sm">Failed to retrieve options data</div>
                  <div className="text-xs text-rose-400 mt-1">{error}</div>
                  <div className="mt-3 flex items-center gap-2">
                    <span className="text-xs text-slate-400">Try popular liquid tickers:</span>
                    {["NVDA", "AAPL", "TSLA", "SPY", "MSFT"].map((sym) => (
                      <button
                        key={sym}
                        onClick={() => setTicker(sym)}
                        className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-xs font-mono font-bold text-white border border-slate-700"
                      >
                        {sym}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Metrics Cards Bar */}
            {data && (
              <MetricsCards
                quote={data.quote}
                dte={dte}
                atmIv={atmIv}
                callWall={keyLevels.callWallStrike}
                putWall={keyLevels.putWallStrike}
                maxPain={keyLevels.maxPainStrike}
                putCallRatio={keyLevels.putCallVolRatio}
                totalCallVol={keyLevels.totalCallVol}
                totalPutVol={keyLevels.totalPutVol}
              />
            )}

            {/* View Switcher Tabs */}
            <div className="flex items-center justify-between border-b border-[#172334] mb-4">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setActiveTab("CHAIN")}
                  className={`flex items-center gap-2 px-4 py-2.5 text-xs font-mono font-bold border-b-2 transition-all ${
                    activeTab === "CHAIN"
                      ? "border-emerald-400 text-emerald-300 bg-emerald-500/5"
                      : "border-transparent text-slate-400 hover:text-slate-200"
                  }`}
                >
                  <Table className="w-3.5 h-3.5" />
                  <span>Options Chain Table</span>
                </button>

                <button
                  onClick={() => setActiveTab("DTE_MATRIX")}
                  className={`flex items-center gap-2 px-4 py-2.5 text-xs font-mono font-bold border-b-2 transition-all ${
                    activeTab === "DTE_MATRIX"
                      ? "border-emerald-400 text-emerald-300 bg-emerald-500/5"
                      : "border-transparent text-slate-400 hover:text-slate-200"
                  }`}
                >
                  <CalendarRange className="w-3.5 h-3.5" />
                  <span>DTE Strike Matrix</span>
                  <span className="px-1.5 py-0.2 rounded text-[9px] bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30">
                    COMPARE
                  </span>
                </button>

                <button
                  onClick={() => setActiveTab("GREEK_BENCH")}
                  className={`flex items-center gap-2 px-4 py-2.5 text-xs font-mono font-bold border-b-2 transition-all ${
                    activeTab === "GREEK_BENCH"
                      ? "border-cyan-400 text-cyan-300 bg-cyan-500/5"
                      : "border-transparent text-slate-400 hover:text-slate-200"
                  }`}
                >
                  <Scale className="w-3.5 h-3.5" />
                  <span>Greek & Capital Bench</span>
                  {greekBenchContracts.length > 0 && (
                    <span className="px-1.5 py-0.2 rounded text-[10px] bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-500/30">
                      {greekBenchContracts.length}
                    </span>
                  )}
                </button>

                <button
                  onClick={() => setActiveTab("STRATEGY")}
                  className={`flex items-center gap-2 px-4 py-2.5 text-xs font-mono font-bold border-b-2 transition-all ${
                    activeTab === "STRATEGY"
                      ? "border-emerald-400 text-emerald-300 bg-emerald-500/5"
                      : "border-transparent text-slate-400 hover:text-slate-200"
                  }`}
                >
                  <LineChart className="w-3.5 h-3.5" />
                  <span>Strategy & Payoff Chart</span>
                  {selectedLegs.length > 0 && (
                    <span className="w-4 h-4 rounded-full bg-emerald-400 text-slate-950 text-[10px] flex items-center justify-center font-black">
                      {selectedLegs.length}
                    </span>
                  )}
                </button>

                <button
                  onClick={() => setActiveTab("METRICS")}
                  className={`flex items-center gap-2 px-4 py-2.5 text-xs font-mono font-bold border-b-2 transition-all ${
                    activeTab === "METRICS"
                      ? "border-emerald-400 text-emerald-300 bg-emerald-500/5"
                      : "border-transparent text-slate-400 hover:text-slate-200"
                  }`}
                >
                  <Shield className="w-3.5 h-3.5" />
                  <span>Key Levels & GEX Analysis</span>
                </button>

                <button
                  onClick={() => setActiveTab("STREAMLIT")}
                  className={`flex items-center gap-2 px-4 py-2.5 text-xs font-mono font-bold border-b-2 transition-all ${
                    activeTab === "STREAMLIT"
                      ? "border-emerald-400 text-emerald-300 bg-emerald-500/5"
                      : "border-transparent text-slate-400 hover:text-slate-200"
                  }`}
                >
                  <Code2 className="w-3.5 h-3.5" />
                  <span>Streamlit Python Code</span>
                </button>
              </div>

              {/* Action hint */}
              <div className="hidden md:flex items-center gap-2 text-xs font-mono text-slate-400">
                <span className="text-emerald-400">●</span>
                <span>Active: {ticker} ({dte}d DTE)</span>
              </div>
            </div>

            {/* TAB CONTENT: DTE STRIKE MATRIX */}
            {activeTab === "DTE_MATRIX" && (
              <DteComparisonView
                ticker={ticker}
                currentPrice={currentPrice}
                initialStrike={compareStrike}
                initialStrategy={compareStrategy}
                onSelectLegsForStrategy={handleSelectLegsForStrategy}
                onPinToGreekBench={handlePinDteRowToGreekBench}
                isContractPinnedToGreekBench={isContractPinnedToGreekBench}
              />
            )}

            {/* TAB CONTENT: GREEK & CAPITAL EFFICIENCY BENCH */}
            {activeTab === "GREEK_BENCH" && (
              <GreekBenchView
                currentTicker={ticker}
                currentPrice={currentPrice}
                contracts={greekBenchContracts}
                onUpdateContractPrice={handleUpdateGreekBenchPrice}
                onUpdateAction={handleUpdateGreekBenchAction}
                onUpdateQuantity={handleUpdateGreekBenchQuantity}
                onRemoveContract={handleRemoveGreekBenchContract}
                onClearAll={handleClearGreekBench}
                onSelectLegsForStrategy={handleSelectLegsForStrategy}
                onNavigateToChain={() => setActiveTab("CHAIN")}
              />
            )}

            {/* TAB CONTENT 1: OPTIONS CHAIN TABLE */}
            {activeTab === "CHAIN" && (
              <div className="space-y-6">
                <OptionsChainTable
                  currentPrice={currentPrice}
                  calls={currentOptionSet.calls}
                  puts={currentOptionSet.puts}
                  selectedLegs={selectedLegs}
                  onToggleContract={handleToggleContract}
                  strikeFilter={strikeFilter}
                  onCompareStrike={handleCompareStrike}
                  onPinToGreekBench={handlePinToGreekBench}
                  isContractPinnedToGreekBench={isContractPinnedToGreekBench}
                />

                {/* Strategy Summary & Quick Chart Preview */}
                <StrategyBuilder
                  legs={selectedLegs}
                  metrics={strategyMetrics}
                  dte={dte}
                  currentPrice={currentPrice}
                  ticker={ticker}
                  activePreset={activePreset}
                  onUpdateLeg={handleUpdateLeg}
                  onRemoveLeg={handleRemoveLeg}
                  onClearAll={() => setSelectedLegs([])}
                  onAddStockLeg={handleAddStockLeg}
                />

                {selectedLegs.length > 0 && (
                  <>
                    <PayoffChart
                      legs={selectedLegs}
                      metrics={strategyMetrics}
                      currentPrice={currentPrice}
                      dte={dte}
                    />

                    <EarlyExitRollCalculator
                      legs={selectedLegs}
                      metrics={strategyMetrics}
                      dte={dte}
                      currentStockPrice={currentPrice}
                      ticker={ticker}
                    />
                  </>
                )}
              </div>
            )}

            {/* TAB CONTENT 2: STRATEGY BUILDER & PAYOFF CHART */}
            {activeTab === "STRATEGY" && (
              <div className="space-y-6">
                <PayoffChart
                  legs={selectedLegs}
                  metrics={strategyMetrics}
                  currentPrice={currentPrice}
                  dte={dte}
                />

                <StrategyBuilder
                  legs={selectedLegs}
                  metrics={strategyMetrics}
                  dte={dte}
                  currentPrice={currentPrice}
                  ticker={ticker}
                  activePreset={activePreset}
                  onUpdateLeg={handleUpdateLeg}
                  onRemoveLeg={handleRemoveLeg}
                  onClearAll={() => setSelectedLegs([])}
                  onAddStockLeg={handleAddStockLeg}
                />

                {selectedLegs.length > 0 && (
                  <EarlyExitRollCalculator
                    legs={selectedLegs}
                    metrics={strategyMetrics}
                    dte={dte}
                    currentStockPrice={currentPrice}
                    ticker={ticker}
                  />
                )}
              </div>
            )}

            {/* TAB CONTENT 3: METRICS & KEY GAMMA LEVELS */}
            {activeTab === "METRICS" && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 font-mono">
                {/* Expected Move & Probability */}
                <div className="bg-[#0b131f] border border-[#172538] rounded-xl p-5">
                  <h4 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-emerald-400" />
                    Market Expected Move & Implied Volatility
                  </h4>
                  <p className="text-xs text-slate-400 mb-4 font-sans leading-relaxed">
                    Options market pricing implies a 68% probability (1 standard deviation) that {ticker} will stay between{" "}
                    <strong className="text-emerald-400">
                      ${(currentPrice - (currentPrice * (atmIv / 100) * Math.sqrt(dte / 365))).toFixed(2)}
                    </strong>{" "}
                    and{" "}
                    <strong className="text-emerald-400">
                      ${(currentPrice + (currentPrice * (atmIv / 100) * Math.sqrt(dte / 365))).toFixed(2)}
                    </strong>{" "}
                    by expiration date ({dte} days).
                  </p>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between py-1.5 border-b border-slate-800">
                      <span className="text-slate-400">ATM Implied Volatility</span>
                      <span className="text-white font-bold">{atmIv.toFixed(2)}%</span>
                    </div>
                    <div className="flex justify-between py-1.5 border-b border-slate-800">
                      <span className="text-slate-400">1-Day Move Estimate</span>
                      <span className="text-white font-bold">
                        ±${(currentPrice * (atmIv / 100) * Math.sqrt(1 / 365)).toFixed(2)} ({(atmIv / 19.1).toFixed(2)}%)
                      </span>
                    </div>
                    <div className="flex justify-between py-1.5 border-b border-slate-800">
                      <span className="text-slate-400">Total Expiration Move</span>
                      <span className="text-emerald-400 font-bold">
                        ±${(currentPrice * (atmIv / 100) * Math.sqrt(dte / 365)).toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Key Gamma & Support/Resistance Levels */}
                <div className="bg-[#0b131f] border border-[#172538] rounded-xl p-5">
                  <h4 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                    <Shield className="w-4 h-4 text-cyan-400" />
                    Key Options Boundaries (GEX & Max Pain)
                  </h4>
                  <p className="text-xs text-slate-400 mb-4 font-sans leading-relaxed">
                    Heavy open interest strikes act as natural magnets or ceilings due to market maker delta hedging.
                  </p>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between py-1.5 border-b border-slate-800">
                      <span className="text-slate-400">Call Wall (Resistance)</span>
                      <span className="text-emerald-400 font-bold">${keyLevels.callWallStrike.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between py-1.5 border-b border-slate-800">
                      <span className="text-slate-400">Put Wall (Support)</span>
                      <span className="text-rose-400 font-bold">${keyLevels.putWallStrike.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between py-1.5 border-b border-slate-800">
                      <span className="text-slate-400">Max Pain Strike</span>
                      <span className="text-amber-300 font-bold">${keyLevels.maxPainStrike.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between py-1.5 border-b border-slate-800">
                      <span className="text-slate-400">Put / Call Volume Ratio</span>
                      <span className="text-white font-bold">{keyLevels.putCallVolRatio.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB CONTENT 4: STREAMLIT PYTHON CODE VIEW */}
            {activeTab === "STREAMLIT" && (
              <div className="bg-[#0a101a] border border-[#172436] rounded-xl p-6 shadow-xl">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-base font-bold text-white font-mono flex items-center gap-2">
                      <Code2 className="w-5 h-5 text-emerald-400" />
                      Standalone Streamlit Web App (`app.py`)
                    </h3>
                    <p className="text-xs text-slate-400 mt-1">
                      Ready-to-run Python script using <code className="text-emerald-400">streamlit</code>,{" "}
                      <code className="text-emerald-400">yfinance</code>, and{" "}
                      <code className="text-emerald-400">plotly</code>.
                    </p>
                  </div>
                  <button
                    onClick={() => setShowStreamlitModal(true)}
                    className="flex items-center gap-1.5 text-xs font-mono font-bold px-3 py-1.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/30 transition-all"
                  >
                    <span>Open Code Viewer / Downloader</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>

                <div className="bg-[#060a10] border border-[#152336] rounded-lg p-4 font-mono text-xs text-slate-300 space-y-4">
                  <div className="flex items-center gap-2 text-emerald-400 font-bold">
                    <span>Quick Local Run Instructions:</span>
                  </div>
                  <pre className="bg-[#09111b] p-3 rounded border border-slate-800 text-emerald-300 text-xs overflow-x-auto">
                    pip install streamlit yfinance pandas plotly numpy scipy{"\n"}
                    streamlit run app.py
                  </pre>
                  <p className="text-xs text-slate-400 font-sans">
                    The file <code className="text-emerald-400 font-mono">app.py</code> and{" "}
                    <code className="text-emerald-400 font-mono">requirements.txt</code> are already saved in the
                    root directory of this project.
                  </p>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Streamlit Python Code Viewer Modal */}
      <PythonStreamlitModal
        isOpen={showStreamlitModal}
        onClose={() => setShowStreamlitModal(false)}
      />
    </div>
  );
}
