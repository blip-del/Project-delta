export interface OptionContract {
  contractSymbol: string;
  strike: number;
  currency: string;
  lastPrice: number;
  change: number;
  percentChange: number;
  volume: number;
  openInterest: number;
  bid: number;
  ask: number;
  impliedVolatility: number;
  inTheMoney: boolean;
  delta: number;
  gamma: number;
  theta: number;
  vega: number;
}

export interface StockQuote {
  symbol: string;
  shortName: string;
  regularMarketPrice: number;
  regularMarketChange: number;
  regularMarketChangePercent: number;
  regularMarketDayHigh: number;
  regularMarketDayLow: number;
  regularMarketVolume: number;
  fiftyTwoWeekHigh: number;
  fiftyTwoWeekLow: number;
  marketCap: number;
  exchange: string;
}

export interface OptionChainData {
  symbol: string;
  quote: StockQuote;
  expirationDates: number[];
  selectedExpiration: number;
  dte: number;
  strikes: number[];
  options: Array<{
    expirationDate: number;
    calls: OptionContract[];
    puts: OptionContract[];
  }>;
  isFallback?: boolean;
}

export type OptionType = "CALL" | "PUT" | "STOCK";
export type OrderAction = "BUY" | "SELL";

export interface StrategyLeg {
  id: string;
  type: OptionType;
  strike: number; // for STOCK, this represents the cost basis / purchase price
  action: OrderAction;
  quantity: number; // for options: number of contracts (1 = 100 shares); for stock: shares multiplier = quantity * 100
  entryPrice: number; // premium per share or stock entry price per share
  delta: number;
  contractSymbol: string;
  expirationDate: number;
  impliedVolatility?: number;
}

export interface StrategyMetrics {
  netPremium: number; // negative = net debit (cost), positive = net credit
  totalCapitalRequired: number; // total cash/collateral or stock investment required
  maxProfit: number | "Unlimited";
  maxLoss: number | "Unlimited";
  breakevens: number[];
  riskRewardRatio: string;
  positionDelta: number;
  annualizedReturn: number; // standard/max annualized APR %
  staticAnnualizedReturn?: number; // if stock stays flat/unchanged until expiration
  premiumAnnualizedReturn?: number; // purely from premium collected: (Premium / Capital) * (365 / DTE)
  maxAnnualizedReturn?: number; // up to maximum potential return: (Max Profit / Capital) * (365 / DTE)
  rawReturn: number; // un-annualized percentage return over holding period
  premiumRawReturn?: number; // un-annualized pure premium yield
  profitProbability: number; // 0 - 100%
}

export type DteStrategyType = "COVERED_CALL" | "CASH_SECURED_PUT";

export interface DteComparisonRow {
  expirationDate: number;
  formattedDate: string;
  dte: number;
  strike: number;
  contractSymbol: string;
  bid: number;
  ask: number;
  mid: number;
  spread: number;
  lastPrice: number;
  volume: number;
  openInterest: number;
  impliedVolatility: number;
  delta: number;
  theta: number;
  gamma: number;
  vega: number;
  inTheMoney: boolean;

  // Key Strategy Calculations
  capitalRequired: number; // per contract ($)
  premiumCollected: number; // per contract ($)
  premiumYieldPercent: number; // % raw premium yield
  premiumAnnualizedApr: number; // % annualized APR for collected premium
  maxProfitPerContract: number; // $ max profit if assigned/expired OTM
  maxReturnPercent: number; // % max raw return
  maxAnnualizedApr: number; // % max annualized APR
  breakEven: number; // $ breakeven price
  downsideBufferPercent: number; // % downside cushion before loss
}

export interface DteComparisonData {
  symbol: string;
  quote: StockQuote;
  strategy: DteStrategyType;
  optionType: "CALL" | "PUT";
  strike: number;
  availableStrikes: number[];
  rows: DteComparisonRow[];
  highestAprDte?: number;
  highestPremiumDte?: number;
  sweetSpotDte?: number;
}

export interface PinnedOptionContract {
  id: string;
  strategy: DteStrategyType;
  symbol: string;
  contractSymbol: string;
  expirationDate: number;
  formattedDate: string;
  dte: number;
  strike: number;
  bid: number;
  ask: number;
  mid: number;
  spread: number;
  lastPrice: number;
  volume: number;
  openInterest: number;
  impliedVolatility: number;
  delta: number;
  inTheMoney: boolean;

  // Custom user override for option cost / fill price
  customFillPrice: number;
  priceMode: "BID" | "MID" | "CUSTOM";
}

