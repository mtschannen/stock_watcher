// Approximate S&P 500 constituents, sorted roughly by sector then market cap
export const SP500_TICKERS: string[] = [
  // Information Technology
  "AAPL", "MSFT", "NVDA", "AVGO", "ORCL", "CRM", "AMD", "INTC", "CSCO", "QCOM",
  "IBM", "TXN", "AMAT", "MU", "LRCX", "KLAC", "ADI", "SNPS", "CDNS", "MCHP",
  "ON", "MPWR", "NXPI", "FTNT", "PANW", "CRWD", "NOW", "ADSK", "WDAY", "ANSS",
  "PTC", "DDOG", "NET", "ZS", "PLTR", "HUBS", "VEEV", "PAYC", "PCTY", "FICO",
  "TRMB", "EPAM", "CTSH", "ACN", "LDOS", "SAIC", "BAH", "CACI",
  "HPQ", "HPE", "DELL", "NTAP", "WDC", "STX", "KEYS", "JNPR", "FFIV", "ZBRA",
  "CDW", "SWKS", "QRVO", "CRUS", "MSCI",

  // Communication Services
  "GOOGL", "META", "T", "VZ", "CMCSA", "DIS", "NFLX", "CHTR", "WBD",
  "FOXA", "FOX", "PARA", "OMC", "IPG", "EA", "TTWO", "RBLX", "MTCH",

  // Consumer Discretionary
  "AMZN", "TSLA", "HD", "MCD", "NKE", "SBUX", "LOW", "TGT", "COST", "AZO",
  "BBY", "DG", "DLTR", "ROST", "TJX", "NVR", "PHM", "DHI", "LEN", "TOL",
  "GRMN", "POOL", "CCL", "RCL", "NCLH", "MGM", "WYNN", "LVS", "MAR", "HLT",
  "H", "DRI", "YUM", "QSR", "CMG", "TSCO", "ORLY", "AAP", "GPC", "MNST",
  "KDP", "TAP", "EAT",

  // Consumer Staples
  "WMT", "PG", "KO", "PEP", "CL", "EL", "CHD", "CLX", "MO", "PM",
  "MDLZ", "KHC", "HSY", "GIS", "K", "CPB", "SJM", "HRL", "CAG", "LW",
  "TSN", "MKC", "KMB",

  // Health Care
  "UNH", "JNJ", "LLY", "ABBV", "MRK", "TMO", "ABT", "DHR", "AMGN", "BMY",
  "GILD", "MDT", "SYK", "ISRG", "BSX", "HCA", "CI", "ELV", "CNC", "HUM",
  "MOH", "DGX", "LH", "HOLX", "IDXX", "VRTX", "REGN", "BIIB", "ZBH", "EW",
  "IQV", "A", "MTD", "WAT", "ALGN", "BIO", "PODD", "TFX", "HSIC",
  "MCK", "ABC", "CAH", "CVS", "WBA",

  // Financials — banks
  "BRK-B", "JPM", "BAC", "WFC", "GS", "MS", "C", "USB", "PNC", "TFC",
  "COF", "RF", "CFG", "KEY", "FITB", "HBAN", "MTB", "CMA",

  // Financials — insurance / investment
  "BLK", "SCHW", "AXP", "SPGI", "MCO", "ICE", "CME", "CB", "PGR", "AFL",
  "TRV", "MET", "AIG", "PRU", "ALL", "HIG", "PFG", "CINF", "WTW", "MMC",
  "AON", "AJG", "BRO",

  // Financials — payments & data
  "MA", "V", "FIS", "FISV", "GPN", "PYPL", "AMP", "EFX", "TRU", "VRSK",
  "BK", "STT",

  // Industrials — defense
  "RTX", "LMT", "GD", "NOC", "BA", "HEI", "TDG", "HII",

  // Industrials — machinery
  "CAT", "DE", "HON", "GE", "EMR", "ETN", "PH", "ROK", "IR", "AME",
  "GWW", "FAST", "CTAS", "ITW", "SWK", "MAS", "AOS", "LII", "TT",
  "CARR", "OTIS", "JCI", "XYL", "GNRC",

  // Industrials — transportation
  "UPS", "FDX", "CSX", "NSC", "UNP", "DAL", "UAL", "AAL", "LUV", "ALK",
  "CHRW", "EXPD", "XPO", "JBHT",

  // Industrials — misc
  "RSG", "WM", "SRCL", "FLR", "PWR", "HUBB", "WAB",

  // Energy
  "XOM", "CVX", "COP", "EOG", "SLB", "OXY", "PSX", "VLO", "MPC", "KMI",
  "WMB", "DVN", "HES", "APA", "BKR", "OKE", "LNG", "CTRA", "MRO",
  "RRC", "EQT", "PXD",

  // Utilities
  "NEE", "DUK", "SO", "D", "EXC", "SRE", "AEP", "PCG", "ED", "XEL",
  "ES", "ETR", "WEC", "DTE", "PPL", "PEG", "CMS", "LNT", "ATO", "CNP",

  // Real Estate
  "PLD", "AMT", "EQIX", "WELL", "DLR", "SPG", "PSA", "AVB", "EQR", "O",
  "VICI", "ARE", "BXP", "SBAC", "CCI", "INVH", "MAA", "UDR", "ESS", "NNN",
  "VTR", "IRM", "WY",

  // Materials
  "LIN", "APD", "ECL", "SHW", "DD", "DOW", "LYB", "PPG", "IFF", "CE",
  "AVY", "NEM", "FCX", "NUE", "VMC", "MLM", "CF", "MOS", "ALB", "AA", "STLD",
];
