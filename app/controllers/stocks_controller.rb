class StocksController < ApplicationController
	before_action :find_stock, only: [:show, :destroy]
	before_action :get_stocks
	before_action :get_info_index
	# before_action :get_basic_info, only: [:show]
	# before_action :get_graph_data, only: [:show]

	def get_stocks
		@stocks = Stock.where(user_id: session[:current_user_id]).order("ticker_symbol ASC")
	end

	def index

	end

	def new
		@message = params[:message]
		@stock = Stock.new
	end

	def create
		@stock = Stock.new(stock_params)
		@stock.ticker_symbol = @stock.ticker_symbol.upcase
		

		yahoo_client = YahooFinance::Client.new
		@data_create = yahoo_client.quotes([@stock.ticker_symbol], [:close])
		if @data_create[0].close.eql? "N/A"
			redirect_to new_stock_path(message: 'Cannot find the given ticker')
			return
		end

		duplicate = Stock.find_by(ticker_symbol: @stock.ticker_symbol, user_id: session[:current_user_id])
		if !(duplicate.nil?)
			redirect_to new_stock_path(message: 'You are already tracking this stock!')
			return
		end

		if @stock.save
			redirect_to root_path
		else
			redirect_to new_stock_path(message: 'Unknown Error')
		end
	end

	def show
			get_graph_data
	end

	def destroy
		@stock.destroy
		redirect_to root_path
	end

	def get_info_index
		@i = 0
		yahoo_client = YahooFinance::Client.new
		@tickers = Array.new
		@stocks.each do |stock|
			@tickers.push(stock.ticker_symbol)
		end

		@index_data = yahoo_client.quotes([@tickers], [:change])
	end

	private def stock_params
		params.require(:stock).permit(:ticker_symbol, :company_name, :stock_logo, :user_id)
	end

	private def find_stock
		@stock = Stock.find(params[:id])
	end

	private def get_basic_info
		#retrieve data here
		yahoo_client = YahooFinance::Client.new
		@data = yahoo_client.quotes([@stock.ticker_symbol], [:open, :high, :low, :close, :last_trade_price, :change, :change_in_percent])
	end
	helper_method :get_basic_info

	private def get_graph_data
		@date_scalar = (params.has_key?(:date_scalar_selector) ? params[:date_scalar_selector] : 3)
		@date_scalar = @date_scalar.to_i
		@date_scalar_float = @date_scalar.to_f

		yahoo_client = YQuotes::Client.new

		@graph_data = yahoo_client.get_quote(
			@stock.ticker_symbol, { 
			period: 'd', 
			start_date: (Time.now - (24*60*60*365*(@date_scalar_float/12))).strftime("%Y-%m-%d"), 
			end_date: Time.now.strftime("%Y-%m-%d")
			})
		@low = @graph_data.adj_close.min
		@max = @graph_data.adj_close.max
		@overflow = false;
		@array_size = @graph_data.index.max+1
		@i = 0
		num_points = @array_size/150
		start_time = Time.now
		@array_data = Array.new
		if (@array_size > (251*(@date_scalar_float/12))-2)
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
				@overflow = true
			end
		end
		@json_string = @array_data.to_json 
		respond_to do |format|
      format.json { render json: @array_data, status: :ok }
      format.html { @json_string }
    end
	end
end

