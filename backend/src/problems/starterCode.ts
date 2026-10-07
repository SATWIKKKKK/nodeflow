import type { Language, ProblemSignature, ValueKind } from "@nodeflow/shared";

/**
 * Generates C++, Java, JavaScript, TypeScript and C stubs from a problem's
 * signature metadata, in the shape LeetCode uses for each language.
 *
 * The bank authors only Python stubs. Deriving the other languages from the
 * signature keeps one source of truth, and guarantees the stub matches exactly
 * what the sandbox harness passes in and reads back.
 */

const snakeToCamel = (value: string) =>
  value.replace(/_([a-z0-9])/g, (_match, char: string) => char.toUpperCase());

type Position = "param" | "return";

export const cppType = (kind: ValueKind, position: Position): string => {
  switch (kind) {
    case "int":
      return "int";
    case "long":
      return "long long";
    case "double":
      return "double";
    case "bool":
      return "bool";
    case "string":
      return "string";
    case "array":
      return position === "param" ? "vector<int>&" : "vector<int>";
    case "long_array":
      return position === "param" ? "vector<long long>&" : "vector<long long>";
    case "double_array":
      return position === "param" ? "vector<double>&" : "vector<double>";
    case "bool_array":
      return position === "param" ? "vector<bool>&" : "vector<bool>";
    case "string_array":
      return position === "param" ? "vector<string>&" : "vector<string>";
    case "matrix":
    case "graph":
      return position === "param" ? "vector<vector<int>>&" : "vector<vector<int>>";
    case "char_matrix":
      return position === "param" ? "vector<vector<char>>&" : "vector<vector<char>>";
    case "string_matrix":
      return position === "param" ? "vector<vector<string>>&" : "vector<vector<string>>";
    case "linked_list":
    case "cyclic_list":
    case "y_list":
    case "list_node_value":
      return "ListNode*";
    case "doubly_linked_list":
      return "DListNode*";
    case "random_list":
      return "RandomNode*";
    case "child_list":
      return "ChildNode*";
    case "tree":
    case "tree_node_value":
      return "TreeNode*";
    case "void":
      return "void";
  }
};

export const javaType = (kind: ValueKind, position: Position): string => {
  switch (kind) {
    case "int":
      return "int";
    case "long":
      return "long";
    case "double":
      return "double";
    case "bool":
      return "boolean";
    case "string":
      return "String";
    case "array":
      return "int[]";
    case "long_array":
      return "long[]";
    case "double_array":
      return "double[]";
    case "bool_array":
      return "boolean[]";
    case "string_array":
      return position === "param" ? "String[]" : "List<String>";
    case "matrix":
    case "graph":
      return position === "param" ? "int[][]" : "List<List<Integer>>";
    case "char_matrix":
      return "char[][]";
    case "string_matrix":
      return "List<List<String>>";
    case "linked_list":
    case "cyclic_list":
    case "y_list":
    case "list_node_value":
      return "ListNode";
    case "doubly_linked_list":
      return "DListNode";
    case "random_list":
      return "RandomNode";
    case "child_list":
      return "ChildNode";
    case "tree":
    case "tree_node_value":
      return "TreeNode";
    case "void":
      return "void";
  }
};

const cppDefaultReturn = (kind: ValueKind): string => {
  switch (kind) {
    case "void":
      return "";
    case "int":
    case "long":
    case "double":
      return "return 0;";
    case "bool":
      return "return false;";
    case "string":
      return 'return "";';
    case "linked_list":
    case "cyclic_list":
    case "y_list":
    case "list_node_value":
    case "doubly_linked_list":
    case "random_list":
    case "child_list":
    case "tree":
    case "tree_node_value":
      return "return nullptr;";
    default:
      return "return {};";
  }
};

const javaDefaultReturn = (kind: ValueKind): string => {
  switch (kind) {
    case "void":
      return "";
    case "int":
    case "long":
    case "double":
      return "return 0;";
    case "bool":
      return "return false;";
    case "string":
      return 'return "";';
    case "array":
      return "return new int[0];";
    case "long_array":
      return "return new long[0];";
    case "double_array":
      return "return new double[0];";
    case "bool_array":
      return "return new boolean[0];";
    case "char_matrix":
      return "return new char[0][0];";
    case "string_array":
    case "matrix":
    case "graph":
    case "string_matrix":
      return "return new ArrayList<>();";
    default:
      return "return null;";
  }
};

