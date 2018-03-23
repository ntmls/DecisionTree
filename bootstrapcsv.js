var Papa = require('papaParse');
var fs = require('fs');
var argv = require('minimist')(process.argv.slice(2));
var Promise = require('Promise');

//example: 
// node bootstrapcsv --in weather.csv --out weather-bs csv --rows 10 --sets 5

console.log(argv); 

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

var writeFile = function(filename) {
    return function(text) {
        return new Promise(function(resolve, reject) {
            fs.writeFile(filename, text, function(error) {
               if(error) {
                   reject(error);
               } else {
                   resolve(text); 
               } 
            });             
        });      
    };
};

var csvToJson = function(csv) {
    return Papa.parse(csv, { header: true });
}; 

var range = function(start, end) {
    var result = [];
    for (let i=start; i <= end; i++) {
        result.push(i);
    }
    return result;  
};

var splitData = function(percent) {
    return function(json) {
        return DT.bootstrapData(json.data, argsv.sets, argv.rows);
    };
};

var saveFiles = function(tuple) {
    var i = 0   ; 
    var ps = tuple.map(function(x) {
        let csv = Papa.unparse(x); 
        i++; 
        return writeFile(argv.out + '-' + i + '.csv')(csv);
    });
    return Promise.all(ps);
};

var logValue = function(value) {
    console.log(value); 
    return value; 
};

readFile(argv.in)
    .then(csvToJson)
    .then(splitData(argv.percent))
    .then(saveFiles)
    .catch(logValue);