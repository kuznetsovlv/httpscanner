(function () {
	"use strict";

	var http = require('http');
	var fs = require('fs');
	var path = require('path');
	var Buffer = require('buffer').Buffer;
	var spawn = require('child_process').spawn;

//	console.log(http.STATUS_CODES);
	class Responser {
		constructor (response) {
			this.response = response;
			this.statusList = http.STATUS_CODES;

			this.setStatus = function (code, msg) {
				if (!code)
					code = 520;
				this.response.stusCode = code;
				this.response.statusMessage = msg || this.statusList[code] || '';
				return this;
			};

			this.sendError = function (code, msg) {
				this.setStatus(code || 404, msg);
				this.response.end();
				return this;
			};
		}
	}

	class FileSender extends Responser {
		constructor (response, filePath) {
			super(response);

			this.path = filePath;
			this.mime = require('./mime.js');
			this.defaultFile = 'index.html';

			this.setMime = function (mime) {
				if (mime.substr(0, 1) !== '.')
					mime = '.' + mime;
				var headers = this.mime[mime] || this.mime['.txt'];
				for (var key in headers)
					response.setHeader(key, headers[key]);
				return this;
			}
			
			this.sendFile = function () {
				function _send(fd, pos) {
					var size = 1024,
					    self = this;;

					fs.read(fd, new Buffer(size), 0, size, pos, function (err, bytesRead, buffer) {
						if (err)
							self.response.end();
						else
							self.response.write(buffer, function () {
								if (bytesRead < size)
									self.response.end();
								else
									_send.call(self, fd, pos + bytesRead);
							});
					});
				}

				var self = this;

				fs.stat(this.path, function (err, stats) {
					if (err) {
						self.sendError(404, 'File ' + path.basename(url) + ' not found.');
					} else if (stats.isFile()) {
						self.setStatus(200).setMime(path.extname(self.path));
						fs.open(self.path, 'r', function (err, fd) {
							if (err) {
								self.sendError(520, err.Error);
							} else {
								self.response.setHeader('Content-length', stats.size);
								self.response.setHeader('Last-Modified', stats.mtime.toUTCString());
								_send.call(self, fd, 0);
							}
						});
					} else if (stats.isDirectory()) {
						self.path = path.normalize(path.join(self.path, self.defaultFile));
						self.sendFile();
					} else {
						self.sendError(404, 'Incorrect path');
					}
				});
			};
		}
	};

	class Commander extends Responser {
		constructor (response, instructions) {
			super(response);

			this.cmd = instructions.cmd;
		}
	}

	class Server extends http.Server {
		constructor (port) {
			
			super();

			this.statusList = http.STATUS_CODES;
			this.mime = require('./mime.js');

			this.getFileSender = function (response, path) {
				return new FileSender(response, path);
			}

			this.on('request', function (request, response) {
				this.emit(request.method.toLowerCase(), request, response);
			});

			this.listen(parseInt(port) || 80);
		}
	};

	global.FileSender = FileSender;
	global.Commander = Commander;

	module.exports = Server;
})()