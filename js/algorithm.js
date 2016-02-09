(function () {

	"use strict";

	var app = angular.module('scanner', []);

	app.controller('scannerCtrl', function ($scope, $http) {
		console.log($scope);

		$http.httpError = function (response) {
			console.log(response.status + ": " + response.statusText);
		};

		$scope.cmd = function (cmd, data,/*cmd, data, ...,*/ callback, errHandler) {
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
			}).then(callback, errHandler || $http.httpError);
		};

		$http({
			method: 'POST',
			url: ''
		}).then(function (response) {
			$scope.job = response.data;
			console.log($scope);
			/*$scope.cmd('data', function (response) {
				$scope.data = response.data[0] || {};
				$scope.rebuild();
			});*/
		}, $http.httpError);
	});
})()