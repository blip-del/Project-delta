import { StrategyLeg, StrategyMetrics, OptionContract } from "../types";

// Calculate payoff for an individual leg at a given stock price at expiration
export function calculateLegPayoff(leg: StrategyLeg, stockPrice: number): number {
  let intrinsic = 0;
  if (leg.type === "CALL") {
    intrinsic = Math.max(0, stockPrice - leg.strike);
  } else {
    intrinsic = Math.max(0, leg.strike - stockPrice);
  }

  const multiplier = 100 * leg.quantity;
  if (leg.action === "BUY") {
    return (intrinsic - leg.entryPrice) * multiplier;
  } else {
    return (leg.entryPrice - intrinsic) * multiplier;
  }
}

// Generate curve data points for charting
export function generatePayoffCurve(
  legs: StrategyLeg[],
  currentPrice: number,
  pointsCount: number = 200
) {
  if (legs.length === 0) return [];

  const strikes = legs.map((l) => l.strike);
  const minK = Math.min(...strikes, currentPrice);
  const maxK = Math.max(...strikes, currentPrice);

  const minPrice = Math.max(1, minK * 0.65);
  const maxPrice = maxK * 1.35;
  const step = (maxPrice - minPrice) / (pointsCount - 1);

  const points = [];
  for (let i = 0; i < pointsCount; i++) {
    const p = Number((minPrice + i * step).toFixed(2));
    let totalPnl = 0;
    for (const leg of legs) {
      totalPnl += calculateLegPayoff(leg, p);
    }

    points.push({
      price: p,
      pnl: Number(totalPnl.toFixed(2)),
      profit: Math.max(0, totalPnl),
      loss: Math.min(0, totalPnl),
    });
  }

  return points;
}

// Compute strategy comprehensive metrics
export function calculateStrategyMetrics(
  legs: StrategyLeg[],
  currentPrice: number,
  dte: number
): StrategyMetrics {
  if (legs.length === 0) {
    return {
      netPremium: 0,
      maxProfit: 0,
      maxLoss: 0,
      breakevens: [],
      riskRewardRatio: "N/A",
      positionDelta: 0,
      annualizedReturn: 0,
      profitProbability: 50,
    };
  }

  let netCash = 0;
  let totalDelta = 0;

  for (const leg of legs) {
    const cost = leg.entryPrice * 100 * leg.quantity;
    if (leg.action === "BUY") {
      netCash -= cost;
      totalDelta += leg.delta * leg.quantity;
    } else {
      netCash += cost;
      totalDelta -= leg.delta * leg.quantity;
    }
  }

  const curve = generatePayoffCurve(legs, currentPrice, 400);
  const pnls = curve.map((pt) => pt.pnl);

  const minPnl = Math.min(...pnls);
  const maxPnl = Math.max(...pnls);

  // Check if unbounded upside or downside
  const leftEdgePnl = curve[0].pnl;
  const rightEdgePnl = curve[curve.length - 1].pnl;

  let maxProfit: number | "Unlimited" = maxPnl;
  let maxLoss: number | "Unlimited" = minPnl;

  // If long call without cap, right edge goes to infinity
  const hasUncappedLongCall = legs.some((l) => l.type === "CALL" && l.action === "BUY");
  const hasShortCall = legs.some((l) => l.type === "CALL" && l.action === "SELL");
  if (hasUncappedLongCall && !hasShortCall) {
    maxProfit = "Unlimited";
  }

  // If short call without hedge, right edge loss is unlimited
  if (hasShortCall && !hasUncappedLongCall) {
    maxLoss = "Unlimited";
  }

  // Find Breakevens
  const breakevens: number[] = [];
  for (let i = 0; i < curve.length - 1; i++) {
    const p1 = curve[i];
    const p2 = curve[i + 1];
    if ((p1.pnl <= 0 && p2.pnl >= 0) || (p1.pnl >= 0 && p2.pnl <= 0)) {
      if (p2.pnl !== p1.pnl) {
        const be = p1.price - (p1.pnl * (p2.price - p1.price)) / (p2.pnl - p1.pnl);
        breakevens.push(Number(be.toFixed(2)));
      }
    }
  }

  // Deduplicate close breakevens
  const uniqueBes = breakevens.filter((v, i, a) => i === 0 || Math.abs(v - a[i - 1]) > 0.5);

  // Risk / Reward
  let riskRewardRatio = "N/A";
  if (typeof maxProfit === "number" && typeof maxLoss === "number" && maxLoss < 0) {
    const rr = Math.abs(maxProfit / maxLoss);
    riskRewardRatio = `1 : ${rr.toFixed(2)}`;
  } else if (maxProfit === "Unlimited") {
    riskRewardRatio = "Unlimited Upside";
  }

  // Annualized Return
  let annualizedReturn = 0;
  const safeDte = Math.max(1, dte);
  if (netCash > 0) {
    // Net credit (credit spread, cash secured put, covered call)
    const capitalAtRisk = typeof maxLoss === "number" ? Math.abs(maxLoss) : 1000;
    if (capitalAtRisk > 0) {
      const returnOnRisk = (netCash / capitalAtRisk);
      annualizedReturn = Number(((returnOnRisk * (365 / safeDte)) * 100).toFixed(1));
    }
  } else if (netCash < 0 && typeof maxProfit === "number" && maxProfit > 0) {
    // Debit strategy
    const invested = Math.abs(netCash);
    const returnOnInvestment = (maxProfit / invested);
    annualizedReturn = Number(((returnOnInvestment * (365 / safeDte)) * 100).toFixed(1));
  }

  // Profit Probability approximation from position delta
  let profitProbability = 50;
  if (legs.length === 1) {
    const leg = legs[0];
    if (leg.action === "BUY") {
      profitProbability = Math.round(Math.abs(leg.delta) * 100);
    } else {
      profitProbability = Math.round((1 - Math.abs(leg.delta)) * 100);
    }
  } else {
    // Multi-leg estimate based on current price PnL
    const currentPricePnl = calculateLegsPnlAtPrice(legs, currentPrice);
    profitProbability = currentPricePnl >= 0 ? 65 : 45;
  }

  return {
    netPremium: Number(netCash.toFixed(2)),
    maxProfit: typeof maxProfit === "number" ? Number(maxProfit.toFixed(2)) : maxProfit,
    maxLoss: typeof maxLoss === "number" ? Number(maxLoss.toFixed(2)) : maxLoss,
    breakevens: uniqueBes,
    riskRewardRatio,
    positionDelta: Number(totalDelta.toFixed(2)),
    annualizedReturn,
    profitProbability,
  };
}

