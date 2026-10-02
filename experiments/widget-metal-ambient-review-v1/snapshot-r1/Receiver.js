var AmbientNativeReceiver = (function(exports) {

Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });
//#region experiments/ambient-material-scheduler-v1/scheduler.mjs
	const PARAMETERS = Object.freeze({
		batchIntervalMs: 2e3,
		windowLookbackMs: 6e3,
		windowMaxUtf16: 128,
		candidateTtlMs: 6e3,
		consistentSamples: 2,
		minimumShapeHoldMs: 5e3,
		revealTickMs: 100,
		revealUnitsPerTick: 4,
		maximumBodyUnits: 256,
		maximumEventUtf16: 256,
		maximumRecentChunks: 64,
		maximumMetadataHistory: 64,
		counterSaturation: 1e6
	});
	const LEXICAL_GROUPS = Object.freeze({
		sphere: {
			ja: [
				"球",
				"球体",
				"たま"
			],
			en: ["sphere", "ball"]
		},
		box: {
			ja: ["箱", "立方体"],
			en: ["box", "cube"]
		},
		ring: {
			ja: ["輪", "リング"],
			en: ["ring", "torus"]
		}
	});
	const wordSegmenter = new Intl.Segmenter("ja", { granularity: "word" });
	const materialSegmenter = new Intl.Segmenter("ja", { granularity: "grapheme" });

//#endregion
//#region experiments/ambient-integration-contract-v1/shape-only.mjs
	const active$1 = (s) => s.visible && !s.paused;
	const boundary$2 = (t, i) => i === 0 || i === t.length || !(t.charCodeAt(i - 1) >= 55296 && t.charCodeAt(i - 1) <= 56319 && t.charCodeAt(i) >= 56320 && t.charCodeAt(i) <= 57343);
	const bump$1 = (s, key, n = 1) => {
		s.metrics[key] = Math.min(PARAMETERS.counterSaturation, (s.metrics[key] ?? 0) + n);
	};
	const record$1 = (s, key, row) => {
		s.history[key].push(row);
		if (s.history[key].length > PARAMETERS.maximumMetadataHistory) s.history[key].shift();
	};
	const chunkText = (s, row) => s.material.body.slice(row.start, row.end).map((u) => u.text).join("").slice(row.trim);
	function bound(s) {
		s.shape.recent = s.shape.recent.filter((r) => s.now < r.at + PARAMETERS.windowLookbackMs).slice(-PARAMETERS.maximumRecentChunks);
		let excess = s.shape.recent.reduce((n, r) => n + chunkText(s, r).length, 0) - PARAMETERS.windowMaxUtf16;
		while (excess > 0 && s.shape.recent.length) {
			const r = s.shape.recent[0], t = chunkText(s, r);
			if (t.length <= excess) {
				excess -= t.length;
				s.shape.recent.shift();
			} else {
				let cut = excess;
				if (!boundary$2(t, cut)) cut++;
				r.trim += cut;
				excess = 0;
			}
		}
	}
	const windowLength = (s) => s.shape.recent.reduce((n, r) => n + chunkText(s, r).length, 0);
	function createShape(mode) {
		return {
			mode,
			current: "sphere",
			lastShapeAt: 0,
			recent: [],
			generation: 0,
			windowRevision: 0,
			dirty: false,
			cache: null,
			candidate: null,
			pending: null,
			nextRequestId: 1,
			nextBatchAt: Infinity,
			anchor: 0,
			catchup: false
		};
	}
	function invalidateShape(s, clearWindow = true) {
		const sh = s.shape;
		sh.generation++;
		sh.candidate = null;
		sh.pending = null;
		sh.cache = null;
		sh.nextBatchAt = Infinity;
		sh.dirty = false;
		sh.catchup = false;
		if (clearWindow) {
			sh.recent = [];
			sh.windowRevision++;
		}
	}
	function grid(s, after = false) {
		const relative = (s.now - s.shape.anchor) / PARAMETERS.batchIntervalMs;
		const step = Math.max(1, after ? Math.floor(relative) + 1 : Math.ceil(relative));
		return s.shape.anchor + step * PARAMETERS.batchIntervalMs;
	}
	function materialToShape(s, chunks, seq, observedAt) {
		const sh = s.shape;
		sh.recent.push(...chunks.map(({ start, end }) => ({
			start,
			end,
			trim: 0,
			at: observedAt,
			seq
		})));
		sh.windowRevision++;
		sh.dirty = true;
		sh.pending = null;
		bound(s);
		if (active$1(s)) sh.nextBatchAt = Math.min(sh.nextBatchAt, grid(s));
	}
	function exposureChanged(s, wasActive) {
		if (wasActive && !active$1(s)) {
			invalidateShape(s, false);
			s.material.nextRevealAt = Infinity;
		}
		if (!wasActive && active$1(s)) {
			s.shape.anchor = s.now;
			s.shape.catchup = true;
			s.shape.dirty = true;
			s.shape.nextBatchAt = s.now + PARAMETERS.batchIntervalMs;
			if (s.material.presented < s.material.body.length) s.material.nextRevealAt = s.now + PARAMETERS.revealTickMs;
		}
	}
	function lexical(s) {
		bound(s);
		const text = s.shape.recent.map((r) => chunkText(s, r)).join("");
		const lower = text.replace(/[A-Z]/g, (c) => c.toLowerCase());
		const ends = [];
		let offset = 0;
		for (const row of s.shape.recent) {
			offset += chunkText(s, row).length;
			ends.push({
				end: offset,
				at: row.at,
				seq: row.seq
			});
		}
		let result = null, priority = 0;
		for (const [shape, groups] of Object.entries(LEXICAL_GROUPS)) {
			for (const language of ["ja", "en"]) for (const alias of groups[language]) {
				let start = lower.indexOf(alias);
				while (start !== -1) {
					const end = start + alias.length;
					if (language === "ja" || !/[a-z0-9_]/.test(lower[start - 1] ?? "") && !/[a-z0-9_]/.test(lower[end] ?? "")) {
						const origin = ends.find((r) => end <= r.end);
						const item = {
							shape,
							end,
							length: alias.length,
							priority,
							evidenceAt: origin.at,
							evidenceSeq: origin.seq
						};
						if (!result || end > result.end || end === result.end && item.length > result.length || end === result.end && item.length === result.length && priority < result.priority) result = item;
					}
					start = lower.indexOf(alias, start + 1);
				}
			}
			priority++;
		}
		bump$1(s, "queries");
		record$1(s, "queries", {
			at: s.now,
			queryUnits: text.length,
			result: result?.shape ?? null
		});
		return result;
	}
	function apply(s) {
		const sh = s.shape, c = sh.candidate;
		if (!c || !active$1(s) || sh.dirty || s.now >= c.expiresAt || c.samples < PARAMETERS.consistentSamples || s.now < sh.lastShapeAt + PARAMETERS.minimumShapeHoldMs) return;
		if (c.shape !== sh.current) {
			record$1(s, "changes", {
				at: s.now,
				from: sh.current,
				to: c.shape,
				evidenceAt: c.evidenceAt,
				delay: s.now - c.evidenceAt
			});
			sh.current = c.shape;
			sh.lastShapeAt = s.now;
			bump$1(s, "shapeChanges");
		}
		sh.candidate = null;
	}
	function observe(s, result, cached = false) {
		const sh = s.shape;
		if (!result || s.now >= result.evidenceAt + PARAMETERS.candidateTtlMs || result.shape === sh.current) {
			sh.candidate = null;
			return;
		}
		const same = sh.candidate?.shape === result.shape;
		const previous = sh.candidate;
		sh.candidate = {
			shape: result.shape,
			samples: same ? Math.min(PARAMETERS.consistentSamples, previous.samples + 1) : 1,
			evidenceAt: cached && same ? previous.evidenceAt : result.evidenceAt,
			expiresAt: cached && same ? previous.expiresAt : result.evidenceAt + PARAMETERS.candidateTtlMs
		};
		apply(s);
		if (sh.candidate && sh.candidate.samples < PARAMETERS.consistentSamples) sh.nextBatchAt = grid(s, true);
	}
	function shapeAnswer(s, data) {
		const sh = s.shape, p = sh.pending;
		if (!active$1(s) || !p || sh.dirty || s.now >= p.expiresAt || [
			"requestId",
			"focusEpoch",
			"policyEpoch",
			"generation",
			"windowRevision"
		].some((k) => data[k] !== p[k]) || data.shape !== p.result?.shape) {
			bump$1(s, "staleAnswers");
			return false;
		}
		sh.pending = null;
		sh.cache = p.result;
		bump$1(s, "acceptedAnswers");
		observe(s, p.result);
		return true;
	}
	function latestAnswer(s) {
		const p = s.shape.pending;
		if (!p) return {};
		return Object.fromEntries([
			"requestId",
			"focusEpoch",
			"policyEpoch",
			"generation",
			"windowRevision"
		].map((k) => [k, p[k]]).concat([["shape", p.result?.shape ?? null]]));
	}
	function due(s) {
		const sh = s.shape, m = s.material;
		if (sh.candidate && s.now >= sh.candidate.expiresAt) {
			sh.candidate = null;
			bump$1(s, "candidateExpiries");
			if (!sh.dirty) sh.nextBatchAt = Infinity;
		}
		if (sh.pending && s.now >= sh.pending.expiresAt) sh.pending = null;
		if (active$1(s) && sh.nextBatchAt <= s.now) {
			sh.nextBatchAt = Infinity;
			if (sh.dirty || sh.catchup) {
				const result = lexical(s);
				sh.dirty = false;
				sh.catchup = false;
				if (sh.mode === "deferred" && result) sh.pending = {
					requestId: sh.nextRequestId++,
					focusEpoch: s.focusEpoch,
					policyEpoch: s.policyEpoch,
					generation: sh.generation,
					windowRevision: sh.windowRevision,
					expiresAt: result.evidenceAt + PARAMETERS.candidateTtlMs,
					result
				};
				else {
					sh.cache = result;
					observe(s, result);
				}
			} else if (sh.candidate && sh.cache) {
				bump$1(s, "cachedSamples");
				observe(s, sh.cache, true);
			}
		}
		apply(s);
		if (active$1(s) && m.nextRevealAt <= s.now) {
			const count = Math.min(PARAMETERS.revealUnitsPerTick, m.body.length - m.presented);
			m.presented += count;
			if (count) record$1(s, "reveals", {
				at: s.now,
				count
			});
			m.nextRevealAt = m.presented < m.body.length ? s.now + PARAMETERS.revealTickMs : Infinity;
		}
	}
	function deadline(s) {
		const sh = s.shape, c = sh.candidate;
		const eligible = c && !sh.dirty && c.samples >= PARAMETERS.consistentSamples && sh.lastShapeAt + PARAMETERS.minimumShapeHoldMs > s.now ? sh.lastShapeAt + PARAMETERS.minimumShapeHoldMs : Infinity;
		return Math.min(active$1(s) ? sh.nextBatchAt : Infinity, active$1(s) ? s.material.nextRevealAt : Infinity, c?.expiresAt ?? Infinity, sh.pending?.expiresAt ?? Infinity, active$1(s) ? eligible : Infinity);
	}
	function advance(s, at, equal = true) {
		if (!Number.isSafeInteger(at) || at < s.now) throw new TypeError("monotonic artificial delivery clock required");
		let iterations = 0;
		for (;;) {
			const next = deadline(s);
			if (next === Infinity || (equal ? next > at : next >= at)) break;
			if (next < s.now || ++iterations > 1e5) throw new Error("invalid bounded scheduler clock");
			s.now = next;
			bound(s);
			due(s);
		}
		s.now = at;
		bound(s);
		s.metrics.queuePeak = Math.max(s.metrics.queuePeak, s.material.body.length - s.material.presented);
		return s;
	}

