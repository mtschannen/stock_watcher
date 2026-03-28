import { useState, useEffect, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import { getMarketInfo, MarketInfo } from "../api/client";
import StockChart from "../components/StockChart";
import LoadingSpinner from "../components/LoadingSpinner";

export default function StockDetail() {
  const { ticker } = useParams<{ ticker: string }>();
  const [info, setInfo] = useState<MarketInfo | null>(null);
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
    return () => clearInterval(intervalRef.current);
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

      {/* Full-width chart */}
      <StockChart ticker={symbol} />
    </div>
  );
}
