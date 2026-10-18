// ../../../AppData/Local/Temp/claude/c--Users-Home-Downloads-FocusPane/4bd70a42-eb07-4ace-8f2a-8cc035bf583e/scratchpad/ragtest.ts
import { pipeline } from "@huggingface/transformers";

// src/rag/seedDocs.ts
var SEED_PREFIX = "seed-v1-";
var chunks = [
  {
    docTitle: "OM-PUMP-101 Feed Water Pump Manual \xA74.2",
    tagReference: "PUMP-101A",
    content: "High vibration on PUMP-101A above 7.1 mm/s RMS: verify suction pressure and deaerator level first, as cavitation is the most common cause. If suction is normal, transfer load to standby pump PUMP-101B and inspect coupling alignment and bearing temperatures."
  },
  {
    docTitle: "Maintenance Log WO-23817",
    tagReference: "PUMP-101A",
    content: "PUMP-101A vibration alarm traced to worn drive-end bearing. Bearing replaced and laser alignment performed. Recommend vibration trending review weekly for 30 days after any bearing work."
  },
  {
    docTitle: "OM-VALVE-204 Pressure Relief Procedure \xA72.1",
    tagReference: "VALVE-204",
    content: "Main steam pressure relief VALVE-204 open indication: confirm steam header pressure on PRESS-210. If header pressure is below setpoint and valve remains open, suspect a stuck pilot or loss of instrument air. Do not attempt manual reseat while the line is pressurized."
  },
  {
    docTitle: "Emergency Operating Procedure EOP-3 Core Temperature",
    tagReference: "TEMP-302",
    content: "Reactor vessel core temperature high on TEMP-302: immediately verify coolant loop flow on FLOW-105. Low coolant flow combined with rising core temperature requires rapid power reduction per EOP-3 step 4 and notification of the shift supervisor."
  },
  {
    docTitle: "Instrument Calibration Record IC-302",
    tagReference: "TEMP-302",
    content: "TEMP-302 thermocouple drift of +4 degC found during last outage calibration. Cross-check against redundant sensor TEMP-302B before acting on a single high reading."
  },
  {
    docTitle: "OM-FLOW-105 Coolant Loop Manual \xA73.4",
    tagReference: "FLOW-105",
    content: "Coolant loop low flow on FLOW-105 is usually downstream of a feed pump issue. Check PUMP-101A status and strainer differential pressure. A clogged strainer shows a rising differential above 0.8 bar."
  },
  {
    docTitle: "Electrical Operations Guide EOG-12 Bus Voltage",
    tagReference: "ELEC-401",
    content: "Substation B bus voltage sag on ELEC-401 can trip motor-driven equipment, including feed water pumps and the instrument air compressor. Check the upstream transformer tap changer and expect sympathetic alarms on PUMP-101A and COMP-501."
  },
  {
    docTitle: "OM-DEA-110 Deaerator Operations \xA75",
    tagReference: "LEVEL-110",
    content: "Deaerator tank level low on LEVEL-110 reduces net positive suction head for the feed pumps. Increase makeup water flow and verify the level control valve is not stuck. Sustained low level will cause PUMP-101A cavitation and vibration."
  },
  {
    docTitle: "OM-COMP-501 Instrument Air System",
    tagReference: "COMP-501",
    content: "Instrument air compressor trip on COMP-501: start the standby compressor and monitor air header pressure. Below 5.5 bar, air-operated valves including VALVE-204 may fail to their safe position."
  },
  {
    docTitle: "OM-PRESS-210 Steam Header Control",
    tagReference: "PRESS-210",
    content: "Steam header pressure high on PRESS-210: check turbine load rejection and the pressure controller output. If pressure continues rising, relief valve VALVE-204 is expected to lift at 92 bar."
  },
  {
    docTitle: "Shift Handover Standard SHS-1",
    content: "During an alarm flood, address the highest-impact root cause first rather than the oldest alarm. Acknowledge consequential alarms only after confirming the upstream cause, and record isolations in the handover summary."
  },
  {
    docTitle: "Alarm Management Philosophy AMP-2",
    content: "Alarms are ranked by process impact rather than arrival time. Impact scores above 0.8 indicate a risk to safety or production and must be addressed within 5 minutes; scores between 0.5 and 0.8 within 30 minutes."
  }
];
var SEED_DOCS = chunks.map((c, i) => ({ ...c, id: `${SEED_PREFIX}${i}` }));

