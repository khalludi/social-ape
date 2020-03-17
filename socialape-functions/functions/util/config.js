require('dotenv').config({ path: __dirname+"/../../.env" });

module.exports = {
    apiKey: process.env.API_KEY,
    authDomain: "socialape-fdee8.firebaseapp.com",
    databaseURL: "https://socialape-fdee8.firebaseio.com",
    projectId: "socialape-fdee8",
    storageBucket: "socialape-fdee8.appspot.com",
    messagingSenderId: "516977902573",
    appId: "1:516977902573:web:ab6b925b2d989f7d4b9de4"
};