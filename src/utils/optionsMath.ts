import { StrategyLeg, StrategyMetrics, OptionContract } from "../types";

// Standard normal cumulative distribution function (Abramowitz & Stegun approximation)
export function normalCDF(x: number): number {
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;

  const sign = x < 0 ? -1 : 1;
  const absX = Math.abs(x) / Math.SQRT2;

  const t = 1.0 / (1.0 + p * absX);
  const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-absX * absX);

  return 0.5 * (1.0 + sign * y);
}

// Black-Scholes option pricing formula
export function blackScholesOptionPrice(
  S: number,
  K: number,
  T: number, // in years
  r: number, // risk-free rate (e.g. 0.045)
  sigma: number, // implied volatility (e.g. 0.35)
  type: "CALL" | "PUT"
): number {
  if (T <= 0.0001 || sigma <= 0.001) {
    return type === "CALL" ? Math.max(0, S - K) : Math.max(0, K - S);
  }

  const sqrtT = Math.sqrt(T);
  const d1 = (Math.log(S / K) + (r + 0.5 * sigma * sigma) * T) / (sigma * sqrtT);
  const d2 = d1 - sigma * sqrtT;

  if (type === "CALL") {
    const callPrice = S * normalCDF(d1) - K * Math.exp(-r * T) * normalCDF(d2);
    return Math.max(0, callPrice);
  } else {
    const putPrice = K * Math.exp(-r * T) * normalCDF(-d2) - S * normalCDF(-d1);
    return Math.max(0, putPrice);
  }
}

// Calculate theoretical leg payoff at an intermediate time before expiration (T+t)
export function calculateTheoreticalLegPayoff(
  leg: StrategyLeg,
  stockPrice: number,
  daysRemaining: number,
  ivShift: number = 0 // percentage shift, e.g. -10 for -10% IV
): number {
  if (leg.type === "STOCK") {
    const shares = 100 * leg.quantity;
    return leg.action === "BUY"
      ? (stockPrice - leg.entryPrice) * shares
      : (leg.entryPrice - stockPrice) * shares;
  }

  // Option leg
  let baseIV = leg.impliedVolatility && leg.impliedVolatility > 0.01 ? leg.impliedVolatility : 0.40;
  if (baseIV > 5) baseIV = baseIV / 100; // normalize if entered as e.g. 45%

  const effectiveIV = Math.max(0.05, baseIV * (1 + ivShift / 100));
  const T = Math.max(0.0001, daysRemaining / 365);
  const r = 0.045; // 4.5% risk free rate estimate

  const currentOptionPrice = blackScholesOptionPrice(
    stockPrice,
    leg.strike,
    T,
    r,
    effectiveIV,
    leg.type
  );

  const multiplier = 100 * leg.quantity;
  if (leg.action === "BUY") {
    return (currentOptionPrice - leg.entryPrice) * multiplier;
  } else {
    return (leg.entryPrice - currentOptionPrice) * multiplier;
  }
}

