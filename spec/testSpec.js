var fs = require('fs');
var DT = require('../decisiontree.js');
var Papa = require('papaparse');

var getData = function() {
    var csv = fs.readFileSync('./test_data/weather.csv', 'utf8');
    expect(csv.length).toBe(362); 
    var json = Papa.parse(csv, { header: true });
    var data = json.data;
    expect(data.length).toBe(14);
    return data;
};

describe("Decision Tree", function() {
    
    it("Get columns from data", function() {
        var data = getData();
        var columns = DT.getColumns(data, []);
        expect(columns.length).toBe(5); 
        
        expect(columns[0].name).toBe("Outlook");
        expect(columns[0].isCategorical).toBe(true);
        expect(columns[0].isNumeric).toBe(false);
        expect(columns[0].uniqueValues).toBe(3);
        
        expect(columns[1].name).toBe("Temperature");
        expect(columns[1].isCategorical).toBe(false);
        expect(columns[1].isNumeric).toBe(true);
        expect(columns[1].uniqueValues).toBe(12);
        
        expect(columns[2].name).toBe("Humidity");
        expect(columns[2].isCategorical).toBe(false);
        expect(columns[2].isNumeric).toBe(true);
        expect(columns[2].uniqueValues).toBe(10);
        
        expect(columns[3].name).toBe("Windy");
        expect(columns[3].isCategorical).toBe(true);
        expect(columns[3].isNumeric).toBe(false);
        expect(columns[3].uniqueValues).toBe(2);
        
        expect(columns[4].name).toBe("Play");
        expect(columns[4].isCategorical).toBe(true);
        expect(columns[4].isNumeric).toBe(false);
        expect(columns[4].uniqueValues).toBe(2);
    });
    
    it("Create a tree from weather data", function() {
        var data = getData();
        var columns = DT.getColumns(data, []);
        let options = {
            maxDepth: 1000, 
            randomize: true,
            splitCount: 10
        };
        var tree = DT.createTree(data, columns, 'Play', options);
        expect(tree).toBeDefined();
        expect(tree.root).toBeDefined();
    });
    
    it("Evaluate a tree", function() {
        let data = getData();
        let columns = DT.getColumns(data, []);
        let options = {
            maxDepth: 1000, 
            randomize: true,
            splitCount: 10
        };
        let tree = DT.createTree(data, columns, 'Play', options);
        let results = data.map(function(row) {
            var result = DT.evalTree(tree, row); 
            expect(result[0].value).toBe(row.Play);
            return result;
        }); 
    });
    
    it("Bootstrap Data", function() {
        var data = getData();
        var sets = DT.bootstrapData(data, 100, 10);
        expect(sets.length).toBeDefined(); 
    });
    
    it("Create a forest from weather data", function() {
        var data = getData();
        let options = {
            trees: 50,
            maxDepth: 4, 
            randomize: true,
            splitCount: 10
        };
        var forest = DT.createForest(data, "Play", options);
        //console.log(forest);
        expect(forest).toBeDefined();
    });
    
    it("Evaluate a forest", function() {
        var data = getData();
        let options = {
            trees: 200,
            maxDepth: 4, 
            randomize: true,
            splitCount: 10
        };
        var forest = DT.createForest(data, "Play", options);
        var results = data.map(function(row) {
            var result = DT.evalForest(forest, row); 
            console.log(result);
            expect(result[0].value).toBe(row.Play);
            return result;
        }); 
    });
    
});