const NODE_KINDS: Record<string, ValueKind[]> = {
  ListNode: ["linked_list", "cyclic_list", "y_list", "list_node_value"],
  DListNode: ["doubly_linked_list"],
  RandomNode: ["random_list"],
  ChildNode: ["child_list"],
  TreeNode: ["tree", "tree_node_value"]
};

export const CPP_NODE_DEFINITIONS: Record<string, string> = {
  ListNode: `struct ListNode {
    int val;
    ListNode* next;
    ListNode() : val(0), next(nullptr) {}
    ListNode(int x) : val(x), next(nullptr) {}
    ListNode(int x, ListNode* next) : val(x), next(next) {}
};`,
  DListNode: `struct DListNode {
    int val;
    DListNode* prev;
    DListNode* next;
    DListNode() : val(0), prev(nullptr), next(nullptr) {}
    DListNode(int x) : val(x), prev(nullptr), next(nullptr) {}
};`,
  RandomNode: `struct RandomNode {
    int val;
    RandomNode* next;
    RandomNode* random;
    RandomNode(int x) : val(x), next(nullptr), random(nullptr) {}
};`,
  ChildNode: `struct ChildNode {
    int val;
    ChildNode* next;
    ChildNode* child;
    ChildNode(int x) : val(x), next(nullptr), child(nullptr) {}
};`,
  TreeNode: `struct TreeNode {
    int val;
    TreeNode* left;
    TreeNode* right;
    TreeNode() : val(0), left(nullptr), right(nullptr) {}
    TreeNode(int x) : val(x), left(nullptr), right(nullptr) {}
    TreeNode(int x, TreeNode* left, TreeNode* right) : val(x), left(left), right(right) {}
};`
};

export const JAVA_NODE_DEFINITIONS: Record<string, string> = {
  ListNode: `class ListNode {
    int val;
    ListNode next;
    ListNode() {}
    ListNode(int val) { this.val = val; }
    ListNode(int val, ListNode next) { this.val = val; this.next = next; }
}`,
  DListNode: `class DListNode {
    int val;
    DListNode prev;
    DListNode next;
    DListNode(int val) { this.val = val; }
}`,
  RandomNode: `class RandomNode {
    int val;
    RandomNode next;
    RandomNode random;
    RandomNode(int val) { this.val = val; }
}`,
  ChildNode: `class ChildNode {
    int val;
    ChildNode next;
    ChildNode child;
    ChildNode(int val) { this.val = val; }
}`,
  TreeNode: `class TreeNode {
    int val;
    TreeNode left;
    TreeNode right;
    TreeNode() {}
    TreeNode(int val) { this.val = val; }
    TreeNode(int val, TreeNode left, TreeNode right) { this.val = val; this.left = left; this.right = right; }
}`
};

const kindsIn = (signature: ProblemSignature): ValueKind[] => {
  const kinds: ValueKind[] = [signature.returnKind, ...signature.parameters.map((parameter) => parameter.kind)];
  if (signature.design) {
    kinds.push(...signature.design.constructorParameters.map((parameter) => parameter.kind));
    for (const method of signature.design.methods) {
      kinds.push(method.returnKind, ...method.parameters.map((parameter) => parameter.kind));
    }
  }
  return kinds;
};

const nodesUsed = (signature: ProblemSignature) => {
  const kinds = new Set(kindsIn(signature));
  return Object.keys(NODE_KINDS).filter((name) => NODE_KINDS[name].some((kind) => kinds.has(kind)));
};

const indent = (text: string, spaces: number) =>
  text
    .split("\n")
    .map((line) => (line ? " ".repeat(spaces) + line : line))
    .join("\n");

