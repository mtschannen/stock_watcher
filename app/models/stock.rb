class Stock < ApplicationRecord
  has_attached_file :stock_logo, styles: { medium: "300x300>", thumb: "500x500>" }, default_url: "/images/:style/missing.png"
  validates_attachment_content_type :stock_logo, content_type: /\Aimage\/.*\z/
end
