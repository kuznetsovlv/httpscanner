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

	function Output (e) {
		Element.call(this, e);

		var list = e.getAttribute('for').split(' '),
		    form = e.form;
		this.inputs = [];

		for (var i = 0, l = list.length; i < l; ++i) {
			var name = list[i];
			for (var j = 0, f = form.length; j < f; ++j) {
				if (form[j].getAttribute('name') === name) {
					this.inputs.push(form[j]);
					break;
				}
			}
		}

		this.bound = function bound (func) {
			function _getVals (arr) {
				var vals = [];
				for (var i = 0, l = arr.length; i < l; ++i)
					vals.push(parseInt(arr[i].value));
				return vals;
			}
			this.e.value = func.apply(this, _getVals(this.inputs));
			var self = this;
			setListener(this.e.form, 'input', function (events) {
				self.e.value = func.apply(self, _getVals(self.inputs));
			});
		}
	}

	function Field (e) {
		switch (e.tagName) {
			case 'SELECT': Select.call(this, e); break;
			case 'OUTPUT': Output.call(this, e); break;
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

	Field.prototype.show = function show (show) {
		function _enable (arr, enable) {
			for (var i = 0, l = arr.length; i < l; ++i)
				arr[i].disabled = !enable;
		}
		if (!arguments.length)
			show = true;
		var node = this.e;

		while (node.tagName !== 'P')
			node = node.parentNode;

		var classes = node.className.split(' '),
		    hidden = -1;

		for (var i = 0, l = classes.length; i < l; ++i)
			if (classes[i] === 'hidden') {
				hidden = i;
				break;
			}
		var fieldTags = 'input,select,output'.split(',');
		for (var i = 0, l=fieldTags.length; i < l; ++i)
			_enable(node.getElementsByTagName(fieldTags[i]), show);

		if (show) {
			if (hidden >=0)
				classes.splice(hidden, 1);
		} else if (hidden < 0)
			classes.push('hidden');
		node.className = classes.join(' ');

		return this;
	};

	Field.prototype.hide = function hide (hide) {
		if (!arguments.length)
			hide = true;
		return this.show(!hide);
	}


	function Scanner (id) {

		var form = document.getElementById(id);
		if (form.tagName!== 'FORM')
			form = form.getElementsByTagName('form')[0];
		if (!form)
			throw "Wrong form element";

		Element.call(this, form);

		this.buttons = {};

		for (var i = 0, l = form.length; i < l; ++i) {
			var e = form[i];
			if ( !{FIELDSET: 1}[e.tagName]) {
				var name = e.getAttribute('name');
				var field = new Field(e);
				field.enabled = false;
				var dest;
				switch (field.type) {
					case 'button':
					case 'submit': dest = this.buttons; break;
					default: dest = this;
				}
				if (dest[name])
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
				var t = type;
				setListener(form, t, function (event) {
					function _noDefault () {
						if (event.PreventDefault)
							event.PreventDefault();
						if (event.returnValue)
							event.returnValue = false;
						return false;
					}
					var target = event.target,
					    name = target.getAttribute('name'),
					    element = target['data-cover'];
					if (!element)
						return;
					var e_type = element.type;
					switch (t) {
						case 'click':
							switch (e_type) {
								case 'button': self.emit('button', name, self.values); break;
							}
							break;
						case 'change': self.emit('change', name, self.values, element.value); break;
						case 'submit': self.emit('scan', self.values); return _noDefault();
						case 'reset': self.emit('reset'); break;
						default: self.emit(t, name, self.values, element);
					}
				});
			})();
		}
	}

	Scanner.prototype.ask = function () {
		var cmds = Array.prototype.slice.call(arguments, 0, -1),
		    callback = Array.prototype.slice.call(arguments, -1)[0],
		    self = this;

		var request = new XMLHttpRequest();
		request.open("POST", this.job || '');
		request.setRequestHeader("Content-Type", "application/json");
		request.onreadystatechange = function () {
			if (request.readyState == 4){
				var status = request.status;
				if (status >= 200 && status < 300) {
					callback.call(self, request.getResponseHeader("Content-Type") === 'application/json' ? JSON.parse(request.responseText) : request.responseText);
				} else {
					alert(['ERROR ', status, '\n', request.statusText].join(''));
				}
			}
		};
		request.send(JSON.stringify(cmds));
	}

	Scanner.prototype.scan = function scan (values) {
		this.emit('scan', values || this.values);
	}

	window.Scanner = Scanner;
})()