const cppFunction = (name: string, returnKind: ValueKind, params: string, bodyIndent: number) => {
  const ret = cppDefaultReturn(returnKind);
  return `${cppType(returnKind, "return")} ${name}(${params}) {
${" ".repeat(bodyIndent)}// Write your solution here.${ret ? `\n${" ".repeat(bodyIndent)}${ret}` : ""}
}`;
};

const buildCpp = (signature: ProblemSignature) => {
  const prelude = nodesUsed(signature)
    .map((name) => CPP_NODE_DEFINITIONS[name])
    .join("\n\n");
  const lead = prelude ? `${prelude}\n\n` : "";

  if (signature.design) {
    const { className, constructorParameters, methods } = signature.design;
    const ctorParams = constructorParameters
      .map((parameter) => `${cppType(parameter.kind, "param")} ${snakeToCamel(parameter.name)}`)
      .join(", ");
    const members = methods
      .map((method) =>
        indent(
          cppFunction(
            method.name,
            method.returnKind,
            method.parameters
              .map((parameter) => `${cppType(parameter.kind, "param")} ${snakeToCamel(parameter.name)}`)
              .join(", "),
            4
          ),
          4
        )
      )
      .join("\n\n");
    return `${lead}class ${className} {
public:
    ${className}(${ctorParams}) {
        // Set up your fields here.
    }

${members}
};`;
  }

  const params = signature.parameters
    .map((parameter) => `${cppType(parameter.kind, "param")} ${snakeToCamel(parameter.name)}`)
    .join(", ");
  return `${lead}${cppFunction(snakeToCamel(signature.functionName), signature.returnKind, params, 4)}`;
};

const javaMethod = (name: string, returnKind: ValueKind, params: string) => {
  const ret = javaDefaultReturn(returnKind);
  return `public ${javaType(returnKind, "return")} ${name}(${params}) {
    // Write your solution here.${ret ? `\n    ${ret}` : ""}
}`;
};

const buildJava = (signature: ProblemSignature) => {
  const prelude = nodesUsed(signature)
    .map((name) => JAVA_NODE_DEFINITIONS[name])
    .join("\n\n");
  const imports = "import java.util.*;\n\n";
  const lead = `${imports}${prelude ? `${prelude}\n\n` : ""}`;

  if (signature.design) {
    const { className, constructorParameters, methods } = signature.design;
    const ctorParams = constructorParameters
      .map((parameter) => `${javaType(parameter.kind, "param")} ${snakeToCamel(parameter.name)}`)
      .join(", ");
    const members = methods
      .map((method) =>
        indent(
          javaMethod(
            method.name,
            method.returnKind,
            method.parameters
              .map((parameter) => `${javaType(parameter.kind, "param")} ${snakeToCamel(parameter.name)}`)
              .join(", ")
          ),
          4
        )
      )
      .join("\n\n");
    return `${lead}class ${className} {
    public ${className}(${ctorParams}) {
        // Set up your fields here.
    }

${members}
}`;
  }

  const params = signature.parameters
    .map((parameter) => `${javaType(parameter.kind, "param")} ${snakeToCamel(parameter.name)}`)
    .join(", ");
  return `${lead}class Solution {
${indent(javaMethod(snakeToCamel(signature.functionName), signature.returnKind, params), 4)}
}`;
};

// ---------------------------------------------------------------------------
// JavaScript and TypeScript
// ---------------------------------------------------------------------------

const jsDocType = (kind: ValueKind): string => {
  switch (kind) {
    case "int":
    case "long":
    case "double":
      return "number";
    case "bool":
      return "boolean";
    case "string":
      return "string";
    case "array":
    case "long_array":
    case "double_array":
      return "number[]";
    case "bool_array":
      return "boolean[]";
    case "string_array":
      return "string[]";
    case "matrix":
    case "graph":
      return "number[][]";
    case "char_matrix":
      return "character[][]";
    case "string_matrix":
      return "string[][]";
    case "void":
      return "void";
    default:
      return nodeOf(kind);
  }
};

const tsType = (kind: ValueKind): string => {
  switch (kind) {
    case "char_matrix":
      return "string[][]";
    case "void":
      return "void";
    case "linked_list":
    case "cyclic_list":
    case "y_list":
    case "list_node_value":
    case "doubly_linked_list":
    case "random_list":
    case "child_list":
    case "tree":
    case "tree_node_value":
      return `${nodeOf(kind)} | null`;
    default:
      return jsDocType(kind);
  }
};

