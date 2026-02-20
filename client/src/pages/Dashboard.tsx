import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { getStocks, Stock } from "../api/client";
import StockCard from "../components/StockCard";

interface DashboardProps {
  loggedIn: boolean;
}

export default function Dashboard({ loggedIn }: DashboardProps) {
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const collectionStatus = searchParams.get("collection_status");

  useEffect(() => {
    if (loggedIn) {
      getStocks()
        .then((res) => setStocks(res.data))
        .catch(() => setStocks([]));
    }
  }, [loggedIn]);

  if (!loggedIn) {
    return (
      <div id="welcome_div">
        <h1 id="welcome_text">Welcome to StockWatcher!</h1>
        <img
          src="/welcome_page.png"
          id="welcome_image"
          alt="Welcome to StockWatcher"
        />
      </div>
    );
  }

  return (
    <>
      {stocks.length === 0 && (
        <div
          className="overflow_warning"
          onClick={() => navigate("/stocks/new")}
          style={{ cursor: "pointer" }}
        >
          <h2>
            You are not tracking any stocks. Click this to start tracking a
            stock.
          </h2>
        </div>
      )}

      {collectionStatus && (
        <div className="overflow_warning">
          <h2>{collectionStatus}</h2>
        </div>
      )}

      <div className="row">
        {stocks.map((stock) => (
          <StockCard key={stock.id} stock={stock} />
        ))}
      </div>
    </>
  );
}