// node_modules/idb/build/index.js
var instanceOfAny = (object, constructors) => constructors.some((c) => object instanceof c);
var idbProxyableTypes;
var cursorAdvanceMethods;
function getIdbProxyableTypes() {
  return idbProxyableTypes || (idbProxyableTypes = [
    IDBIndex,
    IDBObjectStore,
    IDBCursor,
    IDBDatabase,
    IDBTransaction
  ]);
}
function getCursorAdvanceMethods() {
  return cursorAdvanceMethods || (cursorAdvanceMethods = ["advance", "continue", "continuePrimaryKey"].map((method) => IDBCursor.prototype[method]));
}
var transactionDoneMap = /* @__PURE__ */ new WeakMap();
var transformCache = /* @__PURE__ */ new WeakMap();
var reverseTransformCache = /* @__PURE__ */ new WeakMap();
function promisifyRequest(request) {
  const promise = new Promise((resolve, reject) => {
    const unlisten = () => {
      request.removeEventListener("success", success);
      request.removeEventListener("error", error);
    };
    const success = () => {
      resolve(wrap(request.result));
      unlisten();
    };
    const error = () => {
      reject(request.error);
      unlisten();
    };
    request.addEventListener("success", success);
    request.addEventListener("error", error);
  });
  reverseTransformCache.set(promise, request);
  return promise;
}
function cacheDonePromiseForTransaction(tx) {
  if (transactionDoneMap.has(tx))
    return;
  const done = new Promise((resolve, reject) => {
    const unlisten = () => {
      tx.removeEventListener("complete", complete);
      tx.removeEventListener("error", error);
      tx.removeEventListener("abort", error);
    };
    const complete = () => {
      resolve();
      unlisten();
    };
    const error = () => {
      reject(tx.error || new DOMException("AbortError", "AbortError"));
      unlisten();
    };
    tx.addEventListener("complete", complete);
    tx.addEventListener("error", error);
    tx.addEventListener("abort", error);
  });
  transactionDoneMap.set(tx, done);
}
var idbProxyTraps = {
  get(target, prop, receiver) {
    if (target instanceof IDBTransaction) {
      if (prop === "done")
        return transactionDoneMap.get(target);
      if (prop === "store") {
        return receiver.objectStoreNames[1] ? void 0 : receiver.objectStore(receiver.objectStoreNames[0]);
      }
    }
    return wrap(target[prop]);
  },
  set(target, prop, value) {
    target[prop] = value;
    return true;
  },
  has(target, prop) {
    if (target instanceof IDBTransaction && (prop === "done" || prop === "store")) {
      return true;
    }
    return prop in target;
  }
};
function replaceTraps(callback) {
  idbProxyTraps = callback(idbProxyTraps);
}
function wrapFunction(func) {
  if (getCursorAdvanceMethods().includes(func)) {
    return function(...args) {
      func.apply(unwrap(this), args);
      return wrap(this.request);
    };
  }
  return function(...args) {
    return wrap(func.apply(unwrap(this), args));
  };
}
function transformCachableValue(value) {
  if (typeof value === "function")
    return wrapFunction(value);
  if (value instanceof IDBTransaction)
    cacheDonePromiseForTransaction(value);
  if (instanceOfAny(value, getIdbProxyableTypes()))
    return new Proxy(value, idbProxyTraps);
  return value;
}
function wrap(value) {
  if (value instanceof IDBRequest)
    return promisifyRequest(value);
  if (transformCache.has(value))
    return transformCache.get(value);
  const newValue = transformCachableValue(value);
  if (!Object.is(newValue, value)) {
    transformCache.set(value, newValue);
    reverseTransformCache.set(newValue, value);
  }
  return newValue;
}
var unwrap = (value) => reverseTransformCache.get(value);
var readMethods = ["get", "getKey", "getAll", "getAllKeys", "count"];
var writeMethods = ["put", "add", "delete", "clear"];
var cachedMethods = {};
function getMethod(target, prop) {
  if (!(target instanceof IDBDatabase && !(prop in target) && typeof prop === "string")) {
    return;
  }
  if (cachedMethods[prop])
    return cachedMethods[prop];
  const targetFuncName = prop.replace(/FromIndex$/, "");
  const useIndex = prop !== targetFuncName;
  const isWrite = writeMethods.includes(targetFuncName);
  if (
    // Bail if the target doesn't exist on the target. Eg, getAll isn't in Edge.
    !(targetFuncName in (useIndex ? IDBIndex : IDBObjectStore).prototype) || !(isWrite || readMethods.includes(targetFuncName))
  ) {
    return;
  }
  const method = async function(storeName, ...args) {
    const tx = this.transaction(storeName, isWrite ? "readwrite" : "readonly");
    let target2 = tx.store;
    if (useIndex)
      target2 = target2.index(args.shift());
    return (await Promise.all([
      target2[targetFuncName](...args),
      isWrite && tx.done
    ]))[0];
  };
  return cachedMethods[prop] = method;
}
replaceTraps((oldTraps) => ({
  ...oldTraps,
  get: (target, prop, receiver) => getMethod(target, prop) || oldTraps.get(target, prop, receiver),
  has: (target, prop) => !!getMethod(target, prop) || oldTraps.has(target, prop)
}));
var advanceMethodProps = ["advance", "continue", "continuePrimaryKey"];
var methodMap = {};
var advanceResults = /* @__PURE__ */ new WeakMap();
var ittrProxiedCursorToOriginalProxy = /* @__PURE__ */ new WeakMap();
var cursorIteratorTraps = {
  get(target, prop) {
    if (!advanceMethodProps.includes(prop))
      return target[prop];
    let cachedFunc = methodMap[prop];
    if (!cachedFunc) {
      cachedFunc = methodMap[prop] = function(...args) {
        advanceResults.set(this, ittrProxiedCursorToOriginalProxy.get(this)[prop](...args));
      };
    }
    return cachedFunc;
  }
};
async function* iterate(...args) {
  let cursor = this;
  if (!(cursor instanceof IDBCursor)) {
    cursor = await cursor.openCursor(...args);
  }
  if (!cursor)
    return;
  cursor = cursor;
  const proxiedCursor = new Proxy(cursor, cursorIteratorTraps);
  ittrProxiedCursorToOriginalProxy.set(proxiedCursor, cursor);
  reverseTransformCache.set(proxiedCursor, unwrap(cursor));
  while (cursor) {
    yield proxiedCursor;
    cursor = await (advanceResults.get(proxiedCursor) || cursor.continue());
    advanceResults.delete(proxiedCursor);
  }
}
function isIteratorProp(target, prop) {
  return prop === Symbol.asyncIterator && instanceOfAny(target, [IDBIndex, IDBObjectStore, IDBCursor]) || prop === "iterate" && instanceOfAny(target, [IDBIndex, IDBObjectStore]);
}
replaceTraps((oldTraps) => ({
  ...oldTraps,
  get(target, prop, receiver) {
    if (isIteratorProp(target, prop))
      return iterate;
    return oldTraps.get(target, prop, receiver);
  },
  has(target, prop) {
    return isIteratorProp(target, prop) || oldTraps.has(target, prop);
  }
}));

