class AddAttachmentStockLogoToStocks < ActiveRecord::Migration[5.1]
  def self.up
    change_table :stocks do |t|
      t.attachment :stock_logo
    end
  end

  def self.down
    remove_attachment :stocks, :stock_logo
  end
end
