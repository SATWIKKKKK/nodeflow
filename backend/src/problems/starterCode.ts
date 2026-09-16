import type { Language, ProblemSignature, ValueKind } from "@nodeflow/shared";

/**
 * Generates C++/Java stubs from a problem's signature metadata.
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

export const buildStarterCodeByLanguage = (
  signature: ProblemSignature,
  pythonStarter: string
): Record<Language, string> => ({
  python: pythonStarter,
  cpp: buildCpp(signature),
  java: buildJava(signature)
});
