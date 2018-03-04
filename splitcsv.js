var Papa = require('papaParse');
var fs = require('fs');
var argv = require('minimist')(process.argv.slice(2));
var Promise = require('Promise');

//Example:
// node splitcsv --in weather.csv --out1 weather-train.csv --out2 weather-test.csv --percent 70

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

var randomize = function(xs) {
    var ys = xs.map(function(x) {
        return {
            value: x,
            sort: Math.random()
        }; 
    }); 
    ys = ys.sort(function(a, b) {
        return a.sort - b.sort; 
    });
    return ys.map(function(y) {
        return y.value; 
    });
}; 

var splitData = function(percent) {
    return function(json) {
        var data = randomize(json.data); 
        var len = data.length;
        var splitIndex = Math.floor(len * (percent / 100));
        var data1 = data.slice(0, splitIndex);
        var data2 = data.slice(splitIndex, len); 
        return [data1,data2];   
    };
};

var saveFiles = function(tuple) {
    var csv1 = Papa.unparse(tuple[0]); 
    var csv2 = Papa.unparse(tuple[1]); 
    return Promise.all([
        writeFile(argv.out1)(csv1), 
        writeFile(argv.out2)(csv2)
    ]);
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