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

var displayTree = function(tree) {
    displayNode(tree, 'root', '');
    return tree;
};

var displayNode = function (node, type, prefix)  {
    let newPrefix = ' ';
    var branchChar;
    if (node.hasChildren) {
        branchChar = '\u2533';
    } else {
        branchChar = '\u2501';
    }
    switch (type) {
        case 'left':
            console.log(prefix + '\u2523\u2501' + branchChar + 'TRUE\u2501\u2501' + node.label);
            newPrefix = prefix + '\u2502 ';
            break;
        case 'right':
            console.log(prefix + '\u2515\u2501' + branchChar + 'FALSE\u2501\u2501' + node.label);
            newPrefix = prefix + '  ';
            break;
        case 'root':
            console.log(prefix + node.label);
            newPrefix = prefix + '  ';
            break;
    }        
    if (node.hasChildren) {
        displayNode(
            node.left, 
            'left', 
            newPrefix
        );
        displayNode(
            node.right,
            'right', 
            newPrefix
        );
    }
};

readFile('weather.csv')
    .then(csvToJson)
    .then(jsonToDecisionTree)
    .then(logValue)
    .then(displayTree)
    .catch(logValue);