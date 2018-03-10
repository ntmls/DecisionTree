(function(window) {
    
    var getDistinctValues = function(data, columnName) {
        let values = [];
        let valueMap = [];
        let len = data.length;
        for(let i = 0; i < data.length; i++) {
            let value = data[i][columnName]; 
            if (valueMap[value] === undefined) {
                valueMap[value] = 1;
                values.push(value);
            } else {
                valueMap[value] += 1;
            }
        }
        return values.map(function(x) { return { value: x, count: valueMap[x] }; });
    }

    var getAttributes = function(data) {
        var names = Object.getOwnPropertyNames(data[0]);
        var len = data.length;
        var categoricalThreshold;
        return names.map(function(x) {
            var values = getDistinctValues(data, x);
            var isCat = (values.length < len / 3);
            var isNumeric = (values.filter(function(x) {
                return isFinite(x.value);
            }).length == values.length);
            return {
                name: x,
                uniqueValues: values.length,
                isCategorical: isCat,
                isNumeric: isNumeric
            };
        });
    };
    
    var removeAttribute = function(attributes, attribute) {
        return attributes.filter(function(x) { return x.name != attribute; });
    };
    
    var sum = function(xs) {
        return xs.reduce(function(a, b) {
            return a + b;              
        }, 0);
    }; 
    
    var getMean = function(data, attributeName) {
        let total = 0;
        let len = data.length;
        for(let i = 0; i < len; i++) {
            total += parseFloat(data[i][attributeName]);
        }
        return total / len;
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

    var equalsPredicate = function(attributeName, value) {
        return function(row) {
            return row[attributeName] == value;
        };
    };
    
    var lessThanPredicate = function(attributeName, value) {
        return function(row) {
            return row[attributeName] < value;
        };
    };
    
    var split = function(data, splitType, attributeName, value, className, parentGini) {
        let left = [],
            right = [],
            len = data.length, 
            predicate;
        
        switch (splitType) {
            case 'equals':
                predicate = equalsPredicate(attributeName, value);
                break;
            case 'less-than':
                predicate = lessThanPredicate(attributeName, value);
                break;
        }
        
        for (let i = 0; i < len; i++) {
            if (predicate(data[i])) {
                left.push(data[i]);
            } else {
                right.push(data[i]);
            }
        }
        let lgini = calcGini(left, className);
        let rgini = calcGini(right, className);
        let gini = (left.length / len) * lgini + (right.length / len) * rgini;
        
        return {
            attributeName: attributeName,
            value: value,
            splitType: splitType,
            gini: gini,
            gain: parentGini - gini,
            left: left,
            right: right
        };
    };
    
    var getPartitions = function(data, attributes, className, parentGini) {
        var partitions = [];
        let alen = attributes.length;
        for (let i = 0; i < alen; i++) {
            let attribute = attributes[i];
            if (attribute.isCategorical) {
               let values = getDistinctValues(data, attribute.name);
                let vlen = values.length;
                if (vlen > 1) {                         // only partition if therr is more than one value
                    for (let j = 0; j < vlen; j++) {
                        let value = values[j];
                        let partition = split(data, 'equals', attribute.name, value.value, className, parentGini);
                        partitions.push(partition);
                    }
                }
            } else if (attribute.isNumeric) {
                let mean = getMean(data, attribute.name);
                let partition = split(data, 'less-than', attribute.name, mean, className, parentGini);
                partitions.push(partition);
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
    
    var buildNodeFromData = function(data, attributes, className, depth) {
        if (depth === undefined) { 
            depth = 0;
        }
        let recordCount = data.length;
        let gini = calcGini(data, className);
        let left = {};
        let right = {};
        let values = getDistinctValues(data, className);

        let shouldStop = true;
        if (values.length > 1) {    // should we stop recursion?
            var splits = getPartitions(data, attributes, className, gini);
            if (splits.length > 0) {
                shouldStop = false;
            }
        }
        
        if (shouldStop) {
            values = values.sort(function(a,b) {
                return a - b; 
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
            left = buildNodeFromData(split.left, attributes, className, this.depth + 1);
            right = buildNodeFromData(split.right, attributes, className, this.depth + 1);  
            return {
                attributeName: split.attributeName,
                splitType: split.splitType,
                splitValue: split.value,
                hasChildren: !shouldStop,
                left: left,
                right: right
            };
        }
    }; 

    var jsonToTree = function(data, className) {
        var allAttributes = getAttributes(data)
        var attributes = removeAttribute(allAttributes, className);
        var _class = allAttributes.filter(function(x) { 
            return x.name == className;
        })[0];
        return {
            class: _class,
            root: buildNodeFromData(data, attributes, className, 0)
        };
    }; 
    
    var evalNode = function(node) {
        if (!node.hasChildren) {
            return node.values;
        }
        if (node.predicate === undefined) {
            switch (node.splitType) {
                case 'equals':
                    node.predicate = equalsPredicate;
                    break;
                case 'less-than':
                    node.predicate = lessThanPredicate;
                    break;
            };    
        }
        if (node.predicate(node.attributeName, node.value)) {
            return evalNode(node.left);
        } else {
            return evalNode(node.right);
        }
    };
    
    var evalTree = function(tree, object) {
        return evalNode(tree.root, object);  
    };
    
    var exports = {
        jsonToTree: jsonToTree, 
        evalTree: evalTree
    };
    
    if (typeof module === 'undefined') {
        window.DT = exports;
    } else {
        module.exports = exports;
    };
    
})(this);