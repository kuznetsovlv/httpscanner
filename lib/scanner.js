(function () {
	"use strict";

	module.exports = function (args, options) {
		return require('child_process').spawn('scanimage', args, options);
	}
})()