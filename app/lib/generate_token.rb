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
    token = SecureRandom.uuid
    token = SecureRandom.uuid while Student.exists?(user_token: token)
    token
  end
end
