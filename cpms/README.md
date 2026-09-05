# README
NodeJS,express and mysql starter project 
Start with cloning the repo & Run ` npm i ` to download all the dependecies
After that create a .env file where you should define the status of your project 'development' or 'production' and according to that define a prot for each status
.env 

```
STATUS=development
DEV_PORT=7000
PROD_PORT=8000`

```

Your .env file should be at the root folder of the project and should look like this :

```
#SERVER CONFIG
#STATUS=production
STATUS=development
DEV_PORT=7000
PROD_PORT=8000

#Other    
JWTSecret=cpms_2022

#DB CONFIG
HOST=127.0.0.1 
DBUSER=root
PASSWORD=mypsw
DB=cpms
DIALECT=mysql

```

After setting this up you can run `npm start` or in dev mode usin nodemon `npm run dev` 
You'll have your project running according to your status
- Development

- Production


Create a database named project in your project and change the config in your .env file and there you have it, the table user will be created automatically 


## Run dev mode fast.
`killall -q node; npm start & npm start --prefix client`

## Remind
Maybe need create folder tmpfolder for export excel files
`mkdir tmpfolder


## Dockerize
### Build for docker
Make sure no proxy set in web react project
```bash
#remove proxy in client/package.json
"proxy": "http://localhost:7000",
```
Using a .env for docker
`cp backup/.env_dck .env`
build docker iamge
`docker build -t suto/cpms .`

run docker-compose
`docker-compose up`


