"""
Options Analyzer Terminal - Streamlit Web Application
Personal Options Analysis & Strategy Payoff Simulator using yfinance, pandas, and plotly.
"""

import streamlit as st
import yfinance as yf
import pandas as pd
import numpy as np
import plotly.graph_objects as go
from datetime import datetime
import math
from scipy.stats import norm

# Page Configuration - Terminal Dark Theme
st.set_page_config(
    page_title="Options Terminal - yfinance",
    page_icon="📈",
    layout="wide",
    initial_sidebar_state="expanded",
)

# Custom CSS for ApexVol / Dark Terminal Aesthetic
st.markdown("""
<style>
    /* Dark terminal background */
    .stApp {
        background-color: #080d14;
        color: #e2e8f0;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    }
    
    /* Top metric cards */
    .metric-card {
        background: #0d1520;
        border: 1px solid #1c2838;
        border-radius: 8px;
        padding: 12px 16px;
        margin-bottom: 8px;
    }
    .metric-label {
        font-size: 11px;
        text-transform: uppercase;
        color: #64748b;
        letter-spacing: 0.05em;
        font-weight: 600;
        margin-bottom: 4px;
    }
    .metric-value {
        font-size: 20px;
        font-weight: 700;
        color: #f8fafc;
        font-family: 'JetBrains Mono', monospace, monospace;
    }
    .metric-sub {
        font-size: 12px;
        font-weight: 500;
    }
    .text-emerald { color: #00dc82; }
    .text-rose { color: #f43f5e; }
    .text-cyan { color: #38bdf8; }

    /* Tables */
    .dataframe {
        font-family: 'JetBrains Mono', monospace;
        font-size: 12px !important;
    }
    
    /* Buttons */
    .stButton>button {
        background-color: #0f1c2e;
        color: #00dc82;
        border: 1px solid #1e3a5f;
        border-radius: 6px;
        font-weight: 600;
        transition: all 0.2s ease;
    }
    .stButton>button:hover {
        background-color: #00dc82;
        color: #080d14;
        border-color: #00dc82;
    }
</style>
""", unsafe_allow_html=True)

# -------------------------------------------------------------
# BLACK-SCHOLES & GREEKS UTILITIES
# -------------------------------------------------------------
def calculate_greeks(is_call: bool, S: float, K: float, T: float, r: float = 0.045, sigma: float = 0.3):
    """Calculates Black-Scholes Delta and theoretical value."""
    if T <= 0 or sigma <= 0.001 or S <= 0 or K <= 0:
        delta = 1.0 if (is_call and S > K) else (-1.0 if (not is_call and S < K) else 0.0)
        return delta, max(0.0, S - K if is_call else K - S)

    d1 = (math.log(S / K) + (r + 0.5 * sigma ** 2) * T) / (sigma * math.sqrt(T))
    d2 = d1 - sigma * math.sqrt(T)

    if is_call:
        delta = norm.cdf(d1)
        price = S * norm.cdf(d1) - K * math.exp(-r * T) * norm.cdf(d2)
    else:
        delta = norm.cdf(d1) - 1
        price = K * math.exp(-r * T) * norm.cdf(-d2) - S * norm.cdf(-d1)

    return round(delta, 3), max(0.01, round(price, 2))

# -------------------------------------------------------------
# CACHED DATA FETCHING
# -------------------------------------------------------------
@st.cache_data(ttl=120, show_spinner=False)
def fetch_ticker_data(ticker_symbol: str):
    """Fetches stock quote, available expirations, and info."""
    symbol = ticker_symbol.strip().upper()
    try:
        stock = yf.Ticker(symbol)
        info = stock.info or {}
        price = info.get("regularMarketPrice") or info.get("currentPrice") or info.get("previousClose")
        if price is None:
            # Try fast_info
            price = getattr(stock.fast_info, "last_price", None)

        expirations = stock.options
        return stock, info, price, expirations, None
    except Exception as e:
        return None, {}, None, [], str(e)

@st.cache_data(ttl=120, show_spinner=False)
def fetch_options_chain(ticker_symbol: str, expiration_date: str):
    """Fetches options chain for a specific expiration date."""
    try:
        stock = yf.Ticker(ticker_symbol)
        opt = stock.option_chain(expiration_date)
        return opt.calls, opt.puts, None
    except Exception as e:
        return None, None, str(e)

