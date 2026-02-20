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
      const errorMsg =
        err.response?.data?.error || "Unknown Error";
      setMessage(errorMsg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <h1 id="show_header">New Stock</h1>
      <div className="col-md-4 col-md-offset-4">
        <div className="new_form">
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="ticker_symbol">Ticker Symbol</label>
              <input
                type="text"
                className="form-control"
                id="ticker_symbol"
                value={tickerSymbol}
                onChange={(e) => setTickerSymbol(e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="company_name">Company Name</label>
              <input
                type="text"
                className="form-control"
                id="company_name"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="stock_logo">Stock Logo</label>
              <input
                type="file"
                className="form-control-file"
                id="stock_logo"
                accept="image/*"
                onChange={(e) =>
                  setLogoFile(e.target.files?.[0] || null)
                }
              />
            </div>
            <br />
            <button
              type="submit"
              className="btn btn-success"
              disabled={submitting}
            >
              {submitting ? "Adding..." : "Track"}
            </button>
          </form>
        </div>
        {message && (
          <div id="error_message_div">
            <h2>{message}</h2>
          </div>
        )}
      </div>
    </>
  );
}
