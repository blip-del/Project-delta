import React, { useState } from "react";
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  CartesianGrid,
} from "recharts";
import { generatePayoffCurve } from "../utils/optionsMath";
import { StrategyLeg, StrategyMetrics } from "../types";
import { Clock, SlidersHorizontal as Sliders, RefreshCw, Zap } from "lucide-react";

interface PayoffChartProps {
  legs: StrategyLeg[];
  metrics: StrategyMetrics;
  currentPrice: number;
  dte?: number;
}

export const PayoffChart: React.FC<PayoffChartProps> = ({
  legs,
  metrics,
  currentPrice,
  dte = 30,
}) => {
  const [showTodayCurve, setShowTodayCurve] = useState<boolean>(true);
  const [daysElapsed, setDaysElapsed] = useState<number>(0);
  const [ivShift, setIvShift] = useState<number>(0);

  if (legs.length === 0) {
    return (
      <div className="bg-[#0a101a] border border-[#172436] rounded-xl p-8 text-center">
        <p className="text-slate-400 font-mono text-sm">
          Select option contracts to generate the interactive Profit/Loss chart.
        </p>
      </div>
    );
  }

  const safeDte = Math.max(1, dte);
  const effectiveDaysElapsed = Math.min(safeDte, Math.max(0, daysElapsed));
  const daysRemaining = Math.max(0, safeDte - effectiveDaysElapsed);

  const data = generatePayoffCurve(
    legs,
    currentPrice,
    160,
    showTodayCurve ? daysRemaining : 0,
    ivShift
  );

  return (
    <div className="bg-[#0a101a] border border-[#172436] rounded-xl p-4 shadow-lg mb-6">
      {/* Header & Legends */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <div>
          <h3 className="text-sm font-bold text-white font-mono flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
            Interactive Payoff Diagram: Expiration vs. T+0 Curve
          </h3>
          <p className="text-xs text-slate-400">
            Compare theoretical P&L today (T+0) against expiration payoff as time and implied volatility evolve.
          </p>
        </div>

        {/* Legend items */}
        <div className="flex flex-wrap items-center gap-3 text-xs font-mono">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-0.5 bg-[#00dc82]" />
            <span className="text-slate-300">Expiration</span>
          </div>
          {showTodayCurve && (
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-0.5 bg-purple-400 border-b border-dashed border-purple-300" />
              <span className="text-purple-300 font-bold">
                T+{effectiveDaysElapsed}d ({daysRemaining} DTE)
              </span>
            </div>
          )}
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-0.5 bg-cyan-400" />
            <span className="text-slate-300">Spot: ${currentPrice.toFixed(2)}</span>
          </div>
          {metrics.breakevens.map((be) => (
            <div key={be} className="flex items-center gap-1.5">
              <span className="w-3 h-0.5 bg-amber-400" />
              <span className="text-slate-300">BE: ${be.toFixed(2)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Interactive Controls Bar */}
      <div className="mb-4 p-2.5 rounded-lg bg-[#070d16] border border-[#17263b] flex flex-wrap items-center justify-between gap-4 text-xs font-mono">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowTodayCurve(!showTodayCurve)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded transition-all ${
              showTodayCurve
                ? "bg-purple-500/20 text-purple-300 border border-purple-500/40 font-bold"
                : "bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-700"
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>{showTodayCurve ? "T+0 Curve: ON" : "T+0 Curve: OFF"}</span>
          </button>

          {showTodayCurve && (
            <div className="flex items-center gap-1">
              <button
                onClick={() => setDaysElapsed(0)}
                className={`px-2 py-0.5 rounded text-[11px] transition-all ${
                  effectiveDaysElapsed === 0
                    ? "bg-purple-500 text-white font-bold"
                    : "bg-slate-800 hover:bg-slate-700 text-slate-300"
                }`}
                title="View today's initial theoretical P&L"
              >
                Today (T+0)
              </button>
              <button
                onClick={() => setDaysElapsed(Math.round(safeDte / 2))}
                className={`px-2 py-0.5 rounded text-[11px] transition-all ${
                  effectiveDaysElapsed === Math.round(safeDte / 2)
                    ? "bg-purple-500 text-white font-bold"
                    : "bg-slate-800 hover:bg-slate-700 text-slate-300"
                }`}
                title="View theoretical P&L halfway to expiration"
              >
                Halfway ({Math.round(safeDte / 2)}d)
              </button>
              <button
                onClick={() => setDaysElapsed(safeDte)}
                className={`px-2 py-0.5 rounded text-[11px] transition-all ${
                  effectiveDaysElapsed === safeDte
                    ? "bg-purple-500 text-white font-bold"
                    : "bg-slate-800 hover:bg-slate-700 text-slate-300"
                }`}
                title="Snap to expiration date"
              >
                Expiration
              </button>
            </div>
          )}
        </div>

        {showTodayCurve && (
          <div className="flex flex-wrap items-center gap-4">
            {/* Time Slider */}
            <div className="flex items-center gap-2">
              <span className="text-slate-400">Elapsed:</span>
              <input
                type="range"
                min="0"
                max={safeDte}
                value={effectiveDaysElapsed}
                onChange={(e) => setDaysElapsed(parseInt(e.target.value, 10))}
                className="w-24 sm:w-32 accent-purple-500 cursor-pointer"
              />
              <span className="text-purple-300 font-bold min-w-[55px]">
                {effectiveDaysElapsed}d / {safeDte}d
              </span>
            </div>

            {/* IV Shift Slider */}
            <div className="flex items-center gap-2">
              <span className="text-slate-400">IV Shift:</span>
              <input
                type="range"
                min="-30"
                max="30"
                step="5"
                value={ivShift}
                onChange={(e) => setIvShift(parseInt(e.target.value, 10))}
                className="w-20 sm:w-24 accent-cyan-500 cursor-pointer"
              />
              <span
                className={`font-bold min-w-[45px] ${
                  ivShift > 0
                    ? "text-cyan-400"
                    : ivShift < 0
                    ? "text-rose-400"
                    : "text-slate-300"
                }`}
              >
                {ivShift > 0 ? `+${ivShift}%` : `${ivShift}%`}
              </span>
              {ivShift !== 0 && (
                <button
                  onClick={() => setIvShift(0)}
                  className="p-1 text-slate-400 hover:text-white"
                  title="Reset IV Shift to 0%"
                >
                  <RefreshCw className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Chart Canvas */}
      <div className="w-full h-80">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 15, right: 30, left: 10, bottom: 20 }}>
            <defs>
              <linearGradient id="profitGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#00dc82" stopOpacity={0.25} />
                <stop offset="95%" stopColor="#00dc82" stopOpacity={0.0} />
              </linearGradient>
              <linearGradient id="lossGrad" x1="0" y1="1" x2="0" y2="0">
                <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.25} />
                <stop offset="95%" stopColor="#f43f5e" stopOpacity={0.0} />
              </linearGradient>
            </defs>

            <CartesianGrid strokeDasharray="3 3" stroke="#162334" vertical={false} />

            <XAxis
              dataKey="price"
              stroke="#64748b"
              tickFormatter={(v) => `$${v}`}
              tick={{ fontSize: 11, fill: "#64748b" }}
              domain={["auto", "auto"]}
            />
            <YAxis
              stroke="#64748b"
              tickFormatter={(v) => `$${v}`}
              tick={{ fontSize: 11, fill: "#64748b" }}
            />

            <Tooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const pt = payload[0].payload;
                  const isExpProfit = pt.pnl >= 0;
                  const isTheoProfit = pt.theoreticalPnl >= 0;
                  return (
                    <div className="bg-[#0b131f] border border-[#1d2d42] p-2.5 rounded-lg shadow-xl text-xs font-mono">
                      <div className="text-slate-400 mb-1">
                        Stock Price: <span className="text-white font-bold">${pt.price.toFixed(2)}</span>
                      </div>
                      
                      {showTodayCurve && (
                        <div className="mb-1 text-slate-300 flex items-center justify-between gap-3">
                          <span className="text-purple-400">T+{effectiveDaysElapsed}d ({daysRemaining} DTE):</span>
                          <span className={`font-bold ${isTheoProfit ? "text-purple-300" : "text-rose-400"}`}>
                            {isTheoProfit ? "+" : ""}${pt.theoreticalPnl.toFixed(2)}
                          </span>
                        </div>
                      )}

                      <div className="text-slate-300 flex items-center justify-between gap-3">
                        <span className="text-slate-400">At Expiration:</span>
                        <span className={`font-bold ${isExpProfit ? "text-emerald-400" : "text-rose-400"}`}>
                          {isExpProfit ? "+" : ""}${pt.pnl.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  );
                }
                return null;
              }}
            />

            {/* Zero reference line */}
            <ReferenceLine y={0} stroke="#334155" strokeWidth={1.5} />

            {/* Current Price reference line */}
            <ReferenceLine
              x={currentPrice}
              stroke="#38bdf8"
              strokeDasharray="4 4"
              strokeWidth={1.5}
              label={{
                value: `Spot $${currentPrice.toFixed(2)}`,
                fill: "#38bdf8",
                fontSize: 10,
                position: "top",
              }}
            />

            {/* Breakeven reference lines */}
            {metrics.breakevens.map((be) => (
              <ReferenceLine
                key={be}
                x={be}
                stroke="#f59e0b"
                strokeDasharray="2 2"
                strokeWidth={1.5}
                label={{
                  value: `BE $${be.toFixed(2)}`,
                  fill: "#f59e0b",
                  fontSize: 10,
                  position: "insideBottomRight",
                }}
              />
            ))}

            {/* Payoff line & shaded regions */}
            <Area
              type="monotone"
              dataKey="profit"
              fill="url(#profitGrad)"
              stroke="none"
              isAnimationActive={false}
            />
            <Area
              type="monotone"
              dataKey="loss"
              fill="url(#lossGrad)"
              stroke="none"
              isAnimationActive={false}
            />

            {/* Theoretical T+t Line (Purple) */}
            {showTodayCurve && (
              <Line
                type="monotone"
                dataKey="theoreticalPnl"
                stroke="#c084fc"
                strokeWidth={2.2}
                dot={false}
                strokeDasharray="4 3"
                isAnimationActive={false}
              />
            )}

            {/* Expiration Payoff Line (Emerald green) */}
            <Line
              type="monotone"
              dataKey="pnl"
              stroke="#00dc82"
              strokeWidth={2.5}
              dot={false}
              isAnimationActive={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
