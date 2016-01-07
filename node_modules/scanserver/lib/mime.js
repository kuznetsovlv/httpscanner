(function () {
	"use strict";

	module.exports = {
		".txt": {"Content-Type": "text/plain", "Content-Encoding": "charset=utf-8"},
		".htm": {"Content-Type": "text/html", "Content-Encoding": "charset=utf-8"},
		".html": {"Content-Type": "text/html", "Content-Encoding": "charset=utf-8"},
		".js": {"Content-Type": "text/javascript", "Content-Encoding": "charset=utf-8"},
		".css": {"Content-Type": "text/css", "Content-Encoding": "charset=utf-8"},
		".bin": {"Content-Type": "application/binary"},
		".json": {"Content-Type": "application/json"},
		".jpeg": {"Content-Type": "image/jpeg"},
		".jpg": {"Content-Type": "image/jpeg"},
		".png": {"Content-Type": "image/png"},
		".ico": {"Content-Type": "image/x-icon"},
		".mp4": {"Content-Type": "video/mp4"},
		".mp3": {"Content-Type": "audio/mp3"},
		".gif": {"Content-Type": "image/gif"}
	};

	/*module.exports = function (response, mime) {
		if (mime.substr(0, 1) !== '.')
			mime = '.' + mime;
		var headers = mime_types[mime] || mime_types['.txt'];
		for (var key in headers)
			response.setHeader(key, headers[key]);
	}*/
})()