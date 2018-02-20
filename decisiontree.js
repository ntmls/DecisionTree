(function(window) {
    
    function DecisionTree(data, className) {
        //this.data = data;
        this.attributes = removeAttribute(getAttributes(data), className);
        this.className = className;
        this.classValues = getDistinctValues(data, className);
        this.root = new DecisionTreeNode(data, this.attributes, className, '', '');
    };
    
    var sum = function(xs) {
        return xs.reduce(function(a, b) {
            return a + b;              
        }, 0);
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
    
    function DecisionTreeNode(data, attributes, className, attributeName, valueName) {
        this.data = data;
        var _recordCount = data.length;
        this.recordCount = _recordCount;
        this.attributes = attributes;
        this.attributeName = attributeName;
        this.valueName = valueName;
        this.gini = calcGini(data, className);
        this.splits = partitionOnAttributes(data, this.attributes);
        this.children = [];
        
        let maxGain = 0;
        let maxAttribute = undefined;
        let alen = attributes.length;
        for(let i = 0; i < alen; i++) {
            let attribute = this.splits[i];
            let vlen = attribute.values.length;
            let avgGini = 0;
            for(let j = 0; j < vlen; j++) {
                let value = attribute.values[j];
                let weight = value.data.length / _recordCount;
                let gini = calcGini(value.data, className);
                avgGini = avgGini + gini * weight;
            }
            let gain = this.gini - avgGini;
            if (gain > maxGain) {
                maxGain = gain;
                maxAttribute = attribute;
            }
        }
        
        if (maxAttribute !== undefined) {            
            this.children = maxAttribute.values.map(function(x) { 
                return new DecisionTreeNode(
                    x.data, 
                    removeAttribute(attributes, maxAttribute.attribute),
                    className,
                    maxAttribute.attribute,
                    x.valueName);
            });
        }
        
    }; 
    
    var partitionOnValues = function (data, attribute) {
        
        // get values for the atribute
        var values = getDistinctValues(data, attribute); 
        
        // initialize the value map
        var valueMap = [];
        var vlen = values.length;
        for (let i = 0; i < vlen; i++) {
            valueMap[values[i].value] = [];    
        }
        
        // divide up the records
        var dlen = data.length;
        for (let i = 0; i < dlen; i++) {
            valueMap[data[i][attribute]].push(data[i]);
        }
        
        // return an array of data rows
        return values.map(function(x) { 
            return {
                valueName: x.value,
                data: valueMap[x.value] 
            };
        });
        
    };
    
    var partitionOnAttributes = function(data, attributes) {
        return attributes.map(function(x) {
            return {
                attribute: x,
                values: partitionOnValues(data, x)
            };
        });
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
    
    var getAttributes = function(data) {
        return Object.getOwnPropertyNames(data[0]);
    };
    
    var removeAttribute = function(attributes, attribute) {
        return attributes.filter(function(x) { return x != attribute; });
    };
    
    var jsonToTree = function(json, className) {
        var dt = new DecisionTree(json, className); 
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