//#endregion
//#region experiments/ambient-integration-contract-v1/receiver-r3.mjs
	const GRAMMAR = "ambient.integration.v1";
	const SOURCES = Object.freeze([
		{
			id: "system",
			session: "lab",
			control: true
		},
		{
			id: "keys",
			session: "lab",
			activity: true
		},
		{
			id: "editor",
			session: "lab",
			document: true,
			composition: true,
			commit: true,
			primaryCommit: true
		},
		{
			id: "echo",
			session: "lab",
			document: true,
			commit: true,
			primaryCommit: false
		},
		{
			id: "documentApi",
			session: "lab",
			document: true
		},
		{
			id: "sender",
			session: "lab",
			explicitSend: true
		},
		{
			id: "worker",
			session: "lab",
			shapeAnswer: true
		}
	]);
	const INKS$1 = /* @__PURE__ */ new Set([
		"white",
		"blue",
		"green",
		"purple"
	]);
	const OPAQUE = /^[A-Za-z0-9_-]{1,32}$/;
	const integer$3 = (n, min = 0) => Number.isSafeInteger(n) && n >= min;
	const segmenter = new Intl.Segmenter("ja", { granularity: "grapheme" });
	const active = (s) => s.visible && !s.paused;
	const boundary$1 = (t, i) => i === 0 || i === t.length || !(t.charCodeAt(i - 1) >= 55296 && t.charCodeAt(i - 1) <= 56319 && t.charCodeAt(i) >= 56320 && t.charCodeAt(i) <= 57343);
	const boundedPreview = (t) => {
		let end = Math.min(64, t.length);
		if (!boundary$1(t, end)) end--;
		return t.slice(0, end);
	};
	const bump = (s, k, n = 1) => {
		s.metrics[k] = Math.min(PARAMETERS.counterSaturation, (s.metrics[k] ?? 0) + n);
	};
	const record = (s, k, row) => {
		s.history[k].push(row);
		if (s.history[k].length > PARAMETERS.maximumMetadataHistory) s.history[k].shift();
	};
	function createReceiver({ bodyLimit = 256, shapeMode = "inline", savingOff = true, consent } = {}) {
		if (!integer$3(bodyLimit, 1) || bodyLimit > 256 || !["inline", "deferred"].includes(shapeMode) || typeof savingOff !== "boolean" || !savingOff && consent !== "synthetic-opt-in") throw new TypeError("invalid artificial settings or opt-in");
		return {
			grammar: GRAMMAR,
			version: "ambient-integration-contract-v1-r1",
			seed: 1,
			savingOff,
			bodyLimit,
			now: 0,
			focusEpoch: 0,
			policyEpoch: 0,
			field: "unknown",
			documentId: null,
			captureEnabled: true,
			retention: "text",
			visible: true,
			paused: false,
			admissionReady: true,
			sources: Object.fromEntries(SOURCES.map((source) => [source.id, {
				...source,
				seq: 0,
				observedAt: -1,
				appendSupported: true
			}])),
			canonical: {
				document: null,
				preview: "",
				composition: null,
				lastSerial: 0,
				normalizedSeq: 0,
				needsResync: false
			},
			material: {
				body: [],
				nextId: 1,
				presented: 0,
				nextRevealAt: Infinity
			},
			pending: null,
			shape: createShape(shapeMode),
			metrics: Object.fromEntries([
				"received",
				"addedUnits",
				"admissions",
				"permanentHolds",
				"deferrals",
				"gaps",
				"documentGaps",
				"serialGaps",
				"trustedRebases",
				"invalidChanges",
				"transportDuplicates",
				"operationDuplicates",
				"activityKeys",
				"activityShortcuts",
				"queries",
				"shapeChanges",
				"cachedSamples",
				"candidateExpiries",
				"staleAnswers",
				"acceptedAnswers",
				"unsupportedModes",
				"queuePeak",
				"pendingSlotPeak",
				"hiddenWork",
				"normalizedForwardGaps"
			].map((k) => [k, 0])),
			history: {
				decisions: [],
				admissions: [],
				changes: [],
				queries: [],
				reveals: [],
				forwarded: []
			}
		};
	}
	function forward(s, kind) {
		const seq = ++s.canonical.normalizedSeq;
		record(s, "forwarded", {
			seq,
			kind,
			at: s.now
		});
		return seq;
	}
	function invalidate(s, kind, clear = true) {
		invalidateShape(s, clear);
		forward(s, kind);
	}
	function consume(source, e) {
		source.seq = e.seq;
		source.observedAt = e.observedAt;
	}
	function decision(s, status, reason, ack = true, added = 0) {
		const row = {
			at: s.now,
			status,
			reason,
			ack,
			added
		};
		record(s, "decisions", row);
		return row;
	}
	function markGap(s, source, reason) {
		if (s.pending) s.sources[s.pending.source].appendSupported = false;
		source.appendSupported = false;
		s.canonical.needsResync = true;
		s.pending = null;
		bump(s, "gaps");
		invalidate(s, reason);
	}
	function stageDocument(s, data) {
		const doc = s.canonical.document;
		if (!doc || s.canonical.needsResync || data.documentId !== s.documentId || data.baseVersion !== doc.version || data.version !== doc.version + 1) return { error: "document-gap" };
		if (!Array.isArray(data.changes) || data.changes.length < 1 || data.changes.length > 64) return { error: "invalid-changes" };
		const changes = [];
		for (const c of data.changes) {
			if (!c || !integer$3(c.offset) || !integer$3(c.deleteCount) || typeof c.text !== "string" || c.offset + c.deleteCount > doc.text.length || !boundary$1(doc.text, c.offset) || !boundary$1(doc.text, c.offset + c.deleteCount)) return { error: "invalid-changes" };
			changes.push({
				offset: c.offset,
				deleteCount: c.deleteCount,
				text: c.text
			});
		}
		changes.sort((a, b) => a.offset - b.offset);
		for (let i = 1; i < changes.length; i++) if (changes[i].offset === changes[i - 1].offset || changes[i].offset < changes[i - 1].offset + changes[i - 1].deleteCount) return { error: "invalid-changes" };
		let text = doc.text;
		for (const c of changes.toReversed()) text = text.slice(0, c.offset) + c.text + text.slice(c.offset + c.deleteCount);
		if (text.length > 512) return { error: "document-limit" };
		return {
			document: {
				documentId: s.documentId,
				version: data.version,
				text
			},
			segments: changes.map((c) => c.text).filter(Boolean)
		};
	}
	function applyDocument(s, doc) {
		s.canonical.document = doc;
		s.canonical.preview = boundedPreview(doc.text);
		s.canonical.needsResync = false;
	}
	function admit(s, e, source, serial, segments, ink, doc, clearsContext) {
		const totalUtf16 = segments.reduce((n, t) => n + t.length, 0);
		const units = totalUtf16 <= 256 ? segments.map((text) => [...segmenter.segment(text)].map((r) => r.segment)) : [];
		const unitCount = units.reduce((n, row) => n + row.length, 0);
		const permanent = totalUtf16 > 256 ? "event-text-limit" : s.material.body.length + unitCount > s.bodyLimit ? "body-capacity" : null;
		if (!permanent && unitCount && !s.admissionReady) {
			s.pending = {
				source: e.source,
				session: e.session,
				seq: e.seq,
				focusEpoch: e.focusEpoch,
				policyEpoch: e.policyEpoch,
				observedAt: e.observedAt,
				serial,
				operationId: e.operationId,
				kind: e.kind
			};
			s.metrics.pendingSlotPeak = Math.max(s.metrics.pendingSlotPeak, 1);
			bump(s, "deferrals");
			return decision(s, "deferred", "temporary-handoff", false);
		}
		const chunks = [];
		if (!permanent) for (const row of units) {
			const start = s.material.body.length;
			for (const text of row) s.material.body.push({
				id: s.material.nextId++,
				text,
				ink
			});
			if (s.material.body.length > start) chunks.push({
				start,
				end: s.material.body.length
			});
		}
		if (doc) applyDocument(s, doc);
		s.canonical.lastSerial = serial;
		consume(source, e);
		s.pending = null;
		if (e.kind === "composition-final") s.canonical.composition = null;
		if (permanent) {
			bump(s, "permanentHolds");
			record(s, "admissions", {
				at: s.now,
				added: 0,
				reason: permanent
			});
			return decision(s, "held", permanent);
		}
		if (clearsContext) invalidate(s, "document-history-change");
		else if (unitCount) {
			const seq = forward(s, "material");
			materialToShape(s, chunks, seq, e.observedAt);
			if (active(s) && s.material.nextRevealAt === Infinity) s.material.nextRevealAt = s.now + PARAMETERS.revealTickMs;
		}
		s.metrics.queuePeak = Math.max(s.metrics.queuePeak, s.material.body.length - s.material.presented);
		bump(s, "addedUnits", unitCount);
		bump(s, "admissions");
		record(s, "admissions", {
			at: s.now,
			added: unitCount,
			reason: "whole-add-before-ack"
		});
		return decision(s, "accepted", "whole-add-before-ack", true, unitCount);
	}
	function receive(s, e, deliveryAt) {
		advance(s, deliveryAt, false);
		bump(s, "received");
		if (!e || e.grammar !== "ambient.integration.v1" || !OPAQUE.test(e.source ?? "") || !integer$3(e.seq, 1) || !integer$3(e.focusEpoch) || !integer$3(e.policyEpoch) || !integer$3(e.observedAt) || e.observedAt > deliveryAt || typeof e.kind !== "string") return decision(s, "rejected", "invalid-versioned-header");
		const source = s.sources[e.source];
		if (!source || source.session !== e.session) return decision(s, "rejected", "unknown-source-session");
		if (e.seq <= source.seq) {
			bump(s, "transportDuplicates");
			return decision(s, "ignored", "transport-duplicate");
		}
		if (e.observedAt < source.observedAt) return decision(s, "rejected", "source-clock-regression");
		const focus = source.control && e.kind === "focus", policy = source.control && e.kind === "policy";
		if (focus ? e.focusEpoch !== s.focusEpoch + 1 || e.policyEpoch !== s.policyEpoch : policy ? e.focusEpoch !== s.focusEpoch || e.policyEpoch !== s.policyEpoch + 1 : e.focusEpoch !== s.focusEpoch || e.policyEpoch !== s.policyEpoch) return decision(s, "ignored", "stale-epoch");
		if (s.pending && source.id === s.pending.source && e.seq !== s.pending.seq) {
			markGap(s, source, "unacked-source-gap");
			consume(source, e);
			return decision(s, "unsupported", "new-event-before-ack");
		}
		const samePendingEvent = s.pending && [
			"source",
			"session",
			"seq",
			"focusEpoch",
			"policyEpoch",
			"observedAt",
			"kind",
			"operationId",
			"serial"
		].every((k) => e[k] === s.pending[k]);
		if (e.seq > source.seq + 1 && !samePendingEvent) {
			if (source.activity && !source.document && !source.composition && !source.commit && !source.explicitSend && !source.control && !source.shapeAnswer) bump(s, "gaps");
			else markGap(s, source, "source-sequence-gap");
		}
		if (source.control) {
			const data = e.data;
			if (!data || typeof data !== "object") {
				consume(source, e);
				return decision(s, "rejected", "invalid-control");
			}
			if (focus) {
				if (![
					"normal",
					"secure",
					"unknown"
				].includes(data.field) || !OPAQUE.test(data.documentId ?? "")) {
					consume(source, e);
					return decision(s, "rejected", "invalid-focus");
				}
				s.focusEpoch = e.focusEpoch;
				s.field = data.field;
				s.documentId = data.documentId;
				s.canonical.document = null;
				s.canonical.preview = "";
				s.canonical.composition = null;
				s.canonical.lastSerial = 0;
				s.canonical.needsResync = false;
				s.pending = null;
				invalidate(s, "focus");
				s.shape.anchor = s.now;
			} else if (policy) {
				if (!["text", "activity-only"].includes(data.retention) || typeof data.captureEnabled !== "boolean") {
					consume(source, e);
					return decision(s, "rejected", "invalid-policy");
				}
				s.policyEpoch = e.policyEpoch;
				s.retention = data.retention;
				s.captureEnabled = data.captureEnabled;
				s.canonical.document = null;
				s.canonical.preview = "";
				s.canonical.composition = null;
				s.canonical.lastSerial = 0;
				s.canonical.needsResync = false;
				s.pending = null;
				invalidate(s, "policy");
				s.shape.anchor = s.now;
			} else if (e.kind === "admission-ready" && typeof data.ready === "boolean") s.admissionReady = data.ready;
			else if (e.kind === "visibility" && typeof data.visible === "boolean" || e.kind === "pause" && typeof data.paused === "boolean") {
				const wasActive = active(s);
				if (e.kind === "visibility") s.visible = data.visible;
				else s.paused = data.paused;
				forward(s, e.kind);
				exposureChanged(s, wasActive);
			} else if (e.kind === "request-document-sync") {
				consume(source, e);
				bump(s, "unsupportedModes");
				return decision(s, "unsupported", "document-sync-not-adopted");
			} else {
				consume(source, e);
				return decision(s, "rejected", "unsupported-control");
			}
			consume(source, e);
			return decision(s, "controlled", e.kind);
		}
		if (source.activity && e.kind === "activity") {
			const data = e.data;
			if (!data || !integer$3(data.count) || !["key", "shortcut"].includes(data.class)) {
				consume(source, e);
				return decision(s, "rejected", "invalid-activity");
			}
			bump(s, data.class === "key" ? "activityKeys" : "activityShortcuts", data.count);
			consume(source, e);
			return decision(s, "activity", "no-text-route");
		}
		if (s.field !== "normal" || s.retention !== "text" || !s.captureEnabled) {
			consume(source, e);
			return decision(s, "suppressed", "text-route-disabled");
		}
		if (source.shapeAnswer && e.kind === "shape-answer") {
			const data = e.data;
			const ok = data && shapeAnswer(s, data);
			consume(source, e);
			return decision(s, ok ? "answered" : "ignored", ok ? "current-answer" : "stale-answer");
		}
		const explicit = e.kind === "explicit-send";
		const edit = e.kind === "document-edit" || e.kind === "composition-final";
		const known = source.appendSupported && (explicit ? source.explicitSend && e.evidence === "synthetic-explicit-send" : edit && source.commit && e.evidence === "synthetic-commit");
		if (known) {
			if (!integer$3(e.serial, 1) || e.operationId !== `e${e.focusEpoch}-p${e.policyEpoch}-c${e.serial}`) {
				consume(source, e);
				return decision(s, "rejected", "invalid-operation-id");
			}
			if (e.serial <= s.canonical.lastSerial) {
				consume(source, e);
				bump(s, "operationDuplicates");
				return decision(s, "ignored", "operation-duplicate");
			}
			if (edit && !source.primaryCommit) {
				consume(source, e);
				return decision(s, "rejected", "echo-cannot-create-operation");
			}
			if (e.serial !== s.canonical.lastSerial + 1) {
				consume(source, e);
				s.canonical.needsResync = true;
				bump(s, "serialGaps");
				invalidate(s, "operation-serial-gap");
				return decision(s, "held", "serial-rebase-required");
			}
			if (s.pending && (s.pending.source !== e.source || s.pending.seq !== e.seq)) {
				markGap(s, source, "parallel-unacked-source");
				consume(source, e);
				return decision(s, "unsupported", "single-retry-slot-only");
			}
			if (s.pending && [
				"focusEpoch",
				"policyEpoch",
				"observedAt",
				"operationId",
				"kind"
			].some((k) => s.pending[k] !== e[k])) {
				consume(source, e);
				markGap(s, source, "retry-metadata-mismatch");
				return decision(s, "unsupported", "retry-metadata-mismatch");
			}
		}
		if (explicit) {
			if (!known) {
				consume(source, e);
				return decision(s, "suppressed", "known-selection-required");
			}
			const d = e.data;
			if (!d || typeof d.text !== "string" || !INKS$1.has(d.ink) || d.selectionDeclared !== true || d.documentId !== null || d.documentVersion !== null || "changes" in d) {
				consume(source, e);
				return decision(s, "rejected", "invalid-explicit-selection");
			}
			return admit(s, e, source, e.serial, [d.text], d.ink, null, false);
		}
		if (!source.document) {
			consume(source, e);
			return decision(s, "rejected", "source-capability");
		}
		const d = e.data;
		if (!d || typeof d !== "object") {
			consume(source, e);
			return decision(s, "rejected", "invalid-document-payload");
		}
		if (e.kind === "baseline") {
			if (d.documentId !== s.documentId || !integer$3(d.version) || typeof d.text !== "string" || d.text.length > 512) {
				consume(source, e);
				return decision(s, "rejected", "invalid-baseline");
			}
			if (e.evidence === "synthetic-rebase") {
				if (!source.primaryCommit || !source.commit || !integer$3(d.operationSerialBaseline) || d.operationSerialBaseline < s.canonical.lastSerial) {
					consume(source, e);
					return decision(s, "rejected", "invalid-primary-rebase");
				}
				s.canonical.lastSerial = d.operationSerialBaseline;
				source.appendSupported = true;
				bump(s, "trustedRebases");
				invalidate(s, "trusted-rebase");
			}
			applyDocument(s, {
				documentId: d.documentId,
				version: d.version,
				text: d.text
			});
			consume(source, e);
			return decision(s, "observed", "baseline-never-material");
		}
		if (e.kind.startsWith("composition-") && e.kind !== "composition-final") {
			if (!source.composition || !OPAQUE.test(d.compositionId ?? "")) {
				consume(source, e);
				return decision(s, "rejected", "invalid-composition");
			}
			if (e.kind === "composition-start") s.canonical.composition = {
				id: d.compositionId,
				text: ""
			};
			else if (s.canonical.composition?.id !== d.compositionId) {
				consume(source, e);
				return decision(s, "rejected", "composition-id");
			} else if (e.kind === "composition-update" && typeof d.text === "string") s.canonical.composition.text = boundedPreview(d.text);
			else if (e.kind === "composition-cancel") s.canonical.composition = null;
			else {
				consume(source, e);
				return decision(s, "rejected", "composition-kind");
			}
			consume(source, e);
			return decision(s, "preview", "preedit-never-material");
		}
		if (!edit || e.kind === "composition-final" && (!source.composition || s.canonical.composition?.id !== d.compositionId)) {
			consume(source, e);
			return decision(s, "rejected", "document-kind");
		}
		const staged = stageDocument(s, d);
		if (staged.error) {
			consume(source, e);
			if (staged.error === "document-gap") {
				s.canonical.needsResync = true;
				bump(s, "documentGaps");
				invalidate(s, "document-gap");
			} else bump(s, "invalidChanges");
			return decision(s, "rejected", staged.error);
		}
		if (!known) {
			applyDocument(s, staged.document);
			consume(source, e);
			return decision(s, "preview", "unknown-commit-quality");
		}
		if (!INKS$1.has(d.ink) || ![
			"type",
			"paste",
			"completion",
			"replace",
			"undo",
			"redo",
			"delete"
		].includes(d.reason)) {
			consume(source, e);
			return decision(s, "rejected", "invalid-commit-metadata");
		}
		const clearsContext = [
			"undo",
			"redo",
			"delete"
		].includes(d.reason) || staged.segments.length === 0;
		return admit(s, e, source, e.serial, clearsContext ? [] : staged.segments, d.ink, staged.document, clearsContext);
	}
	function advanceTo(s, at) {
		return advance(s, at, true);
	}
	function exportReceiver(s) {
		const result = {
			grammar: GRAMMAR,
			version: s.version,
			savingOff: s.savingOff,
			seed: s.seed,
			shape: s.shape.current,
			now: s.now,
			count: s.material.body.length,
			presentedCount: s.material.presented,
			inkCounts: Object.fromEntries([...INKS$1].map((ink) => [ink, s.material.body.filter((u) => u.ink === ink).length])),
			counters: { ...s.metrics }
		};
		if (!s.savingOff) result.body = s.material.body.map(({ id, text, ink }) => ({
			id,
			text,
			ink
		}));
		return result;
	}
	function restartFromExport(value) {
		if (!value || value.grammar !== "ambient.integration.v1" || value.savingOff !== true || ![
			"sphere",
			"box",
			"ring"
		].includes(value.shape)) throw new TypeError("off aggregate export required");
		const s = createReceiver();
		s.shape.current = value.shape;
		s.seed = integer$3(value.seed) ? value.seed : 1;
		return s;
	}
	function inspect(s) {
		return {
			body: s.material.body.map((u) => u.text).join(""),
			units: s.material.body.length,
			unitTexts: s.material.body.map((u) => u.text),
			ids: s.material.body.map((u) => u.id),
			inks: s.material.body.map((u) => u.ink),
			inkCounts: Object.fromEntries([...INKS$1].map((ink) => [ink, s.material.body.filter((u) => u.ink === ink).length])),
			document: s.canonical.document ? {
				text: s.canonical.document.text,
				version: s.canonical.document.version
			} : null,
			composition: s.canonical.composition,
			serial: s.canonical.lastSerial,
			normalizedSeq: s.canonical.normalizedSeq,
			sourceSeq: Object.fromEntries(Object.entries(s.sources).map(([id, source]) => [id, source.seq])),
			appendUnsupported: Object.values(s.sources).filter((r) => !r.appendSupported).map((r) => r.id),
			pendingSlots: Number(s.pending !== null),
			nextId: s.material.nextId,
			presented: s.material.presented,
			windowUtf16: windowLength(s),
			candidate: s.shape.candidate,
			shape: s.shape.current,
			shapeAt: s.shape.lastShapeAt,
			holdReasons: s.history.admissions.filter((r) => r.added === 0 && r.reason !== "whole-add-before-ack").map((r) => r.reason),
			ackAddedAt: s.history.admissions.find((r) => r.added > 0)?.at ?? null,
			...s.metrics
		};
	}

