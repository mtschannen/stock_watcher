class CreateStockData < ActiveRecord::Migration[5.1]
  def change
    create_table :stock_data do |t|
      t.string :ticker_symbol
      t.datetime :date
      t.float :derivative_fypm
      t.float :linear_fypm
      t.float :rate_fypm

      t.timestamps
    end
  end
end
