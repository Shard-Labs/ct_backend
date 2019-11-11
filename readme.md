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
