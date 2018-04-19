(function(window) {
    
    var getDistinctValues = function(data, index) {
        let values = [];
        let valueMap = [];
        let len = data.length;
        let idx = 0;
        for(let i = 0; i < len; i++) {
            let value = data[i][index]; 
            if (valueMap[value] === undefined) {
                valueMap[value] = idx;
                values.push({
                    value: value,
                    count: 1
                });
                idx++;
            } else {
                values[valueMap[value]].count += 1;
            }
        }
        return values;
    }

    var getColumns = function(data) {
        var names = data[0];
        var rows = data.slice(1);
        var len = names.length;
        var categoricalThreshold;
        var results = [];
        var isNumeric, isBoolean;
        for(let i=0; i<len; i++) {
            var values = getDistinctValues(rows, i);
            var isCat = (values.length < 10);
            isNumeric = true;
            isBoolean = true;
            for(let j=0; j<values.length; j++) {
                if (!isFinite(values[j].value)) { isNumeric = false; }
                if (!(typeof values[j].value === 'boolean')) { isBoolean = false; }
            }
            var column = {
                index: i,
                name: names[i],
                uniqueValues: values.length,
                isCategorical: isCat,
                isNumeric: (isNumeric && !isBoolean),
                isBoolean: isBoolean
            };
            results.push(column);
        }
        return results;
    };
    
    var removeColumn = function(columns, columnName) {
        return columns.filter(function(x) { return x.name != columnName; });
    };
    
    var removeColumns = function(columns, columnNames) {
        if (columnNames === undefined) { return columns; }
        var result = columns;  
        let len = columnNames.length;
        for(let i=0; i<len; i++) {
            result = removeColumn(result, columnNames[i]);
        }
        return result;
    };
    
    var randommIndices = function(count) {
        let result = [];
        for (let i = 0; i < count; i++) {
            result.push({
                i: i,
                r: Math.random()
            });
        }  
        let sorted = result.sort(function(a,b) {
            return a.r - b.r;
        });
        return sorted.map(function(x) {
           return x.i; 
        });
    };
    
    var randomColumns = function(columns, count) {
        if (count === undefined) { return columns; }
        let len = columns.length;
        let ids = randommIndices(len);
        let result = [];
        for(let i=0; i<count; i++) {
            result.push(columns[ids[i]]);
        }
        return result;
    };
    
    var sum = function(xs) {
        return xs.reduce(function(a, b) {
            return a + b;              
        }, 0);
    }; 
    
    var getStats = function(data, index) {
        let total = 0;
        let len = data.length;
        var min, max;
        for(let i = 0; i < len; i++) {
            let value = parseFloat(data[i][index]);
            total += value;
            if (i==0) {
                min = value;
                max = value;
            }
            min = Math.min(min, value);
            max = Math.max(max, value); 
        }
        return {
            mean: total / len, 
            min: min, 
            max: max
        };
    };
    
    var calcGini = function(data, className) {
        var classValues = getDistinctValues(data, className);
        var recordCount = data.length;
        var probsSquared = classValues.map(function(x) {
            var probability = x.count / recordCount; 
            return probability * probability;
        });
        return 1 - sum(probsSquared);
    };

    var equalsPredicate = function(index, value) {
        return function(row) {
            return row[index] == value;
        };
    };
    
    var lessThanPredicate = function(index, value) {
        return function(row) {
            return row[index] < value;
        };
    };
    
    var split = function(data, splitType, column, value, targetIndex, parentGini) {
        let left = [],
            right = [],
            len = data.length, 
            predicate;
        
        switch (splitType) {
            case 'equals':
                predicate = equalsPredicate(column.index, value);
                break;
            case 'less-than':
                predicate = lessThanPredicate(column.index, value);
                break;
            default:
                throw("Node splitType is invalid.")
        }
        
        for (let i = 0; i < len; i++) {
            if (predicate(data[i])) {
                left.push(data[i]);
            } else {
                right.push(data[i]);
            }
        }
        let lgini = calcGini(left, targetIndex);
        let rgini = calcGini(right, targetIndex);
        let gini = (left.length / len) * lgini + (right.length / len) * rgini;
        
        return {
            columnName: column.name,
            columnIndex: column.index,
            value: value,
            splitType: splitType,
            gini: gini,
            gain: parentGini - gini,
            left: left,
            right: right
        };
    };
    
    var getPartitions = function(data, columns, targetIndex, parentGini, options) {
        var partitions = [];
        let alen = columns.length;
        for (let i = 0; i < alen; i++) {
            let column = columns[i];
            if (column.isCategorical) {
               let values = getDistinctValues(data, column.index);
                let vlen = values.length;
                if (vlen > 1) {                         // only partition if therr is more than one value
                    for (let j = 0; j < vlen; j++) {
                        let value = values[j];
                        let partition = split(data, 'equals', column, value.value, targetIndex, parentGini);
                        partitions.push(partition);
                    }
                }
            } else if (column.isNumeric) {
                let stats = getStats(data, column.index);
                if (options.randomize) {
                    for(let j=0; j < options.splitCount; j++) {
                        let r = (stats.max - stats.min) * Math.random() + stats.min; 
                        let partition = split(data, 'less-than', column, r, targetIndex, parentGini);  
                        partitions.push(partition);
                    }  
                } else {
                    let partition = split(data, 'less-than', column, stats.mean, targetIndex, parentGini);  
                    partitions.push(partition);
                }
            }
        }
        return partitions;
        
    };
    
    // Find the split with the maximium gain. 
    // If there is a tie break it by picking at random.
    var getMaxGain = function(splits) {
        let len = splits.length;
        let maxSplit = splits[0];
        for(let i = 1; i < len; i++) {
            if (splits[i].gain > maxSplit.gain) {
                maxSplit = splits[i]; 
            } else if(splits[i].gain == maxSplit.gain) {
                if(Math.random() > .5) {
                    maxSplit = splits[i];
                }
            }
        }
        return maxSplit;
    };
    
    var buildNodeFromData = function(data, columns, target, options, depth) {
        if (depth === undefined) { 
            depth = 0;
        }
        let maxDepth = options.maxDepth;
        let recordCount = data.length;
        let gini = calcGini(data, target.index);
        let left = {};
        let right = {};
        let values = getDistinctValues(data, target.index);

        let shouldStop = true;
        if (maxDepth !== undefined && depth >= maxDepth) { 
            shouldStop = true; 
        } else if (values.length > 1) {    
            var splits = getPartitions(data, columns, target.index, gini, options);
            if (splits.length > 0) {
                shouldStop = false;
            }
        }
        
        if (shouldStop) {
            values = values.sort(function(a,b) {
                return b.count - a.count; 
            });
            let sum = values.reduce(function(a, b) {
                return a + b.count; 
            }, 0);
            let temp = values.map(function(x) {
                return {
                    value: x.value, 
                    probability: x.count / sum
                };
            });
            return {
                splitType: 'none',
                hasChildren: false,
                values: temp
            };
        } else {
            let split = getMaxGain(splits); 
            left = buildNodeFromData(split.left, columns, target, options, depth + 1);
            right = buildNodeFromData(split.right, columns, target, options, depth + 1);  
            return {
                columnName: split.columnName,
                columnIndex: split.columnIndex,
                splitType: split.splitType,
                splitValue: split.value,
                hasChildren: !shouldStop,
                left: left,
                right: right
            };
        }
    }; 
    
    var createTree = function(data, columns, className, options) {
        var rows = data.slice(1);
        if (columns === undefined) { throw("columns are not defined"); }
        if (className === undefined) { throw("className is not defined"); }
        var _columns = randomColumns(removeColumn(columns, className), options.attributes);
        var target = columns.filter(function(x) { 
            return x.name == className;
        })[0];
        return {
            target: target,
            root: buildNodeFromData(rows, _columns, target, options, 0)
        };
    }; 
    
    var evalNode = function(node, row) {
        if (!node.hasChildren) {
            return node.values;
        }
        if (node.predicate === undefined) {
            switch (node.splitType) {
                case 'equals':
                    node.predicate = equalsPredicate(node.columnIndex, node.splitValue);
                    break;
                case 'less-than':
                    node.predicate = lessThanPredicate(node.columnIndex, node.splitValue);
                    break;
                default: 
                    throw("Node splitType not valid");
            };    
        }
        if (node.predicate(row)) {
            return evalNode(node.left, row);
        } else {
            return evalNode(node.right, row);
        }
    };
    
    var evalTree = function(tree, row) {
        return evalNode(tree.root, row);  
    };
    
    var drawSample = function(xs) {
        let len = xs.length;
        let r = Math.floor(Math.random() * len);
        return xs[r];
    }; 
    
    var bootstrapData = function(data, sets, rows) {
        var len = data.length;
        let headers = data[0];
        if (rows === undefined) { rows = len; }
        var result = [];
        for (let i = 0; i < sets; i++) {
            let set = [];
            set.push(headers);
            for (let j = 0; j < rows; j++) {
                set.push(drawSample(data));
            }
            result.push(set);         
        }
        return result;
    };
    
    var createForest = function(data, className, options) {
        let columns = getColumns(data);
        let sets = bootstrapData(data, options.trees); 
        let trees = sets.map(function(set) {
            let tree = createTree(data, columns, className, options);
            return tree;
        });
        return {
            target: trees[0].target,
            trees: trees
        };
    };
    
    var evalForest = function(forest, row) {
        var idx = 0;
        var map = [];
        let len = forest.trees.length;
        let results = [];
        for (let i=0; i < len; i++) {
            var treeResult = evalTree(forest.trees[i], row); 
            let rlen = treeResult.length;
            for (let j=0; j < rlen; j++) {
                var value = treeResult[j].value;
                if (map[value] === undefined) {
                    map[value] = idx;
                    results[idx] = {
                        value: treeResult[j].value, 
                        probability: treeResult[j].probability
                    }; 
                    idx = idx+1;
                } else {
                    results[map[value]].probability += treeResult[j].probability;
                }
            }
        }
        return results.sort(function(a,b) {
            return b.probability - a.probability;
        });
    };
    
    var exports = {
        getColumns: getColumns, 
        removeColumns: removeColumns,
        createTree: createTree, 
        evalTree: evalTree, 
        createForest: createForest,
        evalForest: evalForest, 
        bootstrapData: bootstrapData
    };
    
    if (typeof module === 'undefined') {
        window.DT = exports;
    } else {
        module.exports = exports;
    };
    
})(this);