# -------------------------------------------------------------
# SIDEBAR CONTROLS
# -------------------------------------------------------------
st.sidebar.markdown("### ⚡ **Apex Terminal**")
st.sidebar.caption("Options Chain & Payoff Analyzer")

# Popular Quick Tickers
st.sidebar.markdown("**Quick Watchlist**")
col_w1, col_w2, col_w3, col_w4 = st.sidebar.columns(4)
if col_w1.button("NVDA"): st.session_state.ticker_input = "NVDA"
if col_w2.button("AAPL"): st.session_state.ticker_input = "AAPL"
if col_w3.button("TSLA"): st.session_state.ticker_input = "TSLA"
if col_w4.button("SPY"): st.session_state.ticker_input = "SPY"

if "ticker_input" not in st.session_state:
    st.session_state.ticker_input = "AAPL"

ticker = st.sidebar.text_input("Stock Ticker Symbol", value=st.session_state.ticker_input).strip().upper()

# Fetch stock data
with st.spinner(f"Fetching market data for {ticker}..."):
    stock, info, current_price, expirations, err = fetch_ticker_data(ticker)

if err or not current_price:
    st.error(f"❌ Error fetching data for ticker '{ticker}'. Please verify the symbol or try NVDA / AAPL / TSLA / SPY.")
    st.info(f"Details: {err}")
    st.stop()

if not expirations or len(expirations) == 0:
    st.warning(f"⚠️ No options chain found for '{ticker}'. This security might not have listed US equity options.")
    st.stop()

# Expiration Selector with DTE
today = datetime.now()
exp_options = []
for exp in expirations:
    try:
        exp_dt = datetime.strptime(exp, "%Y-%m-%d")
        dte = (exp_dt - today).days
        exp_options.append(f"{exp} ({dte}d)")
    except Exception:
        exp_options.append(exp)

selected_exp_label = st.sidebar.selectbox("Select Expiration Date", options=exp_options, index=0)
selected_exp = selected_exp_label.split(" ")[0]

# Calculate DTE for selected expiration
try:
    exp_datetime = datetime.strptime(selected_exp, "%Y-%m-%d")
    dte_selected = max(1, (exp_datetime - today).days)
except Exception:
    dte_selected = 30

# Strike Filter
strike_filter = st.sidebar.selectbox(
    "Strike Filter",
    options=["Near The Money (±15%)", "All Strikes", "Near The Money (±30%)", "Top 20 Strikes"],
    index=0
)

# -------------------------------------------------------------
# MAIN DASHBOARD - HEADER METRICS
# -------------------------------------------------------------
prev_close = info.get("regularMarketPreviousClose", current_price)
change = current_price - prev_close
pct_change = (change / prev_close) * 100 if prev_close else 0

col1, col2, col3, col4, col5 = st.columns(5)
with col1:
    st.markdown(f"""
    <div class="metric-card">
        <div class="metric-label">{ticker} Stock Price</div>
        <div class="metric-value">${current_price:,.2f}</div>
        <div class="metric-sub {'text-emerald' if change >= 0 else 'text-rose'}">
            {'+' if change >= 0 else ''}{change:.2f} ({'+' if pct_change >= 0 else ''}{pct_change:.2f}%)
        </div>
    </div>
    """, unsafe_allow_html=True)

with col2:
    dte_label = f"{dte_selected} Days"
    st.markdown(f"""
    <div class="metric-card">
        <div class="metric-label">Selected Expiration</div>
        <div class="metric-value">{selected_exp}</div>
        <div class="metric-sub text-cyan">{dte_label} to expiry</div>
    </div>
    """, unsafe_allow_html=True)

with col3:
    day_low = info.get("regularMarketDayLow", current_price * 0.99)
    day_high = info.get("regularMarketDayHigh", current_price * 1.01)
    st.markdown(f"""
    <div class="metric-card">
        <div class="metric-label">Day Range</div>
        <div class="metric-value">${day_low:.2f} - ${day_high:.2f}</div>
        <div class="metric-sub">52W: ${info.get('fiftyTwoWeekLow', 0):.2f} - ${info.get('fiftyTwoWeekHigh', 0):.2f}</div>
    </div>
    """, unsafe_allow_html=True)