// Calculate payoff for an individual leg at a given stock price at expiration
export function calculateLegPayoff(leg: StrategyLeg, stockPrice: number): number {
  if (leg.type === "STOCK") {
    // 1 unit of quantity represents 100 shares (or 1 lot)
    const shares = 100 * leg.quantity;
    if (leg.action === "BUY") {
      return (stockPrice - leg.entryPrice) * shares;
    } else {
      return (leg.entryPrice - stockPrice) * shares;
    }
  }

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

// Generate curve data points for charting with both expiration and intermediate theoretical curve
export function generatePayoffCurve(
  legs: StrategyLeg[],
  currentPrice: number,
  pointsCount: number = 200,
  daysRemaining: number = 0,
  ivShift: number = 0
) {
  if (legs.length === 0) return [];

  const strikes = legs.map((l) => l.strike);
  const minK = Math.min(...strikes, currentPrice);
  const maxK = Math.max(...strikes, currentPrice);

  const hasStock = legs.some((l) => l.type === "STOCK");
  const minPrice = hasStock ? Math.max(0, minK * 0.4) : Math.max(0.1, minK * 0.65);
  const maxPrice = maxK * 1.35;
  const step = (maxPrice - minPrice) / (pointsCount - 1);

  const points = [];
  for (let i = 0; i < pointsCount; i++) {
    const p = Number((minPrice + i * step).toFixed(2));
    let totalExpirationPnl = 0;
    let totalTheoreticalPnl = 0;

    for (const leg of legs) {
      totalExpirationPnl += calculateLegPayoff(leg, p);
      totalTheoreticalPnl += calculateTheoreticalLegPayoff(leg, p, daysRemaining, ivShift);
    }

    points.push({
      price: p,
      pnl: Number(totalExpirationPnl.toFixed(2)),
      theoreticalPnl: Number(totalTheoreticalPnl.toFixed(2)),
      profit: Math.max(0, totalExpirationPnl),
      loss: Math.min(0, totalExpirationPnl),
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
      totalCapitalRequired: 0,
      maxProfit: 0,
      maxLoss: 0,
      breakevens: [],
      riskRewardRatio: "N/A",
      positionDelta: 0,
      annualizedReturn: 0,
      staticAnnualizedReturn: 0,
      rawReturn: 0,
      profitProbability: 50,
    };
  }

  let netCash = 0;
  let totalDelta = 0;
  let totalCapitalRequired = 0;

  const hasStock = legs.some((l) => l.type === "STOCK");
  const hasOptions = legs.some((l) => l.type === "CALL" || l.type === "PUT");

  for (const leg of legs) {
    const cost = leg.entryPrice * 100 * leg.quantity;
    if (leg.type === "STOCK") {
      if (leg.action === "BUY") {
        totalCapitalRequired += cost;
        totalDelta += 1.0 * leg.quantity;
      } else {
        totalDelta -= 1.0 * leg.quantity;
      }
    } else {
      if (leg.action === "BUY") {
        netCash -= cost;
        totalCapitalRequired += cost;
        totalDelta += leg.delta * leg.quantity;
      } else {
        netCash += cost;
        totalDelta -= leg.delta * leg.quantity;
        // If cash secured put (short put), capital required is strike * 100
        if (leg.type === "PUT" && !hasStock) {
          totalCapitalRequired += leg.strike * 100 * leg.quantity;
        }
      }
    }
  }

  // If covered call (Stock + Short Call), capital required is stock cost minus call premium collected
  if (hasStock) {
    const stockLeg = legs.find((l) => l.type === "STOCK");
    if (stockLeg && stockLeg.action === "BUY") {
      const stockCost = stockLeg.entryPrice * 100 * stockLeg.quantity;
      totalCapitalRequired = Math.max(1, stockCost - (netCash > 0 ? netCash : 0));
    }
  }

  const curve = generatePayoffCurve(legs, currentPrice, 400);
  const pnls = curve.map((pt) => pt.pnl);

  const minPnl = Math.min(...pnls);
  const maxPnl = Math.max(...pnls);

  // Calculate exact theoretical max loss and max profit
  // For long stock (bought stock), if stock goes to 0:
  // loss = (0 - stockEntryPrice) * shares + netCash
  // e.g. for Covered call: (0 - 4.235)*100 + 60 = -423.50 + 60 = -$363.50. Max loss is full net capital outlay!
  let maxProfit: number | "Unlimited" = maxPnl;
  let maxLoss: number | "Unlimited" = minPnl;

  const hasUncappedLongCall = legs.some((l) => l.type === "CALL" && l.action === "BUY");
  const hasShortCall = legs.some((l) => l.type === "CALL" && l.action === "SELL");
  const hasLongStock = legs.some((l) => l.type === "STOCK" && l.action === "BUY");

  // Check if stock goes to $0 (bankruptcy worst-case)
  const pnlAtZero = calculateLegsPnlAtPrice(legs, 0);
  if (pnlAtZero < minPnl) {
    maxLoss = pnlAtZero;
  }

  if (hasUncappedLongCall && !hasShortCall && !hasStock) {
    maxProfit = "Unlimited";
  }

  if (hasShortCall && !hasUncappedLongCall && !hasLongStock) {
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

  // Check if breakeven is outside the curve range (e.g. for covered call, be = stockBasis - callPremium)
  if (hasLongStock && legs.length === 2 && hasShortCall) {
    const sLeg = legs.find((l) => l.type === "STOCK");
    const cLeg = legs.find((l) => l.type === "CALL");
    if (sLeg && cLeg) {
      const calculatedBe = Number((sLeg.entryPrice - cLeg.entryPrice).toFixed(2));
      if (!breakevens.some((b) => Math.abs(b - calculatedBe) < 0.1)) {
        breakevens.push(calculatedBe);
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

  // Annualized Return Calculations: (Profit / Capital at Risk) * (365 / DTE)
  // or (Profit / Capital at Risk) * (52 / weeks)
  const safeDte = Math.max(1, dte);
  const annualMultiplier = 365 / safeDte;

  // Capital basis for ROI:
  // For Covered Call: Stock Cost - Option Premium (Net Capital Outlay)
  // For Cash-Secured Put: Strike * 100 * contracts
  // For Credit Spread: Max Loss (Risk)
  // For Debit Strategy: Net Debit
  const denominatorCapital = totalCapitalRequired > 0 
    ? totalCapitalRequired 
    : (typeof maxLoss === "number" && maxLoss < 0 ? Math.abs(maxLoss) : 1000);

  // 1. Pure Premium Annualized Return: (Net Premium Collected / Capital at Risk) * (365 / DTE)
  let premiumAnnualizedReturn = 0;
  let premiumRawReturn = 0;
  if (netCash > 0 && denominatorCapital > 0) {
    premiumRawReturn = Number(((netCash / denominatorCapital) * 100).toFixed(2));
    premiumAnnualizedReturn = Number((premiumRawReturn * annualMultiplier).toFixed(1));
  }

  // 2. Maximum Annualized Return: (Max Profit / Capital at Risk) * (365 / DTE)
  let maxAnnualizedReturn = 0;
  let maxRawReturn = 0;
  if (typeof maxProfit === "number" && maxProfit > 0 && denominatorCapital > 0) {
    maxRawReturn = Number(((maxProfit / denominatorCapital) * 100).toFixed(2));
    maxAnnualizedReturn = Number((maxRawReturn * annualMultiplier).toFixed(1));
  }

  // 3. Static / If-Flat Annualized Return (if stock stays flat at current price)
  const flatPnl = calculateLegsPnlAtPrice(legs, currentPrice);
  let staticAnnualizedReturn = 0;
  if (flatPnl > 0 && denominatorCapital > 0) {
    const flatRawReturn = (flatPnl / denominatorCapital) * 100;
    staticAnnualizedReturn = Number((flatRawReturn * annualMultiplier).toFixed(1));
  } else if (premiumAnnualizedReturn > 0) {
    staticAnnualizedReturn = premiumAnnualizedReturn;
  }

  // Profit Probability approximation
  let profitProbability = 50;
  if (legs.length === 1) {
    const leg = legs[0];
    if (leg.type !== "STOCK") {
      if (leg.action === "BUY") {
        profitProbability = Math.round(Math.abs(leg.delta) * 100);
      } else {
        profitProbability = Math.round((1 - Math.abs(leg.delta)) * 100);
      }
    }
  } else {
    profitProbability = flatPnl >= 0 ? 68 : 42;
  }

  return {
    netPremium: Number(netCash.toFixed(2)),
    totalCapitalRequired: Number(denominatorCapital.toFixed(2)),
    maxProfit: typeof maxProfit === "number" ? Number(maxProfit.toFixed(2)) : maxProfit,
    maxLoss: typeof maxLoss === "number" ? Number(maxLoss.toFixed(2)) : maxLoss,
    breakevens: uniqueBes,
    riskRewardRatio,
    positionDelta: Number(totalDelta.toFixed(2)),
    annualizedReturn: maxAnnualizedReturn > 0 ? maxAnnualizedReturn : premiumAnnualizedReturn,
    premiumAnnualizedReturn,
    maxAnnualizedReturn,
    staticAnnualizedReturn,
    rawReturn: maxRawReturn > 0 ? maxRawReturn : premiumRawReturn,
    premiumRawReturn,
    profitProbability: Math.min(99, Math.max(1, profitProbability)),
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

// Early Exit / Holding Velocity Analysis
export interface EarlyExitTarget {
  percent: number; // 25, 50, 75, 100
  targetProfit: number;
  buybackOptionPrice: number;
  daysHeld: number;
  annualizedApr: number;
  rawReturn: number;
  velocityMultiplier: number;
  capitalFreedDays: number;
}

export function calculateEarlyExitAnalysis(
  legs: StrategyLeg[],
  metrics: StrategyMetrics,
  dte: number
): {
  hasShortOption: boolean;
  shortLeg?: StrategyLeg;
  capitalAtRisk: number;
  dte: number;
  targets: EarlyExitTarget[];
} {
  const shortLeg = legs.find((l) => (l.type === "CALL" || l.type === "PUT") && l.action === "SELL");
  const hasShortOption = !!shortLeg;

  const capitalAtRisk = metrics.totalCapitalRequired > 0
    ? metrics.totalCapitalRequired
    : (typeof metrics.maxLoss === "number" && metrics.maxLoss < 0 ? Math.abs(metrics.maxLoss) : 1000);

  const safeDte = Math.max(1, dte);
  const maxProfitNumber = typeof metrics.maxProfit === "number" && metrics.maxProfit > 0
    ? metrics.maxProfit
    : (metrics.netPremium > 0 ? metrics.netPremium : 100);

  // Baseline APR at full expiration
  const baseApr = metrics.annualizedReturn > 0 ? metrics.annualizedReturn : 1;

  // Theta decay accelerates non-linearly (square-root rule / empirical options decay):
  // 25% profit is typically reached at ~15% of DTE
  // 50% profit is typically reached at ~35% of DTE (often in 2-3 weeks on 45-60 DTE trades)
  // 75% profit is typically reached at ~65% of DTE
  // 100% profit is reached at 100% of DTE
  const targetPercentages = [25, 50, 75, 100];
  const decayFractions = [0.18, 0.38, 0.68, 1.0];

  const targets: EarlyExitTarget[] = targetPercentages.map((pct, idx) => {
    const fraction = pct / 100;
    const targetProfit = Number((maxProfitNumber * fraction).toFixed(2));
    const estimatedDays = Math.max(1, Math.round(safeDte * decayFractions[idx]));
    const daysSaved = safeDte - estimatedDays;

    const rawReturn = capitalAtRisk > 0 ? (targetProfit / capitalAtRisk) * 100 : 0;
    const apr = Number((rawReturn * (365 / estimatedDays)).toFixed(1));

    // Buyback target price for short option if present
    let buybackOptionPrice = 0;
    if (shortLeg) {
      // e.g. sold at $0.60, 50% profit means buy back at $0.30 (1 - 0.5 = 0.5 of entry)
      buybackOptionPrice = Number((shortLeg.entryPrice * (1 - fraction)).toFixed(2));
    }

    const velocityMultiplier = Number((apr / Math.max(1, baseApr)).toFixed(2));

    return {
      percent: pct,
      targetProfit,
      buybackOptionPrice,
      daysHeld: estimatedDays,
      annualizedApr: apr,
      rawReturn: Number(rawReturn.toFixed(2)),
      velocityMultiplier,
      capitalFreedDays: daysSaved,
    };
  });

  return {
    hasShortOption,
    shortLeg,
    capitalAtRisk,
    dte: safeDte,
    targets,
  };
}

// Roll Simulation Analysis
export interface RollSimulation {
  rollType: "OUT" | "UP_AND_OUT" | "DOWN_AND_OUT";
  title: string;
  currentStrike: number;
  currentEntryPrice: number;
  buybackPrice: number;
  newStrike: number;
  newPremium: number;
  netRollCredit: number; // per contract ($)
  netRollCreditDollars: number; // total ($)
  addedDte: number;
  totalDurationDays: number;
  adjustedStockBasis: number;
  totalCumulativeProfitCap: number;
  extendedAnnualizedApr: number;
  downsideBufferPercent: number;
}

export function calculateRollScenarios(
  legs: StrategyLeg[],
  metrics: StrategyMetrics,
  dte: number,
  currentStockPrice: number
): RollSimulation[] {
  const shortLeg = legs.find((l) => (l.type === "CALL" || l.type === "PUT") && l.action === "SELL");
  const stockLeg = legs.find((l) => l.type === "STOCK" && l.action === "BUY");

  if (!shortLeg) return [];

  const stockBasis = stockLeg ? stockLeg.entryPrice : currentStockPrice;
  const capital = metrics.totalCapitalRequired > 0 ? metrics.totalCapitalRequired : stockBasis * 100;
  const currentStrike = shortLeg.strike;
  const currentPremium = shortLeg.entryPrice;
  const isCall = shortLeg.type === "CALL";

  // Typical buyback at 50% profit or 80% decay
  const buybackPrice = Number((currentPremium * 0.5).toFixed(2));

  // 1. Roll Out in Time (Same Strike, +30 or +45 DTE)
  // Typically yields ~ 70-100% of current initial premium
  const rollOutPremium = Number((currentPremium * 0.85).toFixed(2));
  const rollOutCredit = Number((rollOutPremium - buybackPrice).toFixed(2));
  const rollOutCreditTotal = rollOutCredit * 100 * shortLeg.quantity;
  const addedDte1 = 35;
  const totalDays1 = dte + addedDte1;
  const adjustedBasis1 = Number((stockBasis - (currentPremium - buybackPrice + rollOutCredit)).toFixed(2));
  const totalMaxProfit1 = isCall
    ? ((currentStrike - adjustedBasis1) * 100 * shortLeg.quantity)
    : (currentPremium - buybackPrice + rollOutCredit) * 100 * shortLeg.quantity;
  const rollOutApr = Number((((totalMaxProfit1 / capital) * 100) * (365 / totalDays1)).toFixed(1));
  const downsideBuffer1 = Number((((stockBasis - adjustedBasis1) / stockBasis) * 100).toFixed(1));

  // 2. Roll Up & Out (Higher Strike, e.g. +5% to +10% higher strike, +45 DTE)
  // Captures more share appreciation while taking a modest credit
  const strikeStep = currentStrike > 50 ? 5 : (currentStrike > 10 ? 1 : 0.5);
  const upStrike = Number((currentStrike + strikeStep).toFixed(1));
  const rollUpPremium = Number((currentPremium * 0.70).toFixed(2));
  const rollUpCredit = Number((rollUpPremium - buybackPrice).toFixed(2));
  const rollUpCreditTotal = rollUpCredit * 100 * shortLeg.quantity;
  const addedDte2 = 45;
  const totalDays2 = dte + addedDte2;
  const adjustedBasis2 = Number((stockBasis - (currentPremium - buybackPrice + rollUpCredit)).toFixed(2));
  const totalMaxProfit2 = isCall
    ? ((upStrike - adjustedBasis2) * 100 * shortLeg.quantity)
    : (currentPremium - buybackPrice + rollUpCredit) * 100 * shortLeg.quantity;
  const rollUpApr = Number((((totalMaxProfit2 / capital) * 100) * (365 / totalDays2)).toFixed(1));
  const downsideBuffer2 = Number((((stockBasis - adjustedBasis2) / stockBasis) * 100).toFixed(1));

  return [
    {
      rollType: "OUT",
      title: `Roll Out (Same $${currentStrike.toFixed(1)} Strike)`,
      currentStrike,
      currentEntryPrice: currentPremium,
      buybackPrice,
      newStrike: currentStrike,
      newPremium: rollOutPremium,
      netRollCredit: rollOutCredit,
      netRollCreditDollars: rollOutCreditTotal,
      addedDte: addedDte1,
      totalDurationDays: totalDays1,
      adjustedStockBasis: adjustedBasis1,
      totalCumulativeProfitCap: totalMaxProfit1,
      extendedAnnualizedApr: rollOutApr,
      downsideBufferPercent: downsideBuffer1,
    },
    {
      rollType: "UP_AND_OUT",
      title: isCall ? `Roll Up & Out to $${upStrike.toFixed(1)} Strike` : `Roll Down & Out to $${(currentStrike - strikeStep).toFixed(1)} Strike`,
      currentStrike,
      currentEntryPrice: currentPremium,
      buybackPrice,
      newStrike: isCall ? upStrike : Number((currentStrike - strikeStep).toFixed(1)),
      newPremium: rollUpPremium,
      netRollCredit: rollUpCredit,
      netRollCreditDollars: rollUpCreditTotal,
      addedDte: addedDte2,
      totalDurationDays: totalDays2,
      adjustedStockBasis: adjustedBasis2,
      totalCumulativeProfitCap: totalMaxProfit2,
      extendedAnnualizedApr: rollUpApr,
      downsideBufferPercent: downsideBuffer2,
    },
  ];
}
