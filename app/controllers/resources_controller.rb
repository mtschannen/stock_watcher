class ResourcesController < ApplicationController
  def index
    @stocks = Stock.where(user_id: session[:current_user_id]).order("ticker_symbol ASC")

    @i = 0
    yahoo_client = YahooFinance::Client.new
    @tickers = Array.new
    @stocks.each do |stock|
      @tickers.push(stock.ticker_symbol)
    end

    @index_data = yahoo_client.quotes([@tickers], [:change])
  end
end
