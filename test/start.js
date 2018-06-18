const exec = require('child_process').exec;
const fs = require('fs-extra');
const path = require('path');
const mongoose = require(`mongoose`);
const Admin = mongoose.mongo.Admin;
const Mongoose = require('mongoose').Mongoose;

const strapiBin = path.resolve('./packages/strapi/bin/strapi.js');
const appName = 'testApp';
let appStart;

const databases = {
  mongo: `--dbclient=mongo --dbhost=127.0.0.1 --dbport=27017 --dbname=strapi-test-${new Date().getTime()} --dbusername="" --dbpassword=""`,
  postgres: `--dbclient=postgres --dbhost=127.0.0.1 --dbport=5432 --dbname=strapi-test --dbusername="" --dbpassword=""`,
  mysql: `--dbclient=mysql --dbhost=127.0.0.1 --dbport=3306 --dbname=strapi-test --dbusername="root" --dbpassword="root"`
};

const {runCLI: jest} = require('jest-cli/build/cli');

const main = async () => {
  const clean = async () => {
    // Drop MongoDB test databases.
    try {
      const instance = new Mongoose();
      const connection = await instance.connect('mongodb://localhost');
      const databases = await new Admin(instance.connection.db).listDatabases();

      const arrayOfPromises = databases.databases
        .filter(db => db.name.indexOf('strapi-test-') !== -1)
        .map(db => new Promise((resolve, reject) => {
          const instance = new Mongoose();
          console.log(`mongodb://localhost/${db.name}`);
          instance.connect(`mongodb://localhost/${db.name}`, (err) => {
            if (err) {
              return reject(err);
            }

            instance.connection.db.dropDatabase();

            resolve();
          });
        }));

      await Promise.all(arrayOfPromises);
    } catch (e) {
      // Silent.
    }

    return new Promise((resolve) => {
      fs.exists(appName, exists => {
        if (exists) {
          fs.removeSync(appName);
        }

        resolve();
      });
    });
  };

  const generate = (database) => {
    return new Promise((resolve, reject) => {
      const appCreation = exec(
        `node ${strapiBin} new ${appName} --dev ${database}`,
      );

      appCreation.stdout.on('data', data => {
        console.log(data.toString());

        if (data.includes('is ready at')) {
          appCreation.kill();
          return resolve();
        }

        if (data.includes('Database connection has failed')) {
          appCreation.kill();
          return reject();
        }
      });
    });
  };

  const start = () => {
    return new Promise((resolve) => {
      appStart = exec(
        `node ${strapiBin} start ${appName}`,
      );

      appStart.stdout.on('data', data => {
        console.log(data.toString());

        if (data.includes('To shut down your server')) {
          return resolve();
        }
      });
    });
  };

  const test = () => {
    console.log('Launch test suits');
    return new Promise(async (resolve) => {
      const options = {
        projects: [process.cwd()],
        silent: false
      };

      await jest(options, options.projects);

      resolve();
    });
  };

  const testProcess = async (database) => {
    await clean();
    await generate(database);
    await start();
    await test();

    appStart.kill();
  };

  await testProcess(databases.mongo);
  await testProcess(databases.postgres);
  await testProcess(databases.mysql);
};

main();
