# Implementation Plan: Same Strike DTE Comparison Matrix

Implement a dedicated comparison tool that allows traders to evaluate an identical strike price across the 10 closest expiration dates (DTEs). This empowers users to identify optimal yield, annualized return (APR), and duration risk for Covered Calls and Cash-Secured Puts without cluttering the main chain table.

---

## 1. Feature Architecture & User Scope

Based on user feedback:
- **Placement**: Dedicated tab in the primary navigation bar (`"DTE Strike Comparison"`), preserving the clean layout of the Options Chain and Strategy Builder.
- **Strategies Supported**:
  - **Covered Call**: Evaluates selling calls against 100 shares of stock (tracks Bid price, Premium Yield %, Annualized APR %, Max Return % if assigned, Max APR %, downside protection).
  - **Cash-Secured Put**: Evaluates selling puts secured by cash collateral (tracks Bid price, Premium Yield % against collateral, Annualized APR %, break-even, downside buffer).
- **Presentation**:
  - **Interactive APR Curve Chart**: Visualizes Annualized APR % and Total Return % across DTEs to reveal the optimal decay/velocity sweet spot.
  - **Comparative Ranking Table**: Detailed side-by-side comparison of the 10 closest expirations with metrics, delta, IV, bid/ask spreads, and a one-click "Add to Strategy Builder" action.

---

## 2. Mathematical Calculations & Formulas

For Stock Price $S$, Selected Strike $K$, Option Bid $B$, and Days to Expiration $d$:

### A. Covered Call (Selling Call against Stock)
- **Bid Premium Collected**: $B \times 100$ per contract.
- **Static Yield %**: $(B / S) \times 100$.
- **Annualized Premium APR %**: $(B / S) \times (365 / d) \times 100$.
- **Max Return % (if assigned at strike $K$)**:
  - If $K \ge S$: $((K - S + B) / S) \times 100$
  - If $K < S$: $(B / S) \times 100$ (locked at premium minus intrinsic gap)
- **Max Return Annualized APR %**: $(\text{Max Return \%}) \times (365 / d)$.
- **Downside Protection %**: $(B / S) \times 100$.
- **Break-even Price**: $S - B$.

### B. Cash-Secured Put (Selling Put secured by Collateral)
- **Collateral Required**: $K \times 100$.
- **Bid Premium Collected**: $B \times 100$ per contract.
- **Premium Yield % (Return on Capital)**: $(B / K) \times 100$.
- **Annualized APR %**: $(B / K) \times (365 / d) \times 100$.
- **Downside Cushion %**: $((S - (K - B)) / S) \times 100$.
- **Break-even Price**: $K - B$.

---

## 3. Step-by-Step Implementation Tasks

### Step 1: Server-Side Batch DTE Options Endpoint
- In `server.ts`, add a high-performance endpoint `/api/options/:ticker/strike-dte-comparison` accepting `strike`, `type` (`CALL` | `PUT`), and `limit` (default: 10).
- The server will query the 10 closest expiration chains in parallel using the authenticated Yahoo Finance session and in-memory cache, returning the specific contract data for the requested strike across each expiration.
- Provide a smooth fallback with simulated interpolation if external rate limits occur.

### Step 2: Client Service Integration
- Update `src/services/optionsService.ts` with `fetchStrikeDteComparison(ticker, strike, type)`.
- Define clean TypeScript interfaces in `src/types.ts` for `DteComparisonRow` and `DteComparisonData`.

### Step 3: DTE Comparison View Component (`src/components/DteComparisonView.tsx`)
- **Control Bar**:
  - Strategy Toggle: `Covered Call (Call)` vs `Cash-Secured Put (Put)`.
  - Strike Selector: Dropdown with all available strikes in the chain, with quick buttons (ATM, +1 OTM, +2 OTM) and current underlying price display.
  - Shares / Contracts multiplier: Defaults to 1 contract (100 shares / collateral).
- **Summary Stat Highlights**:
  - "Sweet Spot DTE" (Highest APR velocity).
  - "Max Premium DTE".
  - "Shortest vs Longest Yield Comparison".
- **APR & Yield Curve Chart**:
  - Recharts line/area chart showing DTE on the X-axis vs Annualized APR % (emerald line) and Absolute Yield % (cyan bar/line).
- **Comparison Table**:
  - Columns: Expiration Date, DTE, Bid, Ask, Mid, Spread, Premium ($ & %), Annualized APR %, Max Return %, Max APR %, Delta, IV %, Break-even, Actions.
  - Highlight badge for Highest APR and Lowest Spread.
  - "Load in Strategy" button to seamlessly send that expiration/strike into the Payoff Chart and Strategy Builder.

### Step 4: UI Navigation & Cross-Tab Shortcuts
- In `src/App.tsx`, add the `"DTE Comparison"` tab with icon (`CalendarRange` / `Layers`) in the top navigation bar.
- In `src/components/OptionsChainTable.tsx`, add a small `"Compare DTEs"` shortcut icon button on each strike row, allowing traders to jump directly into the DTE comparison view with that strike preselected.

---

## 4. Verification & Testing

1. **Compilation**: Run `compile_applet` to ensure error-free TypeScript build.
2. **Strategy Calculations Verification**:
   - Verify Covered Call APR with known benchmarks (e.g., $150 stock, $155 strike, $3.00 bid, 30 DTE $\rightarrow$ yield = 2.0%, APR = 24.3%).
   - Verify Cash-Secured Put APR against collateral ($155 strike $\rightarrow$ $15,500 collateral).
3. **Data Fetching & Responsiveness**:
   - Verify responsive switching across popular tickers (AAPL, NVDA, TSLA, SPY).
   - Test changing strikes dynamically and toggling between Call and Put modes.
