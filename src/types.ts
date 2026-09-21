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

export type OptionType = "CALL" | "PUT";
export type OrderAction = "BUY" | "SELL";

export interface StrategyLeg {
  id: string;
  type: OptionType;
  strike: number;
  action: OrderAction;
  quantity: number;
  entryPrice: number; // premium per share
  delta: number;
  contractSymbol: string;
  expirationDate: number;
}

export interface StrategyMetrics {
  netPremium: number; // negative = net debit (cost), positive = net credit
  maxProfit: number | "Unlimited";
  maxLoss: number | "Unlimited";
  breakevens: number[];
  riskRewardRatio: string;
  positionDelta: number;
  annualizedReturn: number; // percentage
  profitProbability: number; // 0 - 100%
}