// src/rag/storage.ts
function cosineSimilarity(a, b) {
  if (a.length !== b.length || a.length === 0) return 0;
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}
function tokenize(text) {
  return text.toLowerCase().match(/[a-z0-9]+(?:-[a-z0-9]+)*/g) ?? [];
}
function buildBM25Stats(texts) {
  const docFrequency = /* @__PURE__ */ new Map();
  let totalLength = 0;
  for (const text of texts) {
    const terms = tokenize(text);
    totalLength += terms.length;
    for (const term of new Set(terms)) {
      docFrequency.set(term, (docFrequency.get(term) ?? 0) + 1);
    }
  }
  return {
    docCount: texts.length,
    avgDocLength: texts.length > 0 ? totalLength / texts.length : 0,
    docFrequency
  };
}
function computeBM25Score(query, text, stats2) {
  const queryTerms = new Set(tokenize(query));
  const textTerms = tokenize(text);
  if (textTerms.length === 0 || stats2.docCount === 0) return 0;
  const termFreq = /* @__PURE__ */ new Map();
  for (const t of textTerms) termFreq.set(t, (termFreq.get(t) ?? 0) + 1);
  let score = 0;
  const k1 = 1.2;
  const b = 0.75;
  const avgdl = stats2.avgDocLength || textTerms.length;
  const docLen = textTerms.length;
  for (const term of queryTerms) {
    const tf = termFreq.get(term) ?? 0;
    if (tf > 0) {
      const df = stats2.docFrequency.get(term) ?? 0;
      const idf = Math.log(1 + (stats2.docCount - df + 0.5) / (df + 0.5));
      const num = tf * (k1 + 1);
      const denom = tf + k1 * (1 - b + b * (docLen / avgdl));
      score += idf * (num / denom);
    }
  }
  return score;
}
function reciprocalRankFusion(vectorRankings, bm25Rankings, k = 60) {
  const scores = /* @__PURE__ */ new Map();
  vectorRankings.forEach((chunk, rank) => {
    const rrfScore = 1 / (k + (rank + 1));
    scores.set(chunk.id, { chunk, score: rrfScore });
  });
  bm25Rankings.forEach((chunk, rank) => {
    const rrfScore = 1 / (k + (rank + 1));
    const existing = scores.get(chunk.id);
    if (existing) {
      existing.score += rrfScore;
    } else {
      scores.set(chunk.id, { chunk, score: rrfScore });
    }
  });
  return Array.from(scores.values()).sort((a, b) => b.score - a.score).map((item) => item.chunk);
}

// ../../../AppData/Local/Temp/claude/c--Users-Home-Downloads-FocusPane/4bd70a42-eb07-4ace-8f2a-8cc035bf583e/scratchpad/ragtest.ts
var ex = await pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2");
var emb = async (t) => Array.from((await ex(t, { pooling: "mean", normalize: true })).data);
var docs = [];
for (const d of SEED_DOCS) docs.push({ ...d, embedding: await emb(d.content) });
var stats = buildBM25Stats(docs.map((d) => d.content));
for (const q of ["PUMP-101A Feed Water Pump High Vibration", "TEMP-302 Reactor Vessel Core Temp High", "VALVE-204 Main Steam Line Pressure Relief Open", "cavitation"]) {
  const qe = await emb(q);
  const v = docs.map((c) => ({ c, s: cosineSimilarity(qe, c.embedding) })).sort((a, b2) => b2.s - a.s).map((x) => x.c);
  const b = docs.map((c) => ({ c, s: computeBM25Score(q, c.content, stats) })).filter((x) => x.s > 0).sort((a, b2) => b2.s - a.s).map((x) => x.c);
  console.log(q, "=>", reciprocalRankFusion(v.slice(0, 10), b.slice(0, 10)).slice(0, 3).map((c) => c.docTitle));
}
