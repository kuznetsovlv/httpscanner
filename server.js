#!/usr/bin/env node

(function () {
	"use strict";

	const path = require('path');

	const spawn = require('child_process').spawn;

	const scanServer = require('scanserver');

	const utils = require('utils');

	const config = require('./config.json');

	const server = new scanServer.Server(__dirname, 80);

	const WAIT = 20 * (60 * 1000);


	/*console.log(config);

	console.log(JSON.stringify(config));*/

	server.busy = {};

	/*function scanner (args, options) {
		return spawn('scanimage', args, options);
	}*/

	function scanner (args, callback, stdoutErr, stderr) {
		if (!stderr)
			stderr = stdoutErr;
		let scan  = spawn('scanimage', args);
		let self = this;
		let data = '';

		scan.stdout.on('data', (chunk) => {data += chunk;});

		if (stdoutErr) {
			scan.stdout.on('error', stdoutErr.call(self, data));
			scan.stderr.on('data', stderr.call(self, data));
		}

		scan.on('close', callback.call(self, code));
	}

	function scanDevices () {
		let data = '';
		let self = this;

		scanner(['-f %i\t%d\t%v\t%m\t%n'], (code) => {
			if (code) {
				self.emit('error', 503, "Stopped with code " + code);
			} else {
				data = data.split('\n');
				let list = [];
				for (let i = 0, l = data.length; i < l; ++i) {
					let raw = data[i];
					if (!raw)
						continue;
					raw = raw.trim().split('\t');
					let tmp = {
						i: +raw[0],
						name: raw[1],
						description: [raw[2], raw[3]].join(' ')
					},
					scanners = config.scanners;
					for (let i = 0, l = scanners.length; i < l; ++i)
						if (tmp.description === scanners[i].type) {
							tmp.fields = utils.clone(scanners[i].fields);
							list.push(tmp);
							break;
						}
				}
				list.sort(function (a, b) {return a.i - b.i});
				self.emit('dataComplete', list);
			}
		}, (data) => {console.log(data); this.emit('error', 503, data)}, (data) => {this.emit('error', 520, data)});
	}

	/*function holdDevice (name) {
		let scan = scanner(['-d ' + name, '-n']);

		if (server.busy[name]) {
			this.emit('error', 503, 'Device ' + name + ' busy.');
			this.cmds = [];
			return;
		}

		server.busy[name] = this.name;
		this.device = name;
	}*/

	function performCmd (cmd, values) {
		switch (cmd) {
			case 'close': this.emit('finish', true); break;
			//case 'hold': holdDevice.call(this, values.name); break; 
			case 'list': scanDevices.call(this); break;
			default: tthis.emit('error', 405, 'Unknown command: ' + cmd);
		}

	};

	server.jobs.on('data', function (type, data) {

		if (this.waiting)
			clearTimeout(this.waiting);

		if (this.finished)
			this.clear(408);

		if (!/\bapplication\/json\b/.test(type))
			this.emit('error', 400, 'The content-type must be an "application/json".');
		data = JSON.parse(data);


		if (!(data instanceof Array))
			this.emit('error', 400, 'Content must be an Array.');

		let common = {};
		this.cmds = [];
		for (let i = 0, j = 1, l = data.length; i < l; ++i, ++j) {
			let di = data[i], dj = data[j];
			switch (typeof di) {
				case 'object': common = di; continue; break;
				case 'string': this.cmds.push([di, typeof dj === 'object' ? utils.joiny(dj, common) : common]); break;
				default: this.emit('error', 400, 'The type of content elements must be a string or an object');
			}
		}

		if (this.cmds.length)
			performCmd.apply(this, this.cmds.shift());
	});

	server.jobs.on('dataComplete', function (data) {
		if (!this.answers)
			this.answers = [data];
		else
			this.answers.push(data);

		if (this.cmds.length) {
			performCmd.apply(this, this.cmds.shift());
		} else {
			let self = this;
			setTimeout(() => {self.emit('finish');}, WAIT);
			this.sendData(JSON.stringify(this.answers), 'json');
		}
	});

	server.jobs.on('error', function (code, msg) {
		let self = this;
		setTimeout(() => {self.emit('finish');}, WAIT);
		this.sendError(code, msg);
	});

	server.jobs.once('finish', function (finalize) {
		if (this.device) {
			delete server.busy[this.device];
			delete this.device;
		}
		this.cmds = [];
		 if (finalize)
		 	this.clear(200);
		 else
		 	this.finished = true;
	});

	server.up();



	/*var http = require('http');
	var fs = require('fs');
	var path = require('path');
	var Buffer = require('buffer').Buffer;
	var spawn = require('child_process').spawn;

	var set_status = require('./lib/status.js');
	var set_mime = require('./lib/mime.js');

	var options = {
		defaultFile: 'index.html'
	};

	var jobs = {};

	 function scanner (args, options) {
		return spawn('scanimage', args, options);
	}

	function converter (format, args, options) {
		switch (format.toLowerCase()) {
			case 'jpg':
			case 'jpeg': return spawn('pnmtojpeg', args, options);
			case 'png': return spawn('pnmtopng', args, options);
			default: return undefined;
		}
	}

	function sendError (response, code, msg) {
		set_status(response, code || 404, msg);
		response.end();
	} 

	function sendFile (response, fd, pos) {
		var size = 1024;
		fs.read(fd, new Buffer(size), 0, size, pos, function (err, bytesRead, buffer) {
			if (err)
				response.end();
			else
				response.write(buffer, function () {
					if (bytesRead < size) 
						response.end();
					else
						sendFile(response, fd, pos + bytesRead);
				});
		});
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
						sendError(response, 520, err.Error);
					response.setHeader('Content-length', stats.size);
					response.setHeader('Last-Modified', stats.mtime.toUTCString());
					sendFile(response, fd, 0);
				});
			} else if (stats.isDirectory()) {
				urlToFile (response, path.normalize(path.join(url, options.defaultFile)));
			} else {
				sendError(response, 404, 'Incorrect path');
			}
		});
	}

	function obj2opts (obj) {
		var opts = [];
		for (var key in obj) {
			if ({cmd: 1, format: 1}[key])
				continue;
			var d = ' ',
			    p = '-';
			if(key.length > 1) {
				p = '--',
				d = '=';
			}
			var opt = [ p, key].join('');
			if (obj[key])
				opt = [opt, obj[key]].join(d);
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
		scan.stderr.on('data', function () {sendError(response, 520);});
	}

	function drawPath (p, checked, callback) {
		if (p === checked){
			callback();
		} else {
			var dir = p,
			    tmp;
			while ((tmp = path.dirname(dir)) && tmp !== checked)
				dir = tmp;
			fs.stat(dir, function (err, stats) {
				if (err) {
					if (err.code === 'ENOENT') {
						fs.mkdir(dir, function (err) {
							if (err)
								sendError(response, 520, err.Error);
							else
								drawPath(p, dir, callback);
						});
					} else {
						sendError(response, 520, err.Error);
					}
				} else if (!stats.isDirectory()) {
					sendError(response, 520, dir + ' must be a dirrectory');
				} else {
					drawPath(p, dir, callback);
				}
			});
		}
	}

	function scanImage (response, data, device) {
		var format = data.conv.format,
		    devPath = path.join('scans', device),
		    imgPath = path.join(devPath, ['img', format].join('.')),
		    fd = 0;
		jobs[device] = imgPath;

		response.on('finish', function () {
			delete jobs[device];
		});

		response.on('close', function () {
			delete jobs[device];
		});

		drawPath(path.join(__dirname, devPath), __dirname, function () {
			var args = obj2opts(data.scanner);
			args.push('--format=pnm')
			var scan = scanner(args);
			var conv = converter(format, obj2opts(data.conv.opts));

			scan.stdout.on('data', function (data) {
				conv.stdin.write(data);
			});
			scan.on('close', function (code) {
				if (code)
					sendError(response, 503, 'Scanner not ready');
				conv.stdin.end();

			});

			conv.stdout.on('data', function (data) {
				var buffer = new Buffer(data);
				if (!fd) {
					try {
						fd = fs.openSync(imgPath, 'w');
					} catch (err) {
						sendError(response, 520, err.Error);
					}
				}
				try {
					fs.writeSync(fd, buffer, 0, buffer.length);
				} catch (err) {
					sendError(response, 520, err.Error);
				}

			});
			conv.on('close', function (code) {
				fs.close(fd, function () {
					if (code)
						sendError(response, 520);
					set_status(response, 200);
					set_mime(response, 'txt');
					response.end(imgPath);
				});
			});

			scan.stderr.on('data', function (data) {sendError(response, 520, data);});
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
					try {
						data = JSON.parse(data);
					} catch (e) {
						sendError(response, 400, 'Wrong JSON');
					}

					var cmd = data.cmd,
					    device = data.scanner ? data.scanner['device-name'] : null;
					switch (cmd) {
						case 'free':
						case 'list': sendDeviceList(response, cmd === 'free'); break;
						case 'scan':
								if (jobs[device])
									sendError(response, 409, 'Device busy');
								else
									scanImage(response, data, device);
								break;
						case 'stop':
						default: sendError(response, 405, 'Unknown command');
					}
				});
				break;
		}
	});

	server.listen(80);*/
})()