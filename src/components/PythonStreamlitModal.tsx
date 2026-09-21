import React, { useState } from "react";
import { X, Copy, Check, Download, Terminal, FileCode, ExternalLink } from "lucide-react";

interface PythonStreamlitModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PythonStreamlitModal: React.FC<PythonStreamlitModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [copied, setCopied] = useState(false);
  const [activeFile, setActiveFile] = useState<"app.py" | "requirements.txt">("app.py");

  if (!isOpen) return null;

  const pythonCode = `"""
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

st.set_page_config(
    page_title="Options Terminal - yfinance",
    page_icon="📈",
    layout="wide",
    initial_sidebar_state="expanded",
)

# Custom CSS for Dark Terminal Theme
st.markdown("""
<style>
    .stApp { background-color: #080d14; color: #e2e8f0; }
    .metric-card {
        background: #0d1520;
        border: 1px solid #1c2838;
        border-radius: 8px;
        padding: 12px 16px;
    }
    .metric-label { font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: 600; }
    .metric-value { font-size: 20px; font-weight: 700; color: #f8fafc; font-family: monospace; }
</style>
""", unsafe_allow_html=True)

# 1. Cached Data Fetching
@st.cache_data(ttl=120, show_spinner=False)
def fetch_ticker_data(ticker_symbol: str):
    stock = yf.Ticker(ticker_symbol.strip().upper())
    info = stock.info or {}
    price = info.get("regularMarketPrice") or info.get("currentPrice") or getattr(stock.fast_info, "last_price", 150.0)
    expirations = stock.options
    return stock, info, price, expirations

@st.cache_data(ttl=120, show_spinner=False)
def fetch_options_chain(ticker_symbol: str, expiration_date: str):
    stock = yf.Ticker(ticker_symbol)
    opt = stock.option_chain(expiration_date)
    return opt.calls, opt.puts

# 2. Sidebar Controls
st.sidebar.markdown("### ⚡ **Apex Options Terminal**")
ticker = st.sidebar.text_input("Stock Ticker Symbol", value="AAPL").strip().upper()

stock, info, current_price, expirations = fetch_ticker_data(ticker)

if not expirations:
    st.error(f"No options found for {ticker}")
    st.stop()

selected_exp = st.sidebar.selectbox("Expiration Date", options=expirations)

# 3. Fetch Chain & Calculate
calls_df, puts_df = fetch_options_chain(ticker, selected_exp)

# Display Options Chain Table (Calls | Strike | Puts)
chain_table = pd.merge(
    calls_df[["strike", "bid", "ask", "lastPrice", "volume", "openInterest", "impliedVolatility"]],
    puts_df[["strike", "bid", "ask", "lastPrice", "volume", "openInterest", "impliedVolatility"]],
    on="strike",
    suffixes=("_call", "_put")
).sort_values("strike")

st.markdown(f"### 📊 Options Chain for {ticker} ({selected_exp})")
st.dataframe(chain_table, use_container_width=True)

# 4. Multi-Contract Selection & P/L Chart
st.markdown("### 🎯 Strategy Payoff Chart")
strikes = chain_table["strike"].tolist()
atm_strike = min(strikes, key=lambda x: abs(x - current_price))

# Strategy simulation points
sim_prices = np.linspace(current_price * 0.7, current_price * 1.3, 100)
# Long Call Payoff calculation example
call_row = chain_table[chain_table["strike"] == atm_strike].iloc[0]
premium = call_row["ask_call"] if call_row["ask_call"] > 0 else call_row["lastPrice_call"]
payoffs = [max(0, p - atm_strike) * 100 - (premium * 100) for p in sim_prices]

fig = go.Figure()
fig.add_hline(y=0, line_color="#475569")
fig.add_vline(x=current_price, line_dash="dash", line_color="#38bdf8", annotation_text="Current Price")
fig.add_trace(go.Scatter(x=sim_prices, y=payoffs, mode="lines", name="Payoff at Expiration", line=dict(color="#00dc82", width=3)))
fig.update_layout(paper_bgcolor="#080d14", plot_bgcolor="#0d1520", font=dict(color="#94a3b8"))
st.plotly_chart(fig, use_container_width=True)
`;

  const requirementsCode = `streamlit>=1.36.0
yfinance>=0.2.40
pandas>=2.2.0
plotly>=5.22.0
numpy>=1.26.0
scipy>=1.13.0
`;

  const currentCode = activeFile === "app.py" ? pythonCode : requirementsCode;

  const handleCopy = () => {
    navigator.clipboard.writeText(currentCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([currentCode], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = activeFile;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#0b131f] border border-[#1a2c42] rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#182638] bg-[#0d1624]">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
              <Terminal className="w-4 h-4" />
            </span>
            <div>
              <h3 className="text-sm font-bold text-white font-mono flex items-center gap-2">
                Ready-To-Run Python Streamlit App
              </h3>
              <p className="text-[11px] text-slate-400">
                Created with Python, Streamlit, yfinance, pandas, and Plotly.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 text-xs font-mono px-3 py-1.5 rounded bg-[#132236] hover:bg-[#1a2f4a] text-slate-200 border border-[#223955] transition-all"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? "Copied!" : "Copy Code"}</span>
            </button>

            <button
              onClick={handleDownload}
              className="flex items-center gap-1.5 text-xs font-mono px-3 py-1.5 rounded bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 transition-all"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download {activeFile}</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Tab switcher: app.py vs requirements.txt */}
        <div className="flex items-center gap-2 px-5 pt-3 bg-[#080d15] border-b border-[#152335]">
          <button
            onClick={() => setActiveFile("app.py")}
            className={`flex items-center gap-1.5 pb-2 px-3 text-xs font-mono border-b-2 transition-all ${
              activeFile === "app.py"
                ? "border-emerald-400 text-emerald-300 font-bold"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <FileCode className="w-3.5 h-3.5" />
            <span>app.py</span>
          </button>
          <button
            onClick={() => setActiveFile("requirements.txt")}
            className={`flex items-center gap-1.5 pb-2 px-3 text-xs font-mono border-b-2 transition-all ${
              activeFile === "requirements.txt"
                ? "border-emerald-400 text-emerald-300 font-bold"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <Terminal className="w-3.5 h-3.5" />
            <span>requirements.txt</span>
          </button>

          <div className="ml-auto text-[11px] text-slate-400 font-mono flex items-center gap-1">
            <span>Run locally:</span>
            <code className="bg-slate-900 text-emerald-400 px-2 py-0.5 rounded border border-slate-800">
              streamlit run app.py
            </code>
          </div>
        </div>

        {/* Code Content Box */}
        <div className="flex-1 overflow-auto p-4 bg-[#060a10]">
          <pre className="text-xs font-mono text-emerald-300/90 leading-relaxed overflow-x-auto whitespace-pre selection:bg-emerald-500/30">
            <code>{currentCode}</code>
          </pre>
        </div>

        {/* Footer info */}
        <div className="p-3 bg-[#0a111b] border-t border-[#182638] flex items-center justify-between text-[11px] text-slate-400 font-mono">
          <div>
            <span>💡 Note: Both </span>
            <span className="text-emerald-400 font-bold">app.py</span>
            <span> and </span>
            <span className="text-emerald-400 font-bold">requirements.txt</span>
            <span> are also saved directly in your project root!</span>
          </div>
          <button
            onClick={onClose}
            className="text-xs text-slate-300 hover:text-white px-3 py-1 rounded bg-[#132030] hover:bg-[#1a2b40]"
          >
            Close Viewer
          </button>
        </div>
      </div>
    </div>
  );
};