export function calculateLegsPnlAtPrice(legs: StrategyLeg[], price: number): number {
  return legs.reduce((sum, leg) => sum + calculateLegPayoff(leg, price), 0);
}

// Key Levels from Option Chain
export function calculateKeyLevels(calls: OptionContract[], puts: OptionContract[], currentPrice: number) {
  // Call Wall: Strike with highest Call Open Interest
  let callWallStrike = currentPrice;
  let maxCallOi = 0;
  calls.forEach((c) => {
    if (c.openInterest > maxCallOi) {
      maxCallOi = c.openInterest;
      callWallStrike = c.strike;
    }
  });

  // Put Wall: Strike with highest Put Open Interest
  let putWallStrike = currentPrice;
  let maxPutOi = 0;
  puts.forEach((p) => {
    if (p.openInterest > maxPutOi) {
      maxPutOi = p.openInterest;
      putWallStrike = p.strike;
    }
  });

  // Total Volumes and Put/Call Ratio
  const totalCallVol = calls.reduce((s, c) => s + (c.volume || 0), 0);
  const totalPutVol = puts.reduce((s, p) => s + (p.volume || 0), 0);
  const putCallVolRatio = totalCallVol > 0 ? Number((totalPutVol / totalCallVol).toFixed(2)) : 1.0;

  const totalCallOi = calls.reduce((s, c) => s + (c.openInterest || 0), 0);
  const totalPutOi = puts.reduce((s, p) => s + (p.openInterest || 0), 0);
  const putCallOiRatio = totalCallOi > 0 ? Number((totalPutOi / totalCallOi).toFixed(2)) : 1.0;

  // Max Pain calculation
  const strikes = Array.from(new Set([...calls.map((c) => c.strike), ...puts.map((p) => p.strike)])).sort(
    (a, b) => a - b
  );

  let minLoss = Infinity;
  let maxPainStrike = currentPrice;

  strikes.forEach((testStrike) => {
    let totalOptionBuyerValue = 0;
    calls.forEach((c) => {
      const intrinsic = Math.max(0, testStrike - c.strike);
      totalOptionBuyerValue += intrinsic * (c.openInterest || 0);
    });
    puts.forEach((p) => {
      const intrinsic = Math.max(0, p.strike - testStrike);
      totalOptionBuyerValue += intrinsic * (p.openInterest || 0);
    });

    if (totalOptionBuyerValue < minLoss) {
      minLoss = totalOptionBuyerValue;
      maxPainStrike = testStrike;
    }
  });

  return {
    callWallStrike,
    putWallStrike,
    maxPainStrike,
    totalCallVol,
    totalPutVol,
    putCallVolRatio,
    totalCallOi,
    totalPutOi,
    putCallOiRatio,
  };
}