with col4:
    # Expected Move estimate: Stock Price * IV * sqrt(DTE/365)
    est_iv = 0.30
    exp_move = current_price * est_iv * math.sqrt(dte_selected / 365)
    st.markdown(f"""
    <div class="metric-card">
        <div class="metric-label">Expected Move (±1σ)</div>
        <div class="metric-value">±${exp_move:.2f}</div>
        <div class="metric-sub text-emerald">${current_price - exp_move:.2f} — ${current_price + exp_move:.2f}</div>
    </div>
    """, unsafe_allow_html=True)

with col5:
    vol = info.get("regularMarketVolume", 0)
    st.markdown(f"""
    <div class="metric-card">
        <div class="metric-label">Market Volume</div>
        <div class="metric-value">{vol:,.0f}</div>
        <div class="metric-sub">Cap: ${info.get('marketCap', 0) / 1e9:.1f}B</div>
    </div>
    """, unsafe_allow_html=True)

# -------------------------------------------------------------
# FETCH OPTIONS CHAIN
# -------------------------------------------------------------
with st.spinner("Fetching options chain..."):
    calls_df, puts_df, chain_err = fetch_options_chain(ticker, selected_exp)

if chain_err or calls_df is None or calls_df.empty:
    st.error(f"Failed to load options chain for {selected_exp}: {chain_err}")
    st.stop()

# Ensure bid / ask exists
for df in [calls_df, puts_df]:
    if "bid" not in df.columns or df["bid"].isna().all():
        df["bid"] = df["lastPrice"] * 0.98
    if "ask" not in df.columns or df["ask"].isna().all():
        df["ask"] = df["lastPrice"] * 1.02
    df["mid"] = ((df["bid"] + df["ask"]) / 2).round(2)

# Compute Delta if missing
T_years = dte_selected / 365
for idx, row in calls_df.iterrows():
    iv = row.get("impliedVolatility", 0.3)
    if iv <= 0 or math.isnan(iv): iv = 0.3
    delta, _ = calculate_greeks(True, current_price, row["strike"], T_years, 0.045, iv)
    calls_df.at[idx, "delta"] = delta

for idx, row in puts_df.iterrows():
    iv = row.get("impliedVolatility", 0.3)
    if iv <= 0 or math.isnan(iv): iv = 0.3
    delta, _ = calculate_greeks(False, current_price, row["strike"], T_years, 0.045, iv)
    puts_df.at[idx, "delta"] = delta

# Merge calls and puts into unified table matching "option table.jpg"
chain_table = pd.merge(
    calls_df[["strike", "bid", "ask", "mid", "lastPrice", "volume", "openInterest", "impliedVolatility", "delta", "contractSymbol"]],
    puts_df[["strike", "bid", "ask", "mid", "lastPrice", "volume", "openInterest", "impliedVolatility", "delta", "contractSymbol"]],
    on="strike",
    suffixes=("_call", "_put")
)

# Apply Strike Filter
if strike_filter == "Near The Money (±15%)":
    chain_table = chain_table[(chain_table["strike"] >= current_price * 0.85) & (chain_table["strike"] <= current_price * 1.15)]
elif strike_filter == "Near The Money (±30%)":
    chain_table = chain_table[(chain_table["strike"] >= current_price * 0.70) & (chain_table["strike"] <= current_price * 1.30)]
elif strike_filter == "Top 20 Strikes":
    chain_table["dist"] = (chain_table["strike"] - current_price).abs()
    chain_table = chain_table.sort_values("dist").head(20).sort_values("strike").drop(columns=["dist"])

chain_table = chain_table.sort_values("strike").reset_index(drop=True)

# -------------------------------------------------------------
# OPTIONS CHAIN TABLE (Visual Style of user image)
# -------------------------------------------------------------
st.markdown("### 📊 **Options Chain**")
st.caption(f"{ticker} Expiration: {selected_exp} ({dte_selected} DTE) | Shaded rows indicate In-The-Money (ITM)")