//#endregion
//#region experiments/ambient-integration-contract-v1/body-view.mjs
	function* readBody(state) {
		for (const { id, text, ink } of state.material.body) yield Object.freeze({
			id,
			text,
			ink
		});
	}

//#endregion
//#region experiments/ambient-integration-contract-v1/storage-gate.mjs
	const counters = [
		"received",
		"addedUnits",
		"admissions",
		"permanentHolds",
		"deferrals",
		"gaps",
		"documentGaps",
		"serialGaps",
		"trustedRebases",
		"invalidChanges",
		"transportDuplicates",
		"operationDuplicates",
		"activityKeys",
		"activityShortcuts",
		"queries",
		"shapeChanges",
		"cachedSamples",
		"candidateExpiries",
		"staleAnswers",
		"acceptedAnswers",
		"unsupportedModes",
		"queuePeak",
		"pendingSlotPeak",
		"hiddenWork",
		"normalizedForwardGaps"
	];
	const colors = [
		"white",
		"blue",
		"green",
		"purple"
	];
	const top = [
		"grammar",
		"version",
		"savingOff",
		"seed",
		"shape",
		"now",
		"count",
		"presentedCount",
		"inkCounts",
		"counters"
	];
	const exactKeys = (o, keys) => o && typeof o === "object" && !Array.isArray(o) && Object.keys(o).length === keys.length && keys.every((k) => Object.hasOwn(o, k));
	const integer$2 = (n, max = Number.MAX_SAFE_INTEGER) => Number.isSafeInteger(n) && n >= 0 && n <= max;
	function validateStorage(value) {
		const fail = (reason) => ({
			valid: false,
			reason
		});
		if (typeof value?.savingOff !== "boolean" || !exactKeys(value, value.savingOff ? top : [...top, "body"])) return fail("top-allowlist");
		if (value.grammar !== "ambient.integration.v1" || value.version !== "ambient-integration-contract-v1-r1" || ![
			"sphere",
			"box",
			"ring"
		].includes(value.shape) || !integer$2(value.seed) || !integer$2(value.now) || !integer$2(value.count, 256) || !integer$2(value.presentedCount, value.count)) return fail("fixed-scalars");
		if (!exactKeys(value.inkCounts, colors) || colors.some((c) => !integer$2(value.inkCounts[c], 256)) || colors.reduce((n, c) => n + value.inkCounts[c], 0) !== value.count) return fail("color-histogram");
		if (!exactKeys(value.counters, counters) || counters.some((k) => !integer$2(value.counters[k], 1e6))) return fail("counter-allowlist");
		if (!value.savingOff) {
			if (!Array.isArray(value.body) || value.body.length !== value.count || value.body.some((r, i) => !exactKeys(r, [
				"id",
				"text",
				"ink"
			]) || r.id !== i + 1 || typeof r.text !== "string" || !r.text.length || r.text.length > 256 || !colors.includes(r.ink))) return fail("bounded-opt-in-body");
		}
		return {
			valid: true,
			reason: value.savingOff ? "aggregate-only" : "explicit-artificial-opt-in-body"
		};
	}

