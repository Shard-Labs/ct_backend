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

## Running in docker containers for development purposes

Write your own development.json file as explained above.

Just type `docker-compose up` to bring up containers for database, backend and frontend. Everything is fully automated with default configs.

# Sign up
*  Go to localhost:8080 and navigate to *Sign Up*.
*  Type some email address and password and confirm that by clicking *Sign Up for CryptoTask* button.
*  You will get response that you have to confirm your email address. To do that manually follow steps below.
*  In another terminal run `docker exec -it db mysql -u root -p` and type "12345678" when requested for password.
*  In *mysql* console type `use cryptotask` to change database
*  To list all registered users type `select * from users;`
*  To confirm email type `update users set emailConfirmed=1 where id=1;` where *id* corresponds to users id from table above.
*  Check if it is all as wished `select * from users;`

