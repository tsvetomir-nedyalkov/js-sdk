'use strict';

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

var Constants = {};

Constants.TextFieldName = 'textField';
Constants.NumberFieldName = 'numberField';
Constants.ArrayFieldName = 'arrayField';

if ((typeof module === 'undefined' ? 'undefined' : _typeof(module)) === 'object') {
  module.exports = Constants;
} else {
  window.Constants = Constants;
}