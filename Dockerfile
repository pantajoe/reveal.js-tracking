FROM node

# create app directory
WORKDIR /usr/src/app

# install dependencies
ADD package*.json /usr/src/app/
RUN npm install

# Bundle app source
COPY css/  /usr/src/app/css/
COPY js/   /usr/src/app/js/
COPY demo/ /usr/src/app/demo/

ADD index.html /usr/src/app/

# run application
EXPOSE 8000
CMD npm start
