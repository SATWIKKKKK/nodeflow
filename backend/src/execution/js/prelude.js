/*
 * Runs inside the learner's sandbox context, before their code. It gives them
 * the node classes LeetCode gives them (ListNode, TreeNode...), a console, and
 * it holds what the harness needs there: input builders, output serialisers,
 * and the tracer that instrumented code reports to (see instrument.mjs).
 *
 * Everything is built inside the context, so the arrays and objects the
 * learner's code receives are from its own realm (`instanceof Array` holds).
 * Mirrors python/tracer.py: same inputs, same outputs, same trace shape.
 */
(function () {
  "use strict";
  const G = globalThis;
  const MAX_OBJECTS = 160;
  const MAX_STRING = 240;
  const MAX_STDOUT = 64000;

  const hide = (name, value) =>
    Object.defineProperty(G, name, { value, writable: true, configurable: true, enumerable: false });

  // ---------------------------------------------------------------------------
  // Node classes, as LeetCode defines them for JavaScript and TypeScript
  // ---------------------------------------------------------------------------

  class ListNode {
    constructor(val, next) {
      this.val = val === undefined ? 0 : val;
      this.next = next === undefined ? null : next;
    }
  }
  class DListNode {
    constructor(val, prev, next) {
      this.val = val === undefined ? 0 : val;
      this.prev = prev === undefined ? null : prev;
      this.next = next === undefined ? null : next;
    }
  }
  class RandomNode {
    constructor(val, next, random) {
      this.val = val === undefined ? 0 : val;
      this.next = next === undefined ? null : next;
      this.random = random === undefined ? null : random;
    }
  }
  class ChildNode {
    constructor(val, next, child) {
      this.val = val === undefined ? 0 : val;
      this.next = next === undefined ? null : next;
      this.child = child === undefined ? null : child;
    }
  }
  class TreeNode {
    constructor(val, left, right) {
      this.val = val === undefined ? 0 : val;
      this.left = left === undefined ? null : left;
      this.right = right === undefined ? null : right;
    }
  }
  hide("ListNode", ListNode);
  hide("DListNode", DListNode);
  hide("RandomNode", RandomNode);
  hide("ChildNode", ChildNode);
  hide("TreeNode", TreeNode);

  // ---------------------------------------------------------------------------
  // console: what the learner prints, Node-style, capped
  // ---------------------------------------------------------------------------

  let stdout = "";
  const write = (text) => {
    if (stdout.length < MAX_STDOUT) stdout += text;
  };

  const inspect = (value, depth = 0, seen = new Set()) => {
    if (value === null) return "null";
    if (value === undefined) return "undefined";
    const type = typeof value;
    if (type === "string") return depth === 0 ? value : `'${value}'`;
    if (type === "number") return Object.is(value, -0) ? "-0" : String(value);
    if (type === "bigint") return `${value}n`;
    if (type === "boolean" || type === "symbol") return String(value);
    if (type === "function") return `[Function: ${value.name || "(anonymous)"}]`;
    if (seen.has(value)) return "[Circular *1]";
    if (depth > 2) return Array.isArray(value) ? "[Array]" : "[Object]";
    seen.add(value);
    try {
      const tag = Object.prototype.toString.call(value);
      if (Array.isArray(value) || (ArrayBuffer.isView(value) && !(value instanceof DataView))) {
        const items = Array.from(value).slice(0, 100).map((item) => inspect(item, depth + 1, seen));
        if (value.length > 100) items.push(`... ${value.length - 100} more items`);
        return items.length ? `[ ${items.join(", ")} ]` : "[]";
      }
      if (tag === "[object Map]") {
        const items = [...value].slice(0, 100).map(([k, v]) => `${inspect(k, depth + 1, seen)} => ${inspect(v, depth + 1, seen)}`);
        return `Map(${value.size}) {${items.length ? ` ${items.join(", ")} ` : ""}}`;
      }
      if (tag === "[object Set]") {
        const items = [...value].slice(0, 100).map((item) => inspect(item, depth + 1, seen));
        return `Set(${value.size}) {${items.length ? ` ${items.join(", ")} ` : ""}}`;
      }
      if (value instanceof Error) return value.stack ? String(value.stack).split("\n")[0] : String(value);
      const proto = Object.getPrototypeOf(value);
      const name = proto && proto !== Object.prototype && proto.constructor ? proto.constructor.name : "";
      const entries = Object.keys(value)
        .slice(0, 100)
        .map((key) => `${/^[A-Za-z_$][\w$]*$/.test(key) ? key : `'${key}'`}: ${inspect(value[key], depth + 1, seen)}`);
      const body = entries.length ? `{ ${entries.join(", ")} }` : "{}";
      return name ? `${name} ${body}` : body;
    } finally {
      seen.delete(value);
    }
  };

  const print = (...args) => write(`${args.map((arg) => inspect(arg)).join(" ")}\n`);
  hide("console", {
    log: print,
    info: print,
    debug: print,
    warn: print,
    error: print,
    trace: print,
    dir: (value) => print(value),
    table: (value) => print(value)
  });

  // ---------------------------------------------------------------------------
  // Input builders
  // ---------------------------------------------------------------------------

  const buildList = (values, tail = null) => {
    let head = tail;
    const list = values || [];
    for (let i = list.length - 1; i >= 0; i -= 1) head = new ListNode(list[i], head);
    return head;
  };

  const buildDll = (values) => {
    let head = null;
    let tail = null;
    for (const value of values || []) {
      const node = new DListNode(value);
      if (!head) head = tail = node;
      else {
        tail.next = node;
        node.prev = tail;
        tail = node;
      }
    }
    return head;
  };

  const buildCyclic = (spec) => {
    const values = (spec && spec.values) || [];
    const nodes = values.map((value) => new ListNode(value));
    for (let i = 0; i + 1 < nodes.length; i += 1) nodes[i].next = nodes[i + 1];
    const pos = spec && spec.pos !== undefined && spec.pos !== null ? spec.pos : -1;
    if (nodes.length && pos >= 0 && pos < nodes.length) nodes[nodes.length - 1].next = nodes[pos];
    return nodes.length ? nodes[0] : null;
  };

  const buildRandom = (pairs) => {
    const list = pairs || [];
    const nodes = list.map((pair) => new RandomNode(pair[0]));
    nodes.forEach((node, index) => {
      if (index + 1 < nodes.length) node.next = nodes[index + 1];
      const target = list[index].length > 1 ? list[index][1] : null;
      if (target !== null && target !== undefined && target >= 0 && target < nodes.length) node.random = nodes[target];
    });
    return nodes.length ? nodes[0] : null;
  };

  const buildChildList = (columns) => {
    const heads = [];
    for (const column of columns || []) {
      let head = null;
      let tail = null;
      for (const value of column) {
        const node = new ChildNode(value);
        if (!head) head = tail = node;
        else {
          tail.child = node;
          tail = node;
        }
      }
      if (head) heads.push(head);
    }
    for (let i = 0; i + 1 < heads.length; i += 1) heads[i].next = heads[i + 1];
    return heads.length ? heads[0] : null;
  };

  const buildTree = (values) => {
    const list = values || [];
    if (!list.length || list[0] === null) return null;
    const root = new TreeNode(list[0]);
    const queue = [root];
    let head = 0;
    let index = 1;
    while (head < queue.length && index < list.length) {
      const node = queue[head++];
      if (index < list.length && list[index] !== null) {
        node.left = new TreeNode(list[index]);
        queue.push(node.left);
      }
      index += 1;
      if (index < list.length && list[index] !== null) {
        node.right = new TreeNode(list[index]);
        queue.push(node.right);
      }
      index += 1;
    }
    return root;
  };

  const buildValue = (kind, value, context) => {
    switch (kind) {
      case "int":
      case "long":
      case "double":
        return value === null || value === undefined ? 0 : Number(value);
      case "bool":
        return Boolean(value);
      case "string":
        return value === null || value === undefined ? "" : String(value);
      case "array":
      case "long_array":
      case "double_array":
      case "bool_array":
      case "string_array":
        return Array.isArray(value) ? value.slice() : [];
      case "matrix":
      case "graph":
      case "char_matrix":
      case "string_matrix":
        return (value || []).map((row) => row.slice());
      case "linked_list":
        return buildList(value);
      case "doubly_linked_list":
        return buildDll(value);
      case "cyclic_list":
        return buildCyclic(value);
      case "random_list":
        return buildRandom(value);
      case "child_list":
        return buildChildList(value);
      case "tree":
        return buildTree(value);
      case "y_list":
        return buildList(value, context.sharedTail || null);
      default:
        return value;
    }
  };

  // ---------------------------------------------------------------------------
  // Output serialisers
  // ---------------------------------------------------------------------------

  const jsonable = (value, seen = new Set()) => {
    if (value === undefined || value === null) return null;
    const type = typeof value;
    if (type === "number") {
      if (Number.isNaN(value)) return "nan";
      if (!Number.isFinite(value)) return value > 0 ? "inf" : "-inf";
      return Object.is(value, -0) ? 0 : value;
    }
    if (type === "bigint") return Number.isSafeInteger(Number(value)) ? Number(value) : String(value);
    if (type === "string" || type === "boolean") return value;
    if (type !== "object") return String(value);
    if (seen.has(value)) return "<cycle>";
    seen.add(value);
    try {
      const tag = Object.prototype.toString.call(value);
      if (Array.isArray(value) || (ArrayBuffer.isView(value) && !(value instanceof DataView))) {
        return Array.from(value, (item) => jsonable(item, seen));
      }
      if (tag === "[object Set]") {
        const items = [...value].map((item) => jsonable(item, seen));
        return sortable(items) ? items.sort(compare) : items;
      }
      if (tag === "[object Map]") {
        const out = {};
        for (const [key, entry] of value) out[String(key)] = jsonable(entry, seen);
        return out;
      }
      const out = {};
      for (const key of Object.keys(value)) {
        if (typeof value[key] !== "function") out[key] = jsonable(value[key], seen);
      }
      return out;
    } finally {
      seen.delete(value);
    }
  };

  const sortable = (items) =>
    items.every((item) => typeof item === "number") || items.every((item) => typeof item === "string");
  const compare = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

  const listValues = (head, link = "next", limit = 500) => {
    const output = [];
    const seen = new Set();
    let current = head;
    while (current !== null && current !== undefined) {
      if (seen.has(current)) {
        output.push("<cycle>");
        break;
      }
      seen.add(current);
      output.push(jsonable(current.val));
      current = current[link];
      if (output.length >= limit && current) {
        output.push("<too long>");
        break;
      }
    }
    return output;
  };

  const dllValues = (head) => {
    const output = [];
    const seen = new Set();
    let previous = null;
    let current = head;
    while (current !== null && current !== undefined) {
      if (seen.has(current)) {
        output.push("<cycle>");
        break;
      }
      seen.add(current);
      if ((current.prev === undefined ? null : current.prev) !== previous) {
        output.push("<prev link broken>");
        break;
      }
      output.push(jsonable(current.val));
      previous = current;
      current = current.next;
      if (output.length > 500) break;
    }
    return output;
  };

  const randomValues = (head) => {
    const nodes = [];
    const index = new Map();
    let current = head;
    while (current && !index.has(current) && nodes.length <= 500) {
      index.set(current, nodes.length);
      nodes.push(current);
      current = current.next;
    }
    return nodes.map((node) => {
      const target = node.random;
      const at = target === null || target === undefined ? null : index.has(target) ? index.get(target) : "<outside list>";
      return [jsonable(node.val), at];
    });
  };

  const treeValues = (root) => {
    if (!root) return [];
    const output = [];
    const queue = [root];
    let head = 0;
    const seen = new Set();
    while (head < queue.length && output.length < 2000) {
      const node = queue[head++];
      if (node === null || node === undefined) {
        output.push(null);
        continue;
      }
      if (seen.has(node)) {
        output.push("<cycle>");
        break;
      }
      seen.add(node);
      output.push(jsonable(node.val));
      queue.push(node.left === undefined ? null : node.left);
      queue.push(node.right === undefined ? null : node.right);
    }
    while (output.length && output[output.length - 1] === null) output.pop();
    return output;
  };

  const serializeResult = (kind, value) => {
    switch (kind) {
      case "void":
        return null;
      case "linked_list":
      case "cyclic_list":
      case "y_list":
        return listValues(value);
      case "doubly_linked_list":
        return dllValues(value);
      case "random_list":
        return randomValues(value);
      case "child_list":
        return listValues(value, "child");
      case "tree":
        return treeValues(value);
      case "list_node_value":
      case "tree_node_value":
        return value === null || value === undefined ? -1 : jsonable(typeof value === "object" ? value.val : value);
      case "bool":
        return typeof value === "boolean" ? value : typeof value === "number" ? Boolean(value) : jsonable(value);
      case "int":
      case "long":
        if (typeof value === "boolean") return value ? 1 : 0;
        return jsonable(value);
      default:
        return jsonable(value);
    }
  };

  // ---------------------------------------------------------------------------
  // Tracer
  // ---------------------------------------------------------------------------

  const STOP = { nfStop: true };
  const T = {
    on: false,
    limit: 0,
    stopAtLimit: false,
    truncated: false,
    visualize: 64,
    steps: [],
    frames: [],
    ids: new WeakMap(),
    next: 1
  };

  const refFor = (value) => {
    let ref = T.ids.get(value);
    if (!ref) {
      ref = `obj_${T.next++}`;
      T.ids.set(value, ref);
    }
    return ref;
  };

  const primitive = (value) => {
    if (value === undefined || value === null) return null;
    const type = typeof value;
    if (type === "number") {
      if (Number.isNaN(value)) return "nan";
      if (!Number.isFinite(value)) return value > 0 ? "inf" : "-inf";
      return Object.is(value, -0) ? 0 : value;
    }
    if (type === "string") return value.length > MAX_STRING ? `${value.slice(0, MAX_STRING)}…` : value;
    if (type === "boolean") return value;
    if (type === "bigint") return Number.isSafeInteger(Number(value)) ? Number(value) : `${value}n`;
    if (type === "symbol") return String(value);
    if (type === "function") return `ƒ ${value.name || "anonymous"}`;
    return undefined;
  };

  const isObject = (value) => value !== null && typeof value === "object";

  /** A primitive, or the heap ref of an object; reachable objects join `heap`. Breadth-first, no recursion. */
  const serialize = (value, heap) => {
    if (!isObject(value)) return primitive(value);
    const root = refFor(value);
    const pending = [value];
    let head = 0;
    while (head < pending.length && Object.keys(heap).length < MAX_OBJECTS) {
      const current = pending[head++];
      const ref = refFor(current);
      if (ref in heap) continue;
      heap[ref] = describe(current, heap, pending);
    }
    return root;
  };

  const child = (value, heap, pending) => {
    if (!isObject(value)) return primitive(value);
    const ref = refFor(value);
    if (!(ref in heap)) pending.push(value);
    return ref;
  };

  const describe = (value, heap, pending) => {
    const limit = T.visualize;
    const tag = Object.prototype.toString.call(value);
    if (Array.isArray(value) || (ArrayBuffer.isView(value) && !(value instanceof DataView))) {
      const visible = Array.from(value.length > limit ? Array.prototype.slice.call(value, 0, limit) : value);
      return {
        type: "list",
        items: visible.map((item) => child(item, heap, pending)),
        truncated: Math.max(0, value.length - visible.length)
      };
    }
    if (tag === "[object Set]") {
      let items = [...value];
      if (sortable(items)) items.sort(compare);
      const visible = items.slice(0, limit);
      return {
        type: "set",
        items: visible.map((item) => child(item, heap, pending)),
        truncated: Math.max(0, items.length - visible.length)
      };
    }
    if (tag === "[object Map]") {
      const fields = {};
      let count = 0;
      for (const [key, entry] of value) {
        if (count++ >= limit) break;
        fields[String(isObject(key) ? refFor(key) : key)] = child(entry, heap, pending);
      }
      return { type: "dict", fields, truncated: Math.max(0, value.size - limit) };
    }
    if (value instanceof Error) return { type: value.name || "Error", fields: { message: primitive(value.message) } };
    const proto = Object.getPrototypeOf(value);
    const plain = proto === Object.prototype || proto === null;
    const fields = {};
    const keys = Object.keys(value);
    for (const key of plain ? keys.slice(0, limit) : keys) {
      const entry = value[key];
      if (typeof entry === "function") continue;
      fields[key] = child(entry, heap, pending);
    }
    if (plain) return { type: "dict", fields, truncated: Math.max(0, keys.length - limit) };
    const name = proto && proto.constructor && proto.constructor.name ? proto.constructor.name : "object";
    return { type: name, fields };
  };

  const frameVariables = (frame, heap) => {
    const variables = {};
    let raw = {};
    try {
      raw = frame && frame.read ? frame.read() : {};
    } catch {
      raw = {};
    }
    for (const name of Object.keys(raw)) {
      const value = raw[name];
      if (typeof value === "function") continue;
      variables[name] = serialize(value, heap);
    }
    return variables;
  };

  const capture = (event, line, returned) => {
    const heap = {};
    const frames = T.frames;
    const top = frames[frames.length - 1];
    // Innermost frame first, so its objects win the object budget.
    const variables = frameVariables(top, heap);
    const stepRecord = { line, event, variables, heap };
    if (frames.length > 1) {
      stepRecord.stack = frames.map((frame) => ({
        function: frame.function,
        line: frame.line,
        variables: frame === top ? variables : frameVariables(frame, heap)
      }));
    }
    if (event === "return") stepRecord.returns = serialize(returned, heap);
    return stepRecord;
  };

  const record = (event, line, returned) => {
    if (T.steps.length >= T.limit) {
      T.truncated = true;
      T.on = false;
      if (T.stopAtLimit) throw STOP;
      return;
    }
    T.steps.push(capture(event, line, returned));
  };

  hide("__nf", {
    enter(name) {
      const frame = { function: name, line: 0, read: null };
      T.frames.push(frame);
      return frame;
    },
    exit(frame) {
      const at = T.frames.lastIndexOf(frame);
      if (at >= 0) T.frames.length = at;
    },
    s(line, read) {
      const frame = T.frames[T.frames.length - 1];
      if (frame) {
        frame.line = line;
        frame.read = read;
      }
      if (T.on) record("line", line);
    },
    r(line, value, read) {
      const frame = T.frames[T.frames.length - 1];
      if (frame) {
        if (line !== null) frame.line = line;
        frame.read = read;
      }
      if (T.on) record("return", frame ? frame.line : line, value);
      return value;
    }
  });

  // ---------------------------------------------------------------------------
  // Running one case
  // ---------------------------------------------------------------------------

  const isClass = (fn) => typeof fn === "function" && /^class[\s{]/.test(Function.prototype.toString.call(fn));

  const designArgs = (parameters, values, context) =>
    parameters.map((parameter, index) => buildValue(parameter.kind, index < values.length ? values[index] : null, context));

  /**
   * Called by the case script with getters for the learner's names, so a
   * `const`, `let` or `class` they declared is found as well as a function.
   * Returns a JSON string: the result, what was printed, and the trace.
   */
  hide("__nf_run", (spec, getEntry, getSolution) => {
    const payload = JSON.parse(spec);
    const context = {};
    if (payload.sharedTail) context.sharedTail = buildList(payload.input[payload.sharedTail]);

    T.on = Boolean(payload.trace);
    T.limit = payload.stepLimit || 0;
    T.stopAtLimit = Boolean(payload.stopAtStepLimit);
    T.visualize = payload.visualizeLimit || 64;

    const outcome = { stdout: "", steps: T.steps };
    const started = Date.now();
    try {
      if (payload.design) {
        const design = payload.design;
        const Klass = getEntry();
        if (typeof Klass !== "function") throw new ReferenceError(`Expected a class named '${design.className}'.`);
        const methods = new Map(design.methods.map((method) => [method.name, method]));
        const operations = payload.input.operations || [];
        const argumentsList = payload.input.arguments || [];
        let instance = null;
        const output = [];
        operations.forEach((operation, index) => {
          const values = index < argumentsList.length ? argumentsList[index] || [] : [];
          if (operation === design.className) {
            instance = new Klass(...designArgs(design.constructorParameters, values, context));
            output.push(null);
            return;
          }
          const method = methods.get(operation);
          if (!method || !instance) throw new ReferenceError(`Unknown operation '${operation}'.`);
          const bound = instance[operation];
          if (typeof bound !== "function") throw new TypeError(`${design.className} has no method '${operation}'.`);
          const result = bound.apply(instance, designArgs(method.parameters, values, context));
          output.push(serializeResult(method.returnKind, result));
        });
        outcome.result = output;
      } else {
        let fn = getEntry();
        let self;
        if (typeof fn !== "function" || isClass(fn)) {
          const Solution = getSolution();
          const instance = typeof Solution === "function" ? new Solution() : null;
          if (instance && typeof instance[payload.name] === "function") {
            self = instance;
            fn = instance[payload.name];
          } else {
            throw new ReferenceError(`Expected a function named '${payload.name}'.`);
          }
        }
        const args = payload.parameters.map((parameter) =>
          buildValue(parameter.kind, payload.input[parameter.name], context)
        );
        outcome.result = serializeResult(payload.returnKind, fn.apply(self, args));
      }
      outcome.ok = true;
    } catch (error) {
      outcome.ok = false;
      if (error === STOP) {
        outcome.stopped = true;
      } else {
        outcome.error = {
          name: error && error.name ? String(error.name) : "Error",
          message: error && error.message !== undefined ? String(error.message) : String(error),
          stack: error && error.stack ? String(error.stack) : ""
        };
      }
    } finally {
      T.on = false;
    }
    outcome.runtimeMs = Date.now() - started;
    outcome.stdout = stdout;
    outcome.truncated = T.truncated;
    return JSON.stringify(outcome);
  });

  /** What survives a run that was cut off (the time limit): the trace so far and what was printed. */
  hide("__nf_partial", () => JSON.stringify({ steps: T.steps, stdout, truncated: T.truncated }));
})();
