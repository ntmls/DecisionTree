var Papa =  require('papaparse');
var Promise = require('promise');
var minimist = require('minimist');
var fs = require('fs');
var DT = require('./decisiontree');

var args = minimist(process.argv.slice(2), {
    string: ['in', 'out', 'class', 'ignore'],
    default: {
        out: 'tree.json'
    }
});

console.log(args);

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

var logValue = function(value) {
    console.log(value); 
    return value; 
};

var jsonToDecisionTree = function(args) {
    var ignore = [];
    if (args.ignore !== undefined) {
        ignore = args.ignore.split(",");
    }
    return function(json) {
        let data = json.data;
        let columns = DT.removeColumns(DT.getColumns(data), ignore);
        console.log(columns);
        return DT.jsonToTree(data, columns, args.class, ignore);   
    }
};

var displayTree = function(tree) {
    displayNode(tree.root, 'root', '');
    return tree;
};

var getNodeLabel = function(node) {
    if (node.hasChildren) {
        return node.attributeName + ' ' + node.splitType + ' ' + node.splitValue;    
    } else {
        return node.values[0].value + ' (' + node.values[0].probability + ')';
    }
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
            console.log(prefix + '\u2523\u2501' + branchChar + 'TRUE\u2501\u2501' + getNodeLabel(node));
            newPrefix = prefix + '\u2502 ';
            break;
        case 'right':
            console.log(prefix + '\u2515\u2501' + branchChar + 'FALSE\u2501\u2501' + getNodeLabel(node));
            newPrefix = prefix + '  ';
            break;
        case 'root':
            console.log(prefix + getNodeLabel(node));
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

var stringify = function(tree) {
    return JSON.stringify(tree, null, 2);
};

var notify = function(message) {
    return function(value) {
        console.log(message); 
        return value;
    };
};

readFile(args.in)
    .then(csvToJson)
    .then(jsonToDecisionTree(args))
    .then(displayTree)
    .then(stringify)
    .then(writeFile(args.out))
    .then(notify('DONE'))
    .catch(logValue);