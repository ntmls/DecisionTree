var Papa = require('papaparse');
var Promise = require('promise');
var fs = require('fs');
var DT = require('./decisiontree');

var readFile = function(fileName) {
    return new Promise(function(resolve, reject) {
        fs.readFile(fileName, 'utf8', function(error, data) {
            if(error) {
                reject(error);
            } else {
                resolve(data);
            }
        });
    });
};

var csvToJson = function(csv) {
    return Papa.parse(csv, { header: true });
}; 

var logValue = function(value) {
    console.log(value); 
    return value; 
};

var jsonToDecisionTree = function(json) {
    return DT.jsonToTree(json.data, "Play");
};

readFile('weather.csv')
    .then(csvToJson)
    .then(jsonToDecisionTree)
    .then(logValue)
    .catch(logValue);