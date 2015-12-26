#!/usr/bin/env node

(function () {
	"use strinct";
	var http = require('http');
	var fs = require('fs');
	var path = require('path');
	var Buffer = require('buffer').Buffer;

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

	function send404 (response, msg) {
		response.statusCode = 404;
		response.statusMessage = msg || 'Not found';
		response.end();
	} 

	function urlToFile (response, url) {
		fs.stat(url, function (err, stats) {
			if (err) {
				send404(response, 'File ' + path.basename(url) + ' not found.');
			} else if (stats.isFile()) {
				response.statusCode = 200;
				response.setHeader("Content-Type", "text/html");
				response.setHeader("Content-Encoding", "UTF-8");
				fs.open(url, 'r', function (err, fd) {
					if (err)
								throw err;
					sendFile(response, fd, 0);
				});
			} else if (stats.isDirectory()) {
				urlToFile (response, path.normalize(path.join(url, options.defaultFile)));
			} else {
				send404(response, 'Incorrect path');
			}
		});
	}

	var server = new http.Server();

	server.on('request', function (request, response) {
		switch (request.method) {
			case 'GET': urlToFile(response, path.join(__dirname, request.url)); break;
			case 'POST': break;
		}
	});

	server.listen(80);
})()