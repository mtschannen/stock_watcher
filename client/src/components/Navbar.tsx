import { useState, useEffect } from "react";
import { Link, useParams } from "react-router-dom";
import { getStocks, Stock } from "../api/client";

interface NavbarProps {
  loggedIn: boolean;
  firstname: string | null;
  onLogin: () => void;
  onLogout: () => void;
}

export default function Navbar({
  loggedIn,
  firstname,
  onLogin,
  onLogout,
}: NavbarProps) {
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const params = useParams();

  useEffect(() => {
    if (loggedIn) {
      getStocks()
        .then((res) => setStocks(res.data))
        .catch(() => setStocks([]));
    } else {
      setStocks([]);
    }
  }, [loggedIn]);

  return (
    <nav id="navbar_id" className="navbar navbar-default">
      <div className="container">
        <div className="navbar-header">
          <Link to="/" className="navbar-brand">
            Stock Watcher
          </Link>
        </div>
        <ul className="nav navbar-nav">
          <li>
            <Link to="/resources">Helpful Resources</Link>
          </li>
        </ul>

        {loggedIn && stocks.length > 0 && (
          <ul className="nav navbar-nav">
            <li
              className={`dropdown ${dropdownOpen ? "open" : ""}`}
              onClick={() => setDropdownOpen(!dropdownOpen)}
            >
              <a
                href="#"
                className="dropdown-toggle"
                role="button"
                onClick={(e) => e.preventDefault()}
              >
                Quick Link<span className="caret"></span>
              </a>
              <ul className="dropdown-menu" role="menu">
                {stocks.map((stock) => {
                  const isActive = params.id === String(stock.id);
                  const arrow =
                    (stock.change || 0) >= 0 ? "\u25B2" : "\u25BC";
                  return (
                    <li
                      key={stock.id}
                      className={isActive ? "active_stock" : ""}
                    >
                      <Link
                        to={`/stocks/${stock.id}`}
                        onClick={() => setDropdownOpen(false)}
                      >
                        {arrow} {stock.ticker_symbol}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </li>
          </ul>
        )}

        <ul className="nav navbar-nav navbar-right">
          {!loggedIn ? (
            <li className="headButton">
              <button
                id="loginButton"
                className="btn btn-success"
                onClick={onLogin}
              >
                Log In
              </button>
            </li>
          ) : (
            <>
              <li>
                <Link to="/stocks/new">Track a new Stock</Link>
              </li>
              <li className="headButton">
                <button
                  id="logoutButton"
                  className="btn btn-danger"
                  onClick={onLogout}
                >
                  Log{firstname} Out
                </button>
              </li>
            </>
          )}
        </ul>
      </div>
    </nav>
  );
}
