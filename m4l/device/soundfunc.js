(function() {

//#region src/engine/expr.ts
	var ExprError = class extends Error {
		pos;
		constructor(message, pos) {
			super(message);
			this.pos = pos;
		}
	};
	const fibCache = [0, 1];
	function fib(n) {
		n = Math.max(0, Math.floor(n));
		if (n > 1476) return Infinity;
		for (let i = fibCache.length; i <= n; i++) fibCache[i] = fibCache[i - 1] + fibCache[i - 2];
		return fibCache[n];
	}
	const primes = [2];
	function prime(n) {
		n = Math.max(0, Math.min(1e5, Math.floor(n)));
		let c = primes[primes.length - 1] + 1;
		while (primes.length <= n) {
			if (isPrime(c)) primes.push(c);
			c++;
		}
		return primes[n];
	}
	function isPrime(n) {
		n = Math.floor(n);
		if (n < 2) return 0;
		if (n % 2 === 0) return n === 2 ? 1 : 0;
		for (let i = 3; i * i <= n; i += 2) if (n % i === 0) return 0;
		return 1;
	}
	function collatz(n) {
		n = Math.max(1, Math.floor(n));
		let s = 0;
		while (n !== 1 && s < 1e3) {
			n = n % 2 === 0 ? n / 2 : 3 * n + 1;
			s++;
		}
		return s;
	}
	function logistic(r, n, x0 = .5) {
		let x = x0;
		const k = Math.min(1e4, Math.max(0, Math.floor(n)));
		for (let i = 0; i < k; i++) x = r * x * (1 - x);
		return x;
	}
	const recamanCache = [0];
	const recamanSeen = /* @__PURE__ */ new Set([0]);
	function recaman(n) {
		n = Math.max(0, Math.min(1e5, Math.floor(n)));
		for (let i = recamanCache.length; i <= n; i++) {
			const prev = recamanCache[i - 1];
			const next = prev - i > 0 && !recamanSeen.has(prev - i) ? prev - i : prev + i;
			recamanCache.push(next);
			recamanSeen.add(next);
		}
		return recamanCache[n];
	}
	const lorenzCache = [];
	let lorenzState = null;
	function lorenz(n) {
		n = Math.max(0, Math.min(2e4, Math.floor(n)));
		if (!lorenzState) {
			lorenzState = [
				.1,
				0,
				0
			];
			for (let i = 0; i < 400; i++) lorenzState = lorenzStep(...lorenzState);
		}
		while (lorenzCache.length <= n) {
			for (let i = 0; i < 8; i++) lorenzState = lorenzStep(...lorenzState);
			lorenzCache.push(lorenzState[0] / 20);
		}
		return lorenzCache[n];
	}
	function lorenzStep(x, y, z) {
		const dt = .005;
		return [
			x + dt * 10 * (y - x),
			y + dt * (x * (28 - z) - y),
			z + dt * (x * y - 8 / 3 * z)
		];
	}
	/** Euclidean rhythm: 1 if step n is a hit when spreading `pulses` over `steps`. */
	function euclid(n, pulses, steps, rotate = 0) {
		steps = Math.max(1, Math.floor(steps));
		pulses = Math.max(0, Math.min(steps, Math.floor(pulses)));
		const i = ((Math.floor(n) + Math.floor(rotate)) % steps + steps) % steps;
		return Math.floor(i * pulses / steps) !== Math.floor((i - 1) * pulses / steps) ? 1 : 0;
	}
	function hash(n, seed = 0) {
		let h = Math.imul(Math.floor(n) ^ 2654435769, 2246822507) ^ Math.imul(Math.floor(seed) + 1663821227, 3266489909);
		h ^= h >>> 16;
		h = Math.imul(h, 2146121005);
		h ^= h >>> 15;
		h = Math.imul(h, 2221713035);
		h ^= h >>> 16;
		return (h >>> 0) / 4294967296;
	}
	function noise(x, seed = 0) {
		const i = Math.floor(x);
		const f = x - i;
		const u = f * f * (3 - 2 * f);
		return hash(i, seed) * (1 - u) + hash(i + 1, seed) * u;
	}
	const PI_DIGITS = "31415926535897932384626433832795028841971693993751058209749445923078164062862089986280348253421170679";
	const fract = (x) => x - Math.floor(x);
	const mod = (a, b) => b === 0 ? 0 : (a % b + b) % b;
	const FUNCTIONS = {
		sin: {
			fn: Math.sin,
			doc: "sine"
		},
		cos: {
			fn: Math.cos,
			doc: "cosine"
		},
		tan: {
			fn: Math.tan,
			doc: "tangent"
		},
		asin: {
			fn: Math.asin,
			doc: "arc sine"
		},
		acos: {
			fn: Math.acos,
			doc: "arc cosine"
		},
		atan: {
			fn: Math.atan,
			doc: "arc tangent"
		},
		atan2: {
			fn: Math.atan2,
			doc: "atan2(y, x)"
		},
		sinh: {
			fn: Math.sinh,
			doc: "hyperbolic sine"
		},
		tanh: {
			fn: Math.tanh,
			doc: "hyperbolic tangent"
		},
		abs: {
			fn: Math.abs,
			doc: "absolute value"
		},
		sign: {
			fn: Math.sign,
			doc: "-1, 0 or 1"
		},
		floor: {
			fn: Math.floor,
			doc: "round down"
		},
		ceil: {
			fn: Math.ceil,
			doc: "round up"
		},
		round: {
			fn: Math.round,
			doc: "round to nearest"
		},
		fract: {
			fn: fract,
			doc: "fractional part"
		},
		bend: {
			fn: (t, b) => bendCurve(t, b),
			doc: "bend(t, b): t (0 → 1) bent like an automation curve — b > 0 starts slow, b < 0 starts fast, 0 is straight"
		},
		sqrt: {
			fn: Math.sqrt,
			doc: "square root"
		},
		exp: {
			fn: Math.exp,
			doc: "e^x"
		},
		log: {
			fn: Math.log,
			doc: "natural log"
		},
		log2: {
			fn: Math.log2,
			doc: "log base 2"
		},
		pow: {
			fn: Math.pow,
			doc: "pow(a, b)"
		},
		min: {
			fn: Math.min,
			doc: "minimum"
		},
		max: {
			fn: Math.max,
			doc: "maximum"
		},
		mod: {
			fn: mod,
			doc: "positive modulo"
		},
		clamp: {
			fn: (x, a = 0, b = 1) => Math.min(Math.max(x, a), b),
			doc: "clamp(x, lo, hi)"
		},
		lerp: {
			fn: (a, b, t) => a + (b - a) * t,
			doc: "lerp(a, b, t)"
		},
		step: {
			fn: (edge, x) => x < edge ? 0 : 1,
			doc: "step(edge, x)"
		},
		smoothstep: {
			fn: (a, b, x) => {
				const t = Math.min(Math.max((x - a) / (b - a), 0), 1);
				return t * t * (3 - 2 * t);
			},
			doc: "smoothstep(a, b, x)"
		},
		sine: {
			fn: (x) => Math.sin(2 * Math.PI * x),
			doc: "sine wave, period 1"
		},
		tri: {
			fn: (x) => 1 - 4 * Math.abs(fract(x - .25) - .5),
			doc: "triangle wave, period 1"
		},
		saw: {
			fn: (x) => 2 * fract(x) - 1,
			doc: "sawtooth wave, period 1"
		},
		sqr: {
			fn: (x) => fract(x) < .5 ? 1 : -1,
			doc: "square wave, period 1"
		},
		fib: {
			fn: fib,
			doc: "nth Fibonacci number"
		},
		prime: {
			fn: prime,
			doc: "nth prime (0 → 2)"
		},
		isprime: {
			fn: isPrime,
			doc: "1 if prime else 0"
		},
		collatz: {
			fn: collatz,
			doc: "Collatz stopping time"
		},
		logistic: {
			fn: logistic,
			doc: "logistic(r, n) map"
		},
		digits: {
			fn: (x, n) => {
				const s = Math.abs(x).toFixed(15).replace(".", "");
				return Number(s[Math.max(0, Math.floor(n))] ?? 0);
			},
			doc: "digits(x, n) nth digit"
		},
		recaman: {
			fn: recaman,
			doc: "Recamán sequence"
		},
		pidigit: {
			fn: (n) => Number(PI_DIGITS[mod(Math.floor(n), 101)]),
			doc: "nth digit of π (0 → 3)"
		},
		thue: {
			fn: (n) => {
				let c = 0;
				for (let v = Math.abs(Math.floor(n)); v; v >>>= 1) c += v & 1;
				return c % 2;
			},
			doc: "Thue–Morse sequence 0/1"
		},
		lorenz: {
			fn: lorenz,
			doc: "Lorenz attractor x, ≈ −1..1"
		},
		euclid: {
			fn: (n, k, s, r = 0) => euclid(n, k, s, r),
			doc: "euclid(n, pulses, steps, rot) → 0/1"
		},
		bits: {
			fn: (mask, n, len = 16) => {
				len = Math.max(1, Math.min(52, Math.floor(len)));
				const i = mod(Math.floor(n), len);
				return Math.floor(mask / Math.pow(2, len - 1 - i)) % 2;
			},
			doc: "bits(0b1001…, n, len) rhythm from binary"
		},
		bit: {
			fn: (x, i) => Math.floor(Math.abs(x) / Math.pow(2, Math.floor(i))) % 2,
			doc: "bit(x, i) ith bit"
		},
		band: {
			fn: (a, b) => (Math.floor(a) & Math.floor(b)) >>> 0,
			doc: "bitwise and"
		},
		bor: {
			fn: (a, b) => (Math.floor(a) | Math.floor(b)) >>> 0,
			doc: "bitwise or"
		},
		bxor: {
			fn: (a, b) => (Math.floor(a) ^ Math.floor(b)) >>> 0,
			doc: "bitwise xor"
		},
		pick: {
			fn: (i, ...vals) => vals.length ? vals[mod(Math.floor(i), vals.length)] : 0,
			doc: "pick(i, a, b, c…) choose by index"
		},
		every: {
			fn: (n, m, off = 0) => mod(Math.floor(n) - Math.floor(off), Math.max(1, Math.floor(m))) === 0 ? 1 : 0,
			doc: "every(n, m, offset) → 1 every m steps"
		},
		chance: {
			fn: (n, p, seed = 0) => hash(n, seed) < p ? 1 : 0,
			doc: "chance(n, p, seed) → 1 with probability p"
		},
		phase: {
			fn: (n, len) => len ? mod(n, len) / len : 0,
			doc: "phase(n, len) 0→1 ramp every len steps"
		},
		decay: {
			fn: (n, len, rate = 4) => Math.exp(-rate * (len ? mod(n, len) / len : 0)),
			doc: "decay(n, len, rate) falling envelope"
		},
		quant: {
			fn: (v, s) => s ? Math.round(v / s) * s : v,
			doc: "quant(v, step) snap to a grid"
		},
		wrap: {
			fn: (v, lo, hi) => hi === lo ? lo : lo + mod(v - lo, hi - lo),
			doc: "wrap(v, lo, hi) wrap into range"
		},
		fold: {
			fn: (v, lo, hi) => {
				const span = hi - lo;
				if (span <= 0) return lo;
				const u = mod(v - lo, 2 * span);
				return lo + (u > span ? 2 * span - u : u);
			},
			doc: "fold(v, lo, hi) bounce inside range"
		},
		rand: {
			fn: hash,
			doc: "rand(n, seed) deterministic 0..1"
		},
		noise: {
			fn: noise,
			doc: "noise(x, seed) smooth 0..1"
		},
		gcd: {
			fn: (a, b) => {
				a = Math.abs(Math.floor(a));
				b = Math.abs(Math.floor(b));
				while (b) [a, b] = [b, a % b];
				return a;
			},
			doc: "greatest common divisor"
		}
	};
	const CONSTANTS = {
		pi: Math.PI,
		tau: Math.PI * 2,
		e: Math.E,
		phi: (1 + Math.sqrt(5)) / 2
	};
	const OPS = [
		"<=",
		">=",
		"==",
		"!=",
		"&&",
		"||",
		"+",
		"-",
		"*",
		"/",
		"%",
		"^",
		"(",
		")",
		",",
		"<",
		">",
		"!",
		"?",
		":"
	];
	function tokenize(src) {
		const out = [];
		let i = 0;
		while (i < src.length) {
			const c = src[i];
			if (/\s/.test(c)) {
				i++;
				continue;
			}
			if (c === "0" && /[xXbB]/.test(src[i + 1] ?? "")) {
				const m = /^0([xX][0-9a-fA-F]+|[bB][01]+)/.exec(src.slice(i));
				if (!m) throw new ExprError(`Bad number`, i);
				out.push({
					t: "num",
					v: parseInt(m[1].slice(1), /[xX]/.test(m[1][0]) ? 16 : 2),
					p: i,
					n: m[0].length
				});
				i += m[0].length;
				continue;
			}
			if (/[0-9.]/.test(c)) {
				const m = /^(\d+\.?\d*|\.\d+)(e[+-]?\d+)?/i.exec(src.slice(i));
				if (!m) throw new ExprError(`Bad number`, i);
				out.push({
					t: "num",
					v: parseFloat(m[0]),
					p: i,
					n: m[0].length
				});
				i += m[0].length;
				continue;
			}
			if (/[a-zA-Z_]/.test(c)) {
				const m = /^[a-zA-Z_][a-zA-Z0-9_]*/.exec(src.slice(i));
				out.push({
					t: "id",
					v: m[0],
					p: i,
					n: m[0].length
				});
				i += m[0].length;
				continue;
			}
			const op = OPS.find((o) => src.startsWith(o, i));
			if (!op) throw new ExprError(`Unexpected '${c}'`, i);
			out.push({
				t: "op",
				v: op,
				p: i,
				n: op.length
			});
			i += op.length;
		}
		out.push({
			t: "eof",
			p: src.length,
			n: 0
		});
		return out;
	}
	/** Replace a variable name everywhere it is used (not function calls of the same name). */
	function renameVariable(src, from, to) {
		let toks;
		try {
			toks = tokenize(src);
		} catch {
			return src;
		}
		let out = src;
		for (let i = toks.length - 1; i >= 0; i--) {
			const t = toks[i];
			const next = toks[i + 1];
			if (t.t === "id" && t.v === from && !(next?.t === "op" && next.v === "(")) out = out.slice(0, t.p) + to + out.slice(t.p + t.n);
		}
		return out;
	}
	function parse(src, allowedVars) {
		const toks = tokenize(src);
		let k = 0;
		const vars = /* @__PURE__ */ new Set();
		const peek = () => toks[k];
		const isOp = (v) => {
			const t = toks[k];
			return t.t === "op" && t.v === v;
		};
		const expect = (v) => {
			if (!isOp(v)) throw new ExprError(`Expected '${v}'`, toks[k].p);
			k++;
		};
		const bin = (op, a, b) => ({
			k: "bin",
			op,
			a,
			b
		});
		function expr() {
			const c = or();
			if (isOp("?")) {
				k++;
				const a = expr();
				expect(":");
				return {
					k: "cond",
					c,
					a,
					b: expr()
				};
			}
			return c;
		}
		function or() {
			let l = and();
			while (isOp("||")) {
				k++;
				l = bin("||", l, and());
			}
			return l;
		}
		function and() {
			let l = cmp();
			while (isOp("&&")) {
				k++;
				l = bin("&&", l, cmp());
			}
			return l;
		}
		function cmp() {
			let l = add();
			for (;;) {
				const t = peek();
				if (t.t !== "op" || ![
					"<",
					">",
					"<=",
					">=",
					"==",
					"!="
				].includes(t.v)) return l;
				k++;
				l = bin(t.v, l, add());
			}
		}
		function add() {
			let l = mul();
			while (isOp("+") || isOp("-")) {
				const op = toks[k++].v;
				l = bin(op, l, mul());
			}
			return l;
		}
		function mul() {
			let l = unary();
			for (;;) {
				if (isOp("*") || isOp("/") || isOp("%")) {
					const op = toks[k++].v;
					l = bin(op, l, unary());
					continue;
				}
				const t = peek();
				const prev = toks[k - 1];
				if (prev && (prev.t === "num" || prev.t === "op" && prev.v === ")") && (t.t === "id" || t.t === "op" && t.v === "(")) {
					l = bin("*", l, unary());
					continue;
				}
				return l;
			}
		}
		function unary() {
			if (isOp("-")) {
				k++;
				return {
					k: "neg",
					a: unary()
				};
			}
			if (isOp("+")) {
				k++;
				return unary();
			}
			if (isOp("!")) {
				k++;
				return {
					k: "not",
					a: unary()
				};
			}
			return power();
		}
		function power() {
			const base = atom();
			if (isOp("^")) {
				k++;
				return bin("^", base, unary());
			}
			return base;
		}
		function atom() {
			const t = peek();
			if (t.t === "num") {
				k++;
				const raw = src.slice(t.p, t.p + t.n);
				return /^0[xXbB]/.test(raw) ? {
					k: "num",
					v: t.v,
					raw
				} : {
					k: "num",
					v: t.v
				};
			}
			if (t.t === "op" && t.v === "(") {
				k++;
				const e = expr();
				expect(")");
				return e;
			}
			if (t.t === "id") {
				k++;
				const name = t.v;
				if (isOp("(")) {
					k++;
					if (!FUNCTIONS[name]) throw new ExprError(`Unknown function '${name}'`, t.p);
					const args = [];
					if (!isOp(")")) {
						args.push(expr());
						while (isOp(",")) {
							k++;
							args.push(expr());
						}
					}
					expect(")");
					return {
						k: "call",
						fn: name,
						args
					};
				}
				if (name in CONSTANTS) return {
					k: "const",
					name
				};
				if (allowedVars && !allowedVars.includes(name)) throw new ExprError(`Unknown variable '${name}'`, t.p);
				vars.add(name);
				return {
					k: "var",
					name
				};
			}
			if (t.t === "eof") throw new ExprError("Unexpected end of formula", t.p);
			throw new ExprError(`Unexpected '${t.v}'`, t.p);
		}
		if (toks.length === 1) throw new ExprError("Empty formula", 0);
		const ast = expr();
		if (peek().t !== "eof") throw new ExprError(`Unexpected '${peek().v}'`, peek().p);
		return {
			ast,
			variables: [...vars]
		};
	}
	function compileAst(ast) {
		switch (ast.k) {
			case "num": {
				const v = ast.v;
				return () => v;
			}
			case "const": {
				const v = CONSTANTS[ast.name];
				return () => v;
			}
			case "var": {
				const name = ast.name;
				return (s) => s[name] ?? 0;
			}
			case "neg": {
				const a = compileAst(ast.a);
				return (s) => -a(s);
			}
			case "not": {
				const a = compileAst(ast.a);
				return (s) => +!a(s);
			}
			case "cond": {
				const c = compileAst(ast.c), a = compileAst(ast.a), b = compileAst(ast.b);
				return (s) => c(s) ? a(s) : b(s);
			}
			case "bin": {
				const a = compileAst(ast.a), b = compileAst(ast.b);
				switch (ast.op) {
					case "+": return (s) => a(s) + b(s);
					case "-": return (s) => a(s) - b(s);
					case "*": return (s) => a(s) * b(s);
					case "/": return (s) => a(s) / b(s);
					case "%": return (s) => mod(a(s), b(s));
					case "^": return (s) => Math.pow(a(s), b(s));
					case "<": return (s) => +(a(s) < b(s));
					case ">": return (s) => +(a(s) > b(s));
					case "<=": return (s) => +(a(s) <= b(s));
					case ">=": return (s) => +(a(s) >= b(s));
					case "==": return (s) => +(a(s) === b(s));
					case "!=": return (s) => +(a(s) !== b(s));
					case "&&": return (s) => a(s) && b(s) ? 1 : 0;
					case "||": return (s) => a(s) || b(s) ? 1 : 0;
				}
				break;
			}
			case "call": {
				const fn = FUNCTIONS[ast.fn].fn;
				const args = ast.args.map(compileAst);
				switch (args.length) {
					case 0: return () => fn();
					case 1: {
						const [a] = args;
						return (s) => fn(a(s));
					}
					case 2: {
						const [a, b] = args;
						return (s) => fn(a(s), b(s));
					}
					case 3: {
						const [a, b, c] = args;
						return (s) => fn(a(s), b(s), c(s));
					}
					default: return (s) => fn(...args.map((a) => a(s)));
				}
			}
		}
		throw new Error("unreachable");
	}
	function compile(src, allowedVars) {
		const { ast, variables } = parse(src, allowedVars);
		return {
			fn: compileAst(ast),
			variables
		};
	}
	function tryCompile(src, allowedVars) {
		try {
			return {
				fn: compile(src, allowedVars).fn,
				error: null
			};
		} catch (e) {
			return {
				fn: null,
				error: e instanceof Error ? e.message : String(e)
			};
		}
	}
	/**
	* An automation-style bend of t ∈ [0, 1]: (e^(c·t) − 1) / (e^c − 1) with c = 6·b.
	* b = 0 is a straight line; b > 0 eases in (slow start), b < 0 eases out (fast start).
	*/
	function bendCurve(t, b) {
		const c = 6 * b;
		return Math.abs(c) < 1e-6 ? t : (Math.exp(c * t) - 1) / (Math.exp(c) - 1);
	}

//#endregion
//#region src/engine/graph.ts
	const num = (v, d = 0) => typeof v === "number" && isFinite(v) ? v : Number(v) || d;
	const WAVES = {
		sine: FUNCTIONS.sine.fn,
		triangle: FUNCTIONS.tri.fn,
		saw: FUNCTIONS.saw.fn,
		square: FUNCTIONS.sqr.fn
	};
	const MATH_OPS = {
		add: {
			label: "a + b",
			fn: (a, b) => a + b
		},
		sub: {
			label: "a − b",
			fn: (a, b) => a - b
		},
		mul: {
			label: "a × b",
			fn: (a, b) => a * b
		},
		div: {
			label: "a ÷ b",
			fn: (a, b) => b === 0 ? 0 : a / b
		},
		mod: {
			label: "a mod b",
			fn: FUNCTIONS.mod.fn
		},
		pow: {
			label: "a ^ b",
			fn: Math.pow
		},
		min: {
			label: "min",
			fn: Math.min
		},
		max: {
			label: "max",
			fn: Math.max
		},
		mix: {
			label: "average",
			fn: (a, b) => (a + b) / 2
		}
	};
	/** the operator symbols match the formula language, so explode/collapse can map them 1:1 */
	const COMPARE_OPS = {
		"<": {
			label: "a < b",
			fn: (a, b) => +(a < b)
		},
		"<=": {
			label: "a ≤ b",
			fn: (a, b) => +(a <= b)
		},
		">": {
			label: "a > b",
			fn: (a, b) => +(a > b)
		},
		">=": {
			label: "a ≥ b",
			fn: (a, b) => +(a >= b)
		},
		"==": {
			label: "a = b",
			fn: (a, b) => +(a === b)
		},
		"!=": {
			label: "a ≠ b",
			fn: (a, b) => +(a !== b)
		},
		"&&": {
			label: "a and b",
			fn: (a, b) => a && b ? 1 : 0
		},
		"||": {
			label: "a or b",
			fn: (a, b) => a || b ? 1 : 0
		}
	};
	const UNARY = [
		"sin",
		"cos",
		"tan",
		"abs",
		"floor",
		"round",
		"ceil",
		"fract",
		"sqrt",
		"exp",
		"log",
		"sign",
		"tanh"
	];
	const SERIES = {
		fib: {
			label: "Fibonacci",
			fn: (n) => FUNCTIONS.fib.fn(n)
		},
		prime: {
			label: "Primes",
			fn: (n) => FUNCTIONS.prime.fn(n)
		},
		collatz: {
			label: "Collatz steps",
			fn: (n) => FUNCTIONS.collatz.fn(n + 1)
		},
		logistic: {
			label: "Logistic map (p = r)",
			fn: (n, p) => FUNCTIONS.logistic.fn(p || 3.7, n)
		},
		pi: {
			label: "Digits of π",
			fn: (n) => FUNCTIONS.pidigit.fn(n)
		},
		phi: {
			label: "Golden angle",
			fn: (n) => FUNCTIONS.fract.fn(n * CONSTANTS.phi)
		},
		random: {
			label: "Random (p = seed)",
			fn: (n, p) => FUNCTIONS.rand.fn(n, p)
		},
		thue: {
			label: "Thue–Morse",
			fn: (n) => FUNCTIONS.thue.fn(n)
		},
		triangular: {
			label: "Triangular",
			fn: (n) => n * (n + 1) / 2
		},
		recaman: {
			label: "Recamán",
			fn: (n) => FUNCTIONS.recaman.fn(n)
		},
		lorenz: {
			label: "Lorenz attractor",
			fn: (n) => FUNCTIONS.lorenz.fn(n)
		},
		sierpinski: {
			label: "Sierpiński (p = row)",
			fn: (n, p) => (Math.floor(n) & Math.floor(p || 7)) === 0 ? 1 : 0
		}
	};
	/**
	* Drum-machine notation, one character per step (spaces and | are ignored):
	*   X accent · x hit · o ghost · 1–9 velocity in ninths · . - _ rest
	*/
	function parsePattern(src) {
		const out = [];
		for (const ch of src) {
			if (ch === " " || ch === "|") continue;
			if (ch === "X") out.push(1);
			else if (ch === "x") out.push(.75);
			else if (ch === "o" || ch === "O") out.push(.35);
			else if (ch >= "1" && ch <= "9") out.push(Number(ch) / 9);
			else out.push(0);
		}
		return out;
	}
	/** section lengths in beats */
	function sectionLengths(d) {
		const mult = d.unit === "bars" ? 4 : 1;
		return parseList(String(d.lengths ?? "")).filter((v) => v > 0).map((v) => v * mult);
	}
	/** "0 3 5 7" or "0, 3, -2.5" → numbers */
	function parseList(src) {
		return src.split(/[\s,]+/).filter(Boolean).map(Number).filter((v) => Number.isFinite(v));
	}
	const ctxVars = [
		"n",
		"x",
		"t",
		"k",
		"steps",
		"h",
		"bar",
		"L",
		"beat",
		"np"
	];
	const NODE_DEFS = {
		step: {
			type: "step",
			label: "Time",
			category: "source",
			hint: "The clock: step n, progress x (0→1), beats t, loop k, plus the current chord h and bar",
			defaults: {},
			inputs: [],
			outputs: [
				{
					id: "n",
					label: "n step"
				},
				{
					id: "x",
					label: "x 0→1"
				},
				{
					id: "t",
					label: "t beats"
				},
				{
					id: "k",
					label: "k loop"
				},
				{
					id: "h",
					label: "h chord"
				},
				{
					id: "bar",
					label: "bar"
				},
				{
					id: "np",
					label: "np note"
				}
			],
			params: [],
			build: () => (_i, c) => [
				c.n,
				c.x,
				c.t,
				c.k,
				c.h,
				c.bar,
				c.np ?? 0
			]
		},
		number: {
			type: "number",
			label: "Number",
			category: "source",
			hint: "A constant you can tweak",
			defaults: {
				value: 1,
				min: -12,
				max: 12
			},
			inputs: [],
			outputs: [{
				id: "out",
				label: "value"
			}],
			params: [{
				key: "value",
				label: "value",
				kind: "number",
				step: .01
			}],
			build: (d) => {
				const v = num(d.value);
				return () => [v];
			}
		},
		expr: {
			type: "expr",
			label: "Formula",
			category: "math",
			hint: "Write any expression. Use a, b, c inputs and n, x, t, k, h (chord), bar, L",
			defaults: { formula: "sin(x * tau) * 4" },
			inputs: [
				{
					id: "a",
					label: "a",
					fallback: 0
				},
				{
					id: "b",
					label: "b",
					fallback: 0
				},
				{
					id: "c",
					label: "c",
					fallback: 0
				}
			],
			outputs: [{
				id: "out",
				label: "out"
			}],
			params: [{
				key: "formula",
				label: "f =",
				kind: "formula"
			}],
			build: (d, sliders) => {
				const fn = compile(String(d.formula ?? "0"), [
					"a",
					"b",
					"c",
					...ctxVars,
					...sliders
				]).fn;
				const scope = {};
				return (ins, c) => {
					for (const s of sliders) scope[s] = c.vars[s] ?? 0;
					scope.beat = c.beat;
					scope.np = c.np ?? 0;
					scope.a = ins[0];
					scope.b = ins[1];
					scope.c = ins[2];
					scope.n = c.n;
					scope.x = c.x;
					scope.t = c.t;
					scope.k = c.k;
					scope.steps = c.steps;
					scope.h = c.h;
					scope.bar = c.bar;
					scope.L = c.L;
					return [fn(scope)];
				};
			}
		},
		math: {
			type: "math",
			label: "Math",
			category: "math",
			hint: "Combine two values",
			defaults: {
				op: "add",
				b: 1
			},
			inputs: [{
				id: "a",
				label: "a",
				fallback: 0
			}, {
				id: "b",
				label: "b",
				fallback: (_c, d) => num(d.b, 1)
			}],
			outputs: [{
				id: "out",
				label: "out"
			}],
			params: [{
				key: "op",
				label: "op",
				kind: "select",
				options: Object.entries(MATH_OPS).map(([value, o]) => ({
					value,
					label: o.label
				}))
			}, {
				key: "b",
				label: "b (if unlinked)",
				kind: "number",
				step: .1
			}],
			build: (d) => {
				const f = (MATH_OPS[String(d.op)] ?? MATH_OPS.add).fn;
				return (ins) => [f(ins[0], ins[1])];
			}
		},
		func: {
			type: "func",
			label: "Function",
			category: "math",
			hint: "Apply a one-argument function",
			defaults: { fn: "abs" },
			inputs: [{
				id: "x",
				label: "x",
				fallback: (c) => c.x
			}],
			outputs: [{
				id: "out",
				label: "out"
			}],
			params: [{
				key: "fn",
				label: "fn",
				kind: "select",
				options: UNARY.map((u) => ({
					value: u,
					label: u
				}))
			}],
			build: (d) => {
				const f = (FUNCTIONS[String(d.fn)] ?? FUNCTIONS.abs).fn;
				return (ins) => [f(ins[0])];
			}
		},
		map: {
			type: "map",
			label: "Range",
			category: "math",
			hint: "Remap a value from one range to another",
			defaults: {
				inMin: -1,
				inMax: 1,
				outMin: 0,
				outMax: 7,
				clamp: true
			},
			inputs: [{
				id: "v",
				label: "value",
				fallback: 0
			}],
			outputs: [{
				id: "out",
				label: "out"
			}],
			params: [
				{
					key: "inMin",
					label: "in min",
					kind: "number",
					step: .1
				},
				{
					key: "inMax",
					label: "in max",
					kind: "number",
					step: .1
				},
				{
					key: "outMin",
					label: "out min",
					kind: "number",
					step: .1
				},
				{
					key: "outMax",
					label: "out max",
					kind: "number",
					step: .1
				}
			],
			build: (d) => {
				const a = num(d.inMin), b = num(d.inMax, 1), c = num(d.outMin), e = num(d.outMax, 1);
				const clamp = d.clamp !== false;
				return (ins) => {
					let u = b === a ? 0 : (ins[0] - a) / (b - a);
					if (clamp) u = Math.min(1, Math.max(0, u));
					return [c + (e - c) * u];
				};
			}
		},
		wave: {
			type: "wave",
			label: "Wave",
			category: "wave",
			hint: "A periodic wave: cycles per pattern, amplitude, offset",
			defaults: {
				shape: "sine",
				cycles: 1,
				amp: 4,
				offset: 0
			},
			inputs: [{
				id: "p",
				label: "phase",
				fallback: (c) => c.x
			}],
			outputs: [{
				id: "out",
				label: "out"
			}],
			params: [
				{
					key: "shape",
					label: "shape",
					kind: "select",
					options: Object.keys(WAVES).map((w) => ({
						value: w,
						label: w
					}))
				},
				{
					key: "cycles",
					label: "cycles",
					kind: "number",
					step: .25
				},
				{
					key: "amp",
					label: "amp",
					kind: "number",
					step: .5
				},
				{
					key: "offset",
					label: "offset",
					kind: "number",
					step: .5
				}
			],
			build: (d) => {
				const w = WAVES[String(d.shape)] ?? WAVES.sine;
				const cy = num(d.cycles, 1), amp = num(d.amp, 1), off = num(d.offset);
				return (ins) => [off + amp * w(ins[0] * cy)];
			}
		},
		series: {
			type: "series",
			label: "Sequence",
			category: "series",
			hint: "Famous number sequences, chaos and randomness",
			defaults: {
				kind: "fib",
				p: 0,
				modulo: 7
			},
			inputs: [{
				id: "n",
				label: "n",
				fallback: (c) => c.n
			}],
			outputs: [{
				id: "out",
				label: "out"
			}],
			params: [
				{
					key: "kind",
					label: "sequence",
					kind: "select",
					options: Object.entries(SERIES).map(([value, s]) => ({
						value,
						label: s.label
					}))
				},
				{
					key: "p",
					label: "p",
					kind: "number",
					step: .01
				},
				{
					key: "modulo",
					label: "mod (0 = off)",
					kind: "number",
					step: 1
				}
			],
			build: (d) => {
				const s = (SERIES[String(d.kind)] ?? SERIES.fib).fn;
				const p = num(d.p), m = num(d.modulo);
				return (ins) => {
					const v = s(ins[0], p);
					return [m > 0 ? FUNCTIONS.mod.fn(v, m) : v];
				};
			}
		},
		euclid: {
			type: "euclid",
			label: "Euclid Rhythm",
			category: "rhythm",
			hint: "Spread pulses evenly over steps — outputs 1 on hits, 0 on rests",
			defaults: {
				pulses: 5,
				length: 8,
				rotate: 0
			},
			inputs: [{
				id: "n",
				label: "n",
				fallback: (c) => c.n
			}],
			outputs: [{
				id: "out",
				label: "gate"
			}],
			params: [
				{
					key: "pulses",
					label: "pulses",
					kind: "number",
					step: 1,
					min: 0
				},
				{
					key: "length",
					label: "length",
					kind: "number",
					step: 1,
					min: 1
				},
				{
					key: "rotate",
					label: "rotate",
					kind: "number",
					step: 1
				}
			],
			build: (d) => {
				const p = num(d.pulses, 3), l = num(d.length, 8), r = num(d.rotate);
				return (ins) => [euclid(ins[0], p, l, r)];
			}
		},
		pattern: {
			type: "pattern",
			label: "Pattern",
			category: "rhythm",
			hint: "Type a beat: X accent, x hit, o ghost, . rest — outputs velocity",
			defaults: {
				pattern: "X...x...X..x..o.",
				rotate: 0
			},
			inputs: [{
				id: "n",
				label: "n",
				fallback: (c) => c.n
			}],
			outputs: [{
				id: "out",
				label: "velocity"
			}],
			params: [{
				key: "pattern",
				label: "beat",
				kind: "text",
				placeholder: "X..o x..."
			}, {
				key: "rotate",
				label: "rotate",
				kind: "number",
				step: 1
			}],
			build: (d) => {
				const pat = parsePattern(String(d.pattern ?? ""));
				const r = num(d.rotate);
				return (ins) => [pat.length ? pat[FUNCTIONS.mod.fn(Math.floor(ins[0]) + r, pat.length)] : 0];
			}
		},
		curve: {
			type: "curve",
			label: "Curve",
			category: "wave",
			hint: "Breakpoints joined by bendable segments — automation, envelopes, swells, ducks",
			defaults: {
				points: "0:0:0 1:1:0",
				repeats: 1,
				lo: 0,
				hi: 1
			},
			inputs: [{
				id: "p",
				label: "phase",
				fallback: (c) => c.x
			}],
			outputs: [{
				id: "out",
				label: "out"
			}],
			params: [
				{
					key: "points",
					label: "curve",
					kind: "curve"
				},
				{
					key: "repeats",
					label: "repeats",
					kind: "number",
					step: 1,
					min: 1
				},
				{
					key: "lo",
					label: "bottom",
					kind: "number",
					step: .5
				},
				{
					key: "hi",
					label: "top",
					kind: "number",
					step: .5
				}
			],
			build: (d) => {
				const pts = parseCurve(String(d.points ?? ""));
				const rep = curveRepeats(d), lo = num(d.lo), hi = num(d.hi, 1);
				return (ins) => {
					const u = ins[0] * rep;
					return [lo + (hi - lo) * evalCurve(pts, u - Math.floor(u))];
				};
			}
		},
		list: {
			type: "list",
			label: "Steps",
			category: "series",
			hint: "A list of values played in order — basslines, chords, riffs",
			defaults: {
				values: "0 0 3 5",
				every: 4
			},
			inputs: [{
				id: "n",
				label: "n",
				fallback: (c) => c.n
			}],
			outputs: [{
				id: "out",
				label: "value"
			}],
			params: [{
				key: "values",
				label: "values",
				kind: "text",
				placeholder: "0 3 5 7"
			}, {
				key: "every",
				label: "hold steps",
				kind: "number",
				step: 1,
				min: 1
			}],
			build: (d) => {
				const vals = parseList(String(d.values ?? ""));
				const every = Math.max(1, num(d.every, 1));
				return (ins) => [vals.length ? vals[FUNCTIONS.mod.fn(Math.floor(ins[0] / every), vals.length)] : 0];
			}
		},
		chance: {
			type: "chance",
			label: "Chance",
			category: "rhythm",
			hint: "Deterministic coin flip: 1 with probability p",
			defaults: {
				p: .7,
				seed: 1
			},
			inputs: [{
				id: "n",
				label: "n",
				fallback: (c) => c.n + c.k * c.steps
			}],
			outputs: [{
				id: "out",
				label: "gate"
			}],
			params: [{
				key: "p",
				label: "probability",
				kind: "number",
				step: .05,
				min: 0,
				max: 1
			}, {
				key: "seed",
				label: "seed",
				kind: "number",
				step: 1
			}],
			build: (d) => {
				const p = num(d.p, .5), seed = num(d.seed);
				return (ins) => [FUNCTIONS.rand.fn(ins[0], seed) < p ? 1 : 0];
			}
		},
		compare: {
			type: "compare",
			label: "Compare",
			category: "math",
			hint: "1 when the comparison holds, otherwise 0 — <, ≤, >, ≥, =, ≠, and, or",
			defaults: {
				op: "<",
				b: 0
			},
			inputs: [{
				id: "a",
				label: "a",
				fallback: 0
			}, {
				id: "b",
				label: "b",
				fallback: (_c, d) => num(d.b, 0)
			}],
			outputs: [{
				id: "out",
				label: "1 / 0"
			}],
			params: [{
				key: "op",
				label: "is",
				kind: "select",
				options: Object.entries(COMPARE_OPS).map(([value, o]) => ({
					value,
					label: o.label
				}))
			}, {
				key: "b",
				label: "b (if unlinked)",
				kind: "number",
				step: .1
			}],
			build: (d) => {
				const f = (COMPARE_OPS[String(d.op)] ?? COMPARE_OPS["<"]).fn;
				return (ins) => [f(ins[0], ins[1])];
			}
		},
		switch: {
			type: "switch",
			label: "If / else",
			category: "form",
			hint: "cond ? then : else — any non-zero condition picks “then”",
			defaults: {
				then: 1,
				else: 0
			},
			inputs: [
				{
					id: "cond",
					label: "if",
					fallback: 0
				},
				{
					id: "then",
					label: "then",
					fallback: (_c, d) => num(d.then, 1)
				},
				{
					id: "else",
					label: "else",
					fallback: (_c, d) => num(d.else, 0)
				}
			],
			outputs: [{
				id: "out",
				label: "out"
			}],
			params: [{
				key: "then",
				label: "then (if unlinked)",
				kind: "number",
				step: .1
			}, {
				key: "else",
				label: "else (if unlinked)",
				kind: "number",
				step: .1
			}],
			build: () => (ins) => [ins[0] ? ins[1] : ins[2]]
		},
		sections: {
			type: "sections",
			label: "Sections",
			category: "form",
			hint: "A piecewise function over time: play A, then B, then C… for the lengths you give. Loops over the song.",
			defaults: {
				lengths: "4 4 4 4",
				unit: "beats"
			},
			inputs: [
				{
					id: "A",
					label: "A",
					fallback: 0
				},
				{
					id: "B",
					label: "B",
					fallback: 0
				},
				{
					id: "C",
					label: "C",
					fallback: 0
				},
				{
					id: "D",
					label: "D",
					fallback: 0
				}
			],
			outputs: [
				{
					id: "out",
					label: "value"
				},
				{
					id: "section",
					label: "section 0…"
				},
				{
					id: "local",
					label: "local 0→1"
				}
			],
			params: [{
				key: "lengths",
				label: "lengths",
				kind: "text",
				placeholder: "4 4 8"
			}, {
				key: "unit",
				label: "in",
				kind: "select",
				options: [{
					value: "beats",
					label: "beats"
				}, {
					value: "bars",
					label: "bars"
				}]
			}],
			build: (d) => {
				const lens = sectionLengths(d);
				const total = lens.reduce((a, b) => a + b, 0);
				return (ins, c) => {
					if (!total) return [
						ins[0],
						0,
						0
					];
					let pos = FUNCTIONS.mod.fn(c.beat, total);
					for (let i = 0; i < lens.length; i++) {
						if (pos < lens[i] || i === lens.length - 1) return [
							ins[i % 4],
							i,
							Math.min(1, pos / lens[i])
						];
						pos -= lens[i];
					}
					return [
						ins[0],
						0,
						0
					];
				};
			}
		},
		output: {
			type: "output",
			label: "Note Out",
			category: "output",
			hint: "What you hear. Each step it turns these inputs into a note — or a rest, or a chord. Hover an input to see what it does.",
			defaults: {},
			inputs: [
				{
					id: "pitch",
					label: "pitch",
					fallback: 0
				},
				{
					id: "velocity",
					label: "velocity",
					fallback: .8
				},
				{
					id: "length",
					label: "length",
					fallback: 1
				},
				{
					id: "shift",
					label: "shift",
					fallback: 0
				},
				{
					id: "ratchet",
					label: "ratchet",
					fallback: 1
				},
				{
					id: "chord",
					label: "chord",
					fallback: 1
				},
				{
					id: "stack",
					label: "stack",
					fallback: 2
				},
				{
					id: "inversion",
					label: "inversion",
					fallback: 0
				},
				{
					id: "strum",
					label: "strum",
					fallback: 0
				},
				{
					id: "bend",
					label: "bend",
					fallback: 0
				},
				{
					id: "pressure",
					label: "pressure",
					fallback: 1
				},
				{
					id: "slide",
					label: "slide",
					fallback: .5
				}
			],
			outputs: [],
			params: [],
			build: () => (ins) => ins
		}
	};
	function compileGraph(graph, sliders = []) {
		const errors = /* @__PURE__ */ new Map();
		const byId = new Map(graph.nodes.map((n) => [n.id, n]));
		const incoming = /* @__PURE__ */ new Map();
		for (const e of graph.edges) {
			if (!byId.has(e.source) || !byId.has(e.target)) continue;
			const list = incoming.get(e.target) ?? [];
			list.push(e);
			incoming.set(e.target, list);
		}
		const order = [];
		const state = /* @__PURE__ */ new Map();
		const visit = (n) => {
			const s = state.get(n.id);
			if (s === 2) return;
			if (s === 1) {
				errors.set(n.id, "Cycle detected");
				return;
			}
			state.set(n.id, 1);
			for (const e of incoming.get(n.id) ?? []) visit(byId.get(e.source));
			state.set(n.id, 2);
			order.push(n);
		};
		graph.nodes.forEach(visit);
		const steps = [];
		for (const node of order) {
			const def = NODE_DEFS[node.type];
			if (!def) continue;
			let ev;
			try {
				ev = def.build(node.data, sliders);
			} catch (e) {
				errors.set(node.id, e instanceof Error ? e.message : String(e));
				ev = () => def.outputs.map(() => 0);
			}
			const sources = def.inputs.map((inp) => {
				const e = (incoming.get(node.id) ?? []).find((x) => x.targetHandle === inp.id);
				if (!e) return null;
				const src = byId.get(e.source);
				const sdef = NODE_DEFS[src.type];
				const idx = sdef ? Math.max(0, sdef.outputs.findIndex((o) => o.id === e.sourceHandle)) : 0;
				return {
					node: e.source,
					idx
				};
			});
			steps.push({
				node,
				def,
				eval: ev,
				sources
			});
		}
		const outputNode = steps.find((s) => s.def.type === "output");
		const values = /* @__PURE__ */ new Map();
		const wiredIn = (port) => !!outputNode && (incoming.get(outputNode.node.id) ?? []).some((e) => e.targetHandle === port);
		return {
			errors,
			expression: {
				bend: wiredIn("bend"),
				pressure: wiredIn("pressure"),
				slide: wiredIn("slide")
			},
			run(ctx, trace) {
				values.clear();
				for (const s of steps) {
					const ins = s.def.inputs.map((inp, i) => {
						const src = s.sources[i];
						if (src) return values.get(src.node)?.[src.idx] ?? 0;
						const fb = inp.fallback;
						return typeof fb === "function" ? fb(ctx, s.node.data) : fb ?? 0;
					});
					let out;
					try {
						out = s.eval(ins, ctx).map((v) => Number.isFinite(v) ? v : 0);
					} catch {
						out = s.def.outputs.map(() => 0);
					}
					values.set(s.node.id, out);
					if (trace) {
						const v = s.def.type === "output" ? ins[0] : out[0];
						let arr = trace.get(s.node.id);
						if (!arr) trace.set(s.node.id, arr = []);
						arr.push(v);
					}
				}
				if (!outputNode) return null;
				const o = values.get(outputNode.node.id);
				return {
					pitch: o[0],
					velocity: o[1],
					length: o[2],
					shift: o[3],
					ratchet: o[4],
					chord: o[5],
					stack: o[6],
					inversion: o[7],
					strum: o[8],
					bend: o[9],
					pressure: o[10],
					slide: o[11]
				};
			}
		};
	}
	const clamp01 = (v) => Math.min(1, Math.max(0, v));
	/** "0:0:0 0.5:1:0.4 1:0:0" → points, sorted by x */
	function parseCurve(src) {
		const pts = src.trim().split(/[\s,;]+/).filter(Boolean).map((tok) => {
			const [x, y, b] = tok.split(":").map(Number);
			return {
				x: clamp01(Number.isFinite(x) ? x : 0),
				y: clamp01(Number.isFinite(y) ? y : 0),
				b: Math.max(-1, Math.min(1, Number.isFinite(b) ? b : 0))
			};
		}).sort((a, c) => a.x - c.x);
		return pts.length ? pts : [{
			x: 0,
			y: 0,
			b: 0
		}, {
			x: 1,
			y: 1,
			b: 0
		}];
	}
	const curveRepeats = (d) => Math.max(1, Math.round(num(d.repeats, 1)));
	/** the curve's height (0 → 1) at u ∈ [0, 1): flat before the first point and after the last */
	function evalCurve(pts, u) {
		if (!pts.length) return 0;
		if (u < pts[0].x) return pts[0].y;
		for (let i = 0; i < pts.length - 1; i++) {
			const a = pts[i], c = pts[i + 1];
			if (u < c.x) {
				const dx = c.x - a.x;
				return dx <= 0 ? c.y : a.y + (c.y - a.y) * bendCurve((u - a.x) / dx, a.b);
			}
		}
		return pts[pts.length - 1].y;
	}

//#endregion
//#region src/engine/steps.ts
	const s = (beats, label, hint) => ({
		beats,
		label,
		hint
	});
	const STEP_GROUPS = [
		{
			title: "Straight",
			items: [
				s(1 / 16, "1/64", "64 per bar"),
				s(1 / 8, "1/32", "32 per bar"),
				s(1 / 4, "1/16", "16 per bar — the usual grid"),
				s(1 / 2, "1/8", "8 per bar"),
				s(1, "1/4", "one per beat"),
				s(2, "1/2", "two per bar"),
				s(4, "1", "one per bar"),
				s(8, "2 bars", "very slow")
			]
		},
		{
			title: "Triplets",
			items: [
				s(1 / 12, "1/32t", "48 per bar"),
				s(1 / 6, "1/16t", "24 per bar — rolls, trap hats"),
				s(1 / 3, "1/8t", "12 per bar — shuffle, swing"),
				s(2 / 3, "1/4t", "6 per bar"),
				s(4 / 3, "1/2t", "3 per bar")
			]
		},
		{
			title: "Dotted",
			items: [
				s(3 / 16, "1/32.", "dotted thirty-second"),
				s(3 / 8, "1/16.", "dotted sixteenth — 3 against 4"),
				s(3 / 4, "1/8.", "dotted eighth — the classic delay feel"),
				s(3 / 2, "1/4.", "dotted quarter"),
				s(3, "1/2.", "dotted half")
			]
		},
		{
			title: "Tuplets",
			items: [
				s(1 / 5, "1/16 ×5", "quintuplet — 5 per beat"),
				s(2 / 5, "1/8 ×5", "quintuplet — 5 per 2 beats"),
				s(1 / 7, "1/16 ×7", "septuplet — 7 per beat"),
				s(2 / 7, "1/8 ×7", "septuplet — 7 per 2 beats"),
				s(1 / 9, "1/32 ×9", "nonuplet — 9 per beat")
			]
		},
		{
			title: "Free",
			items: [
				s((Math.sqrt(5) - 1) / 2, "φ⁻¹ beat", "golden — never lines up with the bar"),
				s(Math.PI / 8, "π/8 beat", "irrational drift against the grid"),
				s(Math.SQRT2 / 4, "√2/4 beat", "another irrational pulse")
			]
		}
	];
	const ALL_STEPS = STEP_GROUPS.flatMap((g) => g.items);
	const MAX_STEPS = 1024;
	/** the lengths a song can have, in beats */
	const FIXED_LENGTHS = [
		4,
		8,
		16,
		32,
		64
	];
	/** the smallest fixed length that holds `beats` (64 at most) */
	const fixedLengthFor = (beats) => FIXED_LENGTHS.find((l) => l >= beats - 1e-9) ?? 64;
	/**
	* Apply a change to a track's grid. With a song length (in beats) every track is
	* exactly that long: a chosen step length becomes a whole number of steps (nudged so
	* the loop lands on the beat), and a typed step count divides the length evenly.
	* With `null` (a free song) steps × step length is whatever it is.
	*/
	function applyGrid(current, patch, length) {
		const next = {
			...current,
			...patch
		};
		if (length === null) {
			next.steps = Math.max(1, Math.min(MAX_STEPS, Math.round(next.steps)));
			return next;
		}
		const steps = patch.steps !== void 0 && patch.stepBeats === void 0 ? patch.steps : length / next.stepBeats;
		next.steps = Math.max(1, Math.min(MAX_STEPS, Math.round(steps)));
		next.stepBeats = length / next.steps;
		return next;
	}
	const gridOf = (t) => ({
		steps: t.steps,
		stepBeats: t.stepBeats
	});

//#endregion
//#region src/engine/music.ts
	const NOTE_NAMES = [
		"C",
		"C#",
		"D",
		"D#",
		"E",
		"F",
		"F#",
		"G",
		"G#",
		"A",
		"A#",
		"B"
	];
	const SCALES = {
		chromatic: {
			label: "None",
			steps: [
				0,
				1,
				2,
				3,
				4,
				5,
				6,
				7,
				8,
				9,
				10,
				11
			],
			group: "none",
			hint: "every semitone — degrees are semitones"
		},
		major: {
			label: "Major",
			steps: [
				0,
				2,
				4,
				5,
				7,
				9,
				11
			],
			group: "western"
		},
		minor: {
			label: "Minor",
			steps: [
				0,
				2,
				3,
				5,
				7,
				8,
				10
			],
			group: "western"
		},
		harmonicMinor: {
			label: "Harmonic Minor",
			steps: [
				0,
				2,
				3,
				5,
				7,
				8,
				11
			],
			group: "western"
		},
		melodicMinor: {
			label: "Melodic Minor",
			steps: [
				0,
				2,
				3,
				5,
				7,
				9,
				11
			],
			group: "western"
		},
		harmonicMajor: {
			label: "Harmonic Major",
			steps: [
				0,
				2,
				4,
				5,
				7,
				8,
				11
			],
			group: "western"
		},
		pentatonic: {
			label: "Pentatonic",
			steps: [
				0,
				2,
				4,
				7,
				9
			],
			group: "western"
		},
		minorPentatonic: {
			label: "Minor Pentatonic",
			steps: [
				0,
				3,
				5,
				7,
				10
			],
			group: "western"
		},
		blues: {
			label: "Blues",
			steps: [
				0,
				3,
				5,
				6,
				7,
				10
			],
			group: "western"
		},
		majorBlues: {
			label: "Major Blues",
			steps: [
				0,
				2,
				3,
				4,
				7,
				9
			],
			group: "western"
		},
		bebopDominant: {
			label: "Bebop Dominant",
			steps: [
				0,
				2,
				4,
				5,
				7,
				9,
				10,
				11
			],
			group: "western"
		},
		bebopMajor: {
			label: "Bebop Major",
			steps: [
				0,
				2,
				4,
				5,
				7,
				8,
				9,
				11
			],
			group: "western"
		},
		dorian: {
			label: "Dorian",
			steps: [
				0,
				2,
				3,
				5,
				7,
				9,
				10
			],
			group: "modes"
		},
		phrygian: {
			label: "Phrygian",
			steps: [
				0,
				1,
				3,
				5,
				7,
				8,
				10
			],
			group: "modes"
		},
		lydian: {
			label: "Lydian",
			steps: [
				0,
				2,
				4,
				6,
				7,
				9,
				11
			],
			group: "modes"
		},
		mixolydian: {
			label: "Mixolydian",
			steps: [
				0,
				2,
				4,
				5,
				7,
				9,
				10
			],
			group: "modes"
		},
		locrian: {
			label: "Locrian",
			steps: [
				0,
				1,
				3,
				5,
				6,
				8,
				10
			],
			group: "modes"
		},
		phrygianDominant: {
			label: "Phrygian Dominant",
			steps: [
				0,
				1,
				4,
				5,
				7,
				8,
				10
			],
			group: "modes",
			hint: "maqam Hijaz · Freygish"
		},
		lydianDominant: {
			label: "Lydian Dominant",
			steps: [
				0,
				2,
				4,
				6,
				7,
				9,
				10
			],
			group: "modes"
		},
		dorianSharp4: {
			label: "Dorian ♯4",
			steps: [
				0,
				2,
				3,
				6,
				7,
				9,
				10
			],
			group: "modes"
		},
		superLocrian: {
			label: "Altered",
			steps: [
				0,
				1,
				3,
				4,
				6,
				8,
				10
			],
			group: "modes",
			hint: "super-Locrian"
		},
		hirajoshi: {
			label: "Hirajōshi",
			steps: [
				0,
				2,
				3,
				7,
				8
			],
			group: "japanese"
		},
		inSen: {
			label: "In Sen",
			steps: [
				0,
				1,
				5,
				7,
				10
			],
			group: "japanese"
		},
		iwato: {
			label: "Iwato",
			steps: [
				0,
				1,
				5,
				6,
				10
			],
			group: "japanese"
		},
		yo: {
			label: "Yo",
			steps: [
				0,
				2,
				5,
				7,
				9
			],
			group: "japanese",
			hint: "also Javanese sléndro"
		},
		kumoi: {
			label: "Kumoi",
			steps: [
				0,
				2,
				3,
				7,
				9
			],
			group: "japanese"
		},
		ryukyu: {
			label: "Ryūkyū",
			steps: [
				0,
				4,
				5,
				7,
				11
			],
			group: "japanese",
			hint: "Okinawan"
		},
		miyakoBushi: {
			label: "Miyako-bushi",
			steps: [
				0,
				1,
				5,
				7,
				8
			],
			group: "japanese"
		},
		doubleHarmonic: {
			label: "Double Harmonic",
			steps: [
				0,
				1,
				4,
				5,
				7,
				8,
				11
			],
			group: "world",
			hint: "Byzantine · raga Bhairav · maqam Hijaz Kar"
		},
		hungarianMinor: {
			label: "Hungarian Minor",
			steps: [
				0,
				2,
				3,
				6,
				7,
				8,
				11
			],
			group: "world"
		},
		neapolitanMinor: {
			label: "Neapolitan Minor",
			steps: [
				0,
				1,
				3,
				5,
				7,
				8,
				11
			],
			group: "world"
		},
		persian: {
			label: "Persian",
			steps: [
				0,
				1,
				4,
				5,
				6,
				8,
				11
			],
			group: "world"
		},
		egyptian: {
			label: "Egyptian",
			steps: [
				0,
				2,
				5,
				7,
				10
			],
			group: "world"
		},
		pelog: {
			label: "Pélog",
			steps: [
				0,
				1,
				3,
				7,
				8
			],
			group: "world",
			hint: "Balinese gamelan (12-tone)"
		},
		todi: {
			label: "Todi",
			steps: [
				0,
				1,
				3,
				6,
				7,
				8,
				11
			],
			group: "world",
			hint: "Indian raga"
		},
		chinese: {
			label: "Chinese",
			steps: [
				0,
				4,
				6,
				7,
				11
			],
			group: "world"
		},
		enigmatic: {
			label: "Enigmatic",
			steps: [
				0,
				1,
				4,
				6,
				8,
				10,
				11
			],
			group: "world",
			hint: "Verdi"
		},
		prometheus: {
			label: "Prometheus",
			steps: [
				0,
				2,
				4,
				6,
				9,
				10
			],
			group: "world",
			hint: "Scriabin"
		},
		wholeTone: {
			label: "Whole Tone",
			steps: [
				0,
				2,
				4,
				6,
				8,
				10
			],
			group: "symmetric"
		},
		octatonic: {
			label: "Octatonic (half–whole)",
			steps: [
				0,
				1,
				3,
				4,
				6,
				7,
				9,
				10
			],
			group: "symmetric",
			hint: "diminished"
		},
		octatonicWH: {
			label: "Octatonic (whole–half)",
			steps: [
				0,
				2,
				3,
				5,
				6,
				8,
				9,
				11
			],
			group: "symmetric"
		},
		augmented: {
			label: "Augmented",
			steps: [
				0,
				3,
				4,
				7,
				8,
				11
			],
			group: "symmetric"
		},
		tritone: {
			label: "Tritone",
			steps: [
				0,
				1,
				4,
				6,
				7,
				10
			],
			group: "symmetric"
		},
		fifths: {
			label: "Fifths only",
			steps: [0, 7],
			group: "symmetric",
			hint: "root and fifth — power chords"
		}
	};
	/** Convert a scale degree (any integer, negative allowed) to a MIDI note. */
	function degreeToMidi(degree, root, scale, octave) {
		const d = Math.round(degree);
		const len = scale.length;
		const oct = Math.floor(d / len);
		const idx = (d % len + len) % len;
		return 12 * (octave + 1) + root + oct * 12 + scale[idx];
	}
	/** Snap a MIDI note number to the nearest note in the scale. */
	function snapToScale(midi, root, scale) {
		const m = Math.round(midi);
		for (let off = 0; off < 12; off++) for (const cand of [m - off, m + off]) {
			const pc = ((cand - root) % 12 + 12) % 12;
			if (scale.includes(pc)) return cand;
		}
		return m;
	}
	function valueToMidi(value, mode, root, scaleKey, octave, clampToMidi = true) {
		const scale = (SCALES[scaleKey] ?? SCALES.major).steps;
		let midi;
		if (mode === "degree") midi = degreeToMidi(value, root, scale, octave);
		else if (mode === "semitone") midi = snapToScale(12 * (octave + 1) + root + value, root, scale);
		else midi = degreeToMidi(value * scale.length, root, scale, octave);
		return clampToMidi ? Math.max(0, Math.min(127, midi)) : midi;
	}
	/**
	* Continuous version for glide tracks: fractional values slide smoothly between
	* scale notes instead of snapping. With `quantize` it snaps like valueToMidi.
	*/
	function valueToPitch(value, mode, root, scaleKey, octave, quantize, clampToMidi = true) {
		if (quantize) return valueToMidi(value, mode, root, scaleKey, octave, clampToMidi);
		const scale = (SCALES[scaleKey] ?? SCALES.major).steps;
		let midi;
		if (mode === "semitone") midi = 12 * (octave + 1) + root + value;
		else {
			const d = mode === "degree" ? value : value * scale.length;
			const lo = Math.floor(d);
			const a = degreeToMidi(lo, root, scale, octave);
			midi = a + (degreeToMidi(lo + 1, root, scale, octave) - a) * (d - lo);
		}
		return clampToMidi ? Math.max(0, Math.min(127, midi)) : midi;
	}
	const DEFAULT_PITCH_RANGE = {
		mode: "wrap",
		low: 24,
		high: 96
	};
	/**
	* Keep a pitch inside the range: 'wrap' moves it by whole octaves (it keeps its
	* note name), 'clamp' pins it to the nearest edge. Always ends inside MIDI 0…127.
	*/
	function limitPitch(midi, range) {
		let m = midi;
		if (range && range.mode !== "off" && range.high > range.low) {
			const { low, high } = range;
			if (range.mode === "clamp" || high - low < 12) m = Math.min(high, Math.max(low, m));
			else {
				if (m < low) m += 12 * Math.ceil((low - m) / 12);
				if (m > high) m -= 12 * Math.ceil((m - high) / 12);
			}
		}
		return Math.max(0, Math.min(127, m));
	}
	function midiToFreq(midi) {
		return 440 * Math.pow(2, (midi - 69) / 12);
	}
	function midiToName(midi) {
		return `${NOTE_NAMES[(midi % 12 + 12) % 12]}${Math.floor(midi / 12) - 1}`;
	}
	/** Inverse of degreeToMidi: the (nearest) scale degree of a MIDI note. */
	function midiToDegree(midi, root, scale, octave) {
		const rel = snapToScale(midi, root, scale) - 12 * (octave + 1) - root;
		const oct = Math.floor(rel / 12);
		const idx = Math.max(0, scale.indexOf((rel % 12 + 12) % 12));
		return oct * scale.length + idx;
	}
	/**
	* Build a chord from scale degrees: `size` tones stacked every `stack` degrees
	* (2 = thirds → triads/7ths/9ths, 3 = fourths → quartal, 1 = clusters, 4 = fifths).
	* Each inversion lifts the lowest tone an octave.
	*/
	function chordTones(rootDegree, size, stack, inversion, root, scaleKey, octave) {
		const scale = (SCALES[scaleKey] ?? SCALES.major).steps;
		size = Math.max(1, Math.min(8, Math.round(size)));
		stack = Math.max(1, Math.min(7, Math.round(stack)));
		const tones = [];
		for (let i = 0; i < size; i++) tones.push(degreeToMidi(Math.round(rootDegree) + i * stack, root, scale, octave));
		const inv = (Math.round(inversion) % size + size) % size;
		for (let i = 0; i < inv; i++) tones.push(tones.shift() + 12);
		return tones.map((m) => Math.max(0, Math.min(127, m)));
	}

//#endregion
//#region src/engine/project.ts
/** Drum voices and their General MIDI percussion note. */
	const DRUMS = {
		kick: {
			label: "Kick",
			gm: 36
		},
		snare: {
			label: "Snare",
			gm: 38
		},
		hat: {
			label: "Closed Hat",
			gm: 42
		},
		openhat: {
			label: "Open Hat",
			gm: 46
		},
		clap: {
			label: "Clap",
			gm: 39
		},
		rim: {
			label: "Rim",
			gm: 37
		},
		tom: {
			label: "Tom",
			gm: 45
		},
		crash: {
			label: "Crash",
			gm: 49
		}
	};
	const isDrum = (w) => w in DRUMS;
	const TRACK_DEFAULTS = {
		steps: 16,
		stepBeats: .25,
		stretch: 1,
		octave: 4,
		pitchMode: "degree",
		waveform: "sine",
		timbre: "sin(tau*p) + 0.5*sin(2*tau*p) + 0.25*sin(3*tau*p)",
		sliders: [],
		volume: .8,
		pan: 0,
		attack: .01,
		release: .4,
		send: 1,
		swing: 0,
		playMode: "notes",
		quantize: true,
		glide: .03,
		muted: false,
		solo: false
	};
	/** the length every track fills, or null when the song is free */
	const songGridLength = (song) => song.lengthMode === "free" ? null : song.lengthBeats;
	const sliderNames = (track) => (track.sliders ?? []).map((s) => s.name);
	const sliderValues = (track) => Object.fromEntries((track.sliders ?? []).map((s) => [s.name, s.value]));
	const SONG_DEFAULTS = {
		bpm: 90,
		root: 0,
		scale: "major",
		reverb: .3,
		exportLoops: 4,
		harmony: "0",
		pitchRange: DEFAULT_PITCH_RANGE,
		lengthMode: "fixed",
		lengthBeats: 16,
		repeat: "evolve",
		exportCurves: "simple",
		exportMidi: "standard",
		bendRange: 24,
		mpeBendRange: 48
	};
	const BEATS_PER_BAR = 4;
	const harmonyCache = /* @__PURE__ */ new Map();
	function harmonyFn(src) {
		if (!harmonyCache.has(src)) {
			if (harmonyCache.size > 64) harmonyCache.clear();
			harmonyCache.set(src, tryCompile(src, HARMONY_VARS).fn);
		}
		return harmonyCache.get(src);
	}
	/** what the harmony formula can read — it belongs to the song, so no track's sliders */
	const HARMONY_VARS = [
		"bar",
		"k",
		"L",
		"beat"
	];
	/** The chord (scale degree) sounding at an absolute beat of the song. */
	function harmonyAt(song, beat) {
		const fn = harmonyFn(song.harmony ?? "0");
		if (!fn) return 0;
		const v = fn({
			bar: Math.floor(beat / 4 + 1e-9),
			k: 0,
			L: scaleLength(song),
			beat: Math.floor(beat + 1e-9)
		});
		return Number.isFinite(v) ? Math.round(v) : 0;
	}
	const scaleLength = (song) => (SCALES[song.scale] ?? SCALES.major).steps.length;
	/** Fill in fields added since a project was saved. */
	function normalizeProject(p) {
		const { sliders: legacySliders, ...songIn } = p.song ?? {};
		const song = {
			...SONG_DEFAULTS,
			...songIn
		};
		const lengths = p.tracks.map((t) => (t.steps ?? 16) * (t.stepBeats ?? .25));
		if (!("lengthMode" in (p.song ?? {}))) {
			const same = lengths.length > 0 && lengths.every((l) => Math.abs(l - lengths[0]) < 1e-9) && FIXED_LENGTHS.some((f) => Math.abs(f - lengths[0]) < 1e-9);
			song.lengthMode = same ? "fixed" : "free";
			song.lengthBeats = same ? lengths[0] : fixedLengthFor(Math.max(1, ...lengths));
		}
		if (legacySliders?.length) for (const sl of legacySliders) song.harmony = renameVariable(song.harmony, sl.name, sl.value < 0 ? `(${sl.value})` : String(sl.value));
		return {
			name: p.name ?? "Untitled",
			song,
			tracks: p.tracks.map((t) => {
				const { lengthMode: _m, lengthBeats: _l, ...rest } = t;
				const track = {
					...TRACK_DEFAULTS,
					...rest
				};
				const old = LEGACY_COLORS.indexOf(String(track.color).toLowerCase());
				if (old >= 0) track.color = NEW_COLORS[old];
				if (legacySliders?.length && !t.sliders) {
					const used = formulaNames(track.graph);
					track.sliders = legacySliders.filter((sl) => used.has(sl.name)).map((sl) => ({ ...sl }));
				}
				return track;
			})
		};
	}
	const LEGACY_COLORS = [
		"#c4583d",
		"#6f8a63",
		"#4a5d7e",
		"#b39561",
		"#8a6a7e",
		"#5e8a86",
		"#6f6a62"
	];
	const NEW_COLORS = [
		"#e2483a",
		"#e8a93a",
		"#4fc98a",
		"#4f86d9",
		"#a865d6",
		"#3fb7b0",
		"#e07a3c"
	];
	/** every name the track's formulas read */
	function formulaNames(graph) {
		const used = /* @__PURE__ */ new Set();
		for (const n of graph.nodes) {
			if (n.type !== "expr") continue;
			try {
				for (const v of parse(String(n.data.formula ?? "")).variables) used.add(v);
			} catch {}
		}
		return used;
	}
	function keyLabel(song) {
		return `${NOTE_NAMES[song.root]} ${song.scale}`;
	}
	const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
	/** samples per step: glide tracks are sampled finely enough for smooth bends */
	const curveRes = (track) => track.playMode === "glide" ? 16 : Math.max(1, Math.min(16, Math.floor(1024 / track.steps)));
	function renderTrack(track, song, loop = 0, withTraces = true) {
		const program = compileGraph(track.graph, sliderNames(track));
		const vars = sliderValues(track);
		const traces = withTraces ? /* @__PURE__ */ new Map() : void 0;
		const notes = [];
		const pitchCurve = [];
		const velocityCurve = [];
		const key = keyLabel(song);
		const drum = isDrum(track.waveform) ? DRUMS[track.waveform] : null;
		const glide = track.playMode === "glide" && !drum;
		let hasOutput = true;
		const L = scaleLength(song);
		const loopBeat = loop * patternBeats(track);
		/** a step's length in real beats — the grid's, stretched */
		const sb = track.stepBeats * stretchOf(track);
		/** clock for a (possibly fractional) step position u: the function's own time t, and the song's real beat */
		const clock = (u, np = 0) => {
			const t = u * track.stepBeats;
			const beat = loopBeat + u * sb;
			return {
				n: Math.floor(u),
				x: u / track.steps,
				t,
				k: loop,
				steps: track.steps,
				h: harmonyAt(song, beat),
				bar: Math.floor(beat / 4 + 1e-9),
				L,
				beat,
				vars,
				np
			};
		};
		const { expression } = program;
		const expressive = expression.bend || expression.pressure || expression.slide;
		/** sample a note's expression across its life: 16 times a step, np running 0 → 1 */
		const noteExpr = (u0, lenSteps) => {
			const count = Math.max(2, Math.min(256, Math.ceil(lenSteps * 16) + 1));
			const e = {
				at: [],
				bend: [],
				pressure: [],
				slide: []
			};
			for (let i = 0; i < count; i++) {
				const np = i / (count - 1) * (1 - 1e-9);
				const o = program.run(clock(u0 + np * lenSteps, np));
				if (!o) break;
				e.at.push(np * lenSteps * sb);
				e.bend.push(clamp(o.bend, -48, 48));
				e.pressure.push(clamp(o.pressure, 0, 1));
				e.slide.push(clamp(o.slide, 0, 1));
			}
			return e;
		};
		for (let n = 0; n < track.steps; n++) {
			const ctx = clock(n);
			const out = program.run(ctx, traces);
			if (!out) {
				hasOutput = false;
				break;
			}
			pitchCurve.push(out.pitch);
			const vel = clamp(out.velocity, 0, 1);
			velocityCurve.push(vel);
			if (vel < .01 || glide) continue;
			const range = song.pitchRange ?? DEFAULT_PITCH_RANGE;
			const rootMidi = drum ? drum.gm : limitPitch(valueToMidi(out.pitch, track.pitchMode, song.root, song.scale, track.octave, false), range);
			const size = drum ? 1 : clamp(Math.round(out.chord), 1, 8);
			const scale = (SCALES[song.scale] ?? SCALES.major).steps;
			const tones = size > 1 ? chordTones(midiToDegree(rootMidi, song.root, scale, track.octave), size, out.stack, out.inversion, song.root, song.scale, track.octave).map((m) => limitPitch(m, range)) : [rootMidi];
			const strum = clamp(out.strum, -.5, .5);
			const tune = drum ? clamp(out.pitch, -24, 24) : 0;
			const ratchet = clamp(Math.round(out.ratchet), 1, 8);
			const shift = clamp(clamp(out.shift, 0, .95) + (n % 2 === 1 ? track.swing : 0), 0, .95);
			const len = clamp(out.length, .05, 64);
			for (let r = 0; r < ratchet; r++) {
				const u0 = n + Math.min(.97, shift) + r / ratchet;
				const expr = expressive ? noteExpr(u0, ratchet > 1 ? .9 / ratchet : Math.max(.05, len)) : void 0;
				tones.forEach((midi, i) => {
					const roll = (strum >= 0 ? i : tones.length - 1 - i) * Math.abs(strum);
					notes.push({
						step: n,
						loop,
						beat: (n + Math.min(.97, shift + roll) + r / ratchet) * sb,
						duration: ratchet > 1 ? sb / ratchet * .9 : Math.max(.05, len - roll) * sb,
						midi,
						name: drum ? drum.label : midiToName(midi),
						freq: midiToFreq(midi),
						velocity: (ratchet > 1 && r > 0 ? vel * (.7 + .3 * r / ratchet) : vel) * (i === 0 ? 1 : .85),
						raw: out.pitch,
						tune,
						key,
						h: ctx.h,
						expr
					});
				});
			}
		}
		const res = hasOutput ? curveRes(track) : 1;
		const curve = {
			res,
			beat: [],
			midi: [],
			velocity: [],
			raw: []
		};
		if (hasOutput) for (let i = 0; i < track.steps * res; i++) {
			const u = i / res;
			const out = program.run(clock(u, u - Math.floor(u)));
			curve.beat.push(u * sb);
			curve.raw.push(out.pitch);
			curve.velocity.push(clamp(out.velocity, 0, 1) * (glide && expression.pressure ? clamp(out.pressure, 0, 1) : 1));
			curve.midi.push(drum ? drum.gm + clamp(out.pitch, -24, 24) : limitPitch(valueToPitch(out.pitch, track.pitchMode, song.root, song.scale, track.octave, !glide || track.quantize, false), song.pitchRange ?? DEFAULT_PITCH_RANGE) + (glide && expression.bend ? clamp(out.bend, -48, 48) : 0));
		}
		return {
			notes,
			pitchCurve,
			velocityCurve,
			curve,
			traces: traces ?? /* @__PURE__ */ new Map(),
			errors: program.errors,
			hasOutput
		};
	}
	/** Bars until the progression repeats (1 for a drone), found by comparing the first 32 bars. */
	function harmonyCycleBars(song) {
		const at = (bar) => harmonyAt(song, bar * 4);
		for (const p of [
			1,
			2,
			3,
			4,
			6,
			8,
			12,
			16
		]) {
			let ok = true;
			for (let b = 0; b < 32 && ok; b++) ok = at(b) === at(b + p);
			if (ok) return p;
		}
		return 16;
	}
	/**
	* One full cycle of the song: its length — or, when the song is free, its longest
	* track. (The progression doesn't stretch it: it repeats, or keeps going, inside.)
	*/
	function songBeats(tracks, song) {
		if (song.lengthMode !== "free") return song.lengthBeats ?? 16;
		return Math.max(1, ...tracks.map(patternBeats));
	}
	/**
	* Split a stretch of play time [from, to) into pieces of song time: with `repeat: 'exact'`
	* each pass of the song starts again at 0; otherwise song time is play time.
	* `base` is where the piece's song time 0 sits in play time.
	*/
	function songWindows(song, songLength, from, to) {
		if (song.repeat !== "exact" || !(songLength > 0)) return [{
			base: 0,
			from,
			to
		}];
		const out = [];
		for (let p = Math.floor(from / songLength + 1e-9); p * songLength < to - 1e-9; p++) {
			const base = p * songLength;
			out.push({
				base,
				from: Math.max(0, from - base),
				to: Math.min(songLength, to - base)
			});
		}
		return out;
	}
	/** how long one pass of the channel lasts, in beats — its grid, stretched */
	function patternBeats(track) {
		return track.steps * track.stepBeats * stretchOf(track);
	}
	const STRETCH_MIN = 1 / 16;
	const STRETCH_MAX = 16;
	const stretchOf = (track) => {
		const s = track.stretch;
		return Number.isFinite(s) && s > 0 ? Math.min(16, Math.max(STRETCH_MIN, s)) : 1;
	};
	function audibleTracks(tracks) {
		const anySolo = tracks.some((t) => t.solo);
		return tracks.filter((t) => anySolo ? t.solo : !t.muted);
	}

//#endregion
//#region src/engine/midi.ts
	const PPQ = 480;
	/** a bend range in semitones, or the fallback if the setting is missing or nonsense */
	const rangeOf = (v, fallback) => typeof v === "number" && v >= 1 && v <= 96 ? v : fallback;
	const GM_PROGRAM = {
		sine: 79,
		triangle: 74,
		square: 80,
		sawtooth: 81,
		bell: 14,
		pluck: 107,
		pad: 89,
		flute: 77,
		reese: 38,
		supersaw: 81,
		keys: 4,
		brass: 61,
		acid: 39,
		custom: 82
	};
	/** Every note (and glide point) of every audible track across the export length, in absolute beats. */
	function collectNotes(project, from = 0, to = exportBeats(project), clipAtEnd = true) {
		const tracks = audibleTracks(project.tracks);
		const total = to;
		const windows = songWindows(project.song, songBeats(tracks, project.song), from, to);
		return tracks.map((track) => {
			const len = patternBeats(track);
			const notes = [];
			const glide = [];
			const isGlide = track.playMode === "glide" && !isDrum(track.waveform);
			if (len <= 0) return {
				track,
				notes,
				glide
			};
			for (const w of windows) for (let k = Math.floor(w.from / len + 1e-9); k * len < w.to - 1e-9; k++) {
				const r = renderTrack(track, project.song, k, false);
				if (isGlide) {
					r.curve.beat.forEach((b, i) => {
						const beat = k * len + b;
						if (beat < w.to - 1e-9) glide.push({
							beat: w.base + beat,
							midi: r.curve.midi[i],
							velocity: r.curve.velocity[i]
						});
					});
					continue;
				}
				for (const n of r.notes) {
					const beat = k * len + n.beat;
					if (beat >= w.to - 1e-9) continue;
					notes.push({
						...n,
						beat: w.base + beat,
						duration: clipAtEnd ? Math.min(n.duration, total - w.base - beat) : n.duration
					});
				}
			}
			return {
				track,
				notes,
				glide
			};
		});
	}
	function exportBeats(project) {
		return songBeats(audibleTracks(project.tracks), project.song) * Math.max(1, project.song.exportLoops);
	}
	const tick = (beat) => Math.round(beat * 480);
	/** how far a simplified curve may stray from the real one: pitch in semitones, expression in CC steps */
	const CURVE_TOLERANCE = {
		semis: .03,
		expr: 1.5
	};
	/**
	* The fewest points that redraw a curve when joined by straight lines (as DAWs draw
	* automation), never straying more than `tol` from it — Ramer–Douglas–Peucker, measuring
	* the vertical error at each sample. Corners always survive; straight runs collapse.
	*/
	function simplifyCurve(xs, ys, tol) {
		const n = xs.length;
		if (n <= 2) return xs.map((_, i) => i);
		const keep = new Uint8Array(n);
		keep[0] = keep[n - 1] = 1;
		const stack = [[0, n - 1]];
		while (stack.length) {
			const [a, b] = stack.pop();
			let worst = -1, err = tol;
			for (let i = a + 1; i < b; i++) {
				const line = xs[b] === xs[a] ? ys[a] : ys[a] + (ys[b] - ys[a]) * (xs[i] - xs[a]) / (xs[b] - xs[a]);
				const e = Math.abs(ys[i] - line);
				if (e > err) err = e, worst = i;
			}
			if (worst > 0) {
				keep[worst] = 1;
				stack.push([a, worst], [worst, b]);
			}
		}
		const out = [];
		for (let i = 0; i < n; i++) if (keep[i]) out.push(i);
		return out;
	}
	function glideEvents(points, ch, total, simplify, stats, range) {
		const cc = (t, c, v) => ({
			tick: t,
			order: .5,
			bytes: [
				176 | ch,
				c,
				v
			]
		});
		const evs = [
			cc(0, 101, 0),
			cc(0, 100, 0),
			cc(0, 6, range),
			cc(0, 38, 0),
			cc(0, 101, 127),
			cc(0, 100, 127)
		];
		let base = -1;
		let lastBend = -1, lastExpr = -1;
		const bend = (t, semis) => {
			const v = bendCode(range)(semis);
			if (v === lastBend) return;
			lastBend = v;
			evs.push({
				tick: t,
				order: .5,
				bytes: [
					224 | ch,
					v & 127,
					v >> 7
				]
			});
		};
		const off = (t) => {
			evs.push({
				tick: t,
				order: 0,
				bytes: [
					128 | ch,
					base,
					0
				]
			});
			base = -1;
		};
		const phrases = [];
		let cur = null;
		for (const p of points) {
			const t = tick(p.beat);
			if (p.velocity < .01) {
				if (cur) cur.end = t, cur = null;
				continue;
			}
			if (cur && Math.abs(p.midi - cur.base) > range - .5) cur.end = t, cur = null;
			if (!cur) phrases.push(cur = {
				t: [],
				semis: [],
				expr: [],
				base: Math.round(p.midi),
				end: null
			});
			cur.t.push(t);
			cur.semis.push(p.midi - cur.base);
			cur.expr.push(p.velocity * 127);
		}
		for (const ph of phrases) {
			base = ph.base;
			const n = ph.t.length;
			stats.raw += 2 * n;
			const bi = simplify ? simplifyCurve(ph.t, ph.semis, CURVE_TOLERANCE.semis) : ph.t.map((_, i) => i);
			const ei = simplify ? simplifyCurve(ph.t, ph.expr, CURVE_TOLERANCE.expr) : ph.t.map((_, i) => i);
			bend(ph.t[0], ph.semis[0]);
			evs.push({
				tick: ph.t[0],
				order: 1,
				bytes: [
					144 | ch,
					base,
					100
				]
			});
			let kept = 0;
			for (const i of bi) {
				const before = lastBend;
				bend(ph.t[i], ph.semis[i]);
				if (lastBend !== before) kept++;
			}
			for (const i of ei) {
				const expr = Math.round(ph.expr[i]);
				if (simplify ? expr !== lastExpr : Math.abs(expr - lastExpr) >= 2) {
					lastExpr = expr;
					evs.push(cc(ph.t[i], 11, expr));
					kept++;
				}
			}
			stats.kept += kept;
			off(ph.end ?? tick(total));
		}
		evs.push({
			tick: tick(total),
			order: .5,
			bytes: [
				224 | ch,
				0,
				64
			]
		});
		return evs;
	}
	const EXPR_TOLERANCE = {
		semis: CURVE_TOLERANCE.semis,
		unit: 1.5 / 127
	};
	/**
	* Write one curve as MIDI events at the given ticks: simplified to the points that redraw it
	* (or every sample), quantised by `encode`, and never repeating a value.
	*/
	function curveEvents(ticks, values, tol, simplify, encode, make, stats, last = NaN) {
		const out = [];
		stats.raw += ticks.length;
		const keep = simplify ? simplifyCurve(ticks, values, tol) : ticks.map((_, i) => i);
		for (const i of keep) {
			const code = encode(values[i]);
			if (code === last) continue;
			last = code;
			out.push(make(ticks[i], code));
		}
		stats.kept += out.length;
		return out;
	}
	const bendCode = (range) => (semis) => Math.max(0, Math.min(16383, Math.round(8192 + semis / range * 8192)));
	const unit127 = (v) => Math.max(0, Math.min(127, Math.round(v * 127)));
	const bendEv = (ch, order) => (tick, v) => ({
		tick,
		order,
		bytes: [
			224 | ch,
			v & 127,
			v >> 7
		]
	});
	const pressEv = (ch, order) => (tick, v) => ({
		tick,
		order,
		bytes: [208 | ch, v]
	});
	const slideEv = (ch, order) => (tick, v) => ({
		tick,
		order,
		bytes: [
			176 | ch,
			74,
			v
		]
	});
	const rpn = (ch, lsb, value) => [
		[101, 0],
		[100, lsb],
		[6, value],
		[38, 0],
		[101, 127],
		[100, 127]
	].map(([c, v]) => ({
		tick: 0,
		order: .4,
		bytes: [
			176 | ch,
			c,
			v
		]
	}));
	/**
	* MPE (lower zone): channel 1 is the master, 2–16 are members, each bending ±48. Each note
	* takes the member channel that has been free longest, so overlapping notes and chords
	* bend, press and slide independently. Glides become one long note per phrase.
	*/
	function mpeEvents(program, notes, glide, total, simplify, stats, range) {
		const evs = [...rpn(0, 6, 15)];
		for (let ch = 1; ch <= 15; ch++) evs.push(...rpn(ch, 0, range), {
			tick: 0,
			order: .45,
			bytes: [192 | ch, program]
		});
		const list = [...notes.map((n) => {
			const on = tick(n.beat), off = Math.max(on + 1, tick(n.beat + n.duration));
			const e = n.expr;
			return {
				on,
				off,
				midi: n.midi,
				vel: Math.max(1, Math.min(127, Math.round(n.velocity * 127))),
				at: e ? e.at.map((a) => tick(n.beat + a) - on) : [0],
				bend: e?.bend ?? [0],
				pressure: e?.pressure ?? [1],
				slide: e?.slide ?? [.5]
			};
		}), ...gliding(glide, total, range - .5)].sort((a, b) => a.on - b.on);
		const freeAt = new Array(16).fill(-Infinity);
		for (const n of list) {
			let ch = 1;
			for (let c = 2; c <= 15; c++) if (freeAt[c] < freeAt[ch]) ch = c;
			freeAt[ch] = n.off;
			const ticks = n.at.map((a) => n.on + Math.min(a, n.off - n.on));
			evs.push(...curveEvents(ticks, n.bend, EXPR_TOLERANCE.semis, simplify, bendCode(range), (t, v) => bendEv(ch, t === n.on ? .7 : .5)(t, v), stats));
			evs.push(...curveEvents(ticks, n.pressure, EXPR_TOLERANCE.unit, simplify, unit127, (t, v) => pressEv(ch, t === n.on ? .7 : .5)(t, v), stats));
			evs.push(...curveEvents(ticks, n.slide, EXPR_TOLERANCE.unit, simplify, unit127, (t, v) => slideEv(ch, t === n.on ? .7 : .5)(t, v), stats));
			evs.push({
				tick: n.on,
				order: 1,
				bytes: [
					144 | ch,
					n.midi,
					n.vel
				]
			}, {
				tick: n.off,
				order: 0,
				bytes: [
					128 | ch,
					n.midi,
					0
				]
			});
		}
		return evs;
	}
	/** a glide's sounding stretches as notes: base note, bend away from it, pressure from its volume */
	function gliding(points, total, reach) {
		const out = [];
		let cur = null;
		const close = (t) => cur && (cur.off = Math.max(cur.on + 1, t), cur = null);
		for (const p of points) {
			const t = tick(p.beat);
			if (p.velocity < .01) {
				close(t);
				continue;
			}
			if (cur && Math.abs(p.midi - cur.midi) > reach) close(t);
			if (!cur) out.push(cur = {
				on: t,
				off: tick(total),
				midi: Math.round(p.midi),
				vel: Math.max(1, Math.round(p.velocity * 127)),
				at: [],
				bend: [],
				pressure: [],
				slide: []
			});
			cur.at.push(t - cur.on);
			cur.bend.push(p.midi - cur.midi);
			cur.pressure.push(p.velocity);
			cur.slide.push(.5);
		}
		return out;
	}
	/** without MPE: each note's bend / pressure / slide on the channel, the bend centred again as it ends */
	function channelExpression(notes, ch, simplify, stats, range) {
		const evs = [];
		const anyBend = notes.some((n) => n.expr?.bend.some((b) => b !== 0));
		if (anyBend) evs.push(...rpn(ch, 0, range));
		const seen = /* @__PURE__ */ new Set();
		for (const n of notes) {
			const e = n.expr;
			if (!e || seen.has(e)) continue;
			seen.add(e);
			const on = tick(n.beat);
			const ticks = e.at.map((a) => tick(n.beat + a));
			if (anyBend) {
				evs.push(...curveEvents(ticks, e.bend, EXPR_TOLERANCE.semis, simplify, bendCode(range), (t, v) => bendEv(ch, t === on ? .7 : .5)(t, v), stats));
				evs.push(bendEv(ch, .65)(Math.max(on + 1, tick(n.beat + n.duration)), 8192));
			}
			if (e.pressure.some((p) => p !== 1)) evs.push(...curveEvents(ticks, e.pressure, EXPR_TOLERANCE.unit, simplify, unit127, (t, v) => pressEv(ch, .6)(t, v), stats));
			if (e.slide.some((s) => s !== .5)) evs.push(...curveEvents(ticks, e.slide, EXPR_TOLERANCE.unit, simplify, unit127, (t, v) => slideEv(ch, .6)(t, v), stats));
		}
		return evs;
	}
	/** a glide as plain notes: a new note each time the slide reaches another semitone, or after a rest */
	function glideAsNotes(points, total) {
		const out = [];
		let cur = null;
		const close = (beat) => {
			if (cur) cur.duration = Math.max(.01, beat - cur.beat);
			cur = null;
		};
		for (const p of points) {
			if (p.velocity < .01) {
				close(p.beat);
				continue;
			}
			const midi = Math.round(p.midi);
			if (cur && midi === cur.midi) continue;
			close(p.beat);
			cur = {
				step: 0,
				loop: 0,
				beat: p.beat,
				duration: 0,
				midi,
				name: "",
				freq: 0,
				velocity: p.velocity,
				raw: 0,
				tune: 0,
				key: "",
				h: 0
			};
			out.push(cur);
		}
		close(total);
		return out;
	}
	/**
	* Every audible channel's MIDI events between `from` and `to` (beats of song time) — what a
	* MIDI file holds, and what the Max for Live device plays, in the given mode. Ticks are
	* absolute (480 per beat from the song's start). `clipAtEnd`: notes stop at `to` (a file),
	* or ring on into whatever comes next (live playback).
	*/
	function windowEvents(project, mode, from, to, stats = {
		raw: 0,
		kept: 0
	}, clipAtEnd = true) {
		const { song } = project;
		const all = collectNotes(project, from, to, clipAtEnd);
		const total = to;
		let melodic = 0;
		return all.map(({ track, notes, glide }) => {
			const drum = isDrum(track.waveform);
			let ch = 9;
			if (!drum) {
				ch = melodic++ % 15;
				if (ch >= 9) ch++;
			}
			const evs = [];
			const t0 = tick(from);
			const simplify = song.exportCurves !== "full";
			if (mode === "notes") {
				if (!drum) evs.push({
					tick: t0,
					order: 0,
					bytes: [192 | ch, GM_PROGRAM[track.waveform] ?? 0]
				});
				for (const n of [...notes, ...glideAsNotes(glide, total)]) {
					const on = tick(n.beat);
					const off = Math.max(on + 1, tick(n.beat + n.duration));
					const vel = Math.max(1, Math.min(127, Math.round(n.velocity * 127)));
					evs.push({
						tick: on,
						order: 1,
						bytes: [
							144 | ch,
							n.midi,
							vel
						]
					}, {
						tick: off,
						order: 0,
						bytes: [
							128 | ch,
							n.midi,
							0
						]
					});
				}
				return {
					track,
					ch,
					events: evs
				};
			}
			if (!drum && mode === "mpe") {
				evs.push(...mpeEvents(GM_PROGRAM[track.waveform] ?? 0, notes, glide, total, simplify, stats, rangeOf(song.mpeBendRange, 48)).map((e) => e.tick === 0 ? {
					...e,
					tick: t0
				} : e));
				return {
					track,
					ch,
					events: evs
				};
			}
			if (!drum) evs.push({
				tick: t0,
				order: 0,
				bytes: [192 | ch, GM_PROGRAM[track.waveform] ?? 0]
			});
			if (glide.length) evs.push(...glideEvents(glide, ch, total, simplify, stats, rangeOf(song.bendRange, 24)).map((e) => e.tick === 0 ? {
				...e,
				tick: t0
			} : e));
			if (!drum && notes.some((n) => n.expr)) evs.push(...channelExpression(notes, ch, simplify, stats, rangeOf(song.bendRange, 24)).map((e) => e.tick === 0 ? {
				...e,
				tick: t0
			} : e));
			for (const n of notes) {
				const on = tick(n.beat);
				const off = Math.max(on + 1, tick(n.beat + n.duration));
				const vel = Math.max(1, Math.min(127, Math.round(n.velocity * 127)));
				evs.push({
					tick: on,
					order: 1,
					bytes: [
						144 | ch,
						n.midi,
						vel
					]
				});
				evs.push({
					tick: off,
					order: 0,
					bytes: [
						128 | ch,
						n.midi,
						0
					]
				});
			}
			return {
				track,
				ch,
				events: evs
			};
		});
	}

//#endregion
//#region src/engine/presets.ts
	const TRACK_COLORS = [
		"#e2483a",
		"#e8a93a",
		"#4fc98a",
		"#4f86d9",
		"#a865d6",
		"#3fb7b0",
		"#e07a3c"
	];
	/** the wider palette: the basic seven, then more lab-instrument colours */
	const CHANNEL_PALETTE = [
		...TRACK_COLORS,
		"#f06292",
		"#ff8a65",
		"#ffd54f",
		"#c5e15a",
		"#8bc34a",
		"#26a69a",
		"#4dd0e1",
		"#64b5f6",
		"#7986cb",
		"#9575cd",
		"#ce93d8",
		"#f48fb1",
		"#bcaaa4",
		"#b0bec5",
		"#d4c25a",
		"#7fdba8",
		"#ff5a5a"
	];
	/** rough rendered height of a node card, so columns can stack without overlap */
	function nodeHeight(node) {
		const d = NODE_DEFS[node.type];
		const formulaLines = node.type === "expr" ? Math.ceil(String(node.data.formula ?? "").length / 30) - 1 : 0;
		return 70 + (d.inputs.length + d.outputs.length) * 21 + d.params.length * 30 + formulaLines * 18 + (node.type === "number" ? 24 : 0) + (node.type === "step" ? 0 : 36);
	}
	/** Layered layout: column = depth from the sources, rows stacked by height. */
	function layoutGraph(g) {
		const depth = /* @__PURE__ */ new Map();
		const into = (id) => g.edges.filter((e) => e.target === id).map((e) => e.source);
		const walk = (id, seen = /* @__PURE__ */ new Set()) => {
			if (depth.has(id)) return depth.get(id);
			if (seen.has(id)) return 0;
			seen.add(id);
			const d = Math.max(-1, ...into(id).map((s) => walk(s, seen))) + 1;
			depth.set(id, d);
			return d;
		};
		g.nodes.forEach((n) => walk(n.id));
		const maxD = Math.max(...depth.values());
		for (const n of g.nodes) if (n.type === "output") depth.set(n.id, Math.max(maxD, 1));
		const byDepth = /* @__PURE__ */ new Map();
		for (const n of g.nodes) {
			const d = depth.get(n.id);
			byDepth.set(d, [...byDepth.get(d) ?? [], n]);
		}
		const MAX_H = 560, GAP = 28;
		const columns = [];
		for (const d of [...byDepth.keys()].sort((a, b) => a - b)) {
			let col = [];
			let h = -28;
			for (const n of byDepth.get(d)) {
				if (col.length && h + GAP + nodeHeight(n) > MAX_H) {
					columns.push(col);
					col = [], h = -28;
				}
				col.push(n);
				h += GAP + nodeHeight(n);
			}
			columns.push(col);
		}
		const colH = (c) => c.reduce((h, n) => h + nodeHeight(n) + GAP, -28);
		const tallest = Math.max(...columns.map(colH));
		const pos = /* @__PURE__ */ new Map();
		columns.forEach((col, ci) => {
			let y = (tallest - colH(col)) / 2;
			for (const n of col) {
				pos.set(n.id, {
					x: ci * 280,
					y
				});
				y += nodeHeight(n) + GAP;
			}
		});
		return {
			nodes: g.nodes.map((n) => ({
				...n,
				position: pos.get(n.id)
			})),
			edges: g.edges
		};
	}
	function graph(nodes, edges) {
		return layoutGraph({
			nodes: nodes.map(([id, type, x, y, data]) => ({
				id,
				type,
				position: {
					x,
					y
				},
				data: { ...data }
			})),
			edges: edges.map(([source, sourceHandle, target, targetHandle]) => ({
				id: `${source}.${sourceHandle}-${target}.${targetHandle}`,
				source,
				sourceHandle,
				target,
				targetHandle
			}))
		});
	}
	/** compact graph builder: nodes by id, wires as 'src.handle>dst.handle' */
	function wire(nodes, wires) {
		return graph(Object.entries(nodes).map(([id, [type, data]]) => [
			id,
			type,
			0,
			0,
			{
				...NODE_DEFS[type].defaults,
				...data
			}
		]), wires.map((w) => {
			const [a, b] = w.split(">");
			const [s, sh] = a.split(".");
			const [t, th] = b.split(".");
			return [
				s,
				sh,
				t,
				th
			];
		}));
	}
	const OUT_X = 640;
	/**
	* Voice-led chords: wrap the chord's root into the octave around the middle of the keys
	* (degrees −2 … L−3), then invert exactly the notes that would stick out above it — every
	* chord lands in close position inside one octave, so the hand barely moves between chords.
	* (For a size-S chord stacked in thirds.)
	*/
	const LIFT = "ceil((L - 2 - wrap(h, -2, L - 2)) / 2)";
	const voicedPitch = (S) => `wrap(h, -2, L - 2) - (${LIFT} < ${S}) * L`;
	/** lift only when the chord was lowered: a chord that already fits stays in root position */
	const voicedInversion = (S) => `(${LIFT} < ${S}) * ${LIFT}`;
	/** the bass: the chord's root, wrapped into one octave so it never wanders off */
	const ROOT = "wrap(h, -3, 4)";
	const WALKING_BASS = voice("Walking bass", "triangle", `${ROOT} + pick(n, 0, 2, 0, 4, 0, 5, 0, 2)`, "0.72 + 0.12 * (n % 2 == 0)", { length: .95 }, {
		stepBeats: 1,
		steps: 8,
		octave: 2,
		attack: .005,
		release: .12,
		volume: .8,
		send: .15
	});
	const RHODES_COMP = voice("Rhodes comp", "bell", voicedPitch(4), "pick(n % 8, 0.55, 0, 0, 0.42, 0.55, 0, 0, 0.35) * (0.85 + 0.15 * rand(n + 16k, 8))", {
		chord: 4,
		inversion: voicedInversion(4),
		length: 1.2,
		strum: .015
	}, {
		stepBeats: .5,
		steps: 16,
		octave: 4,
		swing: .33,
		volume: .5,
		send: .55
	});
	const BOSSA_GUITAR = voice("Nylon guitar", "pluck", voicedPitch(4), "0.48 * bits(pick(floor(n / 16), 0x9228, 0x2924), n)", {
		chord: 4,
		inversion: voicedInversion(4),
		length: 1.5,
		strum: .03
	}, {
		steps: 32,
		octave: 4,
		volume: .55,
		send: .4,
		swing: .04
	});
	const BOSSA_BASS = voice("Bossa bass", "triangle", `${ROOT} + (n % 16 >= 6) * 4`, "0.8 * bits(0x8280, n)", { length: "pick((n % 16 == 6) + 2 * (n % 16 == 8), 5.5, 1.8, 7)" }, {
		steps: 32,
		octave: 2,
		attack: .005,
		release: .15,
		volume: .8
	});
	const MONTUNO = voice("Montuno piano", "pluck", "wrap(h, -2, 5) + pick(floor(n / 2) % 4, 0, 4, 2, 4)", "every(n, 2) * (0.42 + 0.25 * bits(0x2222, n))", {
		chord: 2,
		stack: "L",
		length: 1.6
	}, {
		steps: 32,
		octave: 4,
		volume: .5,
		send: .3
	});
	const TUMBAO = voice("Tumbao bass", "triangle", `${ROOT} + (n % 16 == 6) * 4`, "0.85 * bits(0x0208, n)", { length: 3.5 }, {
		steps: 32,
		octave: 2,
		attack: .005,
		release: .12,
		volume: .85
	});
	const SLAP_BASS = voice("Slap bass", "pluck", `${ROOT} - L + pick(n % 16, 0, 0, 0, 0, 0, 0, L, 0, 0, 0, L - 1, 0, 0, 0, L, 0)`, "bits(0x92A6, n) * (0.68 + 0.27 * bits(0x0202, n))", { length: .8 }, {
		steps: 32,
		octave: 3,
		release: .1,
		volume: .8,
		send: .05
	});
	const CLAV = voice("Clav", "square", voicedPitch(3), "0.42 * bits(0x2452, n)", {
		chord: 3,
		inversion: voicedInversion(3),
		length: .5
	}, {
		steps: 32,
		octave: 4,
		attack: .003,
		release: .06,
		volume: .4,
		send: .15
	});
	const DISCO_BASS = voice("Octave bass", "sawtooth", `${ROOT} - L + L * (floor(n / 2) % 2)`, "0.8 * every(n, 2)", { length: 1.4 }, {
		steps: 16,
		octave: 3,
		attack: .004,
		release: .08,
		volume: .6
	});
	const DISCO_STRINGS = voice("Strings", "pad", voicedPitch(3), "0.5 * every(n, 16)", {
		chord: 3,
		inversion: voicedInversion(3),
		length: 16
	}, {
		steps: 16,
		octave: 4,
		attack: .3,
		release: 1,
		volume: .45,
		send: .8
	});
	const HOUSE_STABS = voice("Organ stabs", "custom", voicedPitch(5), "0.5 * bits(0x1224, n)", {
		chord: 5,
		inversion: voicedInversion(5),
		length: .8
	}, {
		steps: 16,
		octave: 4,
		attack: .005,
		release: .25,
		volume: .42,
		send: .55,
		swing: .12
	});
	const HOUSE_SUB = voice("Sub bass", "sine", `${ROOT} - L`, "0.85 * every(n, 4, 2)", { length: 1.6 }, {
		steps: 16,
		octave: 3,
		release: .1,
		volume: .85
	});
	/** a pad on the chord whose notes are held long and pumped by pressure — a Curve once a beat */
	const PUMP_PAD = {
		name: "Pumping pad",
		waveform: "pad",
		steps: 16,
		stepBeats: .25,
		octave: 4,
		attack: .4,
		release: 1.2,
		volume: .4,
		send: .8,
		graph: wire({
			pitch: ["expr", { formula: voicedPitch(4) }],
			inv: ["expr", { formula: voicedInversion(4) }],
			vel: ["expr", { formula: "0.45 * every(n, 16)" }],
			chord: ["number", {
				value: 4,
				min: 1,
				max: 8
			}],
			length: ["number", {
				value: 16,
				min: 0,
				max: 64
			}],
			beats: ["expr", { formula: "t" }],
			duck: ["curve", {
				points: "0:0.15:0.7 0.9:1:0 1:0.15:0",
				repeats: 1,
				lo: 0,
				hi: 1
			}],
			out: ["output"]
		}, [
			"pitch.out>out.pitch",
			"inv.out>out.inversion",
			"vel.out>out.velocity",
			"chord.out>out.chord",
			"length.out>out.length",
			"beats.out>duck.p",
			"duck.out>out.pressure"
		])
	};
	/** a part as a plantable preset */
	const part = (id, t, description, formula) => ({
		id,
		name: t.name,
		description,
		formula,
		track: {
			pitchMode: "degree",
			...t,
			waveform: t.waveform ?? "sine"
		}
	});
	const PRESETS = [
		{
			id: "pond",
			name: "Still Pond",
			description: "One slow sine wave. The simplest melody.",
			formula: "pitch = 4·sin(2πx)",
			track: {
				waveform: "bell",
				pitchMode: "degree",
				steps: 16,
				stepBeats: .5,
				octave: 5,
				graph: graph([
					[
						"time",
						"step",
						0,
						80
					],
					[
						"wave",
						"wave",
						260,
						40,
						{
							shape: "sine",
							cycles: 1,
							amp: 4,
							offset: 0
						}
					],
					[
						"vel",
						"number",
						260,
						260,
						{ value: .7 }
					],
					[
						"out",
						"output",
						OUT_X,
						100
					]
				], [
					[
						"time",
						"x",
						"wave",
						"p"
					],
					[
						"wave",
						"out",
						"out",
						"pitch"
					],
					[
						"vel",
						"out",
						"out",
						"velocity"
					]
				])
			}
		},
		{
			id: "fib",
			name: "Fibonacci Spiral",
			description: "Fibonacci numbers folded into the scale with a Euclidean pulse.",
			formula: "pitch = fib(n) mod 7 · gate = E(5,8)",
			track: {
				waveform: "pluck",
				pitchMode: "degree",
				steps: 32,
				stepBeats: .25,
				octave: 4,
				graph: graph([
					[
						"time",
						"step",
						0,
						100
					],
					[
						"fib",
						"series",
						260,
						20,
						{
							kind: "fib",
							p: 0,
							modulo: 7
						}
					],
					[
						"eu",
						"euclid",
						260,
						230,
						{
							pulses: 5,
							length: 8,
							rotate: 0
						}
					],
					[
						"vel",
						"math",
						460,
						250,
						{
							op: "mul",
							b: .8
						}
					],
					[
						"out",
						"output",
						OUT_X,
						100
					]
				], [
					[
						"time",
						"n",
						"fib",
						"n"
					],
					[
						"time",
						"n",
						"eu",
						"n"
					],
					[
						"fib",
						"out",
						"out",
						"pitch"
					],
					[
						"eu",
						"out",
						"vel",
						"a"
					],
					[
						"vel",
						"out",
						"out",
						"velocity"
					]
				])
			}
		},
		{
			id: "chaos",
			name: "Chaos Bloom",
			description: "The logistic map at r = 3.7 — order dissolving into chaos.",
			formula: "xₙ₊₁ = r·xₙ(1 − xₙ)",
			track: {
				waveform: "flute",
				pitchMode: "degree",
				steps: 24,
				stepBeats: .5,
				octave: 4,
				attack: .08,
				release: .6,
				graph: graph([
					[
						"time",
						"step",
						0,
						80
					],
					[
						"log",
						"series",
						240,
						20,
						{
							kind: "logistic",
							p: 3.7,
							modulo: 0
						}
					],
					[
						"map",
						"map",
						460,
						20,
						{
							inMin: 0,
							inMax: 1,
							outMin: 0,
							outMax: 10,
							clamp: true
						}
					],
					[
						"vel",
						"expr",
						240,
						260,
						{ formula: "0.35 + 0.5 * noise(n * 0.4)" }
					],
					[
						"out",
						"output",
						700,
						140
					]
				], [
					[
						"time",
						"n",
						"log",
						"n"
					],
					[
						"log",
						"out",
						"map",
						"v"
					],
					[
						"map",
						"out",
						"out",
						"pitch"
					],
					[
						"vel",
						"out",
						"out",
						"velocity"
					]
				])
			}
		},
		{
			id: "golden",
			name: "Golden Rain",
			description: "Each drop lands at n·φ — never repeating, always balanced.",
			formula: "pitch = 12·fract(n·φ)",
			track: {
				waveform: "bell",
				pitchMode: "degree",
				steps: 21,
				stepBeats: .375,
				octave: 4,
				graph: graph([
					[
						"time",
						"step",
						0,
						80
					],
					[
						"phi",
						"expr",
						260,
						20,
						{ formula: "floor(12 * fract(n * phi))" }
					],
					[
						"ch",
						"chance",
						260,
						220,
						{
							p: .75,
							seed: 3
						}
					],
					[
						"vel",
						"expr",
						460,
						220,
						{ formula: "a * (0.4 + 0.5 * rand(n, 9))" }
					],
					[
						"out",
						"output",
						680,
						100
					]
				], [
					[
						"phi",
						"out",
						"out",
						"pitch"
					],
					[
						"ch",
						"out",
						"vel",
						"a"
					],
					[
						"vel",
						"out",
						"out",
						"velocity"
					]
				])
			}
		},
		{
			id: "pi",
			name: "Digits of π",
			description: "π read one digit at a time, played on the scale.",
			formula: "pitch = πₙ",
			track: {
				waveform: "triangle",
				pitchMode: "degree",
				steps: 32,
				stepBeats: .25,
				octave: 4,
				graph: graph([
					[
						"time",
						"step",
						0,
						80
					],
					[
						"pi",
						"series",
						260,
						20,
						{
							kind: "pi",
							p: 0,
							modulo: 0
						}
					],
					[
						"eu",
						"euclid",
						260,
						240,
						{
							pulses: 7,
							length: 12,
							rotate: 2
						}
					],
					[
						"out",
						"output",
						OUT_X,
						100
					]
				], [
					[
						"time",
						"n",
						"pi",
						"n"
					],
					[
						"time",
						"n",
						"eu",
						"n"
					],
					[
						"pi",
						"out",
						"out",
						"pitch"
					],
					[
						"eu",
						"out",
						"out",
						"velocity"
					]
				])
			}
		},
		{
			id: "collatz",
			name: "Collatz Path",
			description: "How many steps each number takes to fall back to 1.",
			formula: "pitch = collatz(n) mod 12",
			track: {
				waveform: "square",
				pitchMode: "semitone",
				steps: 16,
				stepBeats: .25,
				octave: 4,
				volume: .6,
				graph: graph([
					[
						"time",
						"step",
						0,
						80
					],
					[
						"col",
						"series",
						260,
						40,
						{
							kind: "collatz",
							p: 0,
							modulo: 12
						}
					],
					[
						"vel",
						"expr",
						260,
						250,
						{ formula: "n % 4 == 0 ? 0.9 : 0.55" }
					],
					[
						"out",
						"output",
						OUT_X,
						100
					]
				], [
					[
						"time",
						"n",
						"col",
						"n"
					],
					[
						"col",
						"out",
						"out",
						"pitch"
					],
					[
						"vel",
						"out",
						"out",
						"velocity"
					]
				])
			}
		},
		{
			id: "lissajous",
			name: "Lissajous",
			description: "Two sines at 3:2 interfere into a looping figure.",
			formula: "pitch = 3·sin(3τx) + 2·cos(2τx)",
			track: {
				waveform: "sine",
				pitchMode: "degree",
				steps: 32,
				stepBeats: .25,
				octave: 5,
				graph: graph([
					[
						"time",
						"step",
						0,
						80
					],
					[
						"f",
						"expr",
						260,
						60,
						{ formula: "3*sin(3*tau*x) + 2*cos(2*tau*x)" }
					],
					[
						"len",
						"number",
						260,
						260,
						{ value: .8 }
					],
					[
						"out",
						"output",
						OUT_X,
						100
					]
				], [[
					"f",
					"out",
					"out",
					"pitch"
				], [
					"len",
					"out",
					"out",
					"length"
				]])
			}
		},
		{
			id: "bass",
			name: "Breathing Bass",
			description: "A slow triangle wave, deep and long.",
			formula: "pitch = 2·tri(x/2)",
			track: {
				waveform: "pad",
				pitchMode: "degree",
				steps: 8,
				stepBeats: 1,
				octave: 2,
				volume: .7,
				attack: .3,
				release: 1.2,
				graph: graph([
					[
						"time",
						"step",
						0,
						80
					],
					[
						"wave",
						"wave",
						260,
						40,
						{
							shape: "triangle",
							cycles: .5,
							amp: 2,
							offset: 0
						}
					],
					[
						"len",
						"number",
						260,
						270,
						{ value: 2 }
					],
					[
						"eu",
						"euclid",
						260,
						400,
						{
							pulses: 1,
							length: 2,
							rotate: 0
						}
					],
					[
						"out",
						"output",
						OUT_X,
						140
					]
				], [
					[
						"time",
						"x",
						"wave",
						"p"
					],
					[
						"time",
						"n",
						"eu",
						"n"
					],
					[
						"wave",
						"out",
						"out",
						"pitch"
					],
					[
						"len",
						"out",
						"out",
						"length"
					],
					[
						"eu",
						"out",
						"out",
						"velocity"
					]
				])
			}
		},
		{
			id: "evolve",
			name: "Evolving Tide",
			description: "Uses the loop counter k — the melody shifts every pass.",
			formula: "pitch = 3·sin(τx + k/2) + (k mod 3)",
			track: {
				waveform: "sawtooth",
				pitchMode: "degree",
				steps: 16,
				stepBeats: .25,
				octave: 4,
				volume: .55,
				graph: graph([
					[
						"time",
						"step",
						0,
						80
					],
					[
						"f",
						"expr",
						260,
						40,
						{ formula: "3*sin(tau*x + k/2) + (k % 3)" }
					],
					[
						"vel",
						"expr",
						260,
						240,
						{ formula: "0.3 + 0.6 * abs(saw(x * 2))" }
					],
					[
						"out",
						"output",
						OUT_X,
						100
					]
				], [[
					"f",
					"out",
					"out",
					"pitch"
				], [
					"vel",
					"out",
					"out",
					"velocity"
				]])
			}
		},
		{
			id: "theremin",
			name: "Theremin",
			description: "Glide mode: the pitch follows the curve continuously, with vibrato — no notes at all.",
			formula: "y = 7·sin(2πx) + 0.3·sin(48πx)",
			track: {
				waveform: "sine",
				pitchMode: "semitone",
				playMode: "glide",
				quantize: false,
				glide: .02,
				steps: 16,
				stepBeats: .5,
				octave: 5,
				attack: .2,
				release: .5,
				graph: wire({
					f: ["expr", { formula: "7*sin(tau*x) + 0.3*sin(24*tau*x)" }],
					v: ["expr", { formula: "0.5 + 0.35*sin(tau*x*2)^2" }],
					out: ["output"]
				}, ["f.out>out.pitch", "v.out>out.velocity"])
			}
		},
		{
			id: "desmos",
			name: "Graphed Arpeggios",
			description: "A y = f(x) melody written for a graphing calculator: x is time in beats, y is pitch in octaves. VI–VII–V–i minor arpeggios, octave-drop bass, and a falling e^(−12·frac 4x) hook on every note.",
			formula: "y = ⌊(12d + 2)/7⌋/12 + e^(−12 frac 4x)/6",
			track: {
				waveform: "triangle",
				pitchMode: "semitone",
				playMode: "glide",
				quantize: false,
				glide: .004,
				steps: 32,
				stepBeats: .25,
				octave: 4,
				attack: .004,
				release: .06,
				volume: .7,
				send: .5,
				graph: wire({
					y: ["expr", { formula: "floor((12 * ((3*floor(t/2) + 2*(floor(4t) % 4) + (floor(4t) % 8 == 4) + 5) % 7) + 2) / 7) / 12 - (floor(4t) % 8 == 0) + (floor(t/2) == 2) * (floor(4t) % 4 == 1) / 12 + exp(-12 * fract(4t)) / 6" }],
					semitones: ["math", {
						op: "mul",
						b: 12
					}],
					gate: ["expr", { formula: "fract(4t) < 0.85 ? 0.8 : 0" }],
					out: ["output"]
				}, [
					"y.out>semitones.a",
					"semitones.out>out.pitch",
					"gate.out>out.velocity"
				])
			}
		},
		{
			id: "zap",
			name: "Kick, Zap & Hook",
			description: "A three-case piecewise function in x (beats), y (octaves): a falling kick on each beat, a 1.6-octave zap on every third 16th, and an octave-down hook between. Repeats every 84 sixteenths.",
			formula: "y = −2 + 3e^(−20 frac x) | 3/5 + round(12(⌊4x⌋ mod 7)/7)/12 − 8/5 frac 4x | −1 + e^(−12 frac 4x)/6",
			track: {
				waveform: "triangle",
				pitchMode: "semitone",
				playMode: "glide",
				quantize: false,
				glide: .003,
				steps: 84,
				stepBeats: .25,
				octave: 4,
				attack: .003,
				release: .05,
				volume: .7,
				send: .35,
				graph: wire({
					y: ["expr", { formula: "fract(t) < 0.25 ? -2 + 3 * exp(-20 * fract(t)) : floor(4t) % 3 == 0 ? 3/5 + round(12 * (floor(4t) % 7) / 7) / 12 - 8/5 * fract(4t) : -1 + exp(-12 * fract(4t)) / 6" }],
					semitones: ["math", {
						op: "mul",
						b: 12
					}],
					gate: ["expr", { formula: "0.8 * (fract(t) < 0.25 || floor(4t) % 3 == 0 || fract(4t) < 0.8)" }],
					out: ["output"]
				}, [
					"y.out>semitones.a",
					"semitones.out>out.pitch",
					"gate.out>out.velocity"
				])
			}
		},
		{
			id: "lorenzGlide",
			name: "Lorenz Glide",
			description: "A strange attractor sliding between scale notes with portamento.",
			formula: "dx/dt = σ(y − x) …",
			track: {
				waveform: "flute",
				pitchMode: "degree",
				playMode: "glide",
				quantize: true,
				glide: .12,
				steps: 32,
				stepBeats: .25,
				octave: 4,
				graph: wire({
					time: ["step"],
					lz: ["series", {
						kind: "lorenz",
						modulo: 0
					}],
					map: ["map", {
						inMin: -1,
						inMax: 1,
						outMin: -3,
						outMax: 9
					}],
					v: ["expr", { formula: "0.75 * smoothstep(0, 0.15, fract(x*4)) " }],
					out: ["output"]
				}, [
					"time.n>lz.n",
					"lz.out>map.v",
					"map.out>out.pitch",
					"v.out>out.velocity"
				])
			}
		},
		{
			id: "recaman",
			name: "Recamán’s Ladder",
			description: "Step back if you can, forward if you must — a famous self-avoiding walk.",
			formula: "aₙ = aₙ₋₁ − n or + n",
			track: {
				waveform: "pluck",
				pitchMode: "degree",
				steps: 32,
				stepBeats: .25,
				octave: 4,
				graph: wire({
					time: ["step"],
					r: ["series", {
						kind: "recaman",
						modulo: 14
					}],
					eu: ["euclid", {
						pulses: 11,
						length: 16
					}],
					v: ["expr", { formula: "a * (0.5 + 0.4 * rand(n, 2))" }],
					out: ["output"]
				}, [
					"time.n>r.n",
					"r.out>out.pitch",
					"time.n>eu.n",
					"eu.out>v.a",
					"v.out>out.velocity"
				])
			}
		},
		{
			id: "sierpinski",
			name: "Sierpiński Bells",
			description: "Bitwise AND draws a fractal triangle; here it rings bells. Changes each loop.",
			formula: "gate = (n AND k+3) == 0",
			track: {
				waveform: "bell",
				pitchMode: "degree",
				steps: 16,
				stepBeats: .25,
				octave: 5,
				graph: wire({
					p: ["expr", { formula: "bit(n,0) + 2*bit(n,2) + 3*bit(n,3)" }],
					v: ["expr", { formula: "band(n, k + 3) == 0 ? 0.8 : 0" }],
					out: ["output"]
				}, ["p.out>out.pitch", "v.out>out.velocity"])
			}
		},
		{
			id: "wavetable",
			name: "Wavefolder",
			description: "The sound itself is a function: f(p) = sin(2πp + 2·sin(2πp)). Edit it in Channel → Voice.",
			formula: "timbre = sin(τp + 2 sin τp)",
			track: {
				waveform: "custom",
				timbre: "sin(tau*p + 2*sin(tau*p))",
				pitchMode: "degree",
				steps: 16,
				stepBeats: .25,
				octave: 3,
				graph: wire({
					p: ["expr", { formula: "h + pick(floor(n / 2), 0, 2, 4, 2, 5, 4, 2, 1)" }],
					v: ["expr", { formula: "euclid(n, 11, 16) * (0.55 + 0.45 * every(n, 4))" }],
					out: ["output"]
				}, ["p.out>out.pitch", "v.out>out.velocity"])
			}
		},
		{
			id: "form",
			name: "Song Form",
			description: "The Sections node: verse, verse, chorus, bridge — each section its own function, switched by time.",
			formula: "A 8 · A 8 · B 8 · C 8 beats",
			track: {
				waveform: "pluck",
				pitchMode: "degree",
				steps: 16,
				stepBeats: .25,
				octave: 4,
				volume: .55,
				send: .5,
				graph: wire({
					verse: ["expr", { formula: "h + pick(n, 0, 2, 4, 2)" }],
					chorus: ["expr", { formula: "h + L + pick(n, 4, 2, 0, 2, 4, 5)" }],
					bridge: ["expr", { formula: "h + round(3 * sin(tau * x * 2))" }],
					form: ["sections", {
						lengths: "8 8 8 8",
						unit: "beats"
					}],
					gate: ["expr", { formula: "a == 2 ? 0.8 : 0.6 * euclid(n, 5, 8) + 0.2" }],
					out: ["output"]
				}, [
					"verse.out>form.A",
					"verse.out>form.B",
					"chorus.out>form.C",
					"bridge.out>form.D",
					"form.out>out.pitch",
					"form.section>gate.a",
					"gate.out>out.velocity"
				])
			}
		},
		{
			id: "chordPad",
			name: "Chord Pad",
			description: "Holds the song’s current chord: pitch = h, chord = 4 stacks four scale-thirds (a 7th chord).",
			formula: "pitch = h · chord = 4",
			track: {
				waveform: "pad",
				pitchMode: "degree",
				steps: 16,
				stepBeats: .25,
				octave: 3,
				attack: .4,
				release: 1.6,
				send: .9,
				volume: .55,
				graph: wire({
					p: ["expr", { formula: "h" }],
					v: ["expr", { formula: "0.55 * every(n, 16)" }],
					chord: ["number", {
						value: 4,
						min: 1,
						max: 8
					}],
					length: ["number", {
						value: 16,
						min: 0,
						max: 32
					}],
					out: ["output"]
				}, [
					"p.out>out.pitch",
					"v.out>out.velocity",
					"chord.out>out.chord",
					"length.out>out.length"
				])
			}
		},
		{
			id: "strum",
			name: "Koto Strum",
			description: "Strummed triads on the progression; inversions rotate every beat so the top voice moves.",
			formula: "inversion = ⌊n/4⌋ mod 3",
			track: {
				waveform: "pluck",
				pitchMode: "degree",
				steps: 16,
				stepBeats: .25,
				octave: 4,
				volume: .55,
				send: .6,
				graph: wire({
					p: ["expr", { formula: "h" }],
					v: ["expr", { formula: "0.75 * euclid(n, 5, 16)" }],
					chord: ["number", {
						value: 3,
						min: 1,
						max: 8
					}],
					inv: ["expr", { formula: "floor(n / 4) % 3" }],
					strum: ["number", {
						value: .08,
						min: -.5,
						max: .5
					}],
					out: ["output"]
				}, [
					"p.out>out.pitch",
					"v.out>out.velocity",
					"chord.out>out.chord",
					"inv.out>out.inversion",
					"strum.out>out.strum"
				])
			}
		},
		{
			id: "arp",
			name: "Arpeggiator",
			description: "Walks up and down the current chord: h + 0, 2, 4 (root, third, fifth) and L (the octave).",
			formula: "pitch = h + pick(n, 0, 2, 4, L, 4, 2)",
			track: {
				waveform: "triangle",
				pitchMode: "degree",
				steps: 16,
				stepBeats: .25,
				octave: 4,
				volume: .5,
				graph: wire({
					p: ["expr", { formula: "h + pick(n, 0, 2, 4, L, 4, 2)" }],
					v: ["expr", { formula: "0.4 + 0.4 * every(n, 3)" }],
					out: ["output"]
				}, ["p.out>out.pitch", "v.out>out.velocity"])
			}
		},
		{
			id: "quartal",
			name: "Quartal Mist",
			description: "Chords stacked in fourths (stack = 3) instead of thirds — open, modal, very zen.",
			formula: "chord = 4 · stack = 3",
			track: {
				waveform: "flute",
				pitchMode: "degree",
				steps: 16,
				stepBeats: .5,
				octave: 4,
				attack: .2,
				release: 1,
				send: 1,
				volume: .45,
				graph: wire({
					p: ["expr", { formula: "h + round(2 * sin(tau * x))" }],
					v: ["expr", { formula: "0.5 * every(n, 4)" }],
					chord: ["number", {
						value: 4,
						min: 1,
						max: 8
					}],
					stack: ["number", {
						value: 3,
						min: 1,
						max: 7
					}],
					length: ["number", {
						value: 4,
						min: 0,
						max: 16
					}],
					out: ["output"]
				}, [
					"p.out>out.pitch",
					"v.out>out.velocity",
					"chord.out>out.chord",
					"stack.out>out.stack",
					"length.out>out.length"
				])
			}
		},
		part("walking", WALKING_BASS, "Jazz walking bass on the harmony: the root on each chord, a passing note between — quarter notes, swinging.", "pitch = root + 0 2 0 4 0 5 0 2"),
		part("rhodes", RHODES_COMP, "Voice-led seventh chords comping on swung eighths — close position, so the hand barely moves between chords.", "chord of 4 on h, voice-led"),
		part("bossaguitar", BOSSA_GUITAR, "Bossa nova guitar: voice-led seventh chords on the syncopated two-bar rhythm, strummed lightly.", "chord of 4 · bits(0x9228 / 0x2924)"),
		part("bossabass", BOSSA_BASS, "Bossa bass: the root held, the fifth anticipating beat three — the surdo’s two-step.", "pitch = root, fifth on the and-of-2"),
		part("montuno", MONTUNO, "Salsa piano montuno: chord tones in octaves, eighth notes with the offbeats leaning in.", "octaves on h + 0 4 2 4"),
		part("tumbao", TUMBAO, "Salsa tumbao: the bass anticipates — the fifth on the and-of-2, the next root on four.", "fifth on 6, root on 12"),
		part("slap", SLAP_BASS, "Funk slap bass: thumbed roots, octave pops and a flat-seven, syncopated sixteenths.", "root · pops on L · bits(0x92A6)"),
		part("clav", CLAV, "Funk clavinet: short voice-led triads on the offbeat sixteenths.", "chord of 3 · bits(0x2452)"),
		part("discobass", DISCO_BASS, "Disco octave bass: root, octave, root, octave — eighth notes that never sit still.", "root ± L, every eighth"),
		part("discostrings", DISCO_STRINGS, "Disco strings: a voice-led triad held through every bar.", "chord of 3, held"),
		part("housestabs", HOUSE_STABS, "Deep house organ stabs: minor ninth chords on a syncopated swing.", "chord of 5 · bits(0x1224)"),
		part("pumppad", PUMP_PAD, "A pad held through each bar, pumped on every beat by a pressure Curve — sidechain without a compressor.", "chord of 4 · pressure = duck(t)"),
		{
			id: "riser",
			name: "Riser",
			description: "A drawn Curve climbs two octaves — slow, then urgent — while a second one swells the volume. A build-up you can reshape by dragging.",
			formula: "pitch = 14 · bend(x, 0.6) · volume = bend(x, 0.5)",
			track: {
				waveform: "sawtooth",
				pitchMode: "degree",
				playMode: "glide",
				quantize: false,
				glide: .02,
				steps: 16,
				stepBeats: 1,
				octave: 3,
				volume: .5,
				attack: .05,
				release: .4,
				send: .6,
				graph: graph([
					[
						"time",
						"step",
						0,
						80
					],
					[
						"up",
						"curve",
						260,
						0,
						{
							points: "0:0:0.6 1:1:0",
							repeats: 1,
							lo: 0,
							hi: 14
						}
					],
					[
						"vol",
						"curve",
						260,
						300,
						{
							points: "0:0.2:0.5 1:1:0",
							repeats: 1,
							lo: 0,
							hi: .85
						}
					],
					[
						"out",
						"output",
						OUT_X,
						100
					]
				], [[
					"up",
					"out",
					"out",
					"pitch"
				], [
					"vol",
					"out",
					"out",
					"velocity"
				]])
			}
		},
		{
			id: "pump",
			name: "Pumping Pad",
			description: "A pad on the song’s chord, ducked by a Curve on every beat — the sidechain pump, drawn instead of compressed.",
			formula: "pitch = h · volume = duck curve × 4 per loop",
			track: {
				waveform: "pad",
				pitchMode: "degree",
				playMode: "glide",
				quantize: true,
				glide: .08,
				steps: 16,
				stepBeats: .25,
				octave: 4,
				volume: .6,
				attack: .02,
				release: .3,
				send: .7,
				graph: graph([
					[
						"time",
						"step",
						0,
						80
					],
					[
						"p",
						"expr",
						260,
						20,
						{ formula: "h + pick(floor(x * 2), 0, 2)" }
					],
					[
						"duck",
						"curve",
						260,
						200,
						{
							points: "0:0.1:0.7 0.9:1:0 1:0.1:0",
							repeats: 4,
							lo: 0,
							hi: .85
						}
					],
					[
						"out",
						"output",
						OUT_X,
						100
					]
				], [[
					"p",
					"out",
					"out",
					"pitch"
				], [
					"duck",
					"out",
					"out",
					"velocity"
				]])
			}
		},
		{
			id: "drawn",
			name: "Drawn Melody",
			description: "A melody drawn as one Curve — rises, dips and leaps between seven corners — read as notes on the scale. Drag a corner to rewrite it.",
			formula: "pitch = −2 + 11 · curve(x)",
			track: {
				waveform: "pluck",
				pitchMode: "degree",
				steps: 16,
				stepBeats: .25,
				octave: 4,
				volume: .7,
				send: .45,
				graph: graph([
					[
						"time",
						"step",
						0,
						80
					],
					[
						"mel",
						"curve",
						260,
						0,
						{
							points: "0:0.2:0 0.12:0.55:-0.4 0.3:0.35:0.3 0.45:0.9:-0.6 0.62:0.6:0 0.78:0.75:0.5 1:0.2:0",
							repeats: 1,
							lo: -2,
							hi: 9
						}
					],
					[
						"v",
						"expr",
						260,
						260,
						{ formula: "0.5 + 0.35 * every(n, 4) + 0.1 * every(n, 2)" }
					],
					[
						"out",
						"output",
						OUT_X,
						100
					]
				], [[
					"mel",
					"out",
					"out",
					"pitch"
				], [
					"v",
					"out",
					"out",
					"velocity"
				]])
			}
		},
		{
			id: "wobble",
			name: "Bent Wobble",
			description: "A Reese bass on the chord root, its volume cut by a bent Curve eight times a loop — the wobble, with a shape you can drag.",
			formula: "pitch = h · volume = bend(1 − u, −0.7), 8 per loop",
			track: {
				waveform: "reese",
				pitchMode: "degree",
				playMode: "glide",
				quantize: true,
				glide: .05,
				steps: 16,
				stepBeats: .25,
				octave: 2,
				volume: .7,
				release: .1,
				send: .15,
				graph: graph([
					[
						"time",
						"step",
						0,
						80
					],
					[
						"p",
						"expr",
						260,
						20,
						{ formula: "h" }
					],
					[
						"wob",
						"curve",
						260,
						200,
						{
							points: "0:1:-0.7 1:0.05:0",
							repeats: 8,
							lo: .1,
							hi: .9
						}
					],
					[
						"out",
						"output",
						OUT_X,
						100
					]
				], [[
					"p",
					"out",
					"out",
					"pitch"
				], [
					"wob",
					"out",
					"out",
					"velocity"
				]])
			}
		},
		{
			id: "scooplead",
			name: "Scooped Lead",
			description: "A lead whose every note scoops up from below — a Curve on Note Out’s bend, restarting on each note through np. Export with MPE and each note keeps its own bend.",
			formula: "pitch = 0 2 4 2 5 4 2 0 · bend = −2 + 2 · curve(np)",
			track: {
				waveform: "square",
				pitchMode: "degree",
				steps: 16,
				stepBeats: .25,
				octave: 4,
				volume: .5,
				attack: .01,
				release: .25,
				send: .4,
				graph: graph([
					[
						"time",
						"step",
						0,
						80
					],
					[
						"mel",
						"list",
						260,
						0,
						{
							values: "0 2 4 2 5 4 2 0",
							every: 2
						}
					],
					[
						"len",
						"number",
						260,
						200,
						{ value: 1.8 }
					],
					[
						"scoop",
						"curve",
						260,
						320,
						{
							points: "0:0:-0.6 0.35:1:0 1:1:0",
							repeats: 1,
							lo: -2,
							hi: 0
						}
					],
					[
						"out",
						"output",
						OUT_X,
						100
					]
				], [
					[
						"mel",
						"out",
						"out",
						"pitch"
					],
					[
						"len",
						"out",
						"out",
						"length"
					],
					[
						"time",
						"np",
						"scoop",
						"p"
					],
					[
						"scoop",
						"out",
						"out",
						"bend"
					]
				])
			}
		},
		{
			id: "slide808",
			name: "808 Slide",
			description: "Long sub notes on the chord root that hold, then dive a fifth as they end — the trap 808, drawn as a bend Curve on each note.",
			formula: "pitch = h · bend = −7 · curve(np)",
			track: {
				waveform: "sine",
				pitchMode: "degree",
				steps: 16,
				stepBeats: .25,
				octave: 2,
				volume: .85,
				attack: .005,
				release: .15,
				send: .05,
				graph: graph([
					[
						"time",
						"step",
						0,
						80
					],
					[
						"p",
						"expr",
						260,
						0,
						{ formula: "h + pick(floor(n / 8), 0, 0, 2, 4)" }
					],
					[
						"v",
						"expr",
						260,
						120,
						{ formula: "bits(0x8020, n) * 0.9" }
					],
					[
						"len",
						"number",
						260,
						240,
						{ value: 6 }
					],
					[
						"dive",
						"curve",
						260,
						340,
						{
							points: "0:1:0 0.55:1:0.5 1:0:0",
							repeats: 1,
							lo: -7,
							hi: 0
						}
					],
					[
						"out",
						"output",
						OUT_X,
						100
					]
				], [
					[
						"p",
						"out",
						"out",
						"pitch"
					],
					[
						"v",
						"out",
						"out",
						"velocity"
					],
					[
						"len",
						"out",
						"out",
						"length"
					],
					[
						"time",
						"np",
						"dive",
						"p"
					],
					[
						"dive",
						"out",
						"out",
						"bend"
					]
				])
			}
		},
		{
			id: "bloomchords",
			name: "Blooming Chords",
			description: "Chords on the harmony that swell from soft (pressure) and grow a vibrato through each chord (bend) — every note of the chord moves together; with MPE each keeps its own channel.",
			formula: "chord on h · bend = depth(np) · sin(4τt) · pressure = swell(np)",
			track: {
				waveform: "flute",
				pitchMode: "degree",
				steps: 16,
				stepBeats: .25,
				octave: 4,
				volume: .55,
				attack: .08,
				release: .8,
				send: .7,
				graph: graph([
					[
						"time",
						"step",
						0,
						80
					],
					[
						"p",
						"expr",
						260,
						0,
						{ formula: "h" }
					],
					[
						"v",
						"expr",
						260,
						100,
						{ formula: "0.7 * every(n, 8)" }
					],
					[
						"chord",
						"number",
						260,
						200,
						{ value: 3 }
					],
					[
						"len",
						"number",
						260,
						280,
						{ value: 7.5 }
					],
					[
						"depth",
						"curve",
						260,
						360,
						{
							points: "0:0:0.5 0.7:1:0 1:1:0",
							repeats: 1,
							lo: 0,
							hi: .3
						}
					],
					[
						"vib",
						"expr",
						470,
						360,
						{ formula: "a * sin(tau * 4 * t)" }
					],
					[
						"swell",
						"curve",
						260,
						560,
						{
							points: "0:0.2:0.5 0.6:1:-0.4 1:0.7:0",
							repeats: 1,
							lo: 0,
							hi: 1
						}
					],
					[
						"out",
						"output",
						OUT_X,
						100
					]
				], [
					[
						"p",
						"out",
						"out",
						"pitch"
					],
					[
						"v",
						"out",
						"out",
						"velocity"
					],
					[
						"chord",
						"out",
						"out",
						"chord"
					],
					[
						"len",
						"out",
						"out",
						"length"
					],
					[
						"time",
						"np",
						"depth",
						"p"
					],
					[
						"depth",
						"out",
						"vib",
						"a"
					],
					[
						"vib",
						"out",
						"out",
						"bend"
					],
					[
						"time",
						"np",
						"swell",
						"p"
					],
					[
						"swell",
						"out",
						"out",
						"pressure"
					]
				])
			}
		},
		{
			id: "blank",
			name: "Empty Track",
			description: "Just a clock and an output. Start from nothing.",
			formula: "pitch = ?",
			track: {
				waveform: "sine",
				pitchMode: "degree",
				steps: 16,
				stepBeats: .25,
				octave: 4,
				graph: graph([
					[
						"time",
						"step",
						0,
						80
					],
					[
						"f",
						"expr",
						260,
						60,
						{ formula: "n % 8" }
					],
					[
						"out",
						"output",
						OUT_X,
						100
					]
				], [[
					"f",
					"out",
					"out",
					"pitch"
				]])
			}
		}
	];
	/** a drum track whose velocity (and optional ratchet / tuning) are formulas of n, k, x… */
	function drum(name, waveform, steps, vel, opts = {}) {
		const { ratchet, tune, ...rest } = opts;
		const nodes = {
			vel: ["expr", { formula: vel }],
			out: ["output"]
		};
		const wires = ["vel.out>out.velocity"];
		if (ratchet) {
			nodes.rat = ["expr", { formula: ratchet }];
			wires.push("rat.out>out.ratchet");
		}
		if (tune) {
			nodes.tune = ["expr", { formula: tune }];
			wires.push("tune.out>out.pitch");
		}
		return {
			name,
			waveform,
			steps,
			stepBeats: .25,
			send: .12,
			volume: .8,
			graph: wire(nodes, wires),
			...rest
		};
	}
	/** a melodic track: pitch & velocity formulas, plus optional constants/formulas for other Note Out inputs */
	function voice(name, waveform, pitch, vel, inputs, rest) {
		const nodes = {
			pitch: ["expr", { formula: pitch }],
			vel: ["expr", { formula: vel }],
			out: ["output"]
		};
		const wires = ["pitch.out>out.pitch", "vel.out>out.velocity"];
		for (const [port, v] of Object.entries(inputs)) {
			nodes[port] = typeof v === "number" ? ["number", {
				value: v,
				min: 0,
				max: 16
			}] : ["expr", { formula: v }];
			wires.push(`${port}.out>out.${port}`);
		}
		return {
			name,
			waveform,
			steps: 16,
			stepBeats: .25,
			graph: wire(nodes, wires),
			...rest
		};
	}
	/** the four bars of the Amen break as 16-bit masks, read with bits() */
	const AMEN = {
		kick: "bits(pick(floor(n / 16), 0xA030, 0xA030, 0xA020, 0x3020), n)",
		snare: "bits(pick(floor(n / 16), 0x0808, 0x0808, 0x0802, 0x0802), n) + 0.4 * bits(pick(floor(n / 16), 0x0141, 0x0141, 0x4140, 0x4140), n)"
	};
	/** the boom-bap kick: two bars as 16-bit masks — the second answers the first */
	const BOOM_KICK = "bits(pick(floor(n / 16), 0x8120, 0x9024), n)";
	const KITS = [
		{
			id: "jazz",
			name: "Smoky Club",
			description: "132 bpm swing in B♭ over Rhythm changes, two chords a bar. Ride with the skip beat, feathered kick and brushes, a walking bass that lands on every root, voice-led Rhodes comping and a sax that wanders the chord tones.",
			song: {
				bpm: 132,
				root: 10,
				scale: "major",
				harmony: "pick(floor(beat / 2), 0, 5, 1, 4, 2, 5, 1, 4, 0, 3, 2, 5, 1, 4, 0, 0)"
			},
			tracks: [
				drum("Ride", "hat", 16, "pick(n % 8, 0.75, 0, 0.6, 0.5, 0.75, 0, 0.6, 0.5) * (0.9 + 0.1 * rand(n + 16k, 2))", {
					stepBeats: .5,
					swing: .33,
					volume: .55,
					send: .35
				}),
				drum("Hi-hat foot", "hat", 16, "0.35 * (n % 4 == 2)", {
					stepBeats: .5,
					swing: .33,
					volume: .4
				}),
				drum("Kick", "kick", 16, "0.22 * every(n, 2) + 0.35 * (n % 16 == 15)", {
					stepBeats: .5,
					swing: .33,
					volume: .6
				}),
				drum("Brushes", "snare", 16, "0.18 * chance(n + 16k, 0.3, 4) * (n % 2) + 0.45 * (n % 16 == 11) * (k % 2)", {
					stepBeats: .5,
					swing: .33,
					volume: .5,
					send: .3
				}),
				WALKING_BASS,
				RHODES_COMP,
				voice("Sax", "flute", "h + 2 * floor(4 * noise(n * 0.37 + k * 3, 5))", "chance(n + 16k, 0.6, 11) * (0.4 + 0.2 * (n % 2 == 0))", { length: .9 }, {
					stepBeats: .5,
					steps: 16,
					octave: 5,
					swing: .33,
					volume: .45,
					send: .5,
					attack: .03
				})
			]
		},
		{
			id: "bossa",
			name: "Ipanema Dusk",
			description: "130 bpm bossa nova in D: the rim-shot clave, a surdo kick, shaker, the root-and-fifth bass, voice-led nylon guitar on the syncopated two-bar rhythm, and a flute line over I–ii–V–iii–vi.",
			song: {
				bpm: 130,
				root: 2,
				scale: "major",
				harmony: "pick(bar, 0, 0, 1, 4, 2, 5, 1, 4)"
			},
			tracks: [
				drum("Clave (rim)", "rim", 32, "0.6 * bits(pick(floor(n / 16), 0x9224, 0x2240), n)", {
					volume: .6,
					send: .2
				}),
				drum("Surdo", "kick", 32, "0.7 * bits(0x8080, n) + 0.4 * bits(0x1010, n)", { volume: .75 }),
				drum("Shaker", "hat", 32, "0.18 + 0.14 * every(n, 2, 1) + 0.05 * rand(n + 32k, 3)", {
					volume: .4,
					swing: .06
				}),
				BOSSA_BASS,
				BOSSA_GUITAR,
				voice("Flute", "flute", "h + pick(floor(n / 4) % 8, 4, 2, 4, 6, 7, 6, 4, 2)", "0.5 * bits(0x8888, n) * chance(floor(n / 4) + 8k, 0.7, 5)", { length: 3.6 }, {
					steps: 32,
					octave: 5,
					volume: .45,
					send: .6,
					attack: .04
				})
			]
		},
		{
			id: "salsa",
			name: "Montuno",
			description: "96 bpm salsa in A harmonic minor, i–iv–V–iv a bar each. 2-3 son clave, tumbao congas and campana, the bombo, a tumbao bass (the fifth on the and-of-2, the root on four), the piano montuno in octaves and horn hits to close each phrase.",
			song: {
				bpm: 96,
				root: 9,
				scale: "harmonicMinor",
				harmony: "pick(bar, 0, 3, 4, 3)"
			},
			tracks: [
				drum("Clave 2-3", "rim", 32, "0.7 * bits(pick(floor(n / 16), 0x0880, 0x8208), n)", {
					volume: .6,
					send: .15
				}),
				drum("Congas", "tom", 32, "bits(0x2323, n) * (0.55 + 0.25 * (n % 16 == 2 || n % 16 == 10))", {
					tune: "(n % 16 == 2 || n % 16 == 10) ? 14 : 9",
					volume: .6
				}),
				drum("Campana", "tom", 32, "every(n, 4) * (0.35 + 0.2 * every(n, 8))", {
					tune: "22",
					volume: .35
				}),
				drum("Bombo", "kick", 32, "0.6 * (n % 16 == 6) + 0.3 * (n % 16 == 12)", { volume: .7 }),
				TUMBAO,
				MONTUNO,
				voice("Horns", "sawtooth", voicedPitch(3), "0.55 * bits(pick(floor(n / 16), 0, 0x0012), n)", {
					chord: 3,
					inversion: voicedInversion(3),
					length: 1
				}, {
					steps: 32,
					octave: 4,
					attack: .02,
					release: .2,
					volume: .45,
					send: .35
				})
			]
		},
		{
			id: "funk",
			name: "Get Down",
			description: "104 bpm funk in E dorian: a syncopated kick, backbeat with ghost notes, sixteenth hats and an open hat, slap bass with octave pops, clavinet on the offbeats, and horn stabs — i7 for a while, then IV7, then the turn.",
			song: {
				bpm: 104,
				root: 4,
				scale: "dorian",
				harmony: "pick(bar, 0, 0, 3, 3, 0, 0, 6, 3)"
			},
			tracks: [
				drum("Kick", "kick", 32, "0.95 * bits(pick(floor(n / 16), 0x8220, 0x9092), n)", { volume: .9 }),
				drum("Snare", "snare", 32, "max(every(n, 8, 4), 0.2 * bits(0x0542, n))", { send: .15 }),
				drum("Hats", "hat", 32, "(0.3 + 0.35 * every(n, 2)) * (n % 16 != 14) * (0.9 + 0.1 * rand(n + 32k, 2))", { volume: .5 }),
				drum("Open hat", "openhat", 32, "0.45 * (n % 16 == 14)", { volume: .45 }),
				SLAP_BASS,
				CLAV,
				voice("Horns", "sawtooth", `${voicedPitch(3)} + L`, "0.55 * bits(pick(floor(n / 16), 0, 0x000A), n)", {
					chord: 3,
					inversion: voicedInversion(3),
					length: 1
				}, {
					steps: 32,
					octave: 4,
					attack: .015,
					release: .15,
					volume: .42,
					send: .3
				})
			]
		},
		{
			id: "disco",
			name: "Mirror Ball",
			description: "120 bpm disco in A minor, an eight-bar loop that goes all the way round: four-on-the-floor, claps, open hats on the offbeat, the octave bass, held strings and chicken-scratch guitar.",
			song: {
				bpm: 120,
				root: 9,
				scale: "minor",
				harmony: "pick(bar, 0, 3, 6, 2, 5, 3, 4, 4)"
			},
			tracks: [
				drum("Kick", "kick", 16, "every(n, 4)", { volume: .9 }),
				drum("Clap", "clap", 16, "0.7 * every(n, 8, 4)", { send: .25 }),
				drum("Open hat", "openhat", 16, "0.5 * every(n, 4, 2)", { volume: .5 }),
				drum("Hats", "hat", 16, "0.2 * (n % 4 != 2) + 0.06 * rand(n + 16k, 4)", { volume: .4 }),
				DISCO_BASS,
				DISCO_STRINGS,
				voice("Guitar", "pluck", `${voicedPitch(3)} + L`, "0.45 * (n % 4 == 2) + 0.15 * (n % 2)", {
					chord: 2,
					length: .5
				}, {
					steps: 16,
					octave: 4,
					release: .05,
					volume: .35,
					swing: .05
				})
			]
		},
		{
			id: "deephouse",
			name: "Deep Hours",
			description: "122 bpm deep house in D minor, i–VII–VI–VII (Dm–C–B♭–C): kick on every beat, swung claps and hats, an offbeat sub, ninth-chord organ stabs, and a pad pumped on every beat by a pressure Curve.",
			song: {
				bpm: 122,
				root: 2,
				scale: "minor",
				harmony: "pick(bar, 0, 6, 5, 6)"
			},
			tracks: [
				drum("Kick", "kick", 16, "every(n, 4)", { volume: .9 }),
				drum("Clap", "clap", 16, "0.6 * every(n, 8, 4)", {
					swing: .08,
					send: .3
				}),
				drum("Hats", "hat", 16, "0.25 + 0.2 * every(n, 4, 2) + 0.08 * rand(n + 16k, 6)", {
					swing: .12,
					volume: .45
				}),
				drum("Open hat", "openhat", 16, "0.4 * every(n, 4, 2)", {
					swing: .12,
					volume: .4
				}),
				HOUSE_SUB,
				HOUSE_STABS,
				PUMP_PAD
			]
		},
		{
			id: "boombap",
			name: "Boom Bap",
			description: "90 bpm, head-nod hip-hop. A kick that skips around the backbeat, a fat snare with ghost notes, lazy swung hats, a sub that lands with the kick, and dusty 7th chords on the harmony — the keys breathe with a sidechain Curve.",
			song: {
				bpm: 90,
				root: 9,
				scale: "minor",
				harmony: "pick(bar, 0, 5, 3, 4)"
			},
			tracks: [
				drum("Kick", "kick", 32, `${BOOM_KICK} * (0.88 + 0.1 * rand(n + 32k, 3))`, {
					volume: .95,
					swing: .1
				}),
				drum("Snare", "snare", 32, "max(every(n, 8, 4), 0.28 * bits(pick(floor(n / 16), 0x0001, 0x0101), n))", {
					volume: .85,
					send: .22,
					swing: .1
				}),
				drum("Hats", "hat", 32, "every(n, 2) * (0.45 + 0.3 * every(n, 4) + 0.12 * rand(n + 32k, 5))", {
					swing: .16,
					volume: .5
				}),
				drum("Open hat", "openhat", 32, "n % 32 == 30 ? 0.42 : 0", {
					swing: .16,
					volume: .45
				}),
				voice("Sub", "sine", "h", `0.85 * ${BOOM_KICK}`, { length: 3 }, {
					octave: 2,
					steps: 32,
					volume: .75,
					attack: .005,
					release: .18,
					swing: .1,
					send: .05
				}),
				{
					name: "Keys",
					waveform: "bell",
					steps: 32,
					stepBeats: .25,
					octave: 4,
					volume: .5,
					send: .6,
					swing: .16,
					attack: .01,
					release: .9,
					graph: wire({
						pitch: ["expr", { formula: "h" }],
						hit: ["expr", { formula: "bits(pick(floor(n / 16), 0x8202, 0x8020), n)" }],
						duck: ["curve", {
							points: "0:0.5:0.6 0.9:1:0 1:0.5:0",
							repeats: 8,
							lo: 0,
							hi: .7
						}],
						v: ["math", { op: "mul" }],
						chord: ["number", {
							value: 4,
							min: 1,
							max: 8
						}],
						length: ["number", {
							value: 6,
							min: 0,
							max: 16
						}],
						strum: ["number", {
							value: .04,
							min: -.5,
							max: .5
						}],
						out: ["output"]
					}, [
						"pitch.out>out.pitch",
						"hit.out>v.a",
						"duck.out>v.b",
						"v.out>out.velocity",
						"chord.out>out.chord",
						"length.out>out.length",
						"strum.out>out.strum"
					])
				}
			]
		},
		{
			id: "dnb",
			name: "Two-Step DnB",
			description: "174 bpm, liquid. Two-step kick & backbeat from every(), random ghost snares, a roll every 4th bar, a pumping Reese and 7th-chord pads following the harmony.",
			song: {
				bpm: 174,
				root: 5,
				scale: "minor",
				harmony: "pick(floor(bar / 2), 0, 5, 3, 4)"
			},
			tracks: [
				drum("Kick", "kick", 32, "every(n, 16) + 0.9 * every(n, 16, 10) + 0.7 * every(n, 32, 29) * (k % 2)", { volume: .95 }),
				drum("Snare", "snare", 32, "n >= 28 && k % 4 == 3 ? 0.4 + (n - 28) * 0.15 : max(every(n, 8, 4), 0.3 * chance(n + 32k, 0.16, 7) * (1 - every(n, 2)))", { ratchet: "n >= 28 && k % 4 == 3 ? 4 : 1" }),
				drum("Hats", "hat", 16, "0.4 + 0.4 * every(n, 4, 2) + 0.15 * rand(n + 16k, 7)", {
					swing: .08,
					volume: .55
				}),
				drum("Crash", "crash", 32, "n == 0 && k % 4 == 0 ? 0.5 : 0", {
					send: .5,
					volume: .5
				}),
				voice("Reese", "reese", "h", "0.2 + 0.7 * smoothstep(0, 0.7, phase(x * steps, 4))", {}, {
					playMode: "glide",
					quantize: true,
					glide: .06,
					octave: 2,
					steps: 32,
					send: .1,
					volume: .7,
					release: .1
				}),
				voice("Pads", "pad", "h", "0.45 * every(n, 32)", {
					chord: 4,
					length: 32
				}, {
					octave: 3,
					steps: 32,
					send: .9,
					volume: .45,
					attack: .4,
					release: 1.5
				})
			]
		},
		{
			id: "amen",
			name: "Amen Break",
			description: "170 bpm. The most sampled break in history as four hex numbers per drum — bits(0xA030, n) is bar one of the kick.",
			song: {
				bpm: 170,
				root: 9,
				scale: "minor",
				harmony: "pick(bar, 0, 0, 5, 3)"
			},
			tracks: [
				drum("Kick", "kick", 64, AMEN.kick),
				drum("Snare", "snare", 64, AMEN.snare),
				drum("Ride", "hat", 16, "every(n, 2) * (0.5 + 0.3 * bit(n, 2))", { volume: .55 }),
				drum("Crash", "crash", 64, "every(n, 64, 58) * 0.6", {
					volume: .45,
					send: .4
				}),
				voice("Sub", "sine", "h", "phase(n, 16) < 0.85 ? 0.8 : 0", {}, {
					playMode: "glide",
					quantize: true,
					glide: .05,
					octave: 2,
					steps: 64,
					send: 0,
					volume: .8,
					release: .08
				})
			]
		},
		{
			id: "jungle",
			name: "Jungle Roller",
			description: "172 bpm, generative. Euclidean kicks, chance ghost snares that roll, noisy hats, a Lorenz-driven bass — never the same bar twice.",
			song: {
				bpm: 172,
				root: 7,
				scale: "dorian",
				harmony: "pick(bar, 0, 0, 3, 4)"
			},
			tracks: [
				drum("Kick", "kick", 16, "euclid(n, 3, 16)"),
				drum("Snare", "snare", 16, "max(every(n, 8, 4), chance(n + 16k, 0.22, 5) * (0.2 + 0.2 * rand(n, 1)))", { ratchet: "every(n, 8, 4) == 0 && rand(n + 16k, 9) > 0.8 ? pick(n, 2, 3) : 1" }),
				drum("Hats", "hat", 16, "0.35 + 0.45 * noise(n * 0.7 + 3k)", {
					ratchet: "rand(n + 16k, 11) > 0.9 ? 3 : 1",
					tune: "4 * rand(n, 2) - 2",
					volume: .5,
					swing: .1
				}),
				voice("Lorenz Bass", "reese", "h + floor(3 * lorenz(floor(n / 4) + 4k))", "0.25 + 0.6 * smoothstep(0, 0.6, phase(x * steps, 4))", {}, {
					playMode: "glide",
					quantize: true,
					glide: .09,
					octave: 2,
					send: .1,
					volume: .7,
					release: .1
				}),
				voice("Recamán Pluck", "pluck", "h + recaman(n) % 8", "euclid(n, 5, 16, 3)", {}, {
					octave: 5,
					steps: 32,
					volume: .4,
					send: .6,
					pan: -.3
				})
			]
		},
		{
			id: "house",
			name: "Four on the Floor",
			description: "124 bpm house: every(n, 4) kick, clap on 2 & 4, offbeat hats, a Euclidean bassline and chord stabs on the progression.",
			song: {
				bpm: 124,
				root: 0,
				scale: "minor",
				harmony: "pick(bar, 0, 5, 3, 4)"
			},
			tracks: [
				drum("Kick", "kick", 16, "every(n, 4)"),
				drum("Clap", "clap", 16, "every(n, 8, 4)", { send: .3 }),
				drum("Open Hat", "openhat", 16, "0.7 * every(n, 4, 2)", { volume: .5 }),
				drum("Closed Hat", "hat", 16, "every(n, 2) * (0.5 + 0.3 * rand(n, 4)) + 0.5 * every(n, 16, 15)", {
					volume: .45,
					swing: .12
				}),
				voice("Bassline", "reese", "h + pick(n, 0, 0, 0, 0, 2, 0, 0, -1)", "euclid(n, 7, 16, 2)", { length: .6 }, {
					octave: 2,
					volume: .6,
					send: .05
				}),
				voice("Stabs", "pluck", "h", "0.6 * every(n, 8, 3) + 0.45 * every(n, 16, 14)", {
					chord: 3,
					length: .5,
					inversion: 1
				}, {
					octave: 4,
					volume: .45,
					send: .5
				})
			]
		},
		{
			id: "trap",
			name: "Trap Rolls",
			description: "140 bpm half-time: hex-mask kicks, a clap on 3, hi-hat ratchets that rise in pitch, and a sliding 808 on the chord root.",
			song: {
				bpm: 140,
				root: 1,
				scale: "minor",
				harmony: "pick(floor(bar / 2), 0, 5)"
			},
			tracks: [
				drum("Kick", "kick", 32, "bits(pick(floor(n / 16), 0x8120, 0x80A0), n)"),
				drum("Clap", "clap", 16, "every(n, 16, 8)", { send: .35 }),
				drum("Hats", "hat", 16, "0.4 + 0.3 * rand(n, 6) + 0.2 * bit(n, 1)", {
					ratchet: "pick(n + 16 * (k % 2), 1,1,1,1, 1,1,2,1, 1,1,1,1, 3,1,4,2, 1,1,1,1, 1,1,1,1, 2,2,1,1, 6,1,3,1)",
					tune: "n >= 12 ? (n - 12) * 2 : 0",
					volume: .5
				}),
				voice("808", "sine", "h + (n % 16 >= 12) * pick(n, 3, 3, 5, 7)", "0.9 * (1 - 0.6 * phase(n, 16))", {}, {
					playMode: "glide",
					quantize: true,
					glide: .14,
					octave: 2,
					steps: 32,
					send: 0,
					volume: .9,
					release: .3
				})
			]
		},
		{
			id: "royal",
			name: "Royal Road Ballad",
			description: "王道進行 IV–V–iii–vi, the progression of a thousand J-pop ballads: 7th-chord pads, strummed koto, an arpeggio and bass that all read the chord h.",
			song: {
				bpm: 76,
				root: 2,
				scale: "major",
				harmony: "pick(bar, 3, 4, 2, 5)"
			},
			tracks: [
				voice("Pad", "pad", "h", "0.5 * every(n, 16)", {
					chord: 4,
					length: 16
				}, {
					octave: 3,
					volume: .5,
					send: .9,
					attack: .5,
					release: 1.8
				}),
				voice("Koto Strum", "pluck", "h", "0.75 * euclid(n, 3, 8)", {
					chord: 3,
					strum: .07,
					inversion: "floor(n / 4) % 3"
				}, {
					octave: 4,
					volume: .5,
					send: .6,
					pan: .25
				}),
				voice("Arpeggio", "bell", "h + pick(n, 0, 2, 4, 2, L, 4, 2, 4)", "0.35 + 0.35 * every(n, 4) * chance(n + 16k, 0.8, 2)", {}, {
					octave: 5,
					volume: .35,
					send: .7,
					pan: -.3
				}),
				voice("Bass", "sine", "h", "phase(n, 16) < 0.9 ? 0.7 : 0", {}, {
					playMode: "glide",
					quantize: true,
					glide: .08,
					octave: 2,
					volume: .7,
					send: .1
				}),
				drum("Soft Kick", "kick", 16, "0.7 * every(n, 16) + 0.45 * every(n, 16, 10)", { volume: .6 }),
				drum("Rim", "rim", 16, "0.5 * every(n, 8, 4)", {
					volume: .5,
					send: .4
				})
			]
		},
		{
			id: "poly",
			name: "Polyrhythm Track",
			description: "3 against 5 against 7: Euclidean rhythms of different lengths drifting in and out of phase.",
			song: {
				bpm: 108,
				root: 2,
				scale: "yo",
				harmony: "0"
			},
			tracks: [
				drum("Kick · 3/8", "kick", 8, "euclid(n, 3, 8)"),
				drum("Rim · 5/12", "rim", 12, "euclid(n, 5, 12)", { pan: .4 }),
				drum("Toms · 7/16", "tom", 16, "euclid(n, 7, 16, 1)", {
					tune: "2.5 * (fib(n) % 5)",
					pan: -.4,
					send: .3
				}),
				voice("Bells · 4/9", "bell", "pick(n + k, 0, 2, 4, 1, 3)", "euclid(n, 4, 9)", {}, {
					steps: 9,
					stepBeats: .5,
					octave: 5,
					volume: .45
				})
			]
		}
	];
	let counter = 0;
	const uid = (prefix = "id") => `${prefix}_${Date.now().toString(36)}${(counter++).toString(36)}${Math.random().toString(36).slice(2, 5)}`;
	function trackFromTemplate(template, name, index) {
		return {
			...TRACK_DEFAULTS,
			name,
			color: TRACK_COLORS[index % TRACK_COLORS.length],
			...template,
			graph: structuredClone(template.graph),
			sliders: structuredClone(template.sliders ?? []),
			id: uid("track")
		};
	}
	function trackFromPreset(preset, index) {
		return trackFromTemplate(preset.track, preset.name, index);
	}
	function defaultProject() {
		const pick = (id) => PRESETS.find((p) => p.id === id);
		const tracks = [
			trackFromPreset(pick("pond"), 0),
			trackFromPreset(pick("fib"), 1),
			trackFromPreset(pick("bass"), 2)
		];
		tracks[1].volume = .55;
		tracks[1].pan = .3;
		return {
			name: "Untitled",
			song: {
				bpm: 84,
				root: 2,
				scale: "hirajoshi",
				reverb: .35,
				exportLoops: 4,
				harmony: "0",
				pitchRange: { ...DEFAULT_PITCH_RANGE },
				lengthMode: "fixed",
				lengthBeats: 8,
				repeat: "evolve",
				exportCurves: "simple",
				exportMidi: "standard",
				bendRange: 24,
				mpeBendRange: 48
			},
			tracks
		};
	}

//#endregion
//#region src/engine/kits.ts
/**
	* Planting kits and sizing channels to the song — shared by the app and the Max for Live
	* device, so a kit loads the same way in both.
	*/
	/** with a fixed song length, a channel is re-gridded to fill it exactly; a free song leaves it as it is */
	function fitToSong(t, song) {
		const L = songGridLength(song);
		return L === null ? t : {
			...t,
			...applyGrid(gridOf(t), {}, L)
		};
	}
	/**
	* The song a kit plants into (replacing the track): channels that share a length make a fixed
	* song long enough for the progression too; channels of different lengths (polyrhythms) make
	* a free song.
	*/
	function kitSong(kit, tracks, current) {
		const song = {
			...current,
			...kit.song
		};
		const lengths = tracks.map((t) => t.steps * t.stepBeats);
		const same = lengths.every((l) => Math.abs(l - lengths[0]) < 1e-9);
		const cycle = harmonyCycleBars(song);
		return same ? {
			...song,
			lengthMode: "fixed",
			lengthBeats: fixedLengthFor(Math.max(lengths[0], cycle < 16 ? cycle * 4 : 0))
		} : {
			...song,
			lengthMode: "free",
			lengthBeats: fixedLengthFor(Math.max(...lengths))
		};
	}

//#endregion
//#region m4l/host.ts
/**
	* The SoundFunc Max for Live device: Live's transport in, MIDI out.
	*
	* Max's JavaScript runs on the low-priority thread, so this never tries to fire events at
	* the right moment itself. A high-priority [metro] → [transport] reports where Live is every
	* few milliseconds; on each report this works out the next stretch of MIDI (the same events a
	* MIDI file of the song holds — engine/midi.ts) and hands every event to [pipe] with its exact
	* delay. [pipe] runs on the scheduler and lets each one go on time.
	*
	* Kept free of Max globals: the device wiring (max-entry.ts) passes in a small Io, so the
	* same logic runs in tests against a pretend transport.
	*/
	/** how far ahead events are handed to [pipe] — enough to ride out the low-priority thread's delays */
	const LOOKAHEAD_MS = 120;
	/** a jump in Live's position bigger than this (beats) is a relocation, not playback */
	const JUMP = .75;
	/** MIDI bytes packed into one number for [pipe] (a 2-byte message marks its third byte 255) */
	const pack = (bytes) => (bytes[0] & 255) << 16 | (bytes[1] ?? 0) << 8 | (bytes.length > 2 ? bytes[2] : 255);
	function createHost(io) {
		let project = defaultProject();
		/** which channel this device plays: 0 = all (each on its own MIDI channel), n = channel n alone (on MIDI channel 1) */
		let only = 0;
		let mode = "standard";
		let active = true;
		let playing = false;
		let lastBeat = -1;
		/** everything before this (beats) has been handed to [pipe] */
		let handedTo = 0;
		/** note-offs owed for notes already sent: tick → bytes */
		let owed = [];
		/** notes sounding (or about to), for a clean stop: "ch:note" → note-off bytes */
		const sounding = /* @__PURE__ */ new Map();
		/** note-offs handed to [pipe] but not yet due — cancelling [pipe] would swallow them */
		let offsWaiting = [];
		/** MIDI channels that have bent, to re-centre */
		const bent = /* @__PURE__ */ new Set();
		const passes = /* @__PURE__ */ new Map();
		let storeTimer = 0;
		const songLength = () => Math.max(1 / 16, songBeats(audibleTracks(project.tracks), project.song));
		/** one pass of the song as events to play: what the MIDI file of this pass holds */
		function pass(p) {
			let evs = passes.get(p);
			if (evs) return evs;
			const T = songLength();
			let channels = windowEvents(project, mode, p * T, (p + 1) * T, {
				raw: 0,
				kept: 0
			}, false);
			if (only > 0) channels = channels.filter((c) => audibleTracks(project.tracks).indexOf(c.track) === only - 1);
			const all = [];
			for (const c of channels) for (const e of c.events) {
				if ((e.bytes[0] & 240) === 192) continue;
				all.push(only > 0 ? {
					...e,
					bytes: [e.bytes[0] & 240 | 0, ...e.bytes.slice(1)]
				} : e);
			}
			all.sort((a, b) => a.tick - b.tick || a.order - b.order);
			evs = [];
			const open = /* @__PURE__ */ new Map();
			for (const e of all) {
				const kind = e.bytes[0] & 240;
				const key = `${e.bytes[0] & 15}:${e.bytes[1]}`;
				if (kind === 144 && e.bytes[2] > 0) {
					const play = { ...e };
					evs.push(play);
					open.set(key, [...open.get(key) ?? [], play]);
				} else if (kind === 128 || kind === 144 && e.bytes[2] === 0) {
					const on = open.get(key)?.shift();
					if (on) on.off = e.tick;
				} else evs.push({ ...e });
			}
			passes.set(p, evs);
			if (passes.size > 8) passes.delete(passes.keys().next().value);
			return evs;
		}
		function stopAll() {
			io.cancel();
			for (const bytes of sounding.values()) io.now(bytes);
			for (const o of offsWaiting) if (o.beat > lastBeat - 1e-9) io.now(o.bytes);
			offsWaiting = [];
			for (const ch of bent) io.now([
				224 | ch,
				0,
				64
			]);
			sounding.clear();
			bent.clear();
			owed = [];
		}
		/** Live's transport, every few ms: tempo (bpm), playing (1/0), position (Max ticks) */
		function clock(tempo, state, ticks) {
			const beat = ticks / 480;
			if (!state || !active) {
				if (playing) {
					stopAll();
					io.ui("sf_pos", -1);
				}
				playing = false;
				lastBeat = beat;
				return;
			}
			if (!playing || beat < lastBeat - .001 || beat > handedTo + JUMP) {
				if (playing) stopAll();
				playing = true;
				handedTo = beat;
			}
			lastBeat = beat;
			const msPerBeat = 6e4 / Math.max(1, tempo);
			const horizon = beat + 120 / msPerBeat;
			if (horizon <= handedTo) return;
			const from = Math.round(handedTo * 480), to = Math.round(horizon * 480);
			const T = songLength();
			const out = [];
			owed = owed.filter((o) => o.tick < to ? (out.push({
				tick: o.tick,
				order: 0,
				bytes: o.bytes
			}), false) : true);
			for (let p = Math.max(0, Math.floor(handedTo / T) - 1); p * T < horizon; p++) for (const e of pass(p)) {
				if (e.tick < from || e.tick >= to) continue;
				out.push(e);
				if (e.off !== void 0) {
					const offBytes = [
						128 | e.bytes[0] & 15,
						e.bytes[1],
						0
					];
					if (e.off < to) out.push({
						tick: e.off,
						order: 0,
						bytes: offBytes
					});
					else owed.push({
						tick: e.off,
						bytes: offBytes
					});
				}
			}
			out.sort((a, b) => a.tick - b.tick || a.order - b.order);
			for (const e of out) {
				const kind = e.bytes[0] & 240;
				const key = `${e.bytes[0] & 15}:${e.bytes[1]}`;
				if (kind === 144) sounding.set(key, [
					128 | e.bytes[0] & 15,
					e.bytes[1],
					0
				]);
				else if (kind === 128) {
					sounding.delete(key);
					offsWaiting.push({
						beat: e.tick / 480,
						bytes: e.bytes
					});
				} else if (kind === 224) bent.add(e.bytes[0] & 15);
				io.later(Math.max(0, (e.tick / 480 - beat) * msPerBeat), pack(e.bytes));
			}
			handedTo = horizon;
			offsWaiting = offsWaiting.filter((o) => o.beat > beat - 1e-9);
			if (Math.round(beat * 8) !== Math.round(lastSent * 8)) {
				lastSent = beat;
				io.ui("sf_pos", Math.round(beat * 1e3) / 1e3);
			}
		}
		let lastSent = -1;
		/** the project changed: start the coming passes afresh (sent notes still get their offs) */
		function setProject(p, persist = true) {
			project = normalizeProject(p);
			passes.clear();
			if (playing) handedTo = Math.max(lastBeat, handedTo - 120 / 1e3);
			io.status(describe());
			if (persist) {
				clearTimeout(storeTimer);
				storeTimer = setTimeout(() => io.store(JSON.stringify(project)), 1500);
			}
		}
		function describe() {
			const n = audibleTracks(project.tracks).length;
			const which = only > 0 ? `channel ${only} of ${n}` : `${n} channel${n === 1 ? "" : "s"}`;
			return `${project.name || "Untitled"} · ${which} · ${Math.round(songLength() * 100) / 100} beats`;
		}
		return {
			clock,
			setProject,
			/** the device was saved with a project: bring it back (no store — it came from the store) */
			restore(json) {
				try {
					setProject(JSON.parse(json), false);
				} catch {
					io.status("could not read the saved project — starting fresh");
				}
			},
			/** messages from the editor window */
			ui(cmd) {
				if (cmd === "ready") {
					io.writeShared(JSON.stringify(project));
					io.ui("sf_load", io.sharedName);
				} else if (cmd === "changed") {
					const json = io.readShared();
					if (json) try {
						setProject(JSON.parse(json));
					} catch {}
				}
			},
			/** the device's own controls */
			active(on) {
				active = !!on;
				if (!active && playing) stopAll();
			},
			channel(n) {
				only = Math.max(0, Math.round(n));
				passes.clear();
				if (playing) stopAll(), handedTo = lastBeat;
				io.status(describe());
			},
			midi(m) {
				mode = m ? "standard" : "notes";
				passes.clear();
				if (playing) stopAll(), handedTo = lastBeat;
			},
			/** load a style kit straight from the device: 0 = keep, n = the nth kit */
			kit(n) {
				const kit = KITS[n - 1];
				if (!kit) return;
				const tracks = kit.tracks.map((t, i) => trackFromTemplate(t, t.name, i));
				const song = kitSong(kit, tracks, project.song);
				setProject({
					...project,
					name: kit.name,
					song,
					tracks: tracks.map((t) => fitToSong(t, song))
				});
				io.writeShared(JSON.stringify(project));
				io.ui("sf_load", io.sharedName);
			},
			panic: stopAll,
			get project() {
				return project;
			},
			describe
		};
	}

//#endregion
//#region m4l/max-entry.ts
/**
	* The device's script for Max's [v8] object: connects the device logic (host.ts) to Max.
	* Bundled into m4l/device/soundfunc.js by `npm run build:m4l`.
	*
	* Outlets:
	*   0 → [pipe] left: an event (MIDI packed into one number), or "clear"
	*   1 → [pipe] right: that event's delay in ms (sent first)
	*   2 → [midiout]: MIDI right now (note-offs when stopping)
	*   3 → the editor window ([jweb])
	*   4 → [pattr]: the project, kept with the Live Set
	*   5 → the status line on the device
	*/
	const g = globalThis;
	g.inlets = 1;
	g.outlets = 6;
	g.autowatch = 0;
	if (typeof g.structuredClone !== "function") g.structuredClone = (v) => JSON.parse(JSON.stringify(v));
	if (typeof g.setTimeout !== "function") {
		g.setTimeout = (fn, ms) => {
			const t = new Task(fn);
			t.schedule(ms);
			return t;
		};
		g.clearTimeout = (t) => t?.cancel?.();
	}
	/** the dict the editor and the device pass the project through — one per device */
	const sharedName = `sf_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
	const io = {
		later(delayMs, code) {
			outlet(1, delayMs);
			outlet(0, code);
		},
		now(bytes) {
			outlet(2, ...bytes);
		},
		cancel() {
			outlet(0, "clear");
		},
		ui(...args) {
			outlet(3, ...args);
		},
		store(json) {
			outlet(4, "set", json);
		},
		status(text) {
			outlet(5, "set", text);
		},
		readShared() {
			const v = new Dict(sharedName).get("json");
			return typeof v === "string" ? v : null;
		},
		writeShared(json) {
			new Dict(sharedName).set("json", json);
		},
		sharedName
	};
	const host = createHost(io);
	/** Max path → file URL: "Macintosh HD:/Users/x/SoundFunc" → file:///Users/x/SoundFunc; "C:/x" → file:///C:/x */
	function fileUrl(maxPath, file) {
		let p = maxPath.replace(/\\/g, "/");
		if (/\.(amxd|maxpat)$/i.test(p)) p = p.slice(0, p.lastIndexOf("/"));
		const drive = /^[A-Za-z]:\//.test(p);
		if (!drive) p = p.replace(/^[^/]*:/, "");
		return encodeURI(`file://${drive ? "/" : ""}${p}/${file}`);
	}
	g.clock = (tempo, state, ticks) => host.clock(tempo, state, ticks);
	g.restore = (...parts) => host.restore(parts.join(" "));
	g.ui = (cmd) => host.ui(String(cmd));
	g.active = (on) => host.active(on);
	g.channel = (n) => host.channel(n);
	g.midi = (m) => host.midi(m);
	g.kit = (n) => host.kit(n);
	g.panic = () => host.panic();
	/** where the device lives, so the editor window can find its page (ui/index.html beside the device) */
	g.devicepath = (...parts) => io.ui("url", fileUrl(parts.join(" "), "ui/index.html"));
	g.loadbang = () => {
		io.status(host.describe());
		post("SoundFunc ready\n");
	};
	g.bang = () => io.status(host.describe());

//#endregion
})();