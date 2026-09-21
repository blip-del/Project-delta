import React from "react";
import { OptionContract, StrategyLeg } from "../types";
import { Plus, Check, TrendingUp, TrendingDown } from "lucide-react";

interface OptionsChainTableProps {
  currentPrice: number;
  calls: OptionContract[];
  puts: OptionContract[];
  selectedLegs: StrategyLeg[];
  onToggleContract: (contract: OptionContract, type: "CALL" | "PUT", defaultAction: "BUY" | "SELL") => void;
  strikeFilter: string;
}

export const OptionsChainTable: React.FC<OptionsChainTableProps> = ({
  currentPrice,
  calls,
  puts,
  selectedLegs,
  onToggleContract,
  strikeFilter,
}) => {
  // Map puts and calls by strike
  const strikesSet = new Set<number>();
  const callsMap = new Map<number, OptionContract>();
  const putsMap = new Map<number, OptionContract>();

  calls.forEach((c) => {
    strikesSet.add(c.strike);
    callsMap.set(c.strike, c);
  });
  puts.forEach((p) => {
    strikesSet.add(p.strike);
    putsMap.set(p.strike, p);
  });

  let sortedStrikes = Array.from(strikesSet).sort((a, b) => a - b);

  // Apply strike filter
  if (strikeFilter === "ATM_15") {
    sortedStrikes = sortedStrikes.filter(
      (k) => k >= currentPrice * 0.85 && k <= currentPrice * 1.15
    );
  } else if (strikeFilter === "ATM_30") {
    sortedStrikes = sortedStrikes.filter(
      (k) => k >= currentPrice * 0.70 && k <= currentPrice * 1.30
    );
  } else if (strikeFilter === "TOP_25") {
    sortedStrikes = [...sortedStrikes]
      .sort((a, b) => Math.abs(a - currentPrice) - Math.abs(b - currentPrice))
      .slice(0, 25)
      .sort((a, b) => a - b);
  }

  // Find ATM strike
  let atmStrike = sortedStrikes[0] || currentPrice;
  let minDiff = Infinity;
  sortedStrikes.forEach((k) => {
    const diff = Math.abs(k - currentPrice);
    if (diff < minDiff) {
      minDiff = diff;
      atmStrike = k;
    }
  });

  const isLegSelected = (symbol: string) => {
    return selectedLegs.some((l) => l.contractSymbol === symbol);
  };

  return (
    <div className="bg-[#0a101a] border border-[#172436] rounded-xl overflow-hidden shadow-lg">
      {/* Table Sub-Header Controls */}
      <div className="bg-[#0c1421] border-b border-[#172436] px-4 py-2.5 flex items-center justify-between text-xs font-mono">
        <div className="flex items-center gap-3">
          <span className="font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            Calls (Bullish)
          </span>
          <span className="text-[11px] text-slate-500">
            Click Ask to Buy Call, Bid to Sell Call
          </span>
        </div>
        <div className="text-center font-bold text-slate-300">
          STRIKE (ATM: ${atmStrike.toFixed(1)})
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[11px] text-slate-500">
            Click Ask to Buy Put, Bid to Sell Put
          </span>
          <span className="font-bold text-rose-400 uppercase tracking-wider flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-rose-400" />
            Puts (Bearish)
          </span>
        </div>
      </div>

      {/* Main Table Scroll Container */}
      <div className="overflow-x-auto max-h-[580px] overflow-y-auto">
        <table className="w-full text-xs font-mono border-collapse select-none">
          <thead className="sticky top-0 bg-[#0c1421] text-[11px] text-slate-400 border-b border-[#19273a] z-10">
            <tr>
              {/* Call Columns */}
              <th className="py-2 px-2 text-center w-8">Sel</th>
              <th className="py-2 px-2 text-right">Bid</th>
              <th className="py-2 px-2 text-right">Ask</th>
              <th className="py-2 px-2 text-right">Last</th>
              <th className="py-2 px-2 text-right">Delta</th>
              <th className="py-2 px-2 text-right hidden sm:table-cell">IV</th>
              <th className="py-2 px-2 text-right hidden md:table-cell">Vol</th>
              <th className="py-2 px-2 text-right hidden lg:table-cell">OI</th>

              {/* Center Strike Column */}
              <th className="py-2 px-4 text-center bg-[#101b2a] text-cyan-300 font-extrabold border-x border-[#1a2b40] w-24">
                STRIKE
              </th>

              {/* Put Columns */}
              <th className="py-2 px-2 text-left hidden lg:table-cell">OI</th>
              <th className="py-2 px-2 text-left hidden md:table-cell">Vol</th>
              <th className="py-2 px-2 text-left hidden sm:table-cell">IV</th>
              <th className="py-2 px-2 text-left">Delta</th>
              <th className="py-2 px-2 text-left">Last</th>
              <th className="py-2 px-2 text-left">Bid</th>
              <th className="py-2 px-2 text-left">Ask</th>
              <th className="py-2 px-2 text-center w-8">Sel</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-[#131d2b]">
            {sortedStrikes.map((strike) => {
              const call = callsMap.get(strike);
              const put = putsMap.get(strike);
              const isAtm = strike === atmStrike;

              const isCallItm = currentPrice > strike;
              const isPutItm = currentPrice < strike;

              const isCallSelected = call ? isLegSelected(call.contractSymbol) : false;
              const isPutSelected = put ? isLegSelected(put.contractSymbol) : false;

              return (
                <tr
                  key={strike}
                  className={`hover:bg-[#111e30] transition-colors ${
                    isAtm ? "border-y-2 border-cyan-500/40 bg-[#0e1c2d]" : ""
                  }`}
                >
                  {/* --- CALL SIDE --- */}
                  <td className={`py-2 px-2 text-center ${isCallItm ? "bg-emerald-950/20" : ""}`}>
                    {call && (
                      <input
                        type="checkbox"
                        checked={isCallSelected}
                        onChange={() => onToggleContract(call, "CALL", "BUY")}
                        className="rounded bg-slate-800 border-slate-700 text-emerald-500 focus:ring-0 cursor-pointer w-3.5 h-3.5"
                      />
                    )}
                  </td>

                  {/* Call Bid (Sell action) */}
                  <td
                    onClick={() => call && onToggleContract(call, "CALL", "SELL")}
                    className={`py-2 px-2 text-right font-medium cursor-pointer transition-colors hover:bg-emerald-500/20 ${
                      isCallItm ? "bg-emerald-950/20 text-emerald-200" : "text-slate-300"
                    }`}
                    title="Click to add SHORT Call (Sell)"
                  >
                    {call ? `$${call.bid.toFixed(2)}` : "-"}
                  </td>

                  {/* Call Ask (Buy action) */}
                  <td
                    onClick={() => call && onToggleContract(call, "CALL", "BUY")}
                    className={`py-2 px-2 text-right font-medium cursor-pointer transition-colors hover:bg-emerald-500/20 ${
                      isCallItm ? "bg-emerald-950/20 text-emerald-300" : "text-slate-200"
                    }`}
                    title="Click to add LONG Call (Buy)"
                  >
                    {call ? `$${call.ask.toFixed(2)}` : "-"}
                  </td>

                  {/* Call Last */}
                  <td className={`py-2 px-2 text-right text-slate-400 ${isCallItm ? "bg-emerald-950/20" : ""}`}>
                    {call ? `$${call.lastPrice.toFixed(2)}` : "-"}
                  </td>

                  {/* Call Delta */}
                  <td
                    className={`py-2 px-2 text-right font-bold ${
                      isCallItm ? "bg-emerald-950/20 text-emerald-400" : "text-slate-400"
                    }`}
                  >
                    {call ? (call.delta >= 0 ? `+${call.delta.toFixed(3)}` : call.delta.toFixed(3)) : "-"}
                  </td>

                  {/* Call IV */}
                  <td className={`py-2 px-2 text-right text-slate-400 hidden sm:table-cell ${isCallItm ? "bg-emerald-950/20" : ""}`}>
                    {call ? `${call.impliedVolatility.toFixed(1)}%` : "-"}
                  </td>

                  {/* Call Volume */}
                  <td className={`py-2 px-2 text-right text-slate-500 hidden md:table-cell ${isCallItm ? "bg-emerald-950/20" : ""}`}>
                    {call ? call.volume.toLocaleString() : "-"}
                  </td>

                  {/* Call Open Interest */}
                  <td className={`py-2 px-2 text-right text-slate-400 hidden lg:table-cell ${isCallItm ? "bg-emerald-950/20" : ""}`}>
                    {call ? call.openInterest.toLocaleString() : "-"}
                  </td>

                  {/* --- CENTER STRIKE --- */}
                  <td
                    className={`py-2 px-3 text-center font-black border-x border-[#1a2b40] font-mono ${
                      isAtm
                        ? "bg-cyan-500/20 text-cyan-300 ring-1 ring-cyan-400"
                        : "bg-[#0d1624] text-white"
                    }`}
                  >
                    <div className="flex items-center justify-center gap-1">
                      <span>${strike.toFixed(1)}</span>
                      {isAtm && (
                        <span className="text-[9px] px-1 rounded bg-cyan-400 text-slate-950 font-black">
                          ATM
                        </span>
                      )}
                    </div>
                  </td>

                  {/* --- PUT SIDE --- */}
                  {/* Put Open Interest */}
                  <td className={`py-2 px-2 text-left text-slate-400 hidden lg:table-cell ${isPutItm ? "bg-rose-950/20" : ""}`}>
                    {put ? put.openInterest.toLocaleString() : "-"}
                  </td>

                  {/* Put Volume */}
                  <td className={`py-2 px-2 text-left text-slate-500 hidden md:table-cell ${isPutItm ? "bg-rose-950/20" : ""}`}>
                    {put ? put.volume.toLocaleString() : "-"}
                  </td>

                  {/* Put IV */}
                  <td className={`py-2 px-2 text-left text-slate-400 hidden sm:table-cell ${isPutItm ? "bg-rose-950/20" : ""}`}>
                    {put ? `${put.impliedVolatility.toFixed(1)}%` : "-"}
                  </td>

                  {/* Put Delta */}
                  <td
                    className={`py-2 px-2 text-left font-bold ${
                      isPutItm ? "bg-rose-950/20 text-rose-400" : "text-slate-400"
                    }`}
                  >
                    {put ? put.delta.toFixed(3) : "-"}
                  </td>

                  {/* Put Last */}
                  <td className={`py-2 px-2 text-left text-slate-400 ${isPutItm ? "bg-rose-950/20" : ""}`}>
                    {put ? `$${put.lastPrice.toFixed(2)}` : "-"}
                  </td>

                  {/* Put Bid (Sell action) */}
                  <td
                    onClick={() => put && onToggleContract(put, "PUT", "SELL")}
                    className={`py-2 px-2 text-left font-medium cursor-pointer transition-colors hover:bg-rose-500/20 ${
                      isPutItm ? "bg-rose-950/20 text-rose-200" : "text-slate-300"
                    }`}
                    title="Click to add SHORT Put (Sell)"
                  >
                    {put ? `$${put.bid.toFixed(2)}` : "-"}
                  </td>

                  {/* Put Ask (Buy action) */}
                  <td
                    onClick={() => put && onToggleContract(put, "PUT", "BUY")}
                    className={`py-2 px-2 text-left font-medium cursor-pointer transition-colors hover:bg-rose-500/20 ${
                      isPutItm ? "bg-rose-950/20 text-rose-300" : "text-slate-200"
                    }`}
                    title="Click to add LONG Put (Buy)"
                  >
                    {put ? `$${put.ask.toFixed(2)}` : "-"}
                  </td>

                  {/* Put Checkbox */}
                  <td className={`py-2 px-2 text-center ${isPutItm ? "bg-rose-950/20" : ""}`}>
                    {put && (
                      <input
                        type="checkbox"
                        checked={isPutSelected}
                        onChange={() => onToggleContract(put, "PUT", "BUY")}
                        className="rounded bg-slate-800 border-slate-700 text-rose-500 focus:ring-0 cursor-pointer w-3.5 h-3.5"
                      />
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
