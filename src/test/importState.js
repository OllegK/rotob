'use strict';

console.log(`mongodb uri - ${process.env.MONGODB_URI}`);
let mongoURL = process.env.MONGODB_URI;
let MongoClient = require('mongodb').MongoClient;
const fs = require('fs');

async function run () {

  try {
    let myDoc = JSON.parse(fs.readFileSync('./state.json', 'utf8'));
    console.log(myDoc);

    let client = await MongoClient.connect(mongoURL);
    console.log('Database connected!');
    let db = client.db(client.s.options.dbName);
    let collection = db.collection('state');
    console.log('Collection ok');

    let result = await collection.update({state: 'robotState'}, myDoc, { upsert: true });
    console.log(result);
  } catch (e) {
    console.log(e);
    throw new Error(e);
  }
};


run();