# Format display columns
display_df = pd.DataFrame()
display_df["Call Delta"] = chain_table["delta_call"].apply(lambda x: f"{x:.3f}")
display_df["Call Bid"] = chain_table["bid_call"].apply(lambda x: f"${x:.2f}")
display_df["Call Ask"] = chain_table["ask_call"].apply(lambda x: f"${x:.2f}")
display_df["Call Vol"] = chain_table["volume_call"].fillna(0).astype(int)
display_df["Call OI"] = chain_table["openInterest_call"].fillna(0).astype(int)
display_df["Call IV"] = chain_table["impliedVolatility_call"].apply(lambda x: f"{x*100:.1f}%")

display_df["STRIKE"] = chain_table["strike"].apply(lambda x: f"${x:.2f}")

display_df["Put IV"] = chain_table["impliedVolatility_put"].apply(lambda x: f"{x*100:.1f}%")
display_df["Put Bid"] = chain_table["bid_put"].apply(lambda x: f"${x:.2f}")
display_df["Put Ask"] = chain_table["ask_put"].apply(lambda x: f"${x:.2f}")
display_df["Put Vol"] = chain_table["volume_put"].fillna(0).astype(int)
display_df["Put OI"] = chain_table["openInterest_put"].fillna(0).astype(int)
display_df["Put Delta"] = chain_table["delta_put"].apply(lambda x: f"{x:.3f}")

# Display dataframe with Streamlit
st.dataframe(
    display_df,
    use_container_width=True,
    height=340
)

# -------------------------------------------------------------
# STRATEGY BUILDER & MULTI-CONTRACT SELECTOR
# -------------------------------------------------------------
st.markdown("---")
st.markdown("### 🎯 **Strategy Builder & Multi-Contract Analyzer**")
st.caption("Select contracts to analyze aggregate Profit/Loss, Greeks, Breakevens, and Annualized Return.")

# Strategy Quick Presets
col_p1, col_p2, col_p3, col_p4, col_p5 = st.columns(5)
preset = None
if col_p1.button("Long Call (Bullish)"): preset = "LONG_CALL"
if col_p2.button("Long Put (Bearish)"): preset = "LONG_PUT"
if col_p3.button("Bull Call Spread"): preset = "BULL_CALL_SPREAD"
if col_p4.button("Covered Call"): preset = "COVERED_CALL"
if col_p5.button("Straddle (Volatility)"): preset = "STRADDLE"

# Find nearest ATM strike
strikes_list = chain_table["strike"].tolist()
atm_strike = min(strikes_list, key=lambda x: abs(x - current_price))
atm_idx = strikes_list.index(atm_strike)

# Contract selection options
contract_options = []
contract_lookup = {}

for _, row in chain_table.iterrows():
    k = row["strike"]
    call_lbl = f"CALL ${k:.2f} (Ask: ${row['ask_call']:.2f}, Mid: ${row['mid_call']:.2f}, Δ: {row['delta_call']:.2f})"
    put_lbl = f"PUT ${k:.2f} (Ask: ${row['ask_put']:.2f}, Mid: ${row['mid_put']:.2f}, Δ: {row['delta_put']:.2f})"
    
    contract_options.append(call_lbl)
    contract_lookup[call_lbl] = {
        "type": "CALL",
        "strike": k,
        "bid": row["bid_call"],
        "ask": row["ask_call"],
        "mid": row["mid_call"],
        "delta": row["delta_call"],
        "symbol": row["contractSymbol_call"]
    }
    
    contract_options.append(put_lbl)
    contract_lookup[put_lbl] = {
        "type": "PUT",
        "strike": k,
        "bid": row["bid_put"],
        "ask": row["ask_put"],
        "mid": row["mid_put"],
        "delta": row["delta_put"],
        "symbol": row["contractSymbol_put"]
    }

# Default contract based on preset
default_contracts = []
if preset == "LONG_CALL":
    default_contracts = [c for c in contract_options if f"CALL ${atm_strike:.2f}" in c][:1]
elif preset == "LONG_PUT":
    default_contracts = [c for c in contract_options if f"PUT ${atm_strike:.2f}" in c][:1]
elif preset == "BULL_CALL_SPREAD":
    higher_k = strikes_list[min(len(strikes_list)-1, atm_idx + 2)]
    default_contracts = [
        c for c in contract_options if f"CALL ${atm_strike:.2f}" in c or f"CALL ${higher_k:.2f}" in c
    ][:2]
