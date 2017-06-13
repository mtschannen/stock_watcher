class UsersController < ApplicationController
  def after_ch_auth 
    @code = params[:code]
    @res = HTTP.post("https://sandboxcernerhealth.com/oauth/access_token", :form => {:client_id => "449294363c8b4c79b873aaeb150ee74e", :redirect_uri => 'http://localhost:3000', :client_secret => 'cb5tG9Ez5jW8k62nN3Sa92u8gn5Ba3dR', :code => @code })
    @data = JSON.parse(@res, symbolize_keys: true)
    session[:current_user_id] = @data['record_id']
    session[:current_user_firstname] = @data['first_name']
    redirect_to root_path
  end

  def before_ch_auth
    redirect_to "https://sandboxcernerhealth.com/oauth/authenticate?client_id=449294363c8b4c79b873aaeb150ee74e&redirect_uri=http://localhost:3000/authenticate"
  end

  def before_ch_out
    @res = HTTP.post("https://sandboxcernerhealth.com/oauth/logout_nonce", :form => {:client_id => "449294363c8b4c79b873aaeb150ee74e", :redirect_uri => 'http://localhost:3000/logout', :client_secret => 'cb5tG9Ez5jW8k62nN3Sa92u8gn5Ba3dR' })
    @data = JSON.parse(@res, symbolize_keys: true)
    # redirect_to "https://sandboxcernerhealth.com/oauth/logout?client_id=449294363c8b4c79b873aaeb150ee74e&redirect_uri=http://localhost:3000/logout&nonce=@data['nonce']"
    redirect_to ("https://sandboxcernerhealth.com/oauth/logout?client_id=449294363c8b4c79b873aaeb150ee74e&redirect_uri=http://localhost:3000/logout&nonce=" + @data['nonce'])
    reset_session
  end

  def after_ch_out
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
