(function () {

	"use strict";

	var app = angular.module('scanner', []);

	app.controller('scannerCtrl', function ($scope, $http) {
		$http.httpError = function (response) {
			console.log(response.status + ": " + response.statusText);
		};

		$scope.formats = 'jpg,gif,bmp,png,jpeg'.split(',').sort();
		$scope.pic = null;

		$scope.btnDisable = function () {
			return !(this.holded && this.device && (this.holded === this.device.name) && this.format);
		}

		$scope.canvasStyle = function () {
			console.log(this, arguments);
		}

		$scope.cmd = function (cmd, data,/*cmd, data, ...,*/ callback, errHandler) {
			this.inWait = true;
			var self = this,
			    cmds = [];
			for (var i = 0, l = arguments.length; i < l; ++i) {
				var arg = arguments[i];
				if (typeof arg === 'function') {
					callback = arg;
					errHandler = arguments[++i];
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
				delete self.action;
				callback.call(self, response);
			}, function (response) {
				self.inWait = false;
				delete self.action;
				(errHandler || this.httpError).call(self, response);
			});
		};

		$scope.hold = function (device) {
			this.action = ["Reserving device", this.device.name].join(' ');
			this.cmd('hold', {name: device}, function (responce) {
				this.holded = device;
				var geometry = this.device.fields.geometry;
				this.defaultGeometry = {
					l: parseFloat(geometry.l.split('-')[0]),
					t: parseFloat(geometry.t.split('-')[0]),
					x: parseFloat(geometry.x.split('-')[1]),
					y: parseFloat(geometry.y.split('-')[1])

				};
			}, function (response) {
				if (response.status == 409){
					setTimeout(function () {$scope.hold(device)}, 2 * 60 * 1000);
				} else {
					alert('Can not hold device ' + device + '\nError ' + response.status + ": " + response.statusText);
				}
			});
		};

		$scope.scan = function (values) {
			for (var key in this.defaultGeometry)
				if (!values[key])
					values[key] = this.defaultGeometry[key];
			this.action = "Scanning";
			this.cmd('scan', values, function (response) {
				console.log(response.data[0]);
				this.pic = response.data[0];
			}, function (response) {
				alert('Scan process error.\nError ' + response.status + ": " + response.statusText);
			});
		};

		$scope.prescan = function () {
			console.log(this);
		}

		window.onunload = function () {
			$scope.cmd('close', function () {});
		};

		$http({
			method: 'POST',
			url: ''
		}).then(function (response) {
			$scope.job = response.data;
			$scope.action = 'Trying connect to server';
			$scope.cmd('list', function (response) {
				this.list = response.data[0];
			}, function (response) {
				alert('Connection corrupted\nError ' + response.status + ": " + response.statusText);
			});
		}, function (response) {
			alert('Can not set connection\nError ' + response.status + ": " + response.statusText);
		});
	});
})()