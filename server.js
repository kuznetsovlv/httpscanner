#!/usr/bin/env node

(function () {
	"use strict";

	const fs = require('fs');

	const path = require('path');

	const child_process = require('child_process');

	const spawn = child_process.spawn;

	const exec = child_process.exec;

	const scanServer = require('scanserver');

	const utils = require('utils');

	const config = require('./config.json');

	const server = new scanServer.Server(__dirname, 80);

	const WAIT = 5 * (60 * 1000);

	const SCAN_DIR = path.join(__dirname, 'scans');


	server.busy = {};

	function scanner (args, handlers) {
		let scan  = spawn('scanimage', args);
		let self = this;
		let data = '';

		scan.stdout.on('data', (chunk) => {
			if (handlers.stdout)
				handlers.stdout.call(self, chunk);
			else
				data += chunk;
		});

		if (handlers.stdoutErr)
			scan.stdout.on('error', (data) => {handlers.stdoutErr.call(self, data)});
		if(handlers.stderr)
			scan.stderr.on('data', (data) => {handlers.stderr.call(self, data)});
		if (handlers.close)
			scan.on('close', (code) => {
				if (code)
					self.emit('error', 503, "Stopped with code " + code);
				else
					handlers.close.call(self, data)});
	}

	function scanDevices () {
		let handlers = {
			close: (data) => {
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
				this.emit('dataComplete', list);
			},
			stdoutErr: (data) => {console.log(data); this.emit('error', 503, data)},
		}
		scanner.call(this, ['-f %i\t%d\t%v\t%m\t%n'], handlers);
	}

	function holdDevice (name) {
		let self = this;
		exec('scanimage -Ld ' + name, (error, stdout, stderr) => {
			if (stderr) {
				self.emit('error', 503);
				console.log(`stderr: ${stderr}`);
			}
			if (error)
				self.emit('error', 503, '\n' + error.code + ': ' + error.Error);
			else {
				if (self.server.busy[name]) {
					if (!self.server.busy[name].finished && self.server.getJob(self.server.busy[name].name)) {
						self.cmds = [];
						self.emit('error', 409, 'Device ' + name + ' busy.');
						return;
					} else {
						delete server.busy[name];
					}	
				}
				if (!self.finished) {
					self.server.busy[name] = self;
					self.device = name;
					self.emit('dataComplete', name);
				}
			}
		});
	}

	function scan (values) {
		function _scan (values, to) {
			let cmd = ['scanimage', '-d', this.device];
			let p = 'resolution,l,t,x,y'.split(',');
			let self = this;
			let file = path.join(to, [this.name, values.format].join('.'));

			for (let i = 0, l = p.length; i < l; ++i) {
				let key = p[i],
				    arg = ['-'];
				if (key.length > 1)
					arg.push('-');
				arg.push(key);
				cmd.push(arg.join(''), values[key]);
			}

			cmd.push('|');

			cmd.push('convert');

			switch (values.format) {
				case 'jpg':
				case 'jpeg':
				case 'png': cmd.push('-quality ' + (values.quality || 75)); break;
			}

			cmd.push('-');

			cmd.push(file);

			exec(cmd.join(' '), (error, stdout, stderr) => {
				if (stdout)
					console.log(`stdout: ${stdout}`);
				if (stderr)
					console.log(`stderr: ${stderr}`);
				if (error)
					self.emit('error', 520, "Unknown error:\n" + error.code + ": " + error.Error);
				else {
					self.emit('dataComplete', path.relative(__dirname, file));
				}

			});
		}

		let self = this;

		fs.stat(SCAN_DIR, (err, stats) => {
			if (err) {
				if (err.code === 'ENOENT') {
					fs.mkdir(SCAN_DIR, function (err) {
						if (err)
							self.emit('error', 520, err.Error);
						else
							_scan.call(self, values, SCAN_DIR);
					});
				} else {
					self.emit('error', 520, err.Error);
				}
			} else if (!stats.isDirectory()) {
				self.emit('error', 520, SCAN_DIR + ' is not a dirrectory');
			} else {
				_scan.call(self, values, SCAN_DIR);
			}
		});
	}

	function performCmd (cmd, values) {
		switch (cmd) {
			case 'close': this.emit('finish', true); break;
			case 'hold': holdDevice.call(this, values.name); break; 
			case 'list': scanDevices.call(this); break;
			case 'scan': scan.call(this, values); break;
			default: this.emit('error', 405, 'Unknown command: ' + cmd);
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
			delete this.answers;
		}
	});

	server.jobs.on('error', function (code, msg) {
		let self = this;
		setTimeout(() => {self.emit('finish');}, WAIT);
		this.sendError(code, msg);
	});

	server.jobs.once('finish', function (finalize) {
		if (this.device) {
			delete this.server.busy[this.device];
			delete this.device;
		}
		this.cmds = [];

		let self = this;
		fs.stat(SCAN_DIR, (err, stats) => {
			if (!err && stats.isDirectory()) {
				fs.readdir(SCAN_DIR, (err, files) => {
					if(err) {
						if (finalize)
							self.clear(200);
						else
							self.finished = true;
					} else {
						let r = new RegExp('^' + self.name + '\\.\\w+$');
						for (var i = 0, l = files.length; i < l; ++i) {
							let file = files[i];
							if (r.test(file))
								fs.unlinkSync(path.join(SCAN_DIR, file));
						}
						if (finalize)
							self.clear(200);
						else
							self.finished = true;
					}
				});
			} else {
				if (finalize)
					self.clear(200);
				else
					self.finished = true;
			}
		});
	});

	fs.stat(SCAN_DIR, (err, stats) => {
			if (err) {
				if (err.code === 'ENOENT') {
					server.up();
				} else {
					throw err.code + ": " + err.Error;
				}
			} else if (stats.isDirectory()) {
				fs.rmdir(SCAN_DIR, (err) => {
					if (err)
						throw err.code + ": " + err.Error;
					else
						server.up();
				});
			} else {
				fs.unlink(SCAN_DIR, (err) => {
					if (err)
						throw err.code + ": " + err.Error;
					else
						server.up();
				});
			}
		});

	

})()