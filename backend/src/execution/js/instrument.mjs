/**
 * Adds trace calls to a learner's JavaScript, keeping every line where it was.
 *
 * Before each statement inside a function goes `__nf.s(line, read)`, where
 * `read` is a closure returning the variables in scope at that point; each
 * `return x` becomes `return __nf.r(line, x, read)`; each function body is
 * wrapped so the tracer knows which frames are on the stack. Loop conditions
 * record a step every time they are checked, so a loop's line lights up once
 * per iteration, as it does in the Python replay.
 *
 * Nothing inserted contains a newline, so the line numbers in an error's
 * stack, and in the trace, are the learner's own.
 */
import * as acorn from "acorn";

const READ_OBJECT = "__nf_o";

/** Names bound by a parameter or declaration pattern. */
const patternNames = (pattern, out = []) => {
  if (!pattern) return out;
  switch (pattern.type) {
    case "Identifier":
      out.push(pattern.name);
      break;
    case "AssignmentPattern":
      patternNames(pattern.left, out);
      break;
    case "RestElement":
      patternNames(pattern.argument, out);
      break;
    case "ArrayPattern":
      for (const element of pattern.elements) patternNames(element, out);
      break;
    case "ObjectPattern":
      for (const property of pattern.properties) {
        patternNames(property.type === "RestElement" ? property.argument : property.value, out);
      }
      break;
    default:
      break;
  }
  return out;
};

const keyName = (key, computed) => {
  if (!key || computed) return null;
  if (key.type === "Identifier" || key.type === "PrivateIdentifier") return key.name;
  if (key.type === "Literal") return String(key.value);
  return null;
};

