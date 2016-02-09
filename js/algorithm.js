(function () {

	"use strict";

	var app = angular.module('scanner', []);

	app.controller('scannerCtrl', function ($scope, $http) {
		$http.httpError = function (response) {
			console.log(response.status + ": " + response.statusText);
		};

		$scope.cmd = function (cmd, data,/*cmd, data, ...,*/ callback, errHandler) {
			this.inWait = true;
			var cmds = [];
			for (var i = 0, l = arguments.length; i < l; ++i) {
				var arg = arguments[i];
				if (typeof arg === 'function') {
					callback = arg;
					break;
				} else if ({'string': 1, 'object': 1}[typeof arg]) {
					cmds.push(arg);
				} else {
					throw "Incorrect data format";	
				}
			}
			$http({
				method: 'POST',
				url: $scope.job,
				headers: {
				'content-type': 'application/json'
			},
				data: JSON.stringify(cmds)
			}).then(function (response) {
				self.inWait = false;
				callback.call(self, response);
			}, function (response) {
				self.inWait = false;
				(errHandler || this.httpError).call(self, response);
			});
		};

		$http({
			method: 'POST',
			url: ''
		}).then(function (response) {
			$scope.job = response.data;
			$scope.cmd('list', function (response) {
				this.list = response.data[0];
				console.log(this.list);
			}, function (response) {
				alert('Connection corrupted\nError ' + response.status + ": " + response.statusText);
			});
		}, function (response) {
			alert('Can not set connection\nError ' + response.status + ": " + response.statusText);
		});
	});
})()