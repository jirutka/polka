const { parse } = require('querystring');

const noop = x => x;

exports.parse = function (opts={}) {
	const { type, encoding='utf-8', parser=noop } = opts;
	const limit = opts.limit || 100 * 1024; // 100kb

	return function (req, res, next) {
		if (req._body) return next();
		req.body = req.body || {};

		const head = req.headers;
		const ctype = head['content-type'];
		const clength = parseInt(head['content-length'], 10);

		if (isNaN(clength) && head['transfer-encoding'] == null) return next(); // no body
		if (ctype && !ctype.includes(type)) return next(); // not valid type
		if (clength === 0) return next(); // is empty

		if (encoding) {
			req.setEncoding(encoding);
		}

		let bits = '';
		let length = 0;
		req.on('data', x => {
			length += Buffer.byteLength(x);
			if (length <= limit) {
				bits += x;
			} else {
				let err = new Error('Exceeded "Content-Length" limit');
				err.code = 413;
				req.destroy();
				next(err);
			}
		}).on('end', () => {
			try {
				req.body = parser(bits);
				req._body = true;
				next();
			} catch (err) {
				err.code = 422;
				err.details = err.message;
				err.message = 'Invalid content';
				next(err);
			}
		}).on('error', next);
	};
}

exports.json = function (opts={}) {
	const { limit, parser=JSON.parse } = opts;
	const type = opts.type || 'application/json';
	return exports.parse({ type, parser, limit });
}

exports.urlencoded = function (opts={}) {
	const { parser=parse, limit } = opts;
	const type = opts.type || 'application/x-www-form-urlencoded';
	return exports.parse({ type, parser, limit });
}

exports.raw = function (opts={}) {
	const { limit, encoding=null } = opts;
	const type = opts.type || 'application/octet-stream';
	return exports.parse({ limit, type, encoding });
}

exports.text = function (opts={}) {
	const { limit, type='text/plain' } = opts;
	return exports.parse({ limit, type });
}