function nodeOf(kind: ValueKind): string {
  for (const [name, kinds] of Object.entries(NODE_KINDS)) if (kinds.includes(kind)) return name;
  return "any";
}

const JS_NODE_DEFINITIONS: Record<string, string> = {
  ListNode: `Definition for singly-linked list.
function ListNode(val, next) {
    this.val = (val===undefined ? 0 : val)
    this.next = (next===undefined ? null : next)
}`,
  DListNode: `Definition for a doubly linked list node.
function DListNode(val, prev, next) {
    this.val = (val===undefined ? 0 : val)
    this.prev = (prev===undefined ? null : prev)
    this.next = (next===undefined ? null : next)
}`,
  RandomNode: `Definition for a list node with a random pointer.
function RandomNode(val, next, random) {
    this.val = (val===undefined ? 0 : val)
    this.next = (next===undefined ? null : next)
    this.random = (random===undefined ? null : random)
}`,
  ChildNode: `Definition for a multilevel list node.
function ChildNode(val, next, child) {
    this.val = (val===undefined ? 0 : val)
    this.next = (next===undefined ? null : next)
    this.child = (child===undefined ? null : child)
}`,
  TreeNode: `Definition for a binary tree node.
function TreeNode(val, left, right) {
    this.val = (val===undefined ? 0 : val)
    this.left = (left===undefined ? null : left)
    this.right = (right===undefined ? null : right)
}`
};

const TS_NODE_DEFINITIONS: Record<string, string> = {
  ListNode: `Definition for singly-linked list.
class ListNode {
    val: number
    next: ListNode | null
    constructor(val?: number, next?: ListNode | null) {
        this.val = (val===undefined ? 0 : val)
        this.next = (next===undefined ? null : next)
    }
}`,
  DListNode: `Definition for a doubly linked list node.
class DListNode {
    val: number
    prev: DListNode | null
    next: DListNode | null
    constructor(val?: number, prev?: DListNode | null, next?: DListNode | null) {
        this.val = (val===undefined ? 0 : val)
        this.prev = (prev===undefined ? null : prev)
        this.next = (next===undefined ? null : next)
    }
}`,
  RandomNode: `Definition for a list node with a random pointer.
class RandomNode {
    val: number
    next: RandomNode | null
    random: RandomNode | null
    constructor(val?: number, next?: RandomNode | null, random?: RandomNode | null) {
        this.val = (val===undefined ? 0 : val)
        this.next = (next===undefined ? null : next)
        this.random = (random===undefined ? null : random)
    }
}`,
  ChildNode: `Definition for a multilevel list node.
class ChildNode {
    val: number
    next: ChildNode | null
    child: ChildNode | null
    constructor(val?: number, next?: ChildNode | null, child?: ChildNode | null) {
        this.val = (val===undefined ? 0 : val)
        this.next = (next===undefined ? null : next)
        this.child = (child===undefined ? null : child)
    }
}`,
  TreeNode: `Definition for a binary tree node.
class TreeNode {
    val: number
    left: TreeNode | null
    right: TreeNode | null
    constructor(val?: number, left?: TreeNode | null, right?: TreeNode | null) {
        this.val = (val===undefined ? 0 : val)
        this.left = (left===undefined ? null : left)
        this.right = (right===undefined ? null : right)
    }
}`
};

/** The node definitions, as a comment: the harness defines the classes. */
const commentedDefinitions = (signature: ProblemSignature, definitions: Record<string, string>) =>
  nodesUsed(signature)
    .map((name) => `/**\n${definitions[name].split("\n").map((line) => ` * ${line}`.trimEnd()).join("\n")}\n */`)
    .join("\n");

const jsDoc = (params: Array<{ name: string; kind: ValueKind }>, returnKind: ValueKind) =>
  [
    "/**",
    ...params.map((parameter) => ` * @param {${jsDocType(parameter.kind)}} ${snakeToCamel(parameter.name)}`),
    ` * @return {${jsDocType(returnKind)}}`,
    " */"
  ].join("\n");

