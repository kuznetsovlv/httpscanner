(function () {
	"use strict";
	 function Scanner () {

	 }

	 Scanner.prototype.ask = function (cmd, params, callback) {
	 	if (typeof params === 'function') {
	 		callback = params;
	 		params = {};
	 	}
	 	var self = this;
	 	params.cmd = cmd;

	 	var request = new XMLHttpRequest();
	 	request.open("POST", "");
	 	request.setRequestHeader("Content-Type", "application/json");
	 	request.onreadystatechange = function () {
	 		if (request.readyState == 4 && request.status == 200){
	 			var result = JSON.parse(request.responseText);
	 			callback.call(self, result);
	 		}
	 	};
	 	request.send(JSON.stringify(params));
	 }

	 window.Scanner = Scanner;
})()