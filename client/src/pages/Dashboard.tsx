import { useState, useEffect, useRef, useMemo } from "react";
import { getMarketQuotes, getMarketFypmBatch, MarketStock, FypmBatchItem } from "../api/client";
import StockCard from "../components/StockCard";

type SortKey =
  | "alpha"
  | "gainers"
  | "losers"
  | "fypm_high"
  | "fypm_low"
  | "fypm_1d_high"
  | "fypm_1d_low"
  | "fypm_30d_high"
  | "fypm_30d_low";

const SORT_OPTIONS: { key: SortKey; label: string; group: "price" | "fypm" }[] = [
  { key: "alpha",       label: "A–Z",       group: "price" },
  { key: "gainers",     label: "Gainers",   group: "price" },
  { key: "losers",      label: "Losers",    group: "price" },
  { key: "fypm_high",   label: "FYPM ↑",    group: "fypm"  },
  { key: "fypm_low",    label: "FYPM ↓",    group: "fypm"  },
  { key: "fypm_1d_high",label: "1d Δ ↑",    group: "fypm"  },
  { key: "fypm_1d_low", label: "1d Δ ↓",    group: "fypm"  },
  { key: "fypm_30d_high",label: "30d Δ ↑",  group: "fypm"  },
  { key: "fypm_30d_low", label: "30d Δ ↓",  group: "fypm"  },
];