export function instrument(code) {
  const ast = acorn.parse(code, {
    ecmaVersion: "latest",
    sourceType: "script",
    locations: true,
    allowHashBang: true,
    allowReturnOutsideFunction: false
  });

  const edits = [];
  let seq = 0;
  const open = (pos, text) => edits.push({ pos, seq: seq++, close: false, text });
  const close = (pos, text) => edits.push({ pos, seq: seq++, close: true, text });

  /** The closure that reads every variable visible in this function right now. */
  const reader = (fn) => {
    const names = [];
    const seen = new Set();
    for (const scope of fn.scopes) {
      for (const name of scope) {
        if (seen.has(name)) continue;
        seen.add(name);
        names.push(name);
      }
    }
    // A variable read before its declaration has run throws (the temporal dead
    // zone), so each is read on its own and a failure just leaves it out.
    const reads = names.map((name) => `try{${READ_OBJECT}[${JSON.stringify(name)}]=${name}}catch{}`);
    if (fn.hasThis) reads.unshift(`try{if(this!==undefined&&this!==globalThis)${READ_OBJECT}["this"]=this}catch{}`);
    return `()=>{const ${READ_OBJECT}={};${reads.join("")}return ${READ_OBJECT}}`;
  };

  const step = (node, fn) => {
    // `if (x) return y;` on one line: the line has just been recorded by the
    // `if`, so its lone body does not record it a second time.
    if (fn.suppress === node.start) {
      fn.suppress = -1;
      return;
    }
    open(node.start, `__nf.s(${node.loc.start.line},${reader(fn)});`);
  };

  // ---- expressions: only looked into for functions and classes ----------------

  const walkNode = (node, fn, hint) => {
    if (!node || typeof node.type !== "string") return;
    switch (node.type) {
      case "FunctionExpression":
      case "FunctionDeclaration":
      case "ArrowFunctionExpression":
        instrumentFunction(node, node.id?.name ?? hint ?? "anonymous");
        return;
      case "ClassDeclaration":
      case "ClassExpression":
        walkClass(node, node.id?.name ?? hint ?? "anonymous");
        return;
      case "VariableDeclarator":
        walkNode(node.init, fn, node.id.type === "Identifier" ? node.id.name : undefined);
        return;
      case "AssignmentExpression": {
        const left = node.left;
        const name =
          left.type === "Identifier"
            ? left.name
            : left.type === "MemberExpression"
              ? keyName(left.property, left.computed)
              : undefined;
        walkNode(left, fn);
        walkNode(node.right, fn, name ?? undefined);
        return;
      }
      case "Property":
        walkNode(node.value, fn, keyName(node.key, node.computed) ?? undefined);
        if (node.computed) walkNode(node.key, fn);
        return;
      default:
        for (const key of Object.keys(node)) {
          if (key === "type" || key === "loc" || key === "start" || key === "end") continue;
          const child = node[key];
          if (Array.isArray(child)) for (const item of child) walkNode(item, fn);
          else if (child && typeof child === "object" && typeof child.type === "string") walkNode(child, fn);
        }
    }
  };

  const walkClass = (node, name) => {
    walkNode(node.superClass, null);
    for (const element of node.body.body) {
      const key = keyName(element.key, element.computed);
      if (element.type === "MethodDefinition") {
        instrumentFunction(element.value, element.kind === "constructor" ? "constructor" : key ?? "method", name);
      } else if (element.type === "PropertyDefinition") {
        walkNode(element.value, null, key ?? undefined);
      } else if (element.type === "StaticBlock") {
        for (const statement of element.body) walkNode(statement, null);
      }
    }
  };

  // ---- functions ----------------------------------------------------------------

  const instrumentFunction = (node, name) => {
    for (const param of node.params) walkNode(param, null);
    if (node.body.type !== "BlockStatement") {
      // `x => x + 1`: an expression, not lines of its own. Look inside only.
      walkNode(node.body, null);
      return;
    }
    const params = new Set(node.params.flatMap((param) => patternNames(param)));
    const fn = { scopes: [params], hasThis: node.type !== "ArrowFunctionExpression" };
    const body = node.body;
    // Directives ("use strict") must stay first in the body.
    let at = body.start + 1;
    for (const statement of body.body) {
      if (statement.type === "ExpressionStatement" && statement.directive) at = statement.end;
      else break;
    }
    const enter = `const __nf_f=__nf.enter(${JSON.stringify(name)});try{`;
    walkStatements(body.body, fn, true);
    const leave = `;__nf.r(null,undefined,${reader(fn)})}finally{__nf.exit(__nf_f)}`;
    // An empty body (`function () {}`): both halves go in one piece, in order.
    if (at === body.end - 1) open(at, enter + leave);
    else {
      open(at, enter);
      close(body.end - 1, leave);
    }
  };

  // ---- statements ------------------------------------------------------------------

  const declare = (declaration, fn) => {
    const names = declaration.declarations.flatMap((declarator) => patternNames(declarator.id));
    const scope = declaration.kind === "var" ? fn.scopes[0] : fn.scopes[fn.scopes.length - 1];
    for (const name of names) scope.add(name);
  };

  const LOOPS = new Set(["ForStatement", "ForInStatement", "ForOfStatement", "WhileStatement", "DoWhileStatement"]);

  const walkStatements = (statements, fn, functionTop = false) => {
    let lastLine = -1;
    for (const statement of statements) {
      if (functionTop && statement.type === "ExpressionStatement" && statement.directive) continue;
      const line = statement.loc.start.line;
      // `a = 1; b = 2;` on one line is one step, as a line is in the replay.
      if (line === lastLine && !LOOPS.has(statement.type)) fn.suppress = statement.start;
      walkStatement(statement, fn);
      if (fn.suppress === statement.start) fn.suppress = -1;
      lastLine = statement.loc.end.line;
    }
  };

  /** A loop or branch body, braced if it was a lone statement so a step can go first. */
  const walkBody = (node, fn, lead) => {
    if (node.type === "BlockStatement") {
      fn.scopes.push(new Set());
      if (lead) open(node.start + 1, lead());
      walkStatements(node.body, fn);
      fn.scopes.pop();
      return;
    }
    open(node.start, "{");
    if (lead) open(node.start, lead());
    fn.scopes.push(new Set());
    walkStatement(node, fn);
    fn.scopes.pop();
    close(node.end, "}");
  };

  /** A step each time a loop condition is checked. */
  const checkStep = (test, line, fn) => {
    open(test.start, `(__nf.s(${line},${reader(fn)}),(`);
    close(test.end, "))");
  };

  const walkStatement = (node, fn) => {
    const line = node.loc.start.line;
    switch (node.type) {
      case "FunctionDeclaration":
        instrumentFunction(node, node.id?.name ?? "anonymous");
        return;
      case "ClassDeclaration":
        walkClass(node, node.id?.name ?? "anonymous");
        return;
      case "EmptyStatement":
        return;
      case "VariableDeclaration":
        step(node, fn);
        for (const declarator of node.declarations) walkNode(declarator, fn);
        declare(node, fn);
        return;
      case "ReturnStatement":
        step(node, fn);
        walkNode(node.argument, fn);
        if (node.argument) {
          open(node.argument.start, `__nf.r(${line},(`);
          close(node.argument.end, `),${reader(fn)})`);
        } else {
          open(node.start + "return".length, ` __nf.r(${line},undefined,${reader(fn)})`);
        }
        return;
      case "IfStatement":
        step(node, fn);
        walkNode(node.test, fn);
        if (node.consequent.type !== "BlockStatement" && node.consequent.loc.start.line === line) {
          fn.suppress = node.consequent.start;
        }
        walkBody(node.consequent, fn);
        fn.suppress = -1;
        if (node.alternate) walkBody(node.alternate, fn);
        return;
      case "BlockStatement":
        fn.scopes.push(new Set());
        walkStatements(node.body, fn);
        fn.scopes.pop();
        return;
      case "ForStatement": {
        fn.scopes.push(new Set());
        if (node.init?.type === "VariableDeclaration") {
          for (const declarator of node.init.declarations) walkNode(declarator, fn);
          declare(node.init, fn);
        } else {
          walkNode(node.init, fn);
        }
        if (node.test) {
          walkNode(node.test, fn);
          checkStep(node.test, line, fn);
        }
        walkNode(node.update, fn);
        walkBody(node.body, fn, node.test ? undefined : () => `__nf.s(${line},${reader(fn)});`);
        fn.scopes.pop();
        return;
      }
      case "ForInStatement":
      case "ForOfStatement": {
        fn.scopes.push(new Set());
        walkNode(node.right, fn);
        if (node.left.type === "VariableDeclaration") declare(node.left, fn);
        // Each iteration starts on the loop's own line, with the new value bound.
        walkBody(node.body, fn, () => `__nf.s(${line},${reader(fn)});`);
        fn.scopes.pop();
        return;
      }
      case "WhileStatement":
        walkNode(node.test, fn);
        checkStep(node.test, line, fn);
        walkBody(node.body, fn);
        return;
      case "DoWhileStatement":
        walkBody(node.body, fn);
        walkNode(node.test, fn);
        checkStep(node.test, node.test.loc.start.line, fn);
        return;
      case "SwitchStatement":
        step(node, fn);
        walkNode(node.discriminant, fn);
        fn.scopes.push(new Set());
        for (const branch of node.cases) {
          walkNode(branch.test, fn);
          walkStatements(branch.consequent, fn);
        }
        fn.scopes.pop();
        return;
      case "TryStatement":
        step(node, fn);
        walkStatement(node.block, fn);
        if (node.handler) {
          fn.scopes.push(new Set(patternNames(node.handler.param)));
          walkStatements(node.handler.body.body, fn);
          fn.scopes.pop();
        }
        if (node.finalizer) walkStatement(node.finalizer, fn);
        return;
      case "LabeledStatement":
        // A step between the label and its loop would take the label away from
        // the loop, so loops here add none before themselves (see above).
        walkStatement(node.body, fn);
        return;
      default:
        step(node, fn);
        walkNode(node, fn);
    }
  };

  // Top-level code runs before the learner's function is called and is not
  // traced, as in the Python replay; only the functions in it are.
  for (const statement of ast.body) walkNode(statement, null);

  edits.sort((a, b) => {
    if (a.pos !== b.pos) return a.pos - b.pos;
    // At one position, whatever closes comes before whatever opens; inner
    // closers (added later) before outer ones, outer openers before inner.
    if (a.close !== b.close) return a.close ? -1 : 1;
    return a.close ? b.seq - a.seq : a.seq - b.seq;
  });
  let output = "";
  let last = 0;
  for (const edit of edits) {
    output += code.slice(last, edit.pos) + edit.text;
    last = edit.pos;
  }
  return output + code.slice(last);
}
