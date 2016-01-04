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

		this.on = function on (type, handler) {
			if (this.events[type])
				this.events[type].push(handler);
			else
				this.events[type] = [handler];
			return this;
		};

		this.once = function once (type, handler) {
			if (this.onceEvents[type])
				this.onceEvents[type].push(handler);
			else
				this.onceEvents[type] = [handler];
			return this;
		};

		this.emit = function emit (type) {
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
	}

	function Element (e) {

		EventEmmtter.call(this);

		this.e = e;
		this.tag = e.tagName.toLowerCase();
		e['data-cover'] = this;

	}

	function Select (e) {
		Element.call(this, e);

		this.setOptions = function setOptions (opts) {
			var children = this.e.children;
			while (children.length)
				this.e.removeChild(children[0]);

			for (var key in opts) {
				var option = document.createElement('option');
				option.setAttribute('value', key);
				option.appendChild(document.createTextNode(opts[key]));
				this.e.appendChild(option);
			}
		}
	}


	function Input (e) {
		Element.call(this, e);
	}

	function Field (e) {
		switch (e.tagName) {
			case 'SELECT': Select.call(this, e); break;
			case 'INPUT':
			default: Input.call(this, e); break;
		}

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
						return this.e.getAttribute('type') || this.tag;
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

		for (var i = 0, l = form.length; i < l; ++i) {
			var e = form[i];
			this.buttons = {};
			if ( !{FIELDSET: 1, OUTPUT: 1}[e.tagName]) {
				var name = e.getAttribute('name');
				var field = new Field(e);
				var dest;
				switch (field.type) {
					case 'button':
					case 'submit': dest = this.buttons; break;
					default: dest = this;
				}
				if (dest.name)
					throw ["Duplicated or incorrect name", name, "found"].join(' ');
				dest[name] = field;
			}
		}
		Object.defineProperty(this, 'values', {
			get: function () {
				var v = {};
				for (var key in this) {
					var field = this[key];
					if (field.constructor !== Field || !field.enabled)
						continue;
					v[key] = field.value;
				}
				return v;
			},
			set: function (v) {
				if (typeof v === 'object') {
					for (var key in v) {
						var field = this[key];
						if (!field || !('value' in field))
							continue;
						field.value = v[key];
					}
				}
			}
		});

		var self = this;
		var eventMap = 'change,submit,reset,click'.split(',');
		for (var i = 0, l = eventMap.length; i < l; ++i) {
			var type = eventMap[i];
			(function () {
				setListener(form, type, function (event) {
					var target = event.target,
					    name = target.getAttribute('name'),
					    element = target['data-cover'],
					    e_type = element.type;
					switch (type) {
						case 'click':
							switch (e_type) {
								case 'button': self.emit('button', name, self.values); break;
							}
							break;
						case 'change': self.emit('change', self.values, element.value); break;
						case 'submit': self.emit('save', self.values); break;
						case 'reset': self.emit('reset'); break;
						default: self.emit(type, name, self.values, element);
					}

					self.emit(type, event);
					if (event.PreventDefault)
						event.PreventDefault();
					if (event.returnValue)
						event.returnValue = false;
					return false;
				});
			})();
		}
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
			if (request.readyState == 4){
				var status = request.status;
				if (status >= 200 && status < 300) {
					var result = request.getResponseHeader("Content-Type") === 'application/json' ? JSON.parse(request.responseText) : request.responseText;
					callback.call(self, result);
				} else {
					alert(['ERROR', status, '\n', request.statusMassage].join(''));
				}
			}
		};
		request.send(JSON.stringify(params));
	}

	window.Scanner = Scanner;
})()