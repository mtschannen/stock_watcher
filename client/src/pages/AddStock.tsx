import { useState, FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { createStock } from "../api/client";

export default function AddStock() {
  const [tickerSymbol, setTickerSymbol] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setMessage("");

    const formData = new FormData();
    formData.append("ticker_symbol", tickerSymbol);
    formData.append("company_name", companyName);
    if (logoFile) {
      formData.append("stock_logo", logoFile);
    }

    try {
      await createStock(formData);
      navigate("/");
    } catch (err: any) {
      const errorMsg = err.response?.data?.error || "Unknown Error";
      setMessage(errorMsg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ maxWidth: 480 }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text-primary)", marginBottom: 24, fontFamily: "var(--font-mono)" }}>
        Add Stock
      </h1>

      <div className="overview_wrapper" style={{ padding: 24 }}>
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <label style={{ fontSize: 12, color: "var(--text-muted)", fontFamily: "var(--font-mono)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Ticker Symbol
            </label>
            <input
              type="text"
              value={tickerSymbol}
              onChange={(e) => setTickerSymbol(e.target.value.toUpperCase())}
              required
              placeholder="e.g. AAPL"
              style={{
                background: "var(--bg-base)",
                border: "1px solid var(--border-solid)",
                borderRadius: 6,
                padding: "8px 12px",
                color: "var(--text-primary)",
                fontFamily: "var(--font-mono)",
                fontSize: 14,
                outline: "none",
              }}
            />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <label style={{ fontSize: 12, color: "var(--text-muted)", fontFamily: "var(--font-mono)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Company Name
            </label>
            <input
              type="text"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              required
              placeholder="e.g. Apple Inc."
              style={{
                background: "var(--bg-base)",
                border: "1px solid var(--border-solid)",
                borderRadius: 6,
                padding: "8px 12px",
                color: "var(--text-primary)",
                fontSize: 14,
                outline: "none",
              }}
            />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <label style={{ fontSize: 12, color: "var(--text-muted)", fontFamily: "var(--font-mono)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Stock Logo
            </label>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setLogoFile(e.target.files?.[0] || null)}
              style={{
                background: "var(--bg-base)",
                border: "1px solid var(--border-solid)",
                borderRadius: 6,
                padding: "8px 12px",
                color: "var(--text-secondary)",
                fontSize: 13,
                cursor: "pointer",
              }}
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            style={{
              marginTop: 4,
              padding: "10px 20px",
              background: submitting ? "var(--bg-surface-2)" : "var(--accent)",
              color: "#fff",
              border: "none",
              borderRadius: 6,
              fontSize: 14,
              fontWeight: 600,
              cursor: submitting ? "not-allowed" : "pointer",
              transition: "background 0.15s",
              alignSelf: "flex-start",
            }}
          >
            {submitting ? "Adding..." : "Track Stock"}
          </button>
        </form>
      </div>

      {message && (
        <div style={{ marginTop: 16, padding: "12px 16px", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 6, color: "var(--red)", fontSize: 13 }}>
          {message}
        </div>
      )}
    </div>
  );
}
