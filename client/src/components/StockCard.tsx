import { Link } from "react-router-dom";
import { Stock } from "../api/client";

interface StockCardProps {
  stock: Stock;
}

export default function StockCard({ stock }: StockCardProps) {
  const change = stock.change || 0;
  const isUp = change >= 0;
  const arrow = isUp ? "\u25B2" : "\u25BC";
  const colorClass = isUp ? "greenPriceChange" : "redPriceChange";
  const logoUrl = stock.stock_logo_filename
    ? `/uploads/${stock.stock_logo_filename}`
    : undefined;

  return (
    <div className="col-md-3 center-tiles">
      {logoUrl && (
        <div
          className="logo_div"
          style={{ backgroundImage: `url(${logoUrl})` }}
        />
      )}
      <div className="display_div">
        <h1 id="ticker_symbol">{stock.ticker_symbol}</h1>
        <h1 id="index_arrow" className={colorClass}>
          {arrow}
        </h1>
        <h4>{stock.company_name}</h4>
        <Link className="divLink" to={`/stocks/${stock.id}`}>
          View Details
        </Link>
      </div>
    </div>
  );
}
