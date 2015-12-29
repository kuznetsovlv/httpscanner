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
	};

	var jobs = {};

	

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

	function json2opts (json) {
		var opts = [];
		for (var key in json) {
			if (key === 'cmd')
				continue;
			var opt = [key.length > 1 ? '--' : '-', key].join('');
			if (json[key])
				opt = [opt, json[key]].join(' ');
			opts.push(opt);
		}
		return opts;
	}

	function sendDeviceList (response, free) {
		var data = '';
		var scan = scanner(['-f %i\t%d\t%v\t%m\t%n']);

		scan.stdout.on('data', function (chunk) {data += chunk;});
		scan.stdout.on('end', function () {
			data = data.split('\n');
			var list = [];
			for (var i = 0, l = data.length; i < l; ++i) {
				var raw = data[i];
				if (!raw)
					continue;
				raw = raw.trim().split('\t');
				list.push({
					i: +raw[0],
					name: raw[1],
					description: [raw[2], raw[3]].join(' ')
				});
			}
			list.sort(function (a, b) {return a.i - b.i});
			if (free)
				list = list.filter(function (a, i, arr) {return !jobs[a.name];});
			set_status(response, 200);
			set_mime(response, 'json');
			response.end(JSON.stringify(list));
		});
	}

	var server = new http.Server();

	server.on('close', function () {console.log(arguments)});

	server.on('request', function (request, response) {
		/*response.on('finish', function () {
			console.log('Finished');
			console.log(arguments);
		});
		response.on('close', function () {
			console.log('Closed');
			console.log(arguments);
		});*/
		switch (request.method) {
			case 'GET': urlToFile(response, path.join(__dirname, request.url)); break;
			case 'POST':
				var data = [];
				request.on('data', function (chunk) {data.push(chunk);});
				request.on('end', function () {
					data = data.join('');
					if (!request.headers['content-type'] === 'application/json')
						sendError(response, 400, 'Content must be application/json');
					try {
						data = JSON.parse(data);
					} catch (e) {
						sendError(response, 400, 'Wrong JSON');
					}

					var cmd = data.cmd,
					    device = data['device-name'];
					switch (cmd) {
						case 'free':
						case 'list': sendDeviceList(response, cmd === 'free'); break;
						case 'scan':
						case 'stop':
						default: sendError(response, 405, 'Unknown command');
					}
					/*var params = [],
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
					result.stderr.on('data', function (data) {sendError(response, 500);});*/
				});
				break;
		}
	});

	server.listen(80);
})()