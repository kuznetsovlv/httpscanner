#!/usr/bin/env node

(function () {
	"use strinct";
	var http = require('http');
	var fs = require('fs');
	var path = require('path');
	var Buffer = require('buffer').Buffer;

	var scanner = require('./lib/scanner.js');
	var set_status = require('./lib/status.js');
	var set_mime = require('./lib/mime.js')

	var options = {
		defaultFile: 'index.html'
	}

	

	function sendFile (response, fd, pos) {
		var size = 1024;
		fs.read(fd, new Buffer(size), 0, size, pos, function (err, bytesRead, buffer) {
			if (err)
				response.end();
			else
				response.write(buffer.toString('utf8', 0, bytesRead), 'utf8', function () {
					if (bytesRead < size) 
						response.end();
					else
						sendFile(response, fd, pos + bytesRead);
				});
		});
	}

	function sendError (response, code, msg) {
		set_status(response, code || 404, msg);
		response.end();
	} 

	function urlToFile (response, url) {
		fs.stat(url, function (err, stats) {
			if (err) {
				sendError(response, 404, 'File ' + path.basename(url) + ' not found.');
			} else if (stats.isFile()) {
				response.statusCode = 200;
				response.statusMessage = 'OK';
				set_mime(response, path.extname(url));
				fs.open(url, 'r', function (err, fd) {
					if (err)
								throw err;
					sendFile(response, fd, 0);
				});
			} else if (stats.isDirectory()) {
				urlToFile (response, path.normalize(path.join(url, options.defaultFile)));
			} else {
				sendError(response, 404, 'Incorrect path');
			}
		});
	}

	var server = new http.Server();

	server.on('request', function (request, response) {
		switch (request.method) {
			case 'GET': urlToFile(response, path.join(__dirname, request.url)); break;
			case 'POST':
				var data = [];
				request.on('data', function (chunk) {data.push(chunk);});
				request.on('end', function () {
					data = data.join('');
					if (!request.headers['content-type'] === 'application/json')
						sendError(response, 400, 'Content must be application/json');
					data = JSON.parse(data);
					var params = [],
					    type = ['.', data['--format'] || 'png'].join('');
					for (var key in data) {
						params.push(data[key] ? [key, data[key]].join(' ') : key);

					}
					var result = scanner(params);
					response.statusCode = null;
					result.stdout.on('data', function (data) {
						if (!response.statusCode) {
							response.statusCode = 200;
							response.statusMessage = 'OK';
							set_mime(response, type);
						}
						response.write(data);
					});
					result.stdout.on('end', function () {response.end();});
					result.stderr.on('data', function (data) {sendError(response, 500);});
				});
				break;
		}
	});

	server.listen(80);
})()