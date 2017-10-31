Rails.application.routes.draw do
  # For details on the DSL available within this file, see http://guides.rubyonrails.org/routing.html
  resources :stocks
  resources :users
	root 'stocks#index'
  get '/resources', to: 'resources#index', as: 'resources'
  get '/authenticate', to: 'users#after_ch_auth', as: 'authenticate'
  get '/redirectauth', to: 'users#before_ch_auth', as: 'redirectauth'
  get '/redirectout', to: 'users#before_ch_out', as: 'redirectout'
  get '/logout', to: 'users#after_ch_out', as: 'logout'
  get '/test', to: 'stocks#test', as: 'test'
  get '/stocks/:id/update_graph', to: 'stocks#get_graph_data'
  get '/stocks/:id/update_info', to: 'stocks#get_basic_info'
  get '/ticker_info', to: 'stocks#get_ticker_tape_info'
  get '/start_data_collection', to: 'stocks#start_data_collection'
  get '/do_onetime_data_collection', to: 'stocks#do_onetime_data_collection'
end