export default function Dashboard() {
  const [stocks, setStocks]           = useState<MarketStock[]>([]);
  const [fypmMap, setFypmMap]         = useState<Map<string, FypmBatchItem>>(new Map());
  const [loading, setLoading]         = useState(true);
  const [fypmLoading, setFypmLoading] = useState(true);
  const [search, setSearch]           = useState("");
  const [sort, setSort]               = useState<SortKey>("alpha");
  const fypmPollRef                   = useRef<ReturnType<typeof setInterval>>();

  const loadFypm = async () => {
    try {
      const res = await getMarketFypmBatch();
      const map = new Map<string, FypmBatchItem>();
      for (const item of res.data) map.set(item.ticker, item);
      setFypmMap(map);
      // Stop polling once all tickers have book-value data
      const allPopulated = res.data.every((d) => d.derivative_fypm !== null);
      if (allPopulated) clearInterval(fypmPollRef.current);
    } catch { /* ignore */ }
  };

  useEffect(() => {
    getMarketQuotes()
      .then((res) => setStocks(res.data))
      .catch(() => setStocks([]))
      .finally(() => setLoading(false));

    loadFypm().finally(() => setFypmLoading(false));
    // Poll every 65 s — server cache expires at 60 s, so we always get fresh data
    fypmPollRef.current = setInterval(loadFypm, 65_000);
    return () => clearInterval(fypmPollRef.current);
  }, []);

  const fypmLoaded = !fypmLoading;

  const displayed = useMemo(() => {
    let list = stocks;

    if (search.trim()) {
      const q = search.trim().toUpperCase();
      list = list.filter(
        (s) => s.ticker.includes(q) || s.company_name.toUpperCase().includes(q)
      );
    }

    // Sorting
    const nullsLast = (a: number | null | undefined, b: number | null | undefined, desc: boolean) => {
      if (a == null && b == null) return 0;
      if (a == null) return 1;
      if (b == null) return -1;
      return desc ? b - a : a - b;
    };

    switch (sort) {
      case "gainers":
        list = [...list].sort((a, b) => b.change - a.change);
        break;
      case "losers":
        list = [...list].sort((a, b) => a.change - b.change);
        break;
      case "fypm_high":
        list = [...list].sort((a, b) =>
          nullsLast(fypmMap.get(a.ticker)?.derivative_fypm, fypmMap.get(b.ticker)?.derivative_fypm, true)
        );
        break;
      case "fypm_low":
        list = [...list].sort((a, b) =>
          nullsLast(fypmMap.get(a.ticker)?.derivative_fypm, fypmMap.get(b.ticker)?.derivative_fypm, false)
        );
        break;
      case "fypm_1d_high":
        list = [...list].sort((a, b) =>
          nullsLast(fypmMap.get(a.ticker)?.daily_change, fypmMap.get(b.ticker)?.daily_change, true)
        );
        break;
      case "fypm_1d_low":
        list = [...list].sort((a, b) =>
          nullsLast(fypmMap.get(a.ticker)?.daily_change, fypmMap.get(b.ticker)?.daily_change, false)
        );
        break;
      case "fypm_30d_high":
        list = [...list].sort((a, b) =>
          nullsLast(fypmMap.get(a.ticker)?.change_30d, fypmMap.get(b.ticker)?.change_30d, true)
        );
        break;
      case "fypm_30d_low":
        list = [...list].sort((a, b) =>
          nullsLast(fypmMap.get(a.ticker)?.change_30d, fypmMap.get(b.ticker)?.change_30d, false)
        );
        break;
      default:
        list = [...list].sort((a, b) => a.ticker.localeCompare(b.ticker));
    }

    return list;
  }, [stocks, fypmMap, search, sort]);

  const isFypmSort = sort.startsWith("fypm");

  return (
    <div>
      {/* Controls */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
        <input
          type="text"
          placeholder="Search ticker or company…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            flex: "1 1 220px",
            maxWidth: 340,
            padding: "8px 12px",
            background: "var(--bg-surface)",
            border: "1px solid var(--border-solid)",
            borderRadius: 6,
            color: "var(--text-primary)",
            fontSize: 13,
            fontFamily: "var(--font)",
            outline: "none",
          }}
        />

        {/* Sort groups */}
        <div style={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
          {SORT_OPTIONS.filter((o) => o.group === "price").map((o) => (
            <SortBtn key={o.key} label={o.label} active={sort === o.key} onClick={() => setSort(o.key)} />
          ))}
          <span style={{ width: 1, background: "var(--border-solid)", margin: "0 4px", alignSelf: "stretch" }} />
          {SORT_OPTIONS.filter((o) => o.group === "fypm").map((o) => (
            <SortBtn
              key={o.key}
              label={o.label}
              active={sort === o.key}
              onClick={() => setSort(o.key)}
              dimmed={!fypmLoaded}
              title={!fypmLoaded ? "FYPM data loading…" : undefined}
            />
          ))}
        </div>

        <span style={{ fontSize: 12, color: "var(--text-muted)", marginLeft: "auto", whiteSpace: "nowrap" }}>
          {loading
            ? "Loading…"
            : `${displayed.length} stocks${isFypmSort && fypmLoading ? " · FYPM loading…" : ""}`}
        </span>
      </div>

      {/* Grid */}
      {loading ? (
        <div style={{ textAlign: "center", padding: "80px 0", color: "var(--text-muted)", fontSize: 14 }}>
          Fetching market data…
        </div>
      ) : (
        <div className="stock-grid">
          {displayed.map((stock) => (
            <StockCard
              key={stock.ticker}
              stock={stock}
              fypm={fypmLoaded ? (fypmMap.get(stock.ticker) ?? null) : undefined}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function SortBtn({
  label, active, onClick, dimmed, title,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  dimmed?: boolean;
  title?: string;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        padding: "6px 11px",
        borderRadius: 5,
        border: "1px solid",
        borderColor: active ? "var(--accent)" : "var(--border-solid)",
        background: active ? "rgba(59,130,246,0.15)" : "transparent",
        color: active ? "var(--accent)" : dimmed ? "var(--text-muted)" : "var(--text-secondary)",
        fontSize: 11,
        fontWeight: 500,
        cursor: "pointer",
        fontFamily: "var(--font-mono)",
        opacity: dimmed && !active ? 0.5 : 1,
        transition: "all 0.15s",
      }}
    >
      {label}
    </button>
  );
}
