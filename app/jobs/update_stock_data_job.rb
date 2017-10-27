class UpdateStockDataJob < ApplicationJob
  queue_as :default

  def perform()
    stocks = Stock.all
    # retrieves full list of stocks to be evaluated
    for stock in stocks
      stock_data = StockDatum.new
      stock_data.ticker_symbol = stock.ticker_symbol

      yahoo_client = YahooFinance::Client.new
      data = yahoo_client.quotes([stock.ticker_symbol], [:last_trade_price, :dividend_yield])
      url = "https://www.quandl.com/api/v3/datasets/SF0/" + stock.ticker_symbol + "_BVPS_MRY.json?api_key=rWvJtw9jPu2px-yskKZ4"
      resp = HTTP.get(url)
      history = JSON.parse(resp, symbolize_keys: true)

      fred_url = "https://api.stlouisfed.org/fred/series?series_id=DGS5&api_key=d9f592689a18d841cab93825d4e060c7"
      fred_resp = HTTP.get(url)
      five_year_interest_rates = JSON.parse(fred_resp, symbolize_keys: true)

      if history["dataset"].nil?
        @derivative_fypm = "N/A"
        @linear_fypm = "N/A"
        @rate_fypm = "N/A"
      else
        book_values = history["dataset"]["data"]
        # derivative FYPM values
        v1 = book_values[3][1].to_f - book_values[4][1].to_f
        v2 = book_values[2][1].to_f - book_values[3][1].to_f
        v3 = book_values[1][1].to_f - book_values[2][1].to_f
        v4 = book_values[0][1].to_f - book_values[1][1].to_f
        div = data[0].dividend_yield.to_f
        price = data[0].last_trade_price.to_f
        five_year_div_yield = ((((div * 0.01) + 1.0) ** 5.0) - 1.0) * 100.0
        # variables for derivative book value linear fit
        sigma_x = 6.0
        sigma_x_squared = 14.0
        sigma_y = v1 + v2 + v3 + v4
        sigma_xy = v2 + v3*2.0 + v4*3.0
        n = 4.0
        # derivative book value linear fit
        a = ((sigma_y*sigma_x_squared) - (sigma_x*sigma_xy))/((n*sigma_x_squared)-(sigma_x**2))
        b = ((n*sigma_xy) - (sigma_x*sigma_y))/((n*sigma_x_squared)-(sigma_x**2))
        five_year_book_value_added = (6.5*b + a)*5.0
        five_year_book_value_yield = (five_year_book_value_added/price)*100
        # derivative FYPM final calc
        @derivative_fypm = ((five_year_book_value_yield + five_year_div_yield)/10).round(2)

        # non- derivative FYPM values
        v1 = book_values[4][1].to_f
        v2 = book_values[3][1].to_f
        v3 = book_values[2][1].to_f
        v4 = book_values[1][1].to_f
        v5 = book_values[0][1].to_f
        # variables for non-derivative book value linear fit
        sigma_x = 10.0
        sigma_x_squared = 30.0
        sigma_y = v1 + v2 + v3 + v4 + v5
        sigma_xy = v2 + v3*2.0 + v4*3.0 + v5*4.0
        n = 5.0
        # non-derivative book value linear fit
        a = ((sigma_y*sigma_x_squared) - (sigma_x*sigma_xy))/((n*sigma_x_squared)-(sigma_x**2))
        b = ((n*sigma_xy) - (sigma_x*sigma_y))/((n*sigma_x_squared)-(sigma_x**2))
        five_year_book_value_added_linear = (10.0*b + a) - v5
        five_year_book_value_added_rate = 5.0*b
        five_year_book_value_yield_linear = (five_year_book_value_added_linear/price)*100
        five_year_book_value_yield_rate = (five_year_book_value_added_rate/price)*100
        # non-derivative FYPM final calc
        @linear_fypm = ((five_year_book_value_yield_linear + five_year_div_yield)/10).round(2)
        @rate_fypm = ((five_year_book_value_yield_rate + five_year_div_yield)/10).round(2)
      end

      #saves data to database 
      stock_data.linear_fypm = @linear_fypm
      stock_data.rate_fypm = @rate_fypm
      stock_data.derivative_fypm = @derivative_fypm
      stock_data.date = DateTime.now.change({ hour: 22 })
      stock_data.save

    end

    # schedules tomorrows data collection
    UpdateStockDataJob.set(wait_until: DateTime.now.tomorrow.change({ hour: 22 })).perform_later()
  end
end
