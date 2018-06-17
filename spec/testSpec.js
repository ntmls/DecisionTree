var fs = require('fs');
var DT = require('../decisiontree.js');
var Papa = require('papaparse');

var memoize = function(f) {
    var r;
    return function(x) {
        if (r === undefined) {
            r = f(x);
        }
        return r;
    }
}

var getData = memoize(function() {
    var csv = fs.readFileSync('./test_data/weather.csv', 'utf8');
    expect(csv.length).toBe(362); 
    var json = Papa.parse(csv, { 
        header: false,
        dynamicTyping: true
    });
    var data = json.data;
    console.log(data);
    expect(data.length).toBe(15);
    return data;
});

// a psuedo-random function that can be used for testing.
var createRandomGenerator = function(seed) {
    return function() {
        seed = Math.sin(seed) * 10000; 
        return seed - Math.floor(seed);
    };
};

describe("Decision Tree - ", function() {
    
    it("Get columns from data", function() {
        var data = getData();
        var columns = DT.getColumns(data, []);
        expect(columns.length).toBe(5); 
        
        expect(columns[0].name).toBe("Outlook");
        expect(columns[0].index).toBe(0);
        expect(columns[0].isCategorical).toBe(true);
        expect(columns[0].isNumeric).toBe(false);
        expect(columns[0].isBoolean).toBe(false);
        expect(columns[0].values[0]).toBe('sunny');
        expect(columns[0].values[1]).toBe('overcast');
        expect(columns[0].values[2]).toBe('rainy');
        
        expect(columns[1].name).toBe("Temperature");
        expect(columns[1].index).toBe(1);
        expect(columns[1].isCategorical).toBe(false);
        expect(columns[1].isNumeric).toBe(true);
        expect(columns[1].isBoolean).toBe(false);
        expect(columns[1].values).toBeUndefined();
        
        expect(columns[2].name).toBe("Humidity");
        expect(columns[2].index).toBe(2);
        expect(columns[2].isCategorical).toBe(false);
        expect(columns[2].isNumeric).toBe(true);
        expect(columns[2].isBoolean).toBe(false);
        expect(columns[2].values).toBeUndefined();
        
        expect(columns[3].name).toBe("Windy");
        expect(columns[3].index).toBe(3);
        expect(columns[3].isCategorical).toBe(true);
        expect(columns[3].isNumeric).toBe(false);
        expect(columns[3].isBoolean).toBe(true);
        expect(columns[3].values[0]).toBe(false);
        expect(columns[3].values[1]).toBe(true);
        
        expect(columns[4].name).toBe("Play");
        expect(columns[4].index).toBe(4);
        expect(columns[4].isCategorical).toBe(true);
        expect(columns[4].isNumeric).toBe(false);
        expect(columns[4].isNumeric).toBe(false);
        expect(columns[4].values[0]).toBe('no');
        expect(columns[4].values[1]).toBe('yes');
    });
    
    it("Remove columns with given names", function() {
        var data = getData();
        var columns = DT.removeColumns(DT.getColumns(data, []), ["Temperature", "Play"]);
        expect(columns.length).toBe(3); 
        expect(columns[0].name).toBe("Outlook");
        expect(columns[1].name).toBe("Humidity");
        expect(columns[2].name).toBe("Windy");
    });
    
    it("Create a tree from weather data", function() {
        var data = getData();
        var columns = DT.getColumns(data, []);
        let options = {
            maxDepth: 1000, 
            randomize: true,
            splitCount: 3
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
            splitCount: 3
        };
        let tree = DT.createTree(data, columns, 'Play', options);
        let results = data.slice(1).map(function(row) {
            var result = DT.evalTree(tree, row); 
            expect(result[0].value).toBe(row[tree.target.index]);
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
            maxDepth: 10, 
            randomize: true,
            splitCount: 3
        };
        var forest = DT.createForest(data, "Play", options);
        //console.log(forest);
        expect(forest).toBeDefined();
    });
    
    var PerfLog = function() {
        var start = Date.now();
        this.nextTime = function() {
            var time = Date.now();
            var duration = time - start;
            start = time;
            return duration;
        };
    }
    
    it("Evaluate a forest", function() {
        var perfLog = new PerfLog();
        console.log('Start: ' + perfLog.nextTime());
        var data = getData();
        console.log('getData: ' + perfLog.nextTime());
        let options = {
            trees: 200,
            attributes: 3,
            maxDepth: 10, 
            randomize: true,
            splitCount: 10
        };
        var forest = DT.createForest(data, "Play", options);
        console.log('create forest: ' + perfLog.nextTime());
        var results = data.slice(1).map(function(row) {
            var result = DT.evalForest(forest, row); 
            expect(result[0].value).toBe(row[forest.target.index]);
            expect(result[0].value).toBeDefined();
            return result;
        }); 
        console.log('evaluate all data for forest: ' + perfLog.nextTime());
    });
    
    
    it("A psuedo random generator with a given seed must return consistant results.", function() {
        var r;
        r = createRandomGenerator(5678)
        expect(r()).toBe(0.01967306989354256);
        expect(r()).toBe(0.3862162635267623);
        
        r = createRandomGenerator(5678)
        expect(r()).toBe(0.01967306989354256);
        expect(r()).toBe(0.3862162635267623);
    });
    
    it("Must allow a random number generator to be injected.", function() {
        var data = getData();
        let options = {
            trees: 10,
            attributes: 3,
            maxDepth: 10, 
            randomize: true,
            splitCount: 10, 
            random: createRandomGenerator(6789)
        };
        var forest = DT.createForest(data, "Play", options);
        var firstTree = forest.trees[0];
        console.log(firstTree);
        expect(firstTree.root.column.index).toBe(2);
        expect(firstTree.root.right.splitValue).toBe(84.33697460727083);
    });
    
});