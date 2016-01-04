(function () {
	"use strict";

	function setListener (target, type, handler) {
		try {
			target.addEventListener(type, handler, false);
		} catch (e) {
			target.attachEvent(['on', type].join(''), function (event) {
				return handler.call(target, event);
			});
		}
	}

	function EventEmmtter () {
		this.events = {};
		this.onceEvents = {};
	}

	EventEmmtter.prototype.on = function on (type, handler) {
		if (this.events[type])
			this.events[type].push(handler);
		else
			this.events[type] = [handler];
		return this;
	};

	EventEmmtter.prototype.once = function once (type, handler) {
		if (this.onceEvents[type])
			this.onceEvents[type].push(handler);
		else
			this.onceEvents[type] = [handler];
		return this;
	};

	EventEmmtter.prototype.emit = function emit (type) {
		var listeners = this.onceEvents[type],
		    args = [];

		for (var i = 1, l = arguments.length; i < l; ++i)
			args.push(arguments[i]);

		if (listeners)
			while(listeners.length)
				listeners.shift().apply(this, args);

		listeners = this.events[type];
		if (listeners)
			for (var i = 0, l = listeners.length; i < l; ++i)
				listeners[i].apply(this, args);

		return this;
	}

	function Element (e) {

		EventEmmtter.call(this);

		this.e = e;
		this.tag = e.tagName.toLowerCase();
	}

	function Input (e) {

		Element.call(this, e);

		Object.defineProperties(this, {
			'value': {
				get: function () {return this.e.disabled ? undefined : this.e.value},
				set: function (v) {this.e.value = v;}
			},
			'enabled': {
				get: function () {return !this.e.disabled;},
				set: function (v) {this.e.disabled = !v;}
			},
			'type': {
				get: function () {
						return this.e.getAttribute('type') || this.e.tagName.toLowerCase();
				}
			}
		});
	}

	function Scanner (id) {

		var form = document.getElementById(id);
		if (form.tagName!== 'FORM')
			form = form.getElementsByTagName('form')[0];
		if (!form)
			throw "Wrong form element";

		Element.call(this, form);

		var self = this;
		setListener(form, 'submit', function (event) {

			if (event.PreventDefault)
				event.PreventDefault();
			if (event.returnValue)
				event.returnValue = false;
			return false;
		});
		for (var i = 0, l = form.length; i < l; ++i) {
			var e = form[i];
			if ( !{FIELDSET: 1, OUTPUT: 1}[e.tagName]) {
				var name = e.getAttribute('name');
				if (this.name)
					throw ["Duplicated or incorrect name", name, "found"].join(' ');
				this[name] = new Input(e);
			}
		}
		Object.defineProperty(this, 'values', {
			get: function () {
				var v = {};
				for (var key in this) {
					var input = this[key];
					if (input.constructor !== Input || {submit: 1, button: 1}[input.type] || !input.enabled)
						continue;
					v[key] = input.value;
				}
				return v;
			},
			set: function (v) {
				if (typeof v === 'object') {
					for (var key in v) {
						var input = this[key];
						if (!input || !('value' in input))
							continue;
						input.value = v[key];
					}
				}
			}
		})
	}

	Scanner.prototype.ask = function (cmd, params, callback) {
		if (typeof params === 'function') {
			callback = params;
			params = {};
		}
		var self = this;
		params.cmd = cmd;

		var request = new XMLHttpRequest();
		request.open("POST", "");
		request.setRequestHeader("Content-Type", "application/json");
		request.onreadystatechange = function () {
			if (request.readyState == 4 && request.status == 200){
				var result = request.getResponseHeader("Content-Type") === 'application/json' ? JSON.parse(request.responseText) : request.responseText;
				callback.call(self, result);
			}
		};
		request.send(JSON.stringify(params));
	}

	window.Scanner = Scanner;
})()