import { useState, useEffect, useCallback } from "react";
import { Routes, Route } from "react-router-dom";
import { getSession, login, logout, SessionInfo } from "./api/client";
import Navbar from "./components/Navbar";
import MarqueeTicker from "./components/MarqueeTicker";
import Dashboard from "./pages/Dashboard";
import StockDetail from "./pages/StockDetail";
import AddStock from "./pages/AddStock";
import Resources from "./pages/Resources";

function App() {
  const [session, setSession] = useState<SessionInfo>({
    loggedIn: false,
    userId: null,
    firstname: null,
  });

  const fetchSession = useCallback(async () => {
    try {
      const res = await getSession();
      setSession(res.data);
    } catch {
      setSession({ loggedIn: false, userId: null, firstname: null });
    }
  }, []);

  useEffect(() => {
    fetchSession();
  }, [fetchSession]);

  const handleLogin = async () => {
    await login();
    await fetchSession();
  };

  const handleLogout = async () => {
    await logout();
    setSession({ loggedIn: false, userId: null, firstname: null });
  };

  return (
    <div className="app">
      <Navbar
        loggedIn={session.loggedIn}
        firstname={session.firstname}
        onLogin={handleLogin}
        onLogout={handleLogout}
      />
      <MarqueeTicker />
      <div className="container" id="yield_container">
        <Routes>
          <Route
            path="/"
            element={<Dashboard loggedIn={session.loggedIn} />}
          />
          <Route path="/stocks/new" element={<AddStock />} />
          <Route path="/stocks/:id" element={<StockDetail loggedIn={session.loggedIn} />} />
          <Route path="/resources" element={<Resources />} />
        </Routes>
      </div>
    </div>
  );
}

export default App;
