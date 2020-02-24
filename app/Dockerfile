FROM ruby:2.6.5

RUN apt-get update -qq && apt-get install -y nodejs postgresql-client

RUN mkdir /app
WORKDIR /app

ADD Gemfile*      /app/
ADD .ruby-version /app/

RUN gem install bundler:2.1.4
RUN bundle install

COPY . /app/

EXPOSE 4567

CMD ["bundle", "exec", "ruby", "app.rb", "-p", "4567", "-o", "0.0.0.0"]
