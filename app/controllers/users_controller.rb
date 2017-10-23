class UsersController < ApplicationController
  def after_ch_auth 
    # @code = params[:code]
    #retrieves the code given back by ch then posts back the code plus the client id and secret
    # @res = HTTP.post("https://sandboxcernerhealth.com/oauth/access_token", :form => {:client_id => "449294363c8b4c79b873aaeb150ee74e", :redirect_uri => 'http://obduros.com:3000', :client_secret => 'cb5tG9Ez5jW8k62nN3Sa92u8gn5Ba3dR', :code => @code })
    #gets the data sent back by ch and selects the user id and firstname for use
    # @data = JSON.parse(@res, symbolize_keys: true)
    # session[:current_user_id] = @data['record_id']
    # session[:current_user_firstname] = @data['first_name']
    #sends user back to home page
    # redirect_to root_path
  end

  def before_ch_auth
    #redirects user to ch login page, leaves open option for creating a new account
    # redirect_to "https://sandboxcernerhealth.com/oauth/authenticate?client_id=449294363c8b4c79b873aaeb150ee74e&redirect_uri=http://obduros.com:3000/authenticate"
    session[:current_user_id] = 0
    session[:current_user_firstname] = ""
    redirect_to root_path
  end

  def before_ch_out
    #sends initial request to logout to ch
    # @res = HTTP.post("https://sandboxcernerhealth.com/oauth/logout_nonce", :form => {:client_id => "449294363c8b4c79b873aaeb150ee74e", :redirect_uri => 'http://obduros.com:3000/logout', :client_secret => 'cb5tG9Ez5jW8k62nN3Sa92u8gn5Ba3dR' })
    # @data = JSON.parse(@res, symbolize_keys: true)
    #gets info sent back by ch, then confirms logout by sending a second request paired with 'nonce' key
    # redirect_to ("https://sandboxcernerhealth.com/oauth/logout?client_id=449294363c8b4c79b873aaeb150ee74e&redirect_uri=http://obduros.com:3000/logout&nonce=" + @data['nonce'])
    #local sessions destroyed
    reset_session
    redirect_to root_path
  end

  def after_ch_out
    #user sent back to home after logout
    redirect_to root_path
  end

  # def new
  #   @user = User.new
  # end


  # def create
  #   @user = User.new(user_params)
  #   if @stock.save
  #     redirect_to root_path
  #   else
  #     redirect_to resources_path
  #   end
  # end

  # private def user_params
  #   params.require(:user).permit(:userbame, :lastname, :firstname)
  # end

end
