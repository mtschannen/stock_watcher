import { Routes, Route } from "react-router-dom";
import Navbar from "./components/Navbar";
import MarqueeTicker from "./components/MarqueeTicker";
import Dashboard from "./pages/Dashboard";
import StockDetail from "./pages/StockDetail";
import Resources from "./pages/Resources";
import AddStock from "./pages/AddStock";
import FypmAnalysis from "./pages/FypmAnalysis";

function App() {
  return (
    <div className="app">
      <Navbar />
      <MarqueeTicker />
      <div className="container" id="yield_container">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/stocks/:ticker" element={<StockDetail />} />
          <Route path="/resources" element={<Resources />} />
          <Route path="/stocks/new" element={<AddStock />} />
          <Route path="/analysis" element={<FypmAnalysis />} />
        </Routes>
      </div>
    </div>
  );
}

export default App;
