import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getStockInfo, deleteStockApi, StockInfo } from "../api/client";
import StockChart from "../components/StockChart";
import LoadingSpinner from "../components/LoadingSpinner";

interface StockDetailProps {
  loggedIn: boolean;
}

export default function StockDetail({ loggedIn }: StockDetailProps) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [info, setInfo] = useState<StockInfo | null>(null);
  const [overviewLoading, setOverviewLoading] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval>>();

  const stockId = parseInt(id || "0");

  const fetchInfo = async () => {
    setOverviewLoading(true);
    try {
      const res = await getStockInfo(stockId);
      setInfo(res.data);
    } catch (err) {
      console.error("Error fetching stock info:", err);
    } finally {
      setOverviewLoading(false);
    }
  };

  useEffect(() => {
    fetchInfo();
    // Live update every 15 seconds
    intervalRef.current = setInterval(fetchInfo, 15000);
    return () => clearInterval(intervalRef.current);
  }, [stockId]);

  const handleDelete = async () => {
    if (
      !info ||
      !window.confirm(
        `Are you sure you want to delete ${info.stock.ticker_symbol} from your dashboard?`
      )
    )
      return;
    await deleteStockApi(stockId);
    navigate("/");
  };

  const renderFypm = () => {
    if (!info) return null;
    const { fypm } = info;

    if (fypm.derivative_fypm === "N/A") {
      return (
        <>
          <h3>Derivative FYPM: N/A</h3>
          <h3>Linear FYPM: N/A</h3>
          <h3>Rate FYPM: N/A</h3>
        </>
      );
    }

    const renderValue = (
      label: string,
      value: number | "N/A",
      change: number | null
    ) => {
      if (value === "N/A") return <h3>{label}: N/A</h3>;
      const rounded = Number(value).toFixed(2);
      if (change === null) return <h3>{label}: {rounded}</h3>;
      const changeRounded = Number(change).toFixed(2);
      const color = Number(change) >= 0 ? "green" : "red";
      return (
        <h3>
          {label}: {rounded},{" "}
          <i style={{ color }}>{changeRounded}%</i>
        </h3>
      );
    };

    return (
      <>
        {renderValue(
          "Derived FYPM",
          fypm.derivative_fypm,
          fypm.derivative_change
        )}
        {renderValue("Linear FYPM", fypm.linear_fypm, fypm.linear_change)}
        {renderValue("Rate FYPM", fypm.rate_fypm, fypm.rate_change)}
      </>
    );
  };

  const logoUrl = info?.stock.stock_logo_filename
    ? `/uploads/${info.stock.stock_logo_filename}`
    : undefined;

  return (
    <div className="center_text">
      <h1 id="show_header">{info?.stock.company_name || "Loading..."}</h1>
      {loggedIn && info && (
        <button className="btn btn-danger" onClick={handleDelete}>
          Stop Tracking
        </button>
      )}
      <br />
      <div className="row" id="show_page_content">
        <div className="col-md-4" id="left-show">
          <div id="overview_div" className="overview_wrapper">
            {overviewLoading ? (
              <LoadingSpinner type="dots" />
            ) : (
              info && (
                <h1 className="center_text">{info.stock.ticker_symbol}</h1>
              )
            )}
            {info && !overviewLoading && (
              <>
                <h2 id="overview_last_trade_price">
                  ${Number(info.quote.last_trade_price).toFixed(2)}
                </h2>
                <h3
                  id="overview_change"
                  className={
                    info.quote.change >= 0
                      ? "greenPriceChange"
                      : "redPriceChange"
                  }
                >
                  {info.quote.change >= 0 ? "\u25B2" : "\u25BC"}
                  {Number(info.quote.change).toFixed(2)} (
                  {info.quote.change_in_percent})
                </h3>
                <h3 id="overview_opening_price">
                  Opening Price: ${Number(info.quote.open).toFixed(2)}
                </h3>
                {renderFypm()}
              </>
            )}
          </div>
          {logoUrl && (
            <div
              className="logo_div_overview"
              style={{ backgroundImage: `url(${logoUrl})` }}
            />
          )}
          <StockChart stockId={stockId} />
        </div>
      </div>
    </div>
  );
}
