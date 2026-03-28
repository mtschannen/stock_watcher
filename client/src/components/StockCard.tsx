import { Link } from "react-router-dom";
import { MarketStock, FypmBatchItem } from "../api/client";

interface StockCardProps {
  stock: MarketStock;
  /** undefined = still loading; null = no data; object = populated */
  fypm?: FypmBatchItem | null;
}

function fmt(v: number | null | undefined, decimals = 2): string {
  if (v == null) return "—";
  return v.toFixed(decimals);
}

function fmtDelta(v: number | null | undefined, decimals = 3): string {
  if (v == null) return "—";
  return (v >= 0 ? "+" : "") + v.toFixed(decimals);
}

function deltaColor(v: number | null | undefined): string {
  if (v == null) return "var(--text-muted)";
  if (v > 0) return "var(--green)";
  if (v < 0) return "var(--red)";
  return "var(--text-muted)";
}

export default function StockCard({ stock, fypm }: StockCardProps) {
  const isUp = stock.change >= 0;
  const arrow = isUp ? "▲" : "▼";

  const hasFypmValue = fypm != null && fypm.derivative_fypm !== null;

  return (
    <Link className="stock-card" to={`/stocks/${stock.ticker}`}>
      <div className="stock-card-content">
        {/* Ticker + change */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div className="stock-card-ticker">{stock.ticker}</div>
          <div className={`stock-card-change ${isUp ? "up" : "down"}`} style={{ fontSize: 11, marginTop: 2 }}>
            {arrow} {stock.change_pct}
          </div>
        </div>

        <div className="stock-card-name">{stock.company_name || stock.ticker}</div>
        <div className="stock-card-price">${stock.price.toFixed(2)}</div>

        {/* FYPM section — always rendered to keep card heights consistent */}
        <div style={{
          marginTop: 10,
          paddingTop: 8,
          borderTop: "1px solid var(--border)",
          display: "flex",
          flexDirection: "column",
          gap: 4,
        }}>
          {fypm === undefined ? (
            /* Loading */
            <>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 10, color: "var(--text-muted)", fontFamily: "var(--font-mono)", letterSpacing: "0.04em" }}>FYPM</span>
                <span style={{ fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--text-muted)" }}>…</span>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <span style={{ fontSize: 9, color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>L: …</span>
                <span style={{ fontSize: 9, color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>R: …</span>
              </div>
              <div style={{ display: "flex", gap: 10, marginTop: 1 }}>
                <span style={{ fontSize: 9, fontFamily: "var(--font-mono)", color: "var(--text-muted)" }}>1d …</span>
                <span style={{ fontSize: 9, fontFamily: "var(--font-mono)", color: "var(--text-muted)" }}>30d …</span>
              </div>
            </>
          ) : !hasFypmValue ? (
            /* No FYPM data — likely API limit reached */
            <>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 10, color: "var(--text-muted)", fontFamily: "var(--font-mono)", letterSpacing: "0.04em" }}>FYPM</span>
                <span style={{ fontSize: 9, color: "var(--text-muted)", fontFamily: "var(--font-mono)", fontStyle: "italic" }}>unavailable</span>
              </div>
              <span style={{ fontSize: 9, color: "var(--text-muted)", fontFamily: "var(--font-mono)", fontStyle: "italic" }}>
                API limit reached
              </span>
            </>
          ) : (
            /* Populated FYPM */
            <>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 10, color: "var(--text-muted)", fontFamily: "var(--font-mono)", letterSpacing: "0.04em" }}>FYPM</span>
                <span style={{ fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--text-primary)", fontWeight: 600 }}>
                  {fmt(fypm.derivative_fypm)}
                </span>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <span style={{ fontSize: 9, color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>L: {fmt(fypm.linear_fypm)}</span>
                <span style={{ fontSize: 9, color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>R: {fmt(fypm.rate_fypm)}</span>
              </div>
              <div style={{ display: "flex", gap: 10, marginTop: 1 }}>
                <div style={{ fontSize: 9, fontFamily: "var(--font-mono)" }}>
                  <span style={{ color: "var(--text-muted)" }}>1d </span>
                  <span style={{ color: deltaColor(fypm.daily_change) }}>{fmtDelta(fypm.daily_change)}</span>
                </div>
                <div style={{ fontSize: 9, fontFamily: "var(--font-mono)" }}>
                  <span style={{ color: "var(--text-muted)" }}>30d </span>
                  <span style={{ color: deltaColor(fypm.change_30d) }}>{fmtDelta(fypm.change_30d)}</span>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </Link>
  );
}
