class StocksController < ApplicationController
  before_action :check_user_logged_in, except: [:index, :get_ticker_tape_info]
  before_action :find_stock, only: [:get_basic_info, :get_graph_data, :show, :destroy]
  before_action :get_stocks
  before_action :get_info_index
  before_action :get_basic_info, only: [:show]

  #gets called by a before action to prevent url hacks
  private def check_user_logged_in
    if session[:current_user_id].nil?
      redirect_to root_path
    end
  end

  #gets all stocks in ascending order
  def get_stocks
    @stocks = Stock.where(user_id: session[:current_user_id]).order("ticker_symbol ASC")
  end

  def index
    @collection_status = params[:collection_status]
    send_email("tschannenmatt@gmail.com", "TEST", 10.0)
  end

  def send_email(to, stock_ticker, fypm_change)
    opts[:server]      ||= 'localhost'
    opts[:from]        ||= 'tschannenmatt@example.com'
    opts[:from_alias]  ||= 'Obduros'
    opts[:subject]     ||= "FYPM alert for " + stock_ticker + "!"
    opts[:body]        ||= stock_ticker + "\'s FYPM is up " + fypm_change + " today.\n\n-Obduros"

    msg = "<<END_OF_MESSAGE
  From: #{opts[:from_alias]} <#{opts[:from]}>
  To: <#{to}>
  Subject: #{opts[:subject]}

  #{opts[:body]}
  END_OF_MESSAGE"

    Net::SMTP.start(opts[:server]) do |smtp|
      smtp.send_message msg, opts[:from], to
    end
  end

  def start_data_collection
    if DateTime.now.hour < 22
      UpdateStockDataJob.set(wait_until: DateTime.now.change({ hour: 22 })).perform_later()
    else
      UpdateStockDataJob.set(wait_until: DateTime.now.tomorrow.change({ hour: 22 })).perform_later()
    end
    redirect_to root_path(collection_status: 'Collection successfully started!')
  end

  def new
    @message = params[:message]
    @stock = Stock.new
  end

  def create
    @stock = Stock.new(stock_params)
    @stock.ticker_symbol = @stock.ticker_symbol.upcase
    
    #instantiate YahooFinance client
    yahoo_client = YahooFinance::Client.new
    #attempt to retrieve data for stock being created
    @data_create = yahoo_client.quotes([@stock.ticker_symbol], [:close])
    #"N/A" will be returned if no data can be found for ticker
    #used to check if ticker user provides is valid
    if @data_create[0].close.eql? "N/A"
      #re-render form and provides user feedback
      redirect_to new_stock_path(message: 'Cannot find the given ticker')
      return
    end

    #check to see if stock they are trying to add is already being tracked by them
    #attempt to 'find' the stock in their table of stocks
    duplicate = Stock.find_by(ticker_symbol: @stock.ticker_symbol, user_id: session[:current_user_id])
    #if the stock is found
    if !(duplicate.nil?)
      redirect_to new_stock_path(message: 'You are already tracking this stock!')
      return
    end

    #check for successful save
    if @stock.save
      redirect_to root_path
    #unsuccessful save
    else
      redirect_to new_stock_path(message: 'Unknown Error')
    end
  end

  def show
    
  end

  def destroy
    @stock.destroy
    redirect_to root_path
  end

  #this gets the information to assign up or down arrows to the icons on the index page
  def get_info_index
    @i = 0
    yahoo_client = YahooFinance::Client.new
    @tickers = Array.new
    @stocks.each do |stock|
      @tickers.push(stock.ticker_symbol)
    end
    #array of the amount change
    @index_data = yahoo_client.quotes([@tickers], [:change])
  end

  private def stock_params
    params.require(:stock).permit(:ticker_symbol, :company_name, :stock_logo, :user_id)
  end

  private def find_stock
    @stock = Stock.find(params[:id])
  end

  #used to get overview data for show page
  def get_basic_info
    yahoo_client = YahooFinance::Client.new
    @data = yahoo_client.quotes([@stock.ticker_symbol], [:open, :high, :low, :close, :last_trade_price, :change, :change_in_percent, :dividend_yield])
    respond_to do |format|
      format.json { render json: @data, status: :ok }
      format.html { @data }
    end
    url = "https://www.quandl.com/api/v3/datasets/SF0/" + @stock.ticker_symbol + "_BVPS_MRY.json?api_key=rWvJtw9jPu2px-yskKZ4"
    resp = HTTP.get(url)
    @history = JSON.parse(resp, symbolize_keys: true)

    end_date = Date.today
    start_date = Date.today.prev_month 

    fred_url = "https://api.stlouisfed.org/fred/series/observations?series_id=DGS5&api_key=d9f592689a18d841cab93825d4e060c7&file_type=json&observation_start=" + start_date.strftime('%Y-%m-%e') + "&observation_end=" + end_date.strftime('%Y-%m-%e') + ""
    fred_resp = HTTP.get(fred_url)
    five_year_interest_rates = JSON.parse(fred_resp, symbolize_keys: true)
    interest_rate = five_year_interest_rates["observations"].last["value"].to_f

    if @history["dataset"].nil?
      @derivative_fypm = "N/A"
      @linear_fypm = "N/A"
      @rate_fypm = "N/A"
    else
      book_values = @history["dataset"]["data"]
      # derivative FYPM values
      v1 = book_values[3][1].to_f - book_values[4][1].to_f
      v2 = book_values[2][1].to_f - book_values[3][1].to_f
      v3 = book_values[1][1].to_f - book_values[2][1].to_f
      v4 = book_values[0][1].to_f - book_values[1][1].to_f
      @div = @data[0].dividend_yield.to_f
      price = @data[0].last_trade_price.to_f
      five_year_div_yield = ((((@div * 0.01) + 1.0) ** 5.0) - 1.0) * 100.0
      five_year_interest_rate_yield = 100 * ((((interest_rate/100) + 1) ** 5) - 1)
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
      @derivative_fypm = ((five_year_book_value_yield + five_year_div_yield)/five_year_interest_rate_yield).round(2)

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
      @linear_fypm = ((five_year_book_value_yield_linear + five_year_div_yield)/five_year_interest_rate_yield).round(2)
      @rate_fypm = ((five_year_book_value_yield_rate + five_year_div_yield)/five_year_interest_rate_yield).round(2)
    end
  end
  helper_method :get_basic_info

  #retrieves data used to fill in the top ticker tape
  def get_ticker_tape_info 
    yahoo_client = YahooFinance::Client.new
    @ticker_data = yahoo_client.quotes(["^GSPC", "^IXIC", "CL=F", "GC=F", "EURUSD=X"], [:last_trade_price, :change, :change_in_percent])
    respond_to do |format|
      format.json { render json: @ticker_data, status: :ok }
      format.html { @ticker_data }
    end
  end

  #gets the data used to create the graph
  def get_graph_data
    #check for the amount of data the function needs to return, defualt = 3
    @date_scalar = params.has_key?(:num_months) ? params[:num_months] : 3
    #string -> int
    @date_scalar = @date_scalar.to_i
    #make a float copy
    @date_scalar_float = @date_scalar.to_f

    #instantiate YQuotes client to get historical data
    yahoo_client = YQuotes::Client.new
    #retrieve the data
    @graph_data = yahoo_client.get_quote(
      @stock.ticker_symbol, { 
      #get one data point for each day
      period: 'd', 
      #calculate the first date needed based on the amount of data requested
      #24*60*60*365 converts the fractions of a year into seconds
      start_date: (Time.now - (24*60*60*365*(@date_scalar_float/12))).strftime("%Y-%m-%d"), 
      #current date
      end_date: Time.now.strftime("%Y-%m-%d")
      })

    @low = @graph_data.adj_close.min
    @max = @graph_data.adj_close.max
    #used to see if more data is requested than exists
    #i.e. request 12 months of data for a 3-month old stock 
    @overflow = false;
    #figure out how many data points were returned
    @array_size = @graph_data.index.max+1
    @i = 0
    #the number of points that will be displayed on the graph
    num_points = @array_size/150
    start_time = Time.now
    #initialize empty array
    @array_data = Array.new
    #checks for overflow, first case: no overflow 
    if (@array_size > (251*(@date_scalar_float/12))-2)
      (@array_size).times do
        if !(num_points == 0)
          #decide whether or not to add it to data set based on number of points desired
          if @i % num_points == 0
            #add to data set that will be used to make graph
            @array_data.push([@graph_data.date[@i], @graph_data.adj_close[@i]])
          end
        #always add the first point
        else
          #add to data set that will be used to make graph
          @array_data.push([@graph_data.date[@i], @graph_data.adj_close[@i]])
        end
        @i += 1
      end
    #overflow
    else
      (@array_size).times do
        if !(num_points == 0)
          if @i % num_points == 0
            @array_data.push([@graph_data.date[@i], @graph_data.adj_close[@i]])
          end
        else
          @array_data.push([@graph_data.date[@i], @graph_data.adj_close[@i]])
        end
        
        @i += 1
        
      end
      #used to display warning
      @overflow = true
      @array_data.push(@overflow)
    end

    #convert to a json string for easy parsing in javascript function
    @json_string = @array_data.to_json 
    respond_to do |format|
      #for AJAX call to dynamically update graph
      format.json { render json: @array_data, status: :ok }
      format.html { @json_string }
    end
  end
end