//#endregion
//#region experiments/ambient-editor-adapter-v1/adapter-r2.mjs
	const integer$1 = (n, min = 0) => Number.isSafeInteger(n) && n >= min;
	const boundary = (t, i) => integer$1(i) && i <= t.length && (i === 0 || i === t.length || !(t.charCodeAt(i - 1) >= 55296 && t.charCodeAt(i - 1) <= 56319 && t.charCodeAt(i) >= 56320 && t.charCodeAt(i) <= 57343));
	function wellFormed(t) {
		if (typeof t !== "string") return false;
		for (let i = 0; i < t.length; i++) {
			const c = t.charCodeAt(i);
			if (c >= 55296 && c <= 56319) {
				const next = t.charCodeAt(++i);
				if (!(next >= 56320 && next <= 57343)) return false;
			} else if (c >= 56320 && c <= 57343) return false;
		}
		return true;
	}
	const validText$1 = (t) => typeof t === "string" && t.length <= 512 && wellFormed(t);
	function singleDiff(before, after) {
		if (!validText$1(before) || !validText$1(after)) return null;
		if (before === after) return [];
		let prefix = 0;
		while (prefix < before.length && prefix < after.length && before[prefix] === after[prefix]) prefix++;
		while (!boundary(before, prefix) || !boundary(after, prefix)) prefix--;
		let suffix = 0;
		while (suffix < before.length - prefix && suffix < after.length - prefix && before[before.length - suffix - 1] === after[after.length - suffix - 1]) suffix++;
		while (!boundary(before, before.length - suffix) || !boundary(after, after.length - suffix)) suffix--;
		return [{
			offset: prefix,
			deleteCount: before.length - prefix - suffix,
			text: after.slice(prefix, after.length - suffix)
		}];
	}

