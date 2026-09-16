"""Authoring format for the Noesis problem bank.

Each batch module calls `problem(...)` once per problem. `build.py` turns the
batch into data/problems/<batch>.json:

  - examples are written by hand (input, output[, explanation]) and become the
    visible test cases; build.py fails if the reference solution disagrees
  - tests are inputs only; their expected outputs come from the reference
  - the Python starter is generated from the signature unless given

Keep statements in Noesis's own words. Every problem needs at least two
examples and at least three hidden inputs, including edge cases.
"""

PROBLEMS = []

DEFAULT_RETURNS = {
    "int": "0",
    "long": "0",
    "double": "0.0",
    "bool": "False",
    "string": '""',
    "void": None,
}


def problem(
    *,
    id,
    source,
    title,
    topic,
    difficulty,
    structure,
    description,
    constraints,
    ref,
    examples,
    tests,
    fn="",
    params=(),
    ret="int",
    compare="exact",
    starter=None,
    design=None,
    shared_tail=None,
    default_input=None,
    notes=None,
):
    PROBLEMS.append(
        {
            "id": id,
            "source": source,
            "title": title,
            "topic": topic,
            "difficulty": difficulty,
            "structure": structure,
            "description": " ".join(description.split()),
            "constraints": list(constraints),
            "ref": ref.strip("\n") + "\n",
            "examples": list(examples),
            "tests": list(tests),
            "fn": fn,
            "params": [{"name": name, "kind": kind} for name, kind in params],
            "ret": ret,
            "compare": compare,
            "starter": starter,
            "design": design,
            "shared_tail": shared_tail,
            "default_input": default_input,
            "notes": notes,
        }
    )


def method(name, params=(), ret="void"):
    return {"name": name, "parameters": [{"name": n, "kind": k} for n, k in params], "returnKind": ret}


def design(class_name, ctor=(), methods=()):
    return {
        "className": class_name,
        "constructorParameters": [{"name": n, "kind": k} for n, k in ctor],
        "methods": list(methods),
    }


def ops(*calls):
    """ops(("LRUCache", 2), ("put", 1, 1), ("get", 1)) -> design-problem input."""
    return {"operations": [call[0] for call in calls], "arguments": [list(call[1:]) for call in calls]}


def python_starter(p):
    """A stub that compiles and returns a harmless default."""
    if p["starter"]:
        return p["starter"].strip("\n") + "\n"
    if p["design"]:
        d = p["design"]
        ctor_args = "".join(f", {param['name']}" for param in d["constructorParameters"])
        lines = [f"class {d['className']}:", f"    def __init__(self{ctor_args}):", "        # Set up your fields here.", "        pass", ""]
        for m in d["methods"]:
            args = "".join(f", {param['name']}" for param in m["parameters"])
            lines.append(f"    def {m['name']}(self{args}):")
            ret = default_return(m["returnKind"])
            lines.append("        # Write this method." if ret is None else f"        return {ret}")
            lines.append("")
        return "\n".join(lines).rstrip() + "\n"
    args = ", ".join(param["name"] for param in p["params"])
    ret = default_return(p["ret"])
    body = "    # Write your solution here.\n" + (f"    return {ret}\n" if ret is not None else "    pass\n")
    return f"def {p['fn']}({args}):\n{body}"


def default_return(kind):
    if kind in DEFAULT_RETURNS:
        return DEFAULT_RETURNS[kind]
    if kind in ("linked_list", "doubly_linked_list", "random_list", "child_list", "tree", "list_node_value", "tree_node_value", "cyclic_list", "y_list"):
        return "None"
    return "[]"
