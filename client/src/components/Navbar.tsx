import { Link } from "react-router-dom";

export default function Navbar() {
  return (
    <nav id="navbar_id">
      <div className="navbar-inner">
        <Link to="/" className="navbar-brand">
          Stock<span>Watcher</span>
        </Link>

        <ul className="navbar-links">
          <li>
            <Link to="/stocks/new">Add Stock</Link>
          </li>
          <li>
            <Link to="/resources">Resources</Link>
          </li>
          <li>
            <Link to="/analysis">FYPM Analysis</Link>
          </li>
        </ul>
      </div>
    </nav>
  );
}
