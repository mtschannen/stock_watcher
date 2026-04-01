import { useState, useEffect, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import { getMarketInfo, getFypmTickerStats, MarketInfo, FypmTickerStats } from "../api/client";
import StockChart from "../components/StockChart";
import LoadingSpinner from "../components/LoadingSpinner";

function ordinalSuffix(n: number): string {
  const v = n % 100;
  if (v >= 11 && v <= 13) return n + "th";
  switch (n % 10) {
    case 1: return n + "st";
    case 2: return n + "nd";
    case 3: return n + "rd";
    default: return n + "th";
  }
}

function zScoreColor(z: number | null): string {
  if (z === null) return "var(--text-secondary)";
  if (z > 1.5)  return "#ef4444";   // well above mean → expensive
  if (z > 0.5)  return "#f59e0b";   // slightly above
  if (z < -1.5) return "#22c55e";   // well below mean → cheap relative to history
  if (z < -0.5) return "#34d399";   // slightly below
  return "var(--text-secondary)";   // near mean
}

function zScoreLabel(z: number | null): string {
  if (z === null) return "—";
  if (z > 2)   return "Very High";
  if (z > 1)   return "Elevated";
  if (z > 0.5) return "Above Mean";
  if (z < -2)  return "Very Low";
  if (z < -1)  return "Depressed";
  if (z < -0.5) return "Below Mean";
  return "Near Mean";
}

export default function StockDetail() {
  const { ticker } = useParams<{ ticker: string }>();
  const [info, setInfo] = useState<MarketInfo | null>(null);
  const [fypmStats, setFypmStats] = useState<FypmTickerStats | null>(null);
  const [loading, setLoading] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval>>();

  const symbol = (ticker || "").toUpperCase();

  const fetchInfo = async () => {
    try {
      const res = await getMarketInfo(symbol);
      setInfo(res.data);
    } catch (err) {
      console.error("Error fetching stock info:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    fetchInfo();
    intervalRef.current = setInterval(fetchInfo, 15000);
    // Fetch FYPM stats once (not on interval — slow endpoint)
    const controller = new AbortController();
    getFypmTickerStats(symbol, 24, controller.signal)
      .then(r => setFypmStats(r.data))
      .catch(() => {/* no FYPM data available */});
    return () => {
      clearInterval(intervalRef.current);
      controller.abort();
    };
  }, [symbol]);

  const isUp = (info?.quote.change ?? 0) >= 0;
  const fypm = info?.quote ? info.fypm : null;

  const fypmValue = (v: number | "N/A") =>
    v === "N/A" ? "N/A" : Number(v).toFixed(2);

  return (
    <div>
      {/* Back link */}
      <div style={{ marginBottom: 16 }}>
        <Link
          to="/"
          style={{
            color: "var(--text-muted)",
            fontSize: 13,
            textDecoration: "none",
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          ← Market
        </Link>
      </div>

      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          gap: 16,
          marginBottom: 20,
          flexWrap: "wrap",
        }}
      >
        <span
          style={{
            fontSize: 28,
            fontWeight: 700,
            letterSpacing: "-0.02em",
            color: "var(--text-primary)",
            fontFamily: "var(--font-mono)",
          }}
        >
          {symbol}
        </span>
        {info && (
          <span style={{ fontSize: 18, color: "var(--text-secondary)", fontWeight: 400 }}>
            {info.quote.company_name}
          </span>
        )}
      </div>

      {/* Stats strip */}
      {loading ? (
        <div style={{ height: 80, display: "flex", alignItems: "center" }}>
          <LoadingSpinner type="dots" />
        </div>
      ) : info ? (
        <div
          style={{
            display: "flex",
            gap: 2,
            marginBottom: 20,
            flexWrap: "wrap",
          }}
        >
          {/* Price */}
          <div className="stat-tile">
            <div className="stat-label">Price</div>
            <div className="stat-value" style={{ fontSize: 26 }}>
              ${Number(info.quote.last_trade_price).toFixed(2)}
            </div>
          </div>

          {/* Change */}
          <div className="stat-tile">
            <div className="stat-label">Change</div>
            <div
              className="stat-value"
              style={{ color: isUp ? "var(--green)" : "var(--red)", fontSize: 18 }}
            >
              {isUp ? "▲" : "▼"} {Number(info.quote.change).toFixed(2)}
            </div>
            <div
              style={{
                fontSize: 13,
                color: isUp ? "var(--green)" : "var(--red)",
                opacity: 0.8,
              }}
            >
              {info.quote.change_in_percent}
            </div>
          </div>

          {/* Open */}
          <div className="stat-tile">
            <div className="stat-label">Open</div>
            <div className="stat-value">${Number(info.quote.open).toFixed(2)}</div>
          </div>

          {/* FYPM tiles */}
          {fypm && (
            <>
              <div className="stat-tile">
                <div className="stat-label">Derived FYPM</div>
                <div className="stat-value">{fypmValue(fypm.derivative_fypm)}</div>
              </div>
              <div className="stat-tile">
                <div className="stat-label">Linear FYPM</div>
                <div className="stat-value">{fypmValue(fypm.linear_fypm)}</div>
              </div>
              <div className="stat-tile">
                <div className="stat-label">Rate FYPM</div>
                <div className="stat-value">{fypmValue(fypm.rate_fypm)}</div>
              </div>
            </>
          )}
        </div>
      ) : (
        <p style={{ color: "var(--text-muted)" }}>Could not load data for {symbol}.</p>
      )}

      {/* FYPM Stickiness panel */}
      {fypmStats && (
        <div style={{
          background: "var(--bg-surface)",
          border: "1px solid var(--border-solid)",
          borderRadius: 8,
          padding: "16px 20px",
          marginBottom: 20,
        }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", marginBottom: 12 }}>
            FYPM Mean-Reversion Context
            <span style={{ fontSize: 11, fontWeight: 400, color: "var(--text-muted)", marginLeft: 8 }}>
              Linear FYPM · {fypmStats.lookbackMonths}mo history · {fypmStats.dataPoints} data points
            </span>
          </div>
          <div style={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
            {/* Current FYPM */}
            <div className="stat-tile">
              <div className="stat-label">Current FYPM</div>
              <div className="stat-value" style={{ fontSize: 20, color: fypmStats.currentFypm !== null ? "var(--text-primary)" : "var(--text-muted)" }}>
                {fypmStats.currentFypm !== null ? fypmStats.currentFypm.toFixed(2) : "N/A"}
              </div>
            </div>

            {/* Historical mean */}
            <div className="stat-tile">
              <div className="stat-label">2yr Mean FYPM</div>
              <div className="stat-value" style={{ fontSize: 20 }}>
                {fypmStats.mean.toFixed(2)}
              </div>
              <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                ±{fypmStats.std.toFixed(3)} σ
              </div>
            </div>

            {/* Z-score */}
            <div className="stat-tile">
              <div className="stat-label">Z-Score</div>
              <div className="stat-value" style={{ fontSize: 20, color: zScoreColor(fypmStats.zScore) }}>
                {fypmStats.zScore !== null ? (fypmStats.zScore >= 0 ? "+" : "") + fypmStats.zScore.toFixed(2) : "N/A"}
              </div>
              <div style={{ fontSize: 11, color: zScoreColor(fypmStats.zScore), fontWeight: 600 }}>
                {zScoreLabel(fypmStats.zScore)}
              </div>
            </div>

            {/* Percentile */}
            <div className="stat-tile">
              <div className="stat-label">Percentile</div>
              <div className="stat-value" style={{ fontSize: 20 }}>
                {fypmStats.percentile !== null ? ordinalSuffix(Math.round(fypmStats.percentile)) : "N/A"}
              </div>
              <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                vs own 2yr history
              </div>
            </div>

            {/* CV */}
            <div className="stat-tile">
              <div className="stat-label">FYPM Stability (CV)</div>
              <div className="stat-value" style={{
                fontSize: 20,
                color: fypmStats.cv < 0.15 ? "#22c55e" : fypmStats.cv > 0.4 ? "#ef4444" : "#f59e0b",
              }}>
                {(fypmStats.cv * 100).toFixed(1)}%
              </div>
              <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                {fypmStats.cv < 0.15 ? "Sticky" : fypmStats.cv < 0.4 ? "Moderate" : "Volatile"}
              </div>
            </div>

            {/* Range */}
            <div className="stat-tile">
              <div className="stat-label">2yr FYPM Range</div>
              <div className="stat-value" style={{ fontSize: 16 }}>
                {fypmStats.historicalMin.toFixed(2)} – {fypmStats.historicalMax.toFixed(2)}
              </div>
            </div>
          </div>

          {/* Interpretation */}
          {fypmStats.zScore !== null && (
            <div style={{ marginTop: 12, fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.6, borderTop: "1px solid var(--border-solid)", paddingTop: 10 }}>
              {fypmStats.zScore > 1.5
                ? `${symbol}'s FYPM is significantly above its 2-year mean (${fypmStats.zScore >= 0 ? "+" : ""}${fypmStats.zScore.toFixed(2)}σ, ${fypmStats.percentile?.toFixed(0)}th percentile). If FYPM is mean-reverting, this may indicate the stock is currently expensive relative to its own history — price may need to fall, or book value growth accelerate, for FYPM to return to its baseline of ${fypmStats.mean.toFixed(2)}.`
                : fypmStats.zScore < -1.5
                ? `${symbol}'s FYPM is significantly below its 2-year mean (${fypmStats.zScore.toFixed(2)}σ, ${fypmStats.percentile?.toFixed(0)}th percentile). If FYPM is mean-reverting, this may indicate the stock is currently cheap relative to its own history — price may need to rise for FYPM to return to its baseline of ${fypmStats.mean.toFixed(2)}.`
                : `${symbol}'s FYPM is near its 2-year mean (${fypmStats.zScore >= 0 ? "+" : ""}${fypmStats.zScore.toFixed(2)}σ, ${fypmStats.percentile?.toFixed(0)}th percentile). No strong mean-reversion signal — current valuation is in line with this stock's recent history (mean ${fypmStats.mean.toFixed(2)}).`
              }
              {" "}CV of {(fypmStats.cv * 100).toFixed(1)}% indicates this stock's FYPM is {fypmStats.cv < 0.15 ? "very stable (sticky)" : fypmStats.cv < 0.4 ? "moderately stable" : "highly variable"} over time.
            </div>
          )}
        </div>
      )}

      {/* Full-width chart */}
      <StockChart ticker={symbol} />
    </div>
  );
}
