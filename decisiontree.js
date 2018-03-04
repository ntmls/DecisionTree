(function(window) {
    
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
    
    function LearnerTree(data, className) {
        this.attributes = removeAttribute(getAttributes(data), className);
        this.className = className;
        this.classValues = getDistinctValues(data, className);
        this.root = new DTLearnerNode(data, this.attributes, className, 0);
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
    
    var split = function(data, predicate, description, className, parentGini) {
        let left = [],
            right = [],
            len = data.length;
        
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
            label: description,
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
                        let predicate = equalsPredicate(attribute.name, value.value);
                        let description = attribute.name + ' = ' + value.value;
                        let partition = split(data, predicate, description, className, parentGini);
                        partitions.push(partition);
                    }
                }
            } else if (attribute.isNumeric) {
                let mean = getMean(data, attribute.name);
                let predicate = lessThanPredicate(attribute.name, mean);
                let description = attribute.name + ' < ' + mean;
                let partition = split(data, predicate, description, className, parentGini);
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
    
    function DTLearnerNode(data, attributes, className, depth) {
        if (depth === undefined) { 
            this.depth = 0;
        } else {
            this.depth = depth;
        }
        this.data = data;
        var _recordCount = data.length;
        this.recordCount = _recordCount;
        this.attributes = attributes;
        this.gini = calcGini(data, className);
        this.children = [];
        
        let values = getDistinctValues(data, className);
        this.values = values;
        
        let shouldStop = true;
        if (values.length > 1) {    // should we stop recursion?
            var splits = getPartitions(data, this.attributes, className, this.gini);
            if (splits.length > 0) {
                shouldStop = false;
            }
        }
        
        if (shouldStop) {
            this.label = values.map(function(x) {
                return x.value + ' (' + x.count + ')';
            }).join('\t');
        } else {
            let split = getMaxGain(splits); 
            this.label = split.label;
            this.children.push(new DTLearnerNode(split.left, attributes, className, this.depth + 1));
            this.children.push(new DTLearnerNode(split.right, attributes, className, this.depth + 1));   
        }
        
    }; 
    
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
    
    var jsonToTree = function(json, className) {
        var dt = new LearnerTree(json, className); 
        return dt;
    }; 
    
    var exports = {
        jsonToTree: jsonToTree
    };
    
    if (typeof module === 'undefined') {
        window.DT = exports;
    } else {
        module.exports = exports;
    };
    
})(this);