require 'rubygems'
require 'sinatra'
require 'sinatra/cors'
require 'sinatra/activerecord'
require 'json'

require 'pry-byebug' if Sinatra::Base.development?

configure { set :server, :puma }

set :allow_origin, "http://localhost:8000"
set :allow_methods, "POST"
set :allow_headers, "content-type"
set :expose_headers, "location,link"

require './models'
require './lib/generate_token'

options '/api/tracking' do
  204
end

options '/api/authentication/validate-token' do
  204
end

options '/api/authentication/generate-token' do
  204
end

post '/api/tracking' do
  tracking_json = JSON.parse(request.body.read || '{}')
  user_token    = tracking_json['userToken']
  student = Student.find_by(user_token: user_token)

  if student.present?
    student.tracked_sessions.create(tracking_json: tracking_json)
  else
    TrackedSession.create(tracking_json: tracking_json)
  end

  204
end

post '/api/authentication/validate-token' do
  user_token = JSON.parse(request.body.read || '{}')['user_token']
  is_valid   = Student.exists?(user_token: user_token)

  [200, { 'Content-Type' => 'application/json' }, { valid: is_valid }.to_json]
end

post '/api/authentication/generate-token' do
  new_user_token = GenerateToken.call
  student        = Student.new(user_token: new_user_token)

  if student.save
    [200, { 'Content-Type' => 'application/json' }, { user_token: new_user_token }.to_json]
  else
    500
  end
end

get '/last-tracked/?:user_token?' do
  user_token = params[:user_token]
  student    = Student.find_by(user_token: user_token)

  tracked_sessions = student.present? && student.tracked_sessions.any? ? student.tracked_sessions : TrackedSession
  tracking_json    = tracked_sessions.order(created_at: :desc).first&.tracking_json&.to_json

  if tracking_json.present?
    [200, { 'Content-Type' => 'application/json' }, tracking_json]
  else
    404
  end
end