elif preset == "STRADDLE":
    default_contracts = [
        c for c in contract_options if f"CALL ${atm_strike:.2f}" in c or f"PUT ${atm_strike:.2f}" in c
    ][:2]
else:
    # Default to single ATM call
    default_contracts = [c for c in contract_options if f"CALL ${atm_strike:.2f}" in c][:1]

selected_contracts = st.multiselect(
    "Choose Option Contract(s) to Analyze:",
    options=contract_options,
    default=default_contracts
)

if not selected_contracts:
    st.info("💡 Select one or more option contracts above to calculate risk metrics and plot the interactive payoff chart.")
    st.stop()

# Configure each selected leg (Action, Quantity, Premium)
st.markdown("##### **Leg Configuration**")
legs = []
leg_cols = st.columns(len(selected_contracts))

for i, contract_label in enumerate(selected_contracts):
    c_info = contract_lookup[contract_label]
    with leg_cols[i % len(leg_cols)]:
        st.markdown(f"**Leg {i+1}: {c_info['type']} ${c_info['strike']:.2f}**")
        action = st.selectbox(f"Action #{i+1}", ["Buy (Long)", "Sell (Short)"], key=f"act_{i}")
        qty = st.number_input(f"Contracts #{i+1}", min_value=1, max_value=100, value=1, key=f"qty_{i}")
        default_price = c_info["ask"] if "Buy" in action else c_info["bid"]
        price = st.number_input(f"Price ($) #{i+1}", value=float(default_price), step=0.05, format="%.2f", key=f"price_{i}")
        
        legs.append({
            "type": c_info["type"],
            "strike": c_info["strike"],
            "action": "BUY" if "Buy" in action else "SELL",
            "qty": qty,
            "price": price,
            "delta": c_info["delta"]
        })

# -------------------------------------------------------------
# CALCULATE STRATEGY METRICS & PAYOFF CURVE
# -------------------------------------------------------------
# Net Premium Calculation
net_cash_flow = 0.0
position_delta = 0.0

for leg in legs:
    sign = -1 if leg["action"] == "BUY" else 1
    net_cash_flow += sign * (leg["price"] * 100 * leg["qty"])
    delta_sign = 1 if leg["action"] == "BUY" else -1
    position_delta += delta_sign * leg["delta"] * leg["qty"]

# Determine Price Range for Simulation
min_strike = min([l["strike"] for l in legs] + [current_price])
max_strike = max([l["strike"] for l in legs] + [current_price])
sim_min = max(1.0, min_strike * 0.70)
sim_max = max_strike * 1.30
price_points = np.linspace(sim_min, sim_max, 300)

payoffs = []
for p in price_points:
    total_val = 0.0
    for leg in legs:
        if leg["type"] == "CALL":
            intrinsic = max(0.0, p - leg["strike"])
        else:
            intrinsic = max(0.0, leg["strike"] - p)
        
        if leg["action"] == "BUY":
            pnl = (intrinsic - leg["price"]) * 100 * leg["qty"]
        else:
            pnl = (leg["price"] - intrinsic) * 100 * leg["qty"]
        
        total_val += pnl
    payoffs.append(total_val)

payoffs = np.array(payoffs)
max_profit = np.max(payoffs)
max_loss = np.min(payoffs)

# Find Breakeven Points (where payoff crosses zero)
zero_crossings = []
for i in range(len(payoffs) - 1):
    if (payoffs[i] <= 0 and payoffs[i+1] >= 0) or (payoffs[i] >= 0 and payoffs[i+1] <= 0):
        # linear interpolation
        x0, x1 = price_points[i], price_points[i+1]
        y0, y1 = payoffs[i], payoffs[i+1]
        if y1 != y0:
            be = x0 - y0 * (x1 - x0) / (y1 - y0)
            zero_crossings.append(round(be, 2))

# Annualized Return on Investment / Risk (ROC)
capital_at_risk = abs(net_cash_flow) if net_cash_flow < 0 else (abs(max_loss) if max_loss < 0 else 100.0)
annualized_return = 0.0
if capital_at_risk > 0 and net_cash_flow > 0:
    # Net credit strategy (e.g. credit spread, covered call)
    period_return = (net_cash_flow / capital_at_risk)
    annualized_return = period_return * (365 / dte_selected) * 100

