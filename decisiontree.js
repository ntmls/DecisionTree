(function(window) {
        
    var getColumns = function(data) {
        var names = data[0];
        var rows = data.slice(1);
        var len = names.length;
        var categoricalThreshold;
        var results = [];
        var isNumeric, isBoolean, predicate;
        for(let i=0; i<len; i++) {
            var values = getDistinctValues(rows, i);
            let vlen = values.length; 
            var isCat = (vlen < 10);
            isNumeric = true;
            isBoolean = true;
            for(let j=0; j<vlen; j++) {
                if (!isFinite(values[j])) { isNumeric = false; }
                if (!(typeof values[j] === 'boolean')) { isBoolean = false; }
            }
            isNumeric = (isNumeric && !isBoolean);
            if (isCat) {
                predicate = equalsPredicate(i);
            } else if (isNumeric) {
                predicate = lessThanPredicate(i);
            }
            var column = {
                index: i,
                name: names[i],
                isCategorical: isCat,
                isNumeric: isNumeric,
                isBoolean: isBoolean,
                values: isCat ? values : undefined,
                predicate: predicate
            };
            results.push(column);
        }
        return results;
    };
    
    var getDistinctValues = function(data, columnIndex) {
        let values = [];
        let map = [];
        let len = data.length;
        for(let i = 0; i < len; i++) {
            let valueName = data[i][columnIndex]; 
            if (map[valueName] === undefined) {
                values.push(valueName);
                map[valueName] = valueName;
            }
        }
        return values;
    }
    
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
    
    var randommIndices = function(rand, count) {
        let result = [];
        for (let i = 0; i < count; i++) {
            result.push({
                i: i,
                r: rand()
            });
        }  
        let sorted = result.sort(function(a,b) {
            return a.r - b.r;
        });
        return sorted.map(function(x) {
           return x.i; 
        });
    };
    
    var randomColumns = function(rand, columns, count) {
        if (count === undefined) { return columns; }
        let len = columns.length;
        let ids = randommIndices(rand, len);
        let result = [];
        for(let i=0; i<count; i++) {
            result.push(columns[ids[i]]);
        }
        return result;
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
    
     var countValues = function(data, columnValues, columnIndex) {
        let len = data.length;
        let vlen = columnValues.length;
        //let values = new Array(vlen);
        let index = 0;
        var valueName;
        let indices = [];
        let results = new Array(vlen);
        for(let i=0; i<vlen; i++) {
            indices[columnValues[i]] = i;
            results[i] = {
                value: columnValues[i],
                count: 0
            };
        }
        
        for(let i = 0; i < len; i++) {
            valueName = data[i][columnIndex]; 
            index = indices[valueName];
            results[index].count += 1;
        }
        
        var temp = [];
        for(let i = 0; i < vlen; i++) {
            if (results[i].count > 0) {
                temp.push(results[i]);
            }
        }
        return temp;
    }
    
    var calcGini = function(data, columnValues, columnIndex) {
        var targetValues = countValues(data, columnValues, columnIndex);
        var recordCount = data.length;
        let sum = 0;
        let values_length = targetValues.length;
        for(let i=0; i<values_length; i++) {
            let probability = targetValues[i].count / recordCount;
            sum += (probability * probability);
        }
        return 1 - sum;
    };

    var equalsPredicate = function(index) {
        return function(value) {
            return function(row) {
                return row[index] == value;
            };  
        };
    };
    
    var lessThanPredicate = function(index) {
        return function(value) {
            return function(row) {
                return row[index] < value;
            };
        };
    };
    
    // Get all candidate partitions
    var getPartitions = function(data, columns, options) {
        let len = columns.length;
        let index = 0;
        var partitions = [];
        for (let i = 0; i < len; i++) {
            let column = columns[i];
            let partition = getColumnPartition(data, column, options);
            if (partition !== undefined) {
                partitions[index] = partition;
                index++                
            }
        }
        return partitions;
    };
    
    // Get the partitions for a given column based on data type and user specified options
    var getColumnPartition = function(data, column, options) {
        var partition;
        if (column.isCategorical) {
           let values = countValues(data, column.values, column.index);
            let vlen = values.length;
            if (vlen > 1) {                         // only partition if there is more than one value
                let partitions = new Array(vlen);
                for (let j = 0; j < vlen; j++) {
                    let value = values[j];
                    partitions[j] = split(data, column, value.value);
                }
                partition = getMaxGain(options.random, partitions);
            } else {
                return undefined; //couldn't split. All the values for the column are the same.
            }
        } else if (column.isNumeric) {
            let stats = getStats(data, column.index);
            if (options.randomize) {
                let partitions = new Array(options.splitCount);
                for(let j=0; j < options.splitCount; j++) {
                    let r = (stats.max - stats.min) * options.random() + stats.min; 
                    partitions[j] = split(data, column, r);  
                }
                partition = getMaxGain(options.random, partitions);
            } else {
                partition = split(data, column, stats.mean);  
            }
        }
        return partition;
    };  
    
    // given the data and a column split the data.
    var split = function(data, column, value) {
        let left = [],
            right = [],
            len = data.length, 
            predicate;
        
        predicate = column.predicate(value);
        
        for (let i = 0; i < len; i++) {
            if (predicate(data[i])) {
                left.push(data[i]);
            } else {
                right.push(data[i]);
            }
        }
        
        return {
            column: column,
            value: value,
            left: left,
            right: right
        };
    };
    
    var calcGains = function(target, partitions, parentGini) {
        var len = partitions.length;
        var partition, lgini, rgini, gini;
        for (var i = 0; i < len; i++) {
            partition = partitions[i];
            lgini = calcGini(partition.left, target.values, target.index);
            rgini = calcGini(partition.right, target.values, target.index);
            gini = (partition.left.length / len) * lgini + (partition.right.length / len) * rgini;
            partition.gini = gini;
            partition.gain = parentGini - gini;
        }
    };
    
    var buildClassificationNode = function(data, columns, target, options, depth) {
        if (depth === undefined) { 
            depth = 0;
        }
        let maxDepth = options.maxDepth;
        let recordCount = data.length;
        let left = {};
        let right = {};
        let values = countValues(data, target.values, target.index);

        let shouldStop = true;
        if (maxDepth !== undefined && depth >= maxDepth) { 
            shouldStop = true; 
        } else if (values.length > 1) {
            let gini = calcGini(data, target.values, target.index);
            var partitions = getPartitions(data, columns, options);
            //console.log(partitions);
            calcGains(target, partitions, gini);
            if (partitions.length > 0) {
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
                hasChildren: false,
                values: temp
            };
        } else {
            let partition = getMaxGain(options.random, partitions);
            left = buildClassificationNode(partition.left, columns, target, options, depth + 1);
            right = buildClassificationNode(partition.right, columns, target, options, depth + 1);  
            return {
                column: partition.column,
                splitValue: partition.value,
                hasChildren: !shouldStop,
                left: left,
                right: right
            };
        }
    }; 
    
     var buildRegressionNode = function(data, columns, target, options, depth) {
         if (depth === undefined) { 
            depth = 0;
        }
        if (options.minRows === undefined) {
            throw "'minRows' must be defined in options for regression trees";
        }
        let maxDepth = options.maxDepth;
        let recordCount = data.length;
        let left = {};
        let right = {};
        let stats = getVariance(data, target.index);
        let parentVariance = stats.variance;
        let shouldStop = true;
        if (maxDepth !== undefined && depth >= maxDepth) { 
            shouldStop = true; 
        } else if (data.length <= options.minRows) {
            shouldStop = true;
        } else {
            shouldStop = false;
        }
        //console.log(shouldStop);
        if (shouldStop) {
            return {
                hasChildren: false,
                mean: stats.mean,
                variance: parentVariance,
            };
        } else {
            //console.log(parentVariance);
            let partitions = getPartitions(data, columns, options);
            calcVarianceReductions(target, partitions, parentVariance);
            let partition = getMaxReduction(options.random, partitions);

            left = buildRegressionNode(partition.left, columns, target, options, depth + 1);
            right = buildRegressionNode(partition.right, columns, target, options, depth + 1);  
            return {
                column: partition.column,
                splitValue: partition.value,
                hasChildren: !shouldStop,
                left: left,
                right: right
            };
        }
    }; 
    
    var calcVarianceReductions = function(target, partitions, parentVariance) {
        var len = partitions.length;
        var lvar, rvar, partition;
        for(let i=0; i < len; i++) {
            partition = partitions[i];
            lvar = getVariance(partition.left, target.index).variance;
            rvar = getVariance(partition.right, target.index).variance;
            partition.varianceReduction = parentVariance - (lvar + rvar);
        }
    };
    
    var getVariance = function(data, index) {
        var len = data.length;
        var sum = 0;
        var delta = 0;
        var variance = 0;
        for(let i = 0; i < len; i++) {
            sum += data[i][index];
        }
        var mean = sum / len;
        for(let i = 0; i < len; i++) {
            delta = (mean - data[i][index]);
            variance += delta * delta;
        }
        return {
            variance: variance / len,
            mean: mean
        };
    };
    
    var createTree = function(data, columns, className, options) {
        var rows, root;
        if (typeof className !== "string") {
            throw "Expected 'className' argument to be a string";
        }
        if (options === undefined) {
            throw "'options' are undefined.";
        }
        if (options.random === undefined) {
            options.random = Math.random;
        }
        if (options.randomize === true) {
            if (options.splitCount === undefined) {
                throw "'splitCount' must be specified if the 'randomizze' ooption is true.";
            }
        }
        rows = data.slice(1);
        if (columns === undefined) { throw("columns are not defined"); }
        if (className === undefined) { throw("className is not defined"); }
        var _columns = randomColumns(
            options.random, 
            removeColumn(columns, className), 
            options.attributes);
        var target = columns.filter(function(x) { 
            return x.name == className;
        })[0];
        if (target.isCategorical) {
            root = buildClassificationNode(rows, _columns, target, options, 0);
        } else {
            root = buildRegressionNode(rows, _columns, target, options, 0);
        }
        return {
            target: target,
            root: root
        };
    }; 
    
    // Find the split with the maximium gain. 
    // If there is a tie break it by picking at random.
    var getMaxGain = function(rand, splits) {
        let len = splits.length;
        let maxSplit;
        for(let i = 0; i < len; i++) {
            if (splits[i] !== undefined) {
                if (maxSplit === undefined) {
                    maxSplit = splits[i];
                } else {
                    if (splits[i].gain > maxSplit.gain) {
                        maxSplit = splits[i]; 
                    } else if(splits[i].gain == maxSplit.gain) {
                        if(rand() > .5) {
                            maxSplit = splits[i];
                        }
                    }      
                }
            }
        }
        return maxSplit;
    };
    
    var getMaxReduction = function(rand, splits) {
        let len = splits.length;
        let maxSplit;
        for(let i = 0; i < len; i++) {
            if (splits[i] !== undefined) {
                if (maxSplit === undefined) {
                    maxSplit = splits[i];
                } else {
                    if (splits[i].varianceReduction > maxSplit.varianceReduction) {
                        maxSplit = splits[i]; 
                    } else if(splits[i].varianceReduction == maxSplit.varianceReduction) {
                        if(rand() > .5) {
                            maxSplit = splits[i];
                        }
                    }      
                }
            }
        }
        return maxSplit; 
    };
    
    var evalNode = function(node, row, isClassification) {
        if (!node.hasChildren) {
            if (isClassification) {
                return node.values;
            } else {
                return node.mean;
            }
        }
        if (node.column.predicate(node.splitValue)(row)) {
            return evalNode(node.left, row, isClassification);
        } else {
            return evalNode(node.right, row, isClassification);
        }
    };
    
    var evalTree = function(tree, row) {
        return evalNode(tree.root, row, tree.target.isCategorical);  
    };
    
    var drawSample = function(rand, xs) {
        let len = xs.length;
        let r = Math.floor(rand() * len);
        return xs[r];
    }; 
    
    var bootstrapData = function(rand, data, sets, rows) {
        var len = data.length;
        let headers = data[0];
        if (rows === undefined) { rows = len; }
        var result = [];
        for (let i = 0; i < sets; i++) {
            let set = [];
            set.push(headers);
            for (let j = 0; j < rows; j++) {
                set.push(drawSample(rand, data));
            }
            result.push(set);         
        }
        return result;
    };
    
    var createForest = function(data, className, options) {
        if (options.random === undefined) {
            options.random = Math.random;
        }
        let columns = getColumns(data);
        let sets = bootstrapData(options.random, data, options.trees); 
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
        if (forest.target.isCategorical) {
            return evalClassificationForest(forest, row);
        } else {
            return evalRegressionForest(forest, row);
        }
    }
    
    var evalClassificationForest = function(forest, row) {
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
    
    var evalRegressionForest = function(forest, row) {
        let len = forest.trees.length;
        let sum = 0;
        for (let i=0; i < len; i++) {
            var treeResult = evalTree(forest.trees[i], row); 
            sum += treeResult;
        }
        return sum / len;
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