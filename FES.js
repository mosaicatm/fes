/**
 * Created by lindsey on 12/22/2016.
 */

'use strict';

function FES() {
	this._filter = {};
	this._parser = new DOMParser();
}

FES.Operator = {
	LessThan: 'PropertyIsLessThan',
	LessThanOrEqual: 'PropertyIsLessThanOrEqualTo',
	GreaterThan: 'PropertyIsGreaterThan',
	GreaterThanOrEqual: 'PropertyIsGreaterThanOrEqualTo',
	Equal: 'PropertyIsEqualTo',
	NotEqual: 'PropertyIsNotEqualTo',
	Intersects: 'Intersects'
};

FES.ValueType = {
	Literal: 'Literal',
	Function: 'Function',
	PropertyName: 'PropertyName'
};

FES.prototype.condition = function(operand1,operator,operand2) {

	return {
		operator: operator,
		operands: [operand1,operand2]
	}
};

FES.prototype.value = function(type,value) {
	return {
		"type": type,
		"value": value
	};
};

FES.prototype.and = function(conditionArray) {
	return {
		"And": conditionArray
	}
};

FES.prototype.or = function(conditionArray) {
	return {
		"Or": conditionArray
	}
};

FES.prototype.function = function(functionName,parameterArray) {
	return {
		"function": {
			"name": functionName,
			"parameters": parameterArray
		}
	}
};

FES.prototype.toXML = function() {

	function geoJsonToGML(geojson) {
		return '<gml:Polygon xmlns:gml="http://www.opengis.net/gml"></gml:Polygon>';
	}

	function createFunctionXmlNode(jsonNode) {
		var arr = jsonNode.function.parameters;
		var fnXml = '<ogc:Function name="' + jsonNode.function.name + '">';
		for (var i=0; i<arr.length; i++) {
			var val = (arr[i].value != null && typeof(arr[i].value) == "object") ?
				JSON.stringify(arr[i].value) :
				arr[i].value;

			fnXml += '<ogc:' + arr[i].type + '>' + val + '</ogc:' + arr[i].type + '>';
		}
		fnXml += '</ogc:Function>';
		return fnXml;
	}

	function createConditionXmlNode(jsonNode) {
		var xml = '<ogc:' + jsonNode.operator + '>';
		for (var i=0; i<jsonNode.operands.length; i++) {
			switch (jsonNode.operator) {
				case FES.Operator.Intersects:
					xml += geoJsonToGML(jsonNode.value);
					break;
				default:
					var type = jsonNode.operands[i].type;
					var val = jsonNode.operands[i].value;
					if (type == FES.ValueType.Function)
						xml += createFunctionXmlNode(val);
					else
						xml += '<ogc:' + type + '>' + val + '</ogc:' + type + '>';
					break;
			}
		}
		xml += '</ogc:' + jsonNode.operator + '>';
		return xml;
	}

	function createXmlNode(jsonNode) {
		for (var property in jsonNode) {
			if (jsonNode.hasOwnProperty(property)) {
				if (property=='And' || property=='Or') {
					var arr = jsonNode[property];
					var xml = '<ogc:' + property + '>';
					for (var i=0; i<arr.length; i++) {
						xml += createXmlNode(arr[i]);
					}
					xml += '</ogc:' + property + '>';
					return xml;
				} else {
					if (jsonNode.operator) {
						return createConditionXmlNode(jsonNode);

					} else if (jsonNode.function) {
						return createFunctionXmlNode(jsonNode);
					}
				}
			}
		}
		return "";
	}

	return '<ogc:Filter xmlns:ogc="http://www.opengis.net/ogc">' + createXmlNode(this._filter) + '</ogc:Filter>';
};

FES.prototype.toJSON = function() {
	return JSON.stringify(this._filter);
};

FES.prototype.fromJSON = function(json) {
	this._filter = json;
};

FES.prototype.fromXML = function(xml) {

	var fes = this;

	function parseValue(raw) {
		var val;
		if (raw) {
			if (raw.trim() === 'true') {
				val = true;
			} else if (raw.trim() === 'false') {
				val = false;
			} else {
				try {
					val = JSON.parse(raw);
				} catch (e) {
					val = raw;
				}
			}
		}
		return val;
	}

	function parseFunction(node) {
		var arr = [];
		var params = node.childNodes;
		for (var i=0; i<params.length; i++) {
			var type = params[i].nodeName;
			var val = parseValue(params[i].childNodes[0].nodeValue);
			arr.push(fes.value(
				type.substring(type.indexOf(':')+1),
				val)
			)
		}
		return fes.function(node.getAttribute('name'),arr);
	}

	function parseOperand(node) {
		var type = node.nodeName.substring(node.nodeName.indexOf(':')+1);
		var value = (FES.ValueType.Function==type) ? parseFunction(node) : parseValue(node.childNodes[0].nodeValue);
		return fes.value(type,value);
	}

	function parseNode(node) {
		var json = {};
		var name = node.nodeName;
		if (name == 'ogc:Or' || name == 'ogc:And') {
			var conditions = [];
			for (var i=0; i<node.childNodes.length; i++) {
				conditions.push(parseNode(node.childNodes[i]));
			}
			json[name.substring(name.indexOf(':')+1)] = conditions;
		} else {
			json = fes.condition(
				parseOperand(node.childNodes[0]),
				node.nodeName.substring(node.nodeName.indexOf(':')+1),
				parseOperand(node.childNodes[1])
			);
		}
		return json;
	}

	var dom = this._parser.parseFromString(xml,"text/xml");
	var filters = dom.getElementsByTagName("Filter");
	if (filters && filters.length==1) {
		var nodes = filters[0].childNodes;
		if (nodes && nodes.length==1) {
			this._filter = parseNode(nodes[0]);
		}
	}
};