# -------------------------------------------------------------
# DISPLAY STRATEGY METRICS CARDS
# -------------------------------------------------------------
st.markdown("##### **Position Risk & Return Analytics**")
m_col1, m_col2, m_col3, m_col4, m_col5 = st.columns(5)

with m_col1:
    cost_text = f"${abs(net_cash_flow):,.2f} Debit" if net_cash_flow < 0 else f"${net_cash_flow:,.2f} Credit"
    st.metric("Net Premium", cost_text, delta="Capital Required" if net_cash_flow < 0 else "Instant Cash Inflow")

with m_col2:
    profit_text = f"${max_profit:,.2f}" if max_profit < 100000 else "Unlimited"
    st.metric("Max Profit", profit_text)

with m_col3:
    loss_text = f"${abs(max_loss):,.2f}" if max_loss > -100000 else "Unlimited"
    st.metric("Max Loss", loss_text)

with m_col4:
    be_str = ", ".join([f"${b:.2f}" for b in zero_crossings]) if zero_crossings else "None in range"
    st.metric("Breakeven Price(s)", be_str)

with m_col5:
    if annualized_return > 0:
        st.metric("Annualized Return", f"{annualized_return:.1f}%", f"{dte_selected}d duration")
    else:
        st.metric("Position Delta", f"{position_delta:+.2f} Δ", "Bullish" if position_delta > 0 else "Bearish")

# -------------------------------------------------------------
# INTERACTIVE PROFIT / LOSS CHART (PLOTLY)
# -------------------------------------------------------------
st.markdown("##### **Interactive Profit/Loss Payoff at Expiration**")

fig = go.Figure()

# Add zero line
fig.add_hline(y=0, line_dash="solid", line_color="#334155", line_width=1)

# Payoff curve
fig.add_trace(go.Scatter(
    x=price_points,
    y=payoffs,
    mode="lines",
    name="P/L at Expiration",
    line=dict(color="#00dc82", width=3),
    hovertemplate="Stock Price: $%{x:.2f}<br>Profit/Loss: $%{y:,.2f}<extra></extra>"
))

# Shade profit and loss areas
fig.add_trace(go.Scatter(
    x=price_points,
    y=np.maximum(0, payoffs),
    fill='tozeroy',
    fillcolor='rgba(0, 220, 130, 0.12)',
    line=dict(width=0),
    showlegend=False,
    hoverinfo='skip'
))

fig.add_trace(go.Scatter(
    x=price_points,
    y=np.minimum(0, payoffs),
    fill='tozeroy',
    fillcolor='rgba(244, 63, 94, 0.12)',
    line=dict(width=0),
    showlegend=False,
    hoverinfo='skip'
))

# Add current stock price vertical line
fig.add_vline(
    x=current_price,
    line_dash="dash",
    line_color="#38bdf8",
    line_width=2,
    annotation_text=f"Current: ${current_price:.2f}",
    annotation_position="top right",
    annotation_font_color="#38bdf8"
)

# Add breakeven lines
for be in zero_crossings:
    fig.add_vline(
        x=be,
        line_dash="dot",
        line_color="#f59e0b",
        line_width=1.5,
        annotation_text=f"BE: ${be:.2f}",
        annotation_position="bottom right",
        annotation_font_color="#f59e0b"
    )

fig.update_layout(
    paper_bgcolor="#080d14",
    plot_bgcolor="#0d1520",
    font=dict(color="#94a3b8", family="JetBrains Mono, monospace"),
    margin=dict(l=40, r=40, t=30, b=40),
    height=420,
    xaxis=dict(
        title="Underlying Stock Price ($)",
        gridcolor="#1e293b",
        zeroline=False
    ),
    yaxis=dict(
        title="Profit / Loss ($)",
        gridcolor="#1e293b",
        zeroline=False
    ),
    hovermode="x unified"
)

st.plotly_chart(fig, use_container_width=True)

st.markdown("---")
st.caption("⚡ Built with Python, Streamlit, yfinance, pandas, and Plotly. Live options data cached for speed and stability.")
