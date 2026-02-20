import express from "express";
import cors from "cors";
import session from "express-session";
import path from "path";
import stocksRouter from "./routes/stocks";
import usersRouter from "./routes/users";
import resourcesRouter from "./routes/resources";
import { scheduleDataCollection } from "./jobs/updateStockData";

const app = express();
const PORT = parseInt(process.env.PORT || "3001");

// Middleware
app.use(
  cors({
    origin: process.env.CLIENT_URL || "http://localhost:5173",
    credentials: true,
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(
  session({
    secret: process.env.SESSION_SECRET || "stock-watcher-secret-key",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === "production",
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    },
  })
);

// Serve uploaded files
app.use("/uploads", express.static(path.join(__dirname, "../uploads")));

// Serve static assets in production
if (process.env.NODE_ENV === "production") {
  app.use(express.static(path.join(__dirname, "../../client/dist")));
}

// API Routes
app.use("/api/stocks", stocksRouter);
app.use("/api/users", usersRouter);
app.use("/api/resources", resourcesRouter);

// In production, serve the React app for all non-API routes
if (process.env.NODE_ENV === "production") {
  app.get("*", (_req, res) => {
    res.sendFile(path.join(__dirname, "../../client/dist/index.html"));
  });
}

// Schedule background jobs
scheduleDataCollection();

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

export default app;