//#endregion
//#region experiments/ambient-javascriptcore-v1/bridge.mjs
	const copy = (value) => JSON.parse(JSON.stringify(value));
	function normalized(value) {
		if (Array.isArray(value)) return value.map(normalized);
		if (value && typeof value === "object") return Object.fromEntries(Object.keys(value).sort().map((k) => [k, normalized(value[k])]));
		return value;
	}
	const equalValue = (a, b) => JSON.stringify(normalized(a)) === JSON.stringify(normalized(b));
	const repeat = (r) => r.text.repeat(r.count);
	function expectedExpanded(value) {
		const result = copy(value);
		if (result.bodyRepeat) {
			result.body = repeat(result.bodyRepeat);
			delete result.bodyRepeat;
		}
		if (result.document?.textRepeat) {
			result.document.text = repeat(result.document.textRepeat);
			delete result.document.textRepeat;
		}
		return result;
	}
	function freeze$1(event) {
		if (event.data) {
			if (Array.isArray(event.data.changes)) {
				event.data.changes.forEach(Object.freeze);
				Object.freeze(event.data.changes);
			}
			Object.freeze(event.data);
		}
		return Object.freeze(event);
	}
	function buildEvent(blueprint, state, probe) {
		const event = {
			grammar: blueprint.grammar ?? "ambient.integration.v1",
			source: blueprint.source,
			session: "lab",
			seq: blueprint.seq,
			kind: blueprint.kind,
			observedAt: blueprint.observedAt ?? blueprint.at,
			focusEpoch: blueprint.focusEpoch ?? (blueprint.kind === "focus" ? state.focusEpoch + 1 : state.focusEpoch),
			policyEpoch: blueprint.policyEpoch ?? (blueprint.kind === "policy" ? state.policyEpoch + 1 : state.policyEpoch),
			evidence: blueprint.evidence ?? "none"
		};
		if (blueprint.op !== void 0) {
			event.serial = blueprint.op;
			event.operationId = `e${event.focusEpoch}-p${event.policyEpoch}-c${blueprint.op}`;
		}
		if (blueprint.unreadableData) {
			Object.defineProperty(event, "data", {
				enumerable: true,
				get() {
					probe.count++;
					throw new Error("protected artificial payload was read");
				}
			});
			return Object.freeze(event);
		}
		const data = blueprint.answerLatest ? latestAnswer(state) : copy(blueprint.data ?? {});
		if (data.textRepeat) {
			data.text = repeat(data.textRepeat);
			delete data.textRepeat;
		}
		if (data.changesRepeat) {
			data.changes = Array.from({ length: data.changesRepeat.count }, (_, i) => ({
				offset: i,
				deleteCount: 1,
				text: data.changesRepeat.text
			}));
			delete data.changesRepeat;
		}
		event.data = data;
		return freeze$1(event);
	}
	function evaluate(fixtures) {
		if (!fixtures || !Array.isArray(fixtures.cases) || fixtures.cases.length !== 20) throw new Error("fixed synthetic20 required");
		const runs = [];
		let assertions = 0;
		function equal(actual, expected, label, failures) {
			assertions++;
			if (!equalValue(actual, expected)) failures.push({
				label,
				expected,
				actual
			});
		}
		function checkExpected(actual, expected, label, failures) {
			for (const [key, value] of Object.entries(expectedExpanded(expected))) if (key === "sourceSeq" || key === "inkCounts") for (const [sub, v] of Object.entries(value)) equal(actual[key]?.[sub], v, `${label}.${key}.${sub}`, failures);
			else equal(actual[key], value, `${label}.${key}`, failures);
		}
		function invariants(state, label, failures) {
			const actual = inspect(state), body = state.material.body;
			equal(body.length <= state.bodyLimit && state.bodyLimit <= 256, true, `${label}.bodyBound`, failures);
			equal(actual.ids, Array.from({ length: body.length }, (_, i) => i + 1), `${label}.soleMonotonicAllocator`, failures);
			equal(state.material.nextId, body.length + 1, `${label}.nextId`, failures);
			equal(state.material.presented >= 0 && state.material.presented <= body.length, true, `${label}.presentationBound`, failures);
			equal(actual.windowUtf16 <= 128, true, `${label}.windowBound`, failures);
			equal(state.shape.recent.length <= 64, true, `${label}.chunkBound`, failures);
			equal(state.canonical.preview.length <= 64, true, `${label}.previewBound`, failures);
			equal((state.canonical.document?.text.length ?? 0) <= 512, true, `${label}.documentBound`, failures);
			equal(actual.pendingSlots <= 1, true, `${label}.pendingSlotBound`, failures);
			equal("body" in state.canonical || "nextId" in state.canonical || "body" in state.shape || "nextId" in state.shape, false, `${label}.noSecondBody`, failures);
			equal(Object.values(state.history).every((rows) => rows.length <= 64), true, `${label}.historyBound`, failures);
			equal(Object.values(state.metrics).every((n) => Number.isSafeInteger(n) && n >= 0 && n <= 1e6), true, `${label}.counterBound`, failures);
			equal(state.history.forwarded.every((r, i) => i === 0 || r.seq === state.history.forwarded[i - 1].seq + 1), true, `${label}.normalizedContiguous`, failures);
			equal(state.history.reveals.every((r) => r.count <= 4), true, `${label}.revealBound`, failures);
			equal([...readBody(state)], body.map(({ id, text, ink }) => ({
				id,
				text,
				ink
			})), `${label}.readonlyProjection`, failures);
			for (const r of state.shape.recent) equal([
				r.start,
				r.end,
				r.trim,
				r.at,
				r.seq
			].every(Number.isSafeInteger) && r.start >= 0 && r.end > r.start && r.end <= body.length && r.trim >= 0 && !("text" in r), true, `${label}.windowRef`, failures);
		}
		function storageChecks(state, failures) {
			const exported = exportReceiver(state);
			equal(validateStorage(exported).valid, true, "storage.strictAllowlist", failures);
			if (state.savingOff) {
				const restored = restartFromExport(exported);
				equal(inspect(restored).units, 0, "storage.offRestartEmpty", failures);
				equal(inspect(restored).windowUtf16, 0, "storage.offRestartNoWindow", failures);
				equal(restored.canonical.document, null, "storage.offRestartNoMirror", failures);
				equal(restored.shape.pending, null, "storage.offRestartNoQuery", failures);
			} else {
				equal(exported.body, state.material.body.map(({ id, text, ink }) => ({
					id,
					text,
					ink
				})), "storage.onAdmittedOnly", failures);
				let rejected = false;
				try {
					createReceiver({ savingOff: false });
				} catch {
					rejected = true;
				}
				equal(rejected, true, "storage.optInRequired", failures);
			}
			return exported;
		}
		for (const fixture of fixtures.cases) {
			const state = createReceiver(fixture.config), failures = [], traces = [], built = [], probe = { count: 0 };
			let retry = null, retryPeak = 0, receiveCalls = 0;
			try {
				for (let i = 0; i < fixture.events.length; i++) {
					const step = fixture.events[i];
					if (step.check) {
						advanceTo(state, step.at);
						checkExpected(inspect(state), step.check, `${fixture.id}.checkpoint${i}`, failures);
						traces.push({
							index: i,
							at: step.at,
							checkpoint: inspect(state)
						});
						built.push(null);
						continue;
					}
					advance(state, step.at, false);
					const event = step.alias === void 0 ? buildEvent(step, state, probe) : built[step.alias];
					built.push(event);
					receiveCalls++;
					const before = inspect(state), ack = receive(state, event, step.at), after = inspect(state);
					if (!ack.ack) {
						if (retry && retry !== event) failures.push({ label: "producer.moreThanOneRetrySlot" });
						retry = event;
						retryPeak = Math.max(retryPeak, 1);
						for (const key of [
							"body",
							"ids",
							"inks",
							"document",
							"serial",
							"normalizedSeq",
							"nextId"
						]) equal(after[key], before[key], `${fixture.id}.noAckPreserves.${key}`, failures);
						equal(after.sourceSeq[event.source], before.sourceSeq[event.source], `${fixture.id}.noAckSourceSeq`, failures);
					} else if (retry === event || ack.status === "unsupported") retry = null;
					if (ack.added) {
						equal(after.units - before.units, ack.added, `${fixture.id}.ackAfterWholeAdd`, failures);
						equal(state.material.body.slice(0, before.units), before.ids.map((id, j) => ({
							id,
							text: before.unitTexts[j],
							ink: before.inks[j]
						})), `${fixture.id}.oldIdentityRetained`, failures);
					}
					invariants(state, `${fixture.id}.step${i}`, failures);
					traces.push({
						index: i,
						at: step.at,
						observedAt: event.observedAt,
						source: event.source,
						seq: event.seq,
						kind: event.kind,
						ack,
						after,
						bodyView: [...readBody(state)],
						shapeToken: state.shape.pending ? latestAnswer(state) : null
					});
					if (fixture.events[i + 1]?.at !== step.at) advanceTo(state, step.at);
				}
				advanceTo(state, fixture.horizon ?? fixtures.defaults.horizon);
				const exported = storageChecks(state, failures), actual = inspect(state);
				actual.payloadReads = probe.count;
				actual.producerRetryPeak = retryPeak;
				actual.exportMode = state.savingOff ? "off" : "on";
				actual.optInRequired = !state.savingOff;
				if (state.savingOff) {
					const restarted = inspect(restartFromExport(exported));
					actual.restartUnits = restarted.units;
					actual.restartWindowUtf16 = restarted.windowUtf16;
				}
				checkExpected(actual, fixture.expected, fixture.id, failures);
				invariants(state, `${fixture.id}.final`, failures);
				runs.push({
					id: fixture.id,
					passed: failures.length === 0,
					failures,
					actual,
					receiveCalls,
					exported,
					histories: state.history,
					traces,
					finalBodyView: [...readBody(state)],
					finalShapeToken: state.shape.pending ? latestAnswer(state) : null
				});
			} catch (error) {
				runs.push({
					id: fixture.id,
					passed: false,
					failures: [...failures, {
						label: "exception",
						message: error.message
					}],
					actual: inspect(state),
					receiveCalls,
					traces,
					payloadReads: probe.count
				});
			}
		}
		return {
			grammar: GRAMMAR,
			scope: "Synthetic20 CPU engine portability, no OS/UI/IME/realbodyinput",
			cases: runs.length,
			passed: runs.filter((r) => r.passed).length,
			assertions,
			receiveCalls: runs.reduce((n, r) => n + r.receiveCalls, 0),
			actualLexicalQueryCalls: runs.reduce((n, r) => n + r.actual.queries, 0),
			runs
		};
	}
	function evaluateJSON(input) {
		return JSON.stringify(evaluate(JSON.parse(input)));
	}

