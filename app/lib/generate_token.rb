require 'securerandom'

class GenerateToken
  def self.call
    new.call
  end

  def call
    generate_token
  end

  private

  def generate_token
    SecureRandom.uuid
  end
end