const buildJavaScript = (signature: ProblemSignature) => {
  const prelude = commentedDefinitions(signature, JS_NODE_DEFINITIONS);
  const lead = prelude ? `${prelude}\n` : "";

  if (signature.design) {
    const { className, constructorParameters, methods } = signature.design;
    const ctorDoc = constructorParameters.length
      ? `/**\n${constructorParameters.map((parameter) => ` * @param {${jsDocType(parameter.kind)}} ${snakeToCamel(parameter.name)}`).join("\n")}\n */\n`
      : "";
    const ctor = `${ctorDoc}var ${className} = function(${constructorParameters.map((parameter) => snakeToCamel(parameter.name)).join(", ")}) {
    // Set up your fields here.
};`;
    const members = methods
      .map(
        (method) => `${jsDoc(method.parameters, method.returnKind)}
${className}.prototype.${method.name} = function(${method.parameters.map((parameter) => snakeToCamel(parameter.name)).join(", ")}) {
    // Write your solution here.
};`
      )
      .join("\n\n");
    return `${lead}${ctor}\n\n${members}`;
  }

  const name = snakeToCamel(signature.functionName);
  return `${lead}${jsDoc(signature.parameters, signature.returnKind)}
var ${name} = function(${signature.parameters.map((parameter) => snakeToCamel(parameter.name)).join(", ")}) {
    // Write your solution here.
};`;
};

const buildTypeScript = (signature: ProblemSignature) => {
  const prelude = commentedDefinitions(signature, TS_NODE_DEFINITIONS);
  const lead = prelude ? `${prelude}\n\n` : "";
  const params = (list: Array<{ name: string; kind: ValueKind }>) =>
    list.map((parameter) => `${snakeToCamel(parameter.name)}: ${tsType(parameter.kind)}`).join(", ");

  if (signature.design) {
    const { className, constructorParameters, methods } = signature.design;
    const members = methods
      .map(
        (method) => `    ${method.name}(${params(method.parameters)}): ${tsType(method.returnKind)} {
        // Write your solution here.
    }`
      )
      .join("\n\n");
    return `${lead}class ${className} {
    constructor(${params(constructorParameters)}) {
        // Set up your fields here.
    }

${members}
}`;
  }

  return `${lead}function ${snakeToCamel(signature.functionName)}(${params(signature.parameters)}): ${tsType(signature.returnKind)} {
    // Write your solution here.
};`;
};

// ---------------------------------------------------------------------------
// C
// ---------------------------------------------------------------------------

const C_NODE_DEFINITIONS: Record<string, string> = {
  ListNode: `Definition for singly-linked list.
struct ListNode {
    int val;
    struct ListNode *next;
};`,
  DListNode: `Definition for a doubly linked list node.
struct DListNode {
    int val;
    struct DListNode *prev;
    struct DListNode *next;
};`,
  RandomNode: `Definition for a list node with a random pointer.
struct RandomNode {
    int val;
    struct RandomNode *next;
    struct RandomNode *random;
};`,
  ChildNode: `Definition for a multilevel list node.
struct ChildNode {
    int val;
    struct ChildNode *next;
    struct ChildNode *child;
};`,
  TreeNode: `Definition for a binary tree node.
struct TreeNode {
    int val;
    struct TreeNode *left;
    struct TreeNode *right;
};`
};

const C_ELEMENT: Partial<Record<ValueKind, string>> = {
  array: "int*",
  long_array: "long long*",
  double_array: "double*",
  bool_array: "bool*",
  string_array: "char**",
  matrix: "int**",
  graph: "int**",
  char_matrix: "char**",
  string_matrix: "char***"
};
const C_ONE_D = new Set<ValueKind>(["array", "long_array", "double_array", "bool_array", "string_array"]);
const C_TWO_D = new Set<ValueKind>(["matrix", "graph", "char_matrix", "string_matrix"]);

const cScalar = (kind: ValueKind): string => {
  switch (kind) {
    case "int":
      return "int";
    case "long":
      return "long long";
    case "double":
      return "double";
    case "bool":
      return "bool";
    case "string":
      return "char*";
    case "void":
      return "void";
    default:
      return C_ELEMENT[kind] ?? `struct ${nodeOf(kind)}*`;
  }
};