//#endregion
//#region desktop/glyph-metal-ambient-v1/Sources/receiver-bridge.mjs
	const TEST_STATE = /* @__PURE__ */ new WeakMap();
	const INKS = /* @__PURE__ */ new Set([
		"white",
		"blue",
		"green",
		"purple"
	]);
	const integer = (n) => Number.isSafeInteger(n) && n >= 0;
	const safeBoundary = (text, n) => integer(n) && n <= text.length && (n === 0 || n === text.length || !(text.charCodeAt(n - 1) >= 55296 && text.charCodeAt(n - 1) <= 56319 && text.charCodeAt(n) >= 56320 && text.charCodeAt(n) <= 57343));
	const validText = (text) => typeof text === "string" && text.length <= 512 && singleDiff("", text) !== null;
	const literal = (a, b) => a === b;
	function freeze(value) {
		if (Array.isArray(value)) return Object.freeze(value.map(freeze));
		if (value && typeof value === "object") return Object.freeze(Object.fromEntries(Object.entries(value).map(([k, v]) => [k, freeze(v)])));
		return value;
	}
	function createSession() {
		const state = createReceiver({
			savingOff: true,
			bodyLimit: 256,
			shapeMode: "inline"
		});
		let initialized = false, composition = null, selectedInk = "blue", compositionSerial = 0, last = {
			status: "ready",
			reason: "ready"
		}, retired = false;
		const header = (source, kind, data, options = {}) => freeze({
			grammar: state.grammar,
			source,
			session: "lab",
			seq: state.sources[source].seq + 1,
			focusEpoch: options.focusEpoch ?? state.focusEpoch,
			policyEpoch: state.policyEpoch,
			observedAt: state.now,
			evidence: options.evidence ?? "none",
			kind,
			data,
			...options.serial ? {
				serial: options.serial,
				operationId: `e${state.focusEpoch}-p${state.policyEpoch}-c${options.serial}`
			} : {}
		});
		const deliver = (event) => {
			last = receive(state, event, state.now);
			return last;
		};
		function cancel() {
			if (composition) deliver(header("editor", "composition-cancel", { compositionId: composition.id }));
			composition = null;
		}
		function observe(value, reason = "unknown-native-input") {
			if (!validText(value)) {
				last = {
					status: "held",
					reason: "document-limit"
				};
				return;
			}
			const doc = state.canonical.document;
			if (!doc || state.canonical.needsResync) deliver(header("editor", "baseline", {
				documentId: "nativeEditor",
				version: (doc?.version ?? -1) + 1,
				text: value
			}));
			else {
				const changes = singleDiff(doc.text, value);
				if (changes.length) deliver(header("editor", "document-edit", {
					documentId: "nativeEditor",
					baseVersion: doc.version,
					version: doc.version + 1,
					reason: "replace",
					ink: selectedInk,
					changes
				}, { evidence: "document-only" }));
			}
			last = {
				status: "unknown",
				reason
			};
		}
		function commit(command) {
			const doc = state.canonical.document, c = composition;
			const base = c?.base ?? command.base, range = c?.range ?? command.range;
			const text = command.text, value = command.value;
			const validRange = Array.isArray(range) && range.length === 2 && integer(range[0]) && integer(range[1]) && validText(base) && safeBoundary(base, range[0]) && safeBoundary(base, range[0] + range[1]);
			if (!doc || !validRange || !validText(value) || typeof text !== "string" || singleDiff("", text) === null || command.postMarked === true || command.fromComposition === true && !c || !literal(command.base, base) || !literal(doc.text, base) || c && (command.range?.[0] !== range[0] || command.range?.[1] !== range[1]) || !literal(base.slice(0, range[0]) + text + base.slice(range[0] + range[1]), value)) {
				cancel();
				observe(value, "unknown-native-commit-trace");
				return;
			}
			const data = {
				documentId: "nativeEditor",
				baseVersion: doc.version,
				version: doc.version + 1,
				reason: "type",
				ink: c?.ink ?? selectedInk,
				changes: [{
					offset: range[0],
					deleteCount: range[1],
					text
				}],
				...c ? { compositionId: c.id } : {}
			};
			if (!deliver(header("editor", c ? "composition-final" : "document-edit", data, {
				evidence: "synthetic-commit",
				serial: state.canonical.lastSerial + 1
			})).ack) last = {
				status: "unsupported",
				reason: "native-producer-no-retry-route"
			};
			composition = null;
		}
		function aggregate() {
			return {
				version: "metal-ambient-v1-r1",
				savingOff: true,
				bodyCount: state.material.body.length,
				presentedCount: state.material.presented,
				shape: state.shape.current,
				status: last.status,
				reason: last.reason,
				pending: Boolean(state.pending),
				composing: Boolean(composition),
				paused: state.paused,
				visible: state.visible,
				now: state.now
			};
		}
		function frameView() {
			return {
				aggregate: aggregate(),
				units: [...readBody(state)],
				presentedCount: state.material.presented,
				shape: state.shape.current,
				shapeToken: state.shape.pending ? latestAnswer(state) : null
			};
		}
		function execute(command) {
			if (retired) return frameView();
			if (!command || !integer(command.at) || command.at < state.now) throw new Error("monotonic native command required");
			advanceTo(state, command.at);
			if (composition && command.at >= composition.at + 5e3) {
				cancel();
				last = {
					status: "unknown",
					reason: "native-preedit-expired"
				};
			}
			if (command.op === "init") {
				if (initialized) throw new Error("single session initialization");
				initialized = true;
				deliver(header("system", "focus", {
					field: "normal",
					documentId: "nativeEditor"
				}, { focusEpoch: 1 }));
				observe(command.value ?? "", "initial-baseline-not-material");
				last = {
					status: "ready",
					reason: "ready"
				};
			} else if (!initialized) throw new Error("initialize dedicated editor before receiving");
			else if (command.op === "commit") commit(command);
			else if (command.op === "observe") {
				cancel();
				observe(command.value);
			} else if (command.op === "ink") {
				if (!INKS.has(command.ink)) throw new Error("fixed ink");
				selectedInk = command.ink;
			} else if (command.op === "mark-start") {
				cancel();
				const doc = state.canonical.document, r = command.range;
				if (!doc || command.base !== doc.text || !Array.isArray(r) || r.length !== 2 || !integer(r[1]) || !safeBoundary(doc.text, r[0]) || !safeBoundary(doc.text, r[0] + r[1])) last = {
					status: "unknown",
					reason: "unknown-native-mark-range"
				};
				else {
					compositionSerial = Math.min(1e6, compositionSerial + 1);
					composition = {
						id: `nativeIME${compositionSerial}`,
						base: doc.text,
						range: r.slice(),
						ink: selectedInk,
						at: state.now
					};
					deliver(header("editor", "composition-start", { compositionId: composition.id }));
					last = {
						status: "composition",
						reason: "preedit-only"
					};
				}
			} else if (command.op === "mark-update") {
				if (composition && validText(command.text)) {
					let end = Math.min(64, command.text.length);
					if (!safeBoundary(command.text, end)) end--;
					deliver(header("editor", "composition-update", {
						compositionId: composition.id,
						text: command.text.slice(0, end)
					}));
					last = {
						status: "composition",
						reason: "preedit-only"
					};
				}
			} else if (command.op === "mark-cancel") {
				cancel();
				observe(command.value ?? "", "unmark-is-not-confirmation");
			} else if (command.op === "pause") deliver(header("system", "pause", { paused: command.value }));
			else if (command.op === "visible") deliver(header("system", "visibility", { visible: command.value }));
			else if (command.op === "advance" || command.op === "checkpoint") {} else throw new Error("unsupported native command");
			return frameView();
		}
		const api = Object.freeze({
			executeJSON: (json) => JSON.stringify(execute(JSON.parse(json))),
			snapshotJSON: () => JSON.stringify(frameView()),
			aggregateJSON: () => JSON.stringify(aggregate()),
			offExportJSON() {
				const value = exportReceiver(state);
				if (!validateStorage(value).valid || value.savingOff !== true) throw new Error("off export failed");
				return JSON.stringify(value);
			},
			destroy() {
				if (retired) return;
				cancel();
				deliver(header("system", "pause", { paused: true }));
				retired = true;
			}
		});
		TEST_STATE.set(api, {
			state,
			execute
		});
		return api;
	}
	const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
	function expanded(expected) {
		const out = { ...expected };
		if (out.bodyRepeat) {
			out.body = out.bodyRepeat.text.repeat(out.bodyRepeat.count);
			delete out.bodyRepeat;
		}
		if (out.documentRepeat) {
			out.document = out.documentRepeat.text.repeat(out.documentRepeat.count) + (out.documentRepeat.suffix ?? "");
			delete out.documentRepeat;
		}
		if (out.idsRange) {
			out.ids = Array.from({ length: out.idsRange[1] - out.idsRange[0] + 1 }, (_, i) => i + out.idsRange[0]);
			delete out.idsRange;
		}
		if (out.inkRepeat) {
			out.inks = Array(out.inkRepeat.count).fill(out.inkRepeat.ink);
			delete out.inkRepeat;
		}
		return out;
	}
	function evaluateManualJSON(json) {
		const fixtures = JSON.parse(json), runs = [];
		if (fixtures.cases?.length !== 12) throw new Error("fixed manual12 required");
		for (const fixture of fixtures.cases) {
			const api = createSession(), { state, execute } = TEST_STATE.get(api), failures = [], traces = [];
			const check = (actual, expected, label) => {
				if (!same(actual, expected)) failures.push({
					label,
					actual,
					expected
				});
			};
			try {
				for (const original of fixture.commands) {
					let command = original;
					if (original.op === "commit-repeat" || original.op === "commit-after-current") {
						const text = original.op === "commit-repeat" ? original.text.repeat(original.count) : original.text;
						const base = state.canonical.document?.text ?? "";
						command = {
							op: "commit",
							at: original.at,
							base,
							value: base + text,
							text,
							range: [base.length, 0]
						};
					}
					const view = execute(command), actual = inspect(state);
					if (command.expectedBodyCount !== void 0) check(actual.units, command.expectedBodyCount, "checkpoint.body");
					if (command.expectedPresented !== void 0) check(actual.presented, command.expectedPresented, "checkpoint.presented");
					if (command.expectedQueries !== void 0) check(actual.queries, command.expectedQueries, "checkpoint.queries");
					check(actual.units <= 256 && actual.presented <= actual.units && actual.windowUtf16 <= 128 && (actual.document?.text.length ?? 0) <= 512, true, "finite");
					check(view.units.map((u) => u.id), Array.from({ length: actual.units }, (_, i) => i + 1), "same-original-ids");
					traces.push({
						command,
						view,
						document: actual.document
					});
				}
				const actual = inspect(state), off = JSON.parse(api.offExportJSON());
				const result = {
					body: actual.body,
					unitTexts: actual.unitTexts,
					ids: actual.ids,
					inks: actual.inks,
					shape: actual.shape,
					document: actual.document?.text ?? "",
					placeholder: actual.presented === 0,
					lastHoldReason: actual.holdReasons.at(-1) ?? null,
					offExportAggregateOnly: validateStorage(off).valid && !("body" in off)
				};
				for (const [key, value] of Object.entries(expanded(fixture.expected))) check(result[key], value, `final.${key}`);
				runs.push({
					id: fixture.id,
					passed: failures.length === 0,
					failures,
					actual: result,
					finalView: JSON.parse(api.snapshotJSON()),
					offExport: off,
					traces
				});
			} catch (error) {
				runs.push({
					id: fixture.id,
					passed: false,
					failures: [...failures, {
						label: "exception",
						message: error.message
					}],
					traces
				});
			}
		}
		return JSON.stringify({
			version: "native-ambient-manual-r1",
			cases: runs.length,
			passed: runs.filter((r) => r.passed).length,
			runs
		});
	}

//#endregion
exports.createSession = createSession;
exports.evaluateManualJSON = evaluateManualJSON;
exports.evaluateOriginal20JSON = evaluateJSON;
return exports;
})({});