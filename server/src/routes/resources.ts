import { Router, Request, Response } from "express";

const router = Router();

const RESOURCES = [
  {
    title: "Buffet Indicator",
    url: "https://www.advisorperspectives.com/dshort/updates/2017/05/02/market-cap-to-gdp-an-updated-look-at-the-buffett-valuation-indicator",
    description:
      "One of the best stand-alone indicators of market-wide over or under valuation",
  },
  {
    title: "WSJ Financial News",
    url: "https://www.wsj.com/news/markets",
    description: "Source for general market-related current events",
  },
  {
    title: "Yahoo Finance",
    url: "https://finance.yahoo.com/",
    description: "Great for researching financials and charting",
  },
  {
    title: "Federal Reserve Database",
    url: "https://fred.stlouisfed.org/",
    description: "Easy-to-use macroeconomic data",
  },
  {
    title: "Daily Treasury Yield Curve Rates",
    url: "https://www.treasury.gov/resource-center/data-chart-center/interest-rates/Pages/TextView.aspx?data=yield",
    description: "Treasury note yield rates",
  },
];

router.get("/", (_req: Request, res: Response) => {
  res.json(RESOURCES);
});

export default router;
