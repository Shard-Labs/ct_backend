# Cryptotask backend

## Requirements

- MySQL or MariaDB
- Node.js
- Yarn
- Elasticsearch

## Installation

Clone this repo:
```
git clone https://repo_url
```

Install all dependencies:
```
yarn install
```

Run migrations on MySQL database to create all tables and database stuff:
```
npx sequelize-cli db:migrate
```

Run seeds on MySQL database to fill DB with some required data:
```
npx sequelize-cli db:seed:all
```

Create mappings on Elasticsearch:
```
node init/es.js
```

Run application:
```
yarn start or nodemon start
```

## Setup

Copy config/example.json to config/development.json and enter real data. When data changes you need to restart process.

## Running in docker containers

On this branch, you have already development.json configured for running using docker-compose.

Just type `docker-compose up` to bring up containers for database and backend. Everything is fully automated with default configs.
Backend is exposed to port 3000 on host which is default port on which frontend connects.

## TODO
Add frontend to this docker-compose for easier running of whole project on any machine.