/** LeetCode's C parameters: arrays bring their length, grids their row lengths too. */
const cParams = (list: Array<{ name: string; kind: ValueKind }>) =>
  list.flatMap((parameter) => {
    const name = snakeToCamel(parameter.name);
    if (C_ONE_D.has(parameter.kind)) return [`${cScalar(parameter.kind)} ${name}`, `int ${name}Size`];
    if (C_TWO_D.has(parameter.kind)) return [`${cScalar(parameter.kind)} ${name}`, `int ${name}Size`, `int* ${name}ColSize`];
    return [`${cScalar(parameter.kind)} ${name}`];
  });

const cReturnParams = (kind: ValueKind) =>
  C_ONE_D.has(kind) ? ["int* returnSize"] : C_TWO_D.has(kind) ? ["int* returnSize", "int** returnColumnSizes"] : [];

const cDefaultBody = (kind: ValueKind) => {
  if (C_ONE_D.has(kind)) return ["*returnSize = 0;", "return NULL;"];
  if (C_TWO_D.has(kind)) return ["*returnSize = 0;", "*returnColumnSizes = NULL;", "return NULL;"];
  switch (kind) {
    case "void":
      return [];
    case "int":
    case "long":
      return ["return 0;"];
    case "double":
      return ["return 0.0;"];
    case "bool":
      return ["return false;"];
    case "string":
      return ['return "";'];
    default:
      return ["return NULL;"];
  }
};

const cReturnNote = (kind: ValueKind) =>
  C_ONE_D.has(kind)
    ? "/**\n * Note: The returned array must be malloced, assume caller calls free().\n */\n"
    : C_TWO_D.has(kind)
      ? "/**\n * Return an array of arrays of size *returnSize.\n * The sizes of the arrays are returned as *returnColumnSizes array.\n * Note: Both returned array and *columnSizes array must be malloced, assume caller calls free().\n */\n"
      : "";

const cFunction = (name: string, returnKind: ValueKind, params: string[], note = true) => {
  const body = ["// Write your solution here.", ...cDefaultBody(returnKind)].map((line) => `    ${line}`).join("\n");
  return `${note ? cReturnNote(returnKind) : ""}${cScalar(returnKind)} ${name}(${[...params, ...cReturnParams(returnKind)].join(", ")}) {
${body}
}`;
};

const lowerFirst = (value: string) => value.slice(0, 1).toLowerCase() + value.slice(1);
const upperFirst = (value: string) => value.slice(0, 1).toUpperCase() + value.slice(1);

const buildC = (signature: ProblemSignature) => {
  const prelude = commentedDefinitions(signature, C_NODE_DEFINITIONS);
  const lead = prelude ? `${prelude}\n` : "";

  if (signature.design) {
    const { className, constructorParameters, methods } = signature.design;
    const prefix = lowerFirst(className);
    const create = `${className}* ${prefix}Create(${cParams(constructorParameters).join(", ")}) {
    ${className}* obj = malloc(sizeof(${className}));
    // Set up your fields here.
    return obj;
}`;
    const members = methods.map((method) =>
      cFunction(`${prefix}${upperFirst(method.name)}`, method.returnKind, [`${className}* obj`, ...cParams(method.parameters)], false)
    );
    const free = `void ${prefix}Free(${className}* obj) {
    free(obj);
}`;
    return `${lead}typedef struct {
    // Add your fields here.
} ${className};


${[create, ...members, free].join("\n\n")}`;
  }

  return `${lead}${cFunction(snakeToCamel(signature.functionName), signature.returnKind, cParams(signature.parameters))}`;
};

export const buildStarterCodeByLanguage = (
  signature: ProblemSignature,
  pythonStarter: string
): Record<Language, string> => ({
  python: pythonStarter,
  cpp: buildCpp(signature),
  java: buildJava(signature),
  javascript: buildJavaScript(signature),
  typescript: buildTypeScript(signature),
  c: buildC(signature)
});
