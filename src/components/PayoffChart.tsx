import React from "react";
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

interface PayoffChartProps {
  legs: StrategyLeg[];
  metrics: StrategyMetrics;
  currentPrice: number;
}

export const PayoffChart: React.FC<PayoffChartProps> = ({
  legs,
  metrics,
  currentPrice,
}) => {
  if (legs.length === 0) {
    return (
      <div className="bg-[#0a101a] border border-[#172436] rounded-xl p-8 text-center">
        <p className="text-slate-400 font-mono text-sm">
          Select option contracts to generate the interactive Profit/Loss chart.
        </p>
      </div>
    );
  }

  const data = generatePayoffCurve(legs, currentPrice, 160);

  return (
    <div className="bg-[#0a101a] border border-[#172436] rounded-xl p-4 shadow-lg mb-6">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div>
          <h3 className="text-sm font-bold text-white font-mono flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            Interactive Profit / Loss Payoff Curve at Expiration
          </h3>
          <p className="text-xs text-slate-400">
            Hover over the curve to inspect projected dollar profit/loss at any underlying stock price.
          </p>
        </div>

        <div className="flex items-center gap-4 text-xs font-mono">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-0.5 bg-cyan-400" />
            <span className="text-slate-300">Current: ${currentPrice.toFixed(2)}</span>
          </div>
          {metrics.breakevens.map((be) => (
            <div key={be} className="flex items-center gap-1.5">
              <span className="w-3 h-0.5 bg-amber-400" />
              <span className="text-slate-300">BE: ${be.toFixed(2)}</span>
            </div>
          ))}
        </div>
      </div>

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
                  const isProfit = pt.pnl >= 0;
                  return (
                    <div className="bg-[#0b131f] border border-[#1d2d42] p-2.5 rounded-lg shadow-xl text-xs font-mono">
                      <div className="text-slate-400 mb-1">
                        Stock Price: <span className="text-white font-bold">${pt.price.toFixed(2)}</span>
                      </div>
                      <div className={`font-black text-sm ${isProfit ? "text-emerald-400" : "text-rose-400"}`}>
                        P/L: {isProfit ? "+" : ""}${pt.pnl.toFixed(2)}
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
                value: `Current $${currentPrice.toFixed(2)}`,
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
