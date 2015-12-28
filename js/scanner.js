(function () {
	"use strict";
	 function sendResponse (resp, callback) {
	 	var request = new XMLHttpRequest();
	 	request.open("POST", "");

	 	request.onreadystatechange = function () {
	 		if (request.readyState == 4 && request.status == 200)
	 			callback(request);
	 	};

	 	request.ontimeout = function () {
	 		alert('Timeout!');
	 	};

	 	/*request.onprogress = function () {
	 		console.log(request.responseText.length);
	 	}*/

	 	if (typeof resp === 'object') {
	 		resp = JSON.stringify(resp);
	 		request.setRequestHeader("Content-Type", "application/json");
	 	} else {
	 		request.setRequestHeader("Content-Type", "text/plain;charset=UTF-8");
	 	}
	 	request.send(resp);
	 }

	 function devParse (str) {
	 	var device = {};
	 	str =( str.split('device ')[1] || '').split(' is a ');
	 	device.name = str[0].replace(/[`'"]/g, ' ').trim();
	 	device.description = str[1] || '';
	 	return device;
	 }

	 function Scanner () {

	 }

	 Scanner.prototype.ask = function (cmd, params, callback) {
	 	if (typeof params === 'function') {
	 		callback = params;
	 		params = {};
	 	}
	 	var _callback = callback,
	 	    self = this;;
	 	switch (cmd) {
	 		case 'list':
	 			params = {'-L': ''};
	 			callback = function (obj) {
	 				var tmp = obj.responseText.split('\n'),
	 				    result = [];

	 				for (var i = 0, l = tmp.length; i < l; ++i){
	 					var t = tmp[i];
	 					if (t)
	 						result.push(devParse(t));
	 				}

	 				_callback.call(self, result);
	 			}
	 			break;
	 		case 'scan':
	 			callback = function (obj) {
	 				_callback.call(self, obj.responseText);
	 			};
	 			if (!params)
	 				params = {};

	 	}

	 	sendResponse.call(this, params, callback);
	 }

	 window.Scanner = Scanner;
})()