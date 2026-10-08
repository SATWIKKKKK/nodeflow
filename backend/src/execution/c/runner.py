"""C sandbox harness.

Same JSON payload and response as the other harnesses. Functions follow
LeetCode's C conventions: an array arrives as a pointer and a length
(`int* nums, int numsSize`), a grid also carries its row lengths
(`int** grid, int gridSize, int* gridColSize`), and a function that returns an
array reports its length through `int* returnSize` (and the row lengths of a
grid through `int** returnColumnSizes`). Design problems are a struct with
`<name>Create`, one function per method taking the struct first, and
`<name>Free`.

Inputs are baked into the program as C literals, one function per case; the
binary takes the case index as argv[1], so a crash in one case never hides the
others. The learner's code sits after `#line 1 "user.c"`, so compiler messages
and the debugger use their own line numbers, and traces are recorded under gdb
with the same tracer as C++ (cpp/gdb_tracer.py, told it is reading C).

malloc, calloc, realloc and free are routed through small wrappers that note
every block's size. A C array is only a pointer, so that table is how the
replay knows how many cells to draw.
"""

import json
import os
import re
import signal
import subprocess
import sys
import time

sys.path.insert(0, "/runner")
from nf_trace import delta_encode, dumps  # noqa: E402

WORK_DIR = os.environ.get("NF_WORK_DIR", "/tmp/work")
SOURCE_PATH = os.path.join(WORK_DIR, "solution.c")
BINARY_PATH = os.path.join(WORK_DIR, "solution")
TRACE_PATH = os.path.join(WORK_DIR, "trace.json")
GDB_TRACER = os.environ.get("NF_GDB_TRACER", "/runner/gdb_tracer.py")
COMPILE_TIMEOUT = 30
MAX_STDOUT = 64_000

NODE_DEFINITIONS = {
    "ListNode": "struct ListNode {\n    int val;\n    struct ListNode* next;\n};",
    "DListNode": "struct DListNode {\n    int val;\n    struct DListNode* prev;\n    struct DListNode* next;\n};",
    "RandomNode": "struct RandomNode {\n    int val;\n    struct RandomNode* next;\n    struct RandomNode* random;\n};",
    "ChildNode": "struct ChildNode {\n    int val;\n    struct ChildNode* next;\n    struct ChildNode* child;\n};",
    "TreeNode": "struct TreeNode {\n    int val;\n    struct TreeNode* left;\n    struct TreeNode* right;\n};",
}

HELPERS = r"""
#define NF_NULL LLONG_MIN

/* ---- allocation table: block sizes, for the tracer ---- */
#define NF_MAX_ALLOCS 16384
void* nf_alloc_ptr[NF_MAX_ALLOCS];
size_t nf_alloc_len[NF_MAX_ALLOCS];
int nf_alloc_count = 0;

static void nf_untrack(void* p) {
    if (!p) return;
    for (int i = nf_alloc_count - 1; i >= 0; --i) {
        if (nf_alloc_ptr[i] == p) {
            nf_alloc_count--;
            nf_alloc_ptr[i] = nf_alloc_ptr[nf_alloc_count];
            nf_alloc_len[i] = nf_alloc_len[nf_alloc_count];
            return;
        }
    }
}
static void nf_track(void* p, size_t n) {
    if (!p) return;
    nf_untrack(p);
    if (nf_alloc_count < NF_MAX_ALLOCS) {
        nf_alloc_ptr[nf_alloc_count] = p;
        nf_alloc_len[nf_alloc_count] = n;
        nf_alloc_count++;
    }
}
static void* nf_malloc(size_t n) { void* p = malloc(n ? n : 1); nf_track(p, n); return p; }
static void* nf_calloc(size_t c, size_t n) { void* p = calloc(c ? c : 1, n ? n : 1); nf_track(p, c * n); return p; }
static void* nf_realloc(void* q, size_t n) {
    void* p = realloc(q, n ? n : 1);
    if (p) { nf_untrack(q); nf_track(p, n); }
    return p;
}
static void nf_free(void* p) { nf_untrack(p); free(p); }
static char* nf_strdup(const char* s) {
    size_t n = strlen(s) + 1;
    char* p = (char*)nf_malloc(n);
    memcpy(p, s, n);
    return p;
}

__attribute__((noinline)) void nf_enter(void) {}

/* ---- input builders ---- */
static int* nf_ints(int n, const int* v) { int* p = (int*)nf_malloc(sizeof(int) * (n ? n : 1)); if (n) memcpy(p, v, sizeof(int) * n); return p; }
static long long* nf_longs(int n, const long long* v) { long long* p = (long long*)nf_malloc(sizeof(long long) * (n ? n : 1)); if (n) memcpy(p, v, sizeof(long long) * n); return p; }
static double* nf_doubles(int n, const double* v) { double* p = (double*)nf_malloc(sizeof(double) * (n ? n : 1)); if (n) memcpy(p, v, sizeof(double) * n); return p; }
static bool* nf_bools(int n, const bool* v) { bool* p = (bool*)nf_malloc(sizeof(bool) * (n ? n : 1)); if (n) memcpy(p, v, sizeof(bool) * n); return p; }
static char** nf_strs(int n, const char** v) {
    char** p = (char**)nf_malloc(sizeof(char*) * (n ? n : 1));
    for (int i = 0; i < n; ++i) p[i] = nf_strdup(v[i]);
    return p;
}
static int** nf_matrix(int rows, const int* cols, const int* flat, int** colSizes) {
    int** m = (int**)nf_malloc(sizeof(int*) * (rows ? rows : 1));
    *colSizes = nf_ints(rows, cols);
    int at = 0;
    for (int r = 0; r < rows; ++r) { m[r] = nf_ints(cols[r], flat + at); at += cols[r]; }
    return m;
}
static char** nf_char_matrix(int rows, const int* cols, const char* flat, int** colSizes) {
    char** m = (char**)nf_malloc(sizeof(char*) * (rows ? rows : 1));
    *colSizes = nf_ints(rows, cols);
    int at = 0;
    for (int r = 0; r < rows; ++r) {
        m[r] = (char*)nf_malloc(cols[r] + 1);
        memcpy(m[r], flat + at, cols[r]);
        m[r][cols[r]] = 0;
        at += cols[r];
    }
    return m;
}
static char*** nf_str_matrix(int rows, const int* cols, const char** flat, int** colSizes) {
    char*** m = (char***)nf_malloc(sizeof(char**) * (rows ? rows : 1));
    *colSizes = nf_ints(rows, cols);
    int at = 0;
    for (int r = 0; r < rows; ++r) { m[r] = nf_strs(cols[r], flat + at); at += cols[r]; }
    return m;
}
static struct ListNode* nf_list(int n, const int* v, struct ListNode* tail) {
    struct ListNode* head = tail;
    for (int i = n - 1; i >= 0; --i) {
        struct ListNode* node = (struct ListNode*)nf_malloc(sizeof(struct ListNode));
        node->val = v[i]; node->next = head; head = node;
    }
    return head;
}
static struct ListNode* nf_cyclic(int n, const int* v, int pos) {
    struct ListNode* head = nf_list(n, v, NULL);
    if (!head || pos < 0 || pos >= n) return head;
    struct ListNode* target = head; for (int i = 0; i < pos; ++i) target = target->next;
    struct ListNode* last = head; while (last->next) last = last->next;
    last->next = target;
    return head;
}
static struct DListNode* nf_dll(int n, const int* v) {
    struct DListNode* head = NULL; struct DListNode* tail = NULL;
    for (int i = 0; i < n; ++i) {
        struct DListNode* node = (struct DListNode*)nf_malloc(sizeof(struct DListNode));
        node->val = v[i]; node->prev = tail; node->next = NULL;
        if (tail) tail->next = node; else head = node;
        tail = node;
    }
    return head;
}
static struct RandomNode* nf_random(int n, const int* vals, const int* targets) {
    struct RandomNode** nodes = (struct RandomNode**)malloc(sizeof(struct RandomNode*) * (n ? n : 1));
    for (int i = 0; i < n; ++i) {
        nodes[i] = (struct RandomNode*)nf_malloc(sizeof(struct RandomNode));
        nodes[i]->val = vals[i]; nodes[i]->next = NULL; nodes[i]->random = NULL;
    }
    for (int i = 0; i < n; ++i) {
        if (i + 1 < n) nodes[i]->next = nodes[i + 1];
        if (targets[i] >= 0 && targets[i] < n) nodes[i]->random = nodes[targets[i]];
    }
    struct RandomNode* head = n ? nodes[0] : NULL;
    free(nodes);
    return head;
}
static struct ChildNode* nf_child(int columns, const int* sizes, const int* flat) {
    struct ChildNode* first = NULL; struct ChildNode* previous = NULL;
    int at = 0;
    for (int c = 0; c < columns; ++c) {
        struct ChildNode* head = NULL; struct ChildNode* tail = NULL;
        for (int i = 0; i < sizes[c]; ++i) {
            struct ChildNode* node = (struct ChildNode*)nf_malloc(sizeof(struct ChildNode));
            node->val = flat[at + i]; node->next = NULL; node->child = NULL;
            if (tail) tail->child = node; else head = node;
            tail = node;
        }
        at += sizes[c];
        if (!head) continue;
        if (previous) previous->next = head; else first = head;
        previous = head;
    }
    return first;
}
static struct TreeNode* nf_tree(int n, const long long* v) {
    if (n == 0 || v[0] == NF_NULL) return NULL;
    struct TreeNode** queue = (struct TreeNode**)malloc(sizeof(struct TreeNode*) * n);
    int head = 0, size = 0;
    struct TreeNode* root = (struct TreeNode*)nf_malloc(sizeof(struct TreeNode));
    root->val = (int)v[0]; root->left = root->right = NULL;
    queue[size++] = root;
    int i = 1;
    while (head < size && i < n) {
        struct TreeNode* node = queue[head++];
        if (i < n && v[i] != NF_NULL) {
            node->left = (struct TreeNode*)nf_malloc(sizeof(struct TreeNode));
            node->left->val = (int)v[i]; node->left->left = node->left->right = NULL;
            queue[size++] = node->left;
        }
        i++;
        if (i < n && v[i] != NF_NULL) {
            node->right = (struct TreeNode*)nf_malloc(sizeof(struct TreeNode));
            node->right->val = (int)v[i]; node->right->left = node->right->right = NULL;
            queue[size++] = node->right;
        }
        i++;
    }
    free(queue);
    return root;
}

/* ---- JSON output ---- */
typedef struct { char* data; size_t len; size_t cap; } nf_buf;
static void nf_put(nf_buf* b, const char* s) {
    size_t n = strlen(s);
    if (b->len + n + 1 > b->cap) {
        size_t cap = b->cap ? b->cap : 256;
        while (b->len + n + 1 > cap) cap *= 2;
        b->data = (char*)realloc(b->data, cap);
        b->cap = cap;
    }
    memcpy(b->data + b->len, s, n + 1);
    b->len += n;
}
static void nf_json_long(nf_buf* b, long long v) { char t[32]; snprintf(t, sizeof t, "%lld", v); nf_put(b, t); }
static void nf_json_double(nf_buf* b, double v) {
    if (isnan(v)) { nf_put(b, "\"nan\""); return; }
    if (isinf(v)) { nf_put(b, v > 0 ? "\"inf\"" : "\"-inf\""); return; }
    char t[64]; snprintf(t, sizeof t, "%.12g", v); nf_put(b, t);
}
static void nf_json_bool(nf_buf* b, bool v) { nf_put(b, v ? "true" : "false"); }
static void nf_json_chars(nf_buf* b, const char* s, int n) {
    nf_put(b, "\"");
    char t[8];
    for (int i = 0; n < 0 ? s[i] != 0 : i < n; ++i) {
        unsigned char c = (unsigned char)s[i];
        if (c == '"') nf_put(b, "\\\"");
        else if (c == '\\') nf_put(b, "\\\\");
        else if (c == '\n') nf_put(b, "\\n");
        else if (c == '\t') nf_put(b, "\\t");
        else if (c == '\r') nf_put(b, "\\r");
        else if (c < 0x20) { snprintf(t, sizeof t, "\\u%04x", c); nf_put(b, t); }
        else { t[0] = (char)c; t[1] = 0; nf_put(b, t); }
    }
    nf_put(b, "\"");
}
static void nf_json_str(nf_buf* b, const char* s) { if (!s) nf_put(b, "null"); else nf_json_chars(b, s, -1); }
static void nf_json_char(nf_buf* b, char c) { nf_json_chars(b, &c, 1); }
static void nf_json_ints(nf_buf* b, const int* v, int n) {
    if (!v && n > 0) { nf_put(b, "null"); return; }
    nf_put(b, "[");
    for (int i = 0; i < n; ++i) { if (i) nf_put(b, ","); nf_json_long(b, v[i]); }
    nf_put(b, "]");
}
static void nf_json_longs(nf_buf* b, const long long* v, int n) {
    if (!v && n > 0) { nf_put(b, "null"); return; }
    nf_put(b, "[");
    for (int i = 0; i < n; ++i) { if (i) nf_put(b, ","); nf_json_long(b, v[i]); }
    nf_put(b, "]");
}
static void nf_json_doubles(nf_buf* b, const double* v, int n) {
    if (!v && n > 0) { nf_put(b, "null"); return; }
    nf_put(b, "[");
    for (int i = 0; i < n; ++i) { if (i) nf_put(b, ","); nf_json_double(b, v[i]); }
    nf_put(b, "]");
}
static void nf_json_bools(nf_buf* b, const bool* v, int n) {
    if (!v && n > 0) { nf_put(b, "null"); return; }
    nf_put(b, "[");
    for (int i = 0; i < n; ++i) { if (i) nf_put(b, ","); nf_json_bool(b, v[i]); }
    nf_put(b, "]");
}
static void nf_json_strs(nf_buf* b, char** v, int n) {
    if (!v && n > 0) { nf_put(b, "null"); return; }
    nf_put(b, "[");
    for (int i = 0; i < n; ++i) { if (i) nf_put(b, ","); nf_json_str(b, v[i]); }
    nf_put(b, "]");
}
static void nf_json_matrix(nf_buf* b, int** v, int n, const int* cols) {
    if (!v && n > 0) { nf_put(b, "null"); return; }
    nf_put(b, "[");
    for (int i = 0; i < n; ++i) { if (i) nf_put(b, ","); nf_json_ints(b, v[i], cols ? cols[i] : 0); }
    nf_put(b, "]");
}
static void nf_json_char_matrix(nf_buf* b, char** v, int n, const int* cols) {
    if (!v && n > 0) { nf_put(b, "null"); return; }
    nf_put(b, "[");
    for (int i = 0; i < n; ++i) {
        if (i) nf_put(b, ",");
        nf_put(b, "[");
        int width = cols ? cols[i] : 0;
        for (int j = 0; j < width; ++j) { if (j) nf_put(b, ","); nf_json_char(b, v[i][j]); }
        nf_put(b, "]");
    }
    nf_put(b, "]");
}
static void nf_json_str_matrix(nf_buf* b, char*** v, int n, const int* cols) {
    if (!v && n > 0) { nf_put(b, "null"); return; }
    nf_put(b, "[");
    for (int i = 0; i < n; ++i) { if (i) nf_put(b, ","); nf_json_strs(b, v[i], cols ? cols[i] : 0); }
    nf_put(b, "]");
}

#define NF_SEEN_MAX 4096
static int nf_seen(void** seen, int count, void* p) { for (int i = 0; i < count; ++i) if (seen[i] == p) return 1; return 0; }

static void nf_json_list(nf_buf* b, struct ListNode* head) {
    void* seen[501]; int count = 0;
    nf_put(b, "[");
    for (struct ListNode* cur = head; cur; cur = cur->next) {
        if (count) nf_put(b, ",");
        if (nf_seen(seen, count, cur)) { nf_put(b, "\"<cycle>\""); break; }
        if (count >= 500) { nf_put(b, "\"<too long>\""); break; }
        seen[count++] = cur;
        nf_json_long(b, cur->val);
    }
    nf_put(b, "]");
}
static void nf_json_dll(nf_buf* b, struct DListNode* head) {
    void* seen[501]; int count = 0;
    struct DListNode* previous = NULL;
    nf_put(b, "[");
    for (struct DListNode* cur = head; cur; previous = cur, cur = cur->next) {
        if (count) nf_put(b, ",");
        if (nf_seen(seen, count, cur)) { nf_put(b, "\"<cycle>\""); break; }
        if (cur->prev != previous) { nf_put(b, "\"<prev link broken>\""); break; }
        if (count >= 500) { nf_put(b, "\"<too long>\""); break; }
        seen[count++] = cur;
        nf_json_long(b, cur->val);
    }
    nf_put(b, "]");
}
static void nf_json_random(nf_buf* b, struct RandomNode* head) {
    struct RandomNode* nodes[501]; int count = 0;
    for (struct RandomNode* cur = head; cur && count <= 500 && !nf_seen((void**)nodes, count, cur); cur = cur->next) nodes[count++] = cur;
    nf_put(b, "[");
    for (int i = 0; i < count; ++i) {
        if (i) nf_put(b, ",");
        nf_put(b, "[");
        nf_json_long(b, nodes[i]->val);
        nf_put(b, ",");
        struct RandomNode* target = nodes[i]->random;
        if (!target) nf_put(b, "null");
        else {
            int at = -1;
            for (int j = 0; j < count; ++j) if (nodes[j] == target) { at = j; break; }
            if (at >= 0) nf_json_long(b, at); else nf_put(b, "\"<outside list>\"");
        }
        nf_put(b, "]");
    }
    nf_put(b, "]");
}
static void nf_json_child(nf_buf* b, struct ChildNode* head) {
    void* seen[501]; int count = 0;
    nf_put(b, "[");
    for (struct ChildNode* cur = head; cur; cur = cur->child) {
        if (count) nf_put(b, ",");
        if (nf_seen(seen, count, cur)) { nf_put(b, "\"<cycle>\""); break; }
        if (count >= 500) { nf_put(b, "\"<too long>\""); break; }
        seen[count++] = cur;
        nf_json_long(b, cur->val);
    }
    nf_put(b, "]");
}
static void nf_json_tree(nf_buf* b, struct TreeNode* root) {
    if (!root) { nf_put(b, "[]"); return; }
    struct TreeNode** queue = (struct TreeNode**)malloc(sizeof(struct TreeNode*) * 4100);
    void** seen = (void**)malloc(sizeof(void*) * 2100);
    int head = 0, size = 0, count = 0, out = 0, nulls = 0, cycle = 0;
    queue[size++] = root;
    nf_buf items = {0};
    while (head < size && out < 2000) {
        struct TreeNode* node = queue[head++];
        if (!node) { nulls++; continue; }
        if (nf_seen(seen, count, node)) { cycle = 1; break; }
        seen[count++] = node;
        for (; nulls > 0; --nulls) { nf_put(&items, out ? ",null" : "null"); out++; }
        if (out) nf_put(&items, ",");
        nf_json_long(&items, node->val);
        out++;
        if (size + 2 < 4100) { queue[size++] = node->left; queue[size++] = node->right; }
    }
    nf_put(b, "[");
    if (items.data) nf_put(b, items.data);
    if (cycle) nf_put(b, out ? ",\"<cycle>\"" : "\"<cycle>\"");
    nf_put(b, "]");
    free(items.data); free(queue); free(seen);
}

static void nf_emit(nf_buf* b) {
    const char* path = getenv("NF_RESULT");
    FILE* out = path ? fopen(path, "w") : stderr;
    if (!out) out = stderr;
    fputs(b->data ? b->data : "null", out);
    fputc('\n', out);
    fflush(out);
    if (out != stderr) fclose(out);
}
"""

ROUTING = r"""
#define malloc(n) nf_malloc(n)
#define calloc(c, n) nf_calloc((c), (n))
#define realloc(p, n) nf_realloc((p), (n))
#define free(p) nf_free(p)
#define strdup(s) nf_strdup(s)
"""

ONE_D = {"array", "long_array", "double_array", "bool_array", "string_array"}
TWO_D = {"matrix", "graph", "char_matrix", "string_matrix"}
NODE_TYPE_BY_KIND = {
    "linked_list": "struct ListNode*",
    "cyclic_list": "struct ListNode*",
    "y_list": "struct ListNode*",
    "list_node_value": "struct ListNode*",
    "doubly_linked_list": "struct DListNode*",
    "random_list": "struct RandomNode*",
    "child_list": "struct ChildNode*",
    "tree": "struct TreeNode*",
    "tree_node_value": "struct TreeNode*",
}
SCALAR_TYPES = {"int": "int", "long": "long long", "double": "double", "bool": "bool", "string": "char*"}
ARRAY_TYPES = {
    "array": "int*",
    "long_array": "long long*",
    "double_array": "double*",
    "bool_array": "bool*",
    "string_array": "char**",
    "matrix": "int**",
    "graph": "int**",
    "char_matrix": "char**",
    "string_matrix": "char***",
}


# ---------------------------------------------------------------------------
# Literals
# ---------------------------------------------------------------------------


def c_string(value):
    out = ['"']
    for byte in str(value if value is not None else "").encode("utf8"):
        char = chr(byte)
        if char == '"':
            out.append('\\"')
        elif char == "\\":
            out.append("\\\\")
        elif 32 <= byte < 127 and char != "?":
            out.append(char)
        else:
            out.append("\\%03o" % byte)
    out.append('"')
    return "".join(out)


def c_char(value):
    text = str(value or "\0")[:1]
    if text == "'":
        return "'\\''"
    if text == "\\":
        return "'\\\\'"
    byte = ord(text)
    if 32 <= byte < 127:
        return f"'{text}'"
    return "'\\%03o'" % (byte & 0xFF)


def c_int(value):
    return str(int(value or 0))


def c_long(value):
    return f"{int(value or 0)}LL"


def c_double(value):
    number = float(value or 0)
    text = repr(number)
    if "inf" in text or "nan" in text:
        return "0.0"
    return text


def compound(c_type, items):
    items = list(items)
    if not items:
        return "NULL"
    return f"({c_type}[]){{{', '.join(items)}}}"


def build_lines(kind, name, value):
    """Declarations that build one input; returns (lines, call arguments)."""
    if kind in SCALAR_TYPES and kind != "string":
        literal = {"int": c_int, "long": c_long, "double": c_double, "bool": lambda v: "true" if v else "false"}[kind](value)
        return [f"{SCALAR_TYPES[kind]} {name} = {literal};"], [name]
    if kind == "string":
        return [f"char* {name} = nf_strdup({c_string(value)});"], [name]
    values = value or []
    if kind == "array":
        return [f"int {name}_n = {len(values)};", f"int* {name} = nf_ints({len(values)}, {compound('int', map(c_int, values))});"], [name, f"{name}_n"]
    if kind == "long_array":
        return [f"int {name}_n = {len(values)};", f"long long* {name} = nf_longs({len(values)}, {compound('long long', map(c_long, values))});"], [name, f"{name}_n"]
    if kind == "double_array":
        return [f"int {name}_n = {len(values)};", f"double* {name} = nf_doubles({len(values)}, {compound('double', map(c_double, values))});"], [name, f"{name}_n"]
    if kind == "bool_array":
        return [f"int {name}_n = {len(values)};", f"bool* {name} = nf_bools({len(values)}, {compound('bool', ('true' if v else 'false' for v in values))});"], [name, f"{name}_n"]
    if kind == "string_array":
        return [f"int {name}_n = {len(values)};", f"char** {name} = nf_strs({len(values)}, {compound('const char*', map(c_string, values))});"], [name, f"{name}_n"]
    if kind in ("matrix", "graph", "char_matrix", "string_matrix"):
        rows = [list(row or []) for row in values]
        cols = compound("int", (str(len(row)) for row in rows))
        flat = [item for row in rows for item in row]
        if kind in ("matrix", "graph"):
            builder = f"nf_matrix({len(rows)}, {cols}, {compound('int', map(c_int, flat))}, &{name}_cols)"
            c_type = "int**"
        elif kind == "char_matrix":
            builder = f"nf_char_matrix({len(rows)}, {cols}, {compound('char', map(c_char, flat))}, &{name}_cols)"
            c_type = "char**"
        else:
            builder = f"nf_str_matrix({len(rows)}, {cols}, {compound('const char*', map(c_string, flat))}, &{name}_cols)"
            c_type = "char***"
        return [f"int {name}_n = {len(rows)};", f"int* {name}_cols = NULL;", f"{c_type} {name} = {builder};"], [name, f"{name}_n", f"{name}_cols"]
    if kind == "linked_list":
        return [f"struct ListNode* {name} = nf_list({len(values)}, {compound('int', map(c_int, values))}, NULL);"], [name]
    if kind == "y_list":
        return [f"struct ListNode* {name} = nf_list({len(values)}, {compound('int', map(c_int, values))}, nf_shared);"], [name]
    if kind == "doubly_linked_list":
        return [f"struct DListNode* {name} = nf_dll({len(values)}, {compound('int', map(c_int, values))});"], [name]
    if kind == "cyclic_list":
        spec = value or {}
        items = spec.get("values") or []
        pos = spec.get("pos", -1)
        pos = -1 if pos is None else pos
        return [f"struct ListNode* {name} = nf_cyclic({len(items)}, {compound('int', map(c_int, items))}, {c_int(pos)});"], [name]
    if kind == "random_list":
        vals = [c_int(pair[0]) for pair in values]
        targets = [c_int(-1 if len(pair) < 2 or pair[1] is None else pair[1]) for pair in values]
        return [f"struct RandomNode* {name} = nf_random({len(values)}, {compound('int', vals)}, {compound('int', targets)});"], [name]
    if kind == "child_list":
        columns = [list(column or []) for column in values]
        sizes = compound("int", (str(len(column)) for column in columns))
        flat = [item for column in columns for item in column]
        return [f"struct ChildNode* {name} = nf_child({len(columns)}, {sizes}, {compound('int', map(c_int, flat))});"], [name]
    if kind == "tree":
        items = ["NF_NULL" if item is None else c_long(item) for item in values]
        return [f"struct TreeNode* {name} = nf_tree({len(items)}, {compound('long long', items)});"], [name]
    raise ValueError(f"Unsupported C parameter kind: {kind}")


def call_and_serialize(kind, call_prefix, args):
    """Lines that call the learner's function and write its result as JSON into `nf_b`."""
    if kind == "void":
        return [f"{call_prefix}({', '.join(args)});", 'nf_put(&nf_b, "null");']
    if kind in ONE_D:
        c_type = ARRAY_TYPES[kind]
        writer = {
            "array": "nf_json_ints",
            "long_array": "nf_json_longs",
            "double_array": "nf_json_doubles",
            "bool_array": "nf_json_bools",
            "string_array": "nf_json_strs",
        }[kind]
        return [
            "int nf_rs = 0;",
            f"{c_type} nf_r = {call_prefix}({', '.join(args + ['&nf_rs'])});",
            f"{writer}(&nf_b, nf_r, nf_rs);",
        ]
    if kind in TWO_D:
        c_type = ARRAY_TYPES[kind]
        writer = {
            "matrix": "nf_json_matrix",
            "graph": "nf_json_matrix",
            "char_matrix": "nf_json_char_matrix",
            "string_matrix": "nf_json_str_matrix",
        }[kind]
        return [
            "int nf_rs = 0;",
            "int* nf_rcs = NULL;",
            f"{c_type} nf_r = {call_prefix}({', '.join(args + ['&nf_rs', '&nf_rcs'])});",
            f"{writer}(&nf_b, nf_r, nf_rs, nf_rcs);",
        ]
    call = f"{call_prefix}({', '.join(args)})"
    if kind in ("int", "long"):
        return [f"long long nf_r = (long long)({call});", "nf_json_long(&nf_b, nf_r);"]
    if kind == "double":
        return [f"double nf_r = (double)({call});", "nf_json_double(&nf_b, nf_r);"]
    if kind == "bool":
        return [f"bool nf_r = ({call}) ? true : false;", "nf_json_bool(&nf_b, nf_r);"]
    if kind == "string":
        return [f"char* nf_r = {call};", "nf_json_str(&nf_b, nf_r);"]
    if kind in ("linked_list", "cyclic_list", "y_list"):
        return [f"struct ListNode* nf_r = {call};", "nf_json_list(&nf_b, nf_r);"]
    if kind == "doubly_linked_list":
        return [f"struct DListNode* nf_r = {call};", "nf_json_dll(&nf_b, nf_r);"]
    if kind == "random_list":
        return [f"struct RandomNode* nf_r = {call};", "nf_json_random(&nf_b, nf_r);"]
    if kind == "child_list":
        return [f"struct ChildNode* nf_r = {call};", "nf_json_child(&nf_b, nf_r);"]
    if kind == "tree":
        return [f"struct TreeNode* nf_r = {call};", "nf_json_tree(&nf_b, nf_r);"]
    if kind == "list_node_value":
        return [f"struct ListNode* nf_r = {call};", "nf_json_long(&nf_b, nf_r ? nf_r->val : -1);"]
    if kind == "tree_node_value":
        return [f"struct TreeNode* nf_r = {call};", "nf_json_long(&nf_b, nf_r ? nf_r->val : -1);"]
    raise ValueError(f"Unsupported C return kind: {kind}")


def snake_to_camel(value):
    parts = value.split("_")
    return parts[0] + "".join(part[:1].upper() + part[1:] for part in parts[1:])


def lower_first(value):
    return value[:1].lower() + value[1:]


def upper_first(value):
    return value[:1].upper() + value[1:]


# ---------------------------------------------------------------------------
# Source generation
# ---------------------------------------------------------------------------


def blank_declarations(code):
    """Blank out the learner's copies of the node structs, keeping line numbers."""
    for name in NODE_DEFINITIONS:
        while True:
            match = re.search(r"\b(?:typedef\s+)?struct\s+" + name + r"\s*\{", code)
            if not match:
                break
            start = code.find("{", match.end() - 1)
            depth = 0
            end = None
            for index in range(start, len(code)):
                if code[index] == "{":
                    depth += 1
                elif code[index] == "}":
                    depth -= 1
                    if depth == 0:
                        end = index + 1
                        break
            if end is None:
                break
            tail = code[end:]
            semicolon = tail.find(";")
            if semicolon >= 0 and re.fullmatch(r"[\s\w]*", tail[:semicolon]):
                end += semicolon + 1
            removed = code[match.start() : end]
            code = code[: match.start()] + "\n" * removed.count("\n") + code[end:]
    return code


def case_function(index, payload, case_input):
    lines = [f"static void nf_case_{index}(void) {{", "    nf_buf nf_b = {0};"]
    shared = payload.get("sharedTail")
    if shared:
        tail = case_input.get(shared) or []
        lines.append(f"    struct ListNode* nf_shared = nf_list({len(tail)}, {compound('int', map(c_int, tail))}, NULL);")

    design = payload.get("design")
    if design:
        class_name = design["className"]
        prefix = lower_first(class_name)
        methods = {method["name"]: method for method in design["methods"]}
        lines.append(f"    {class_name}* nf_obj = NULL;")
        lines.append('    nf_put(&nf_b, "[");')
        operations = case_input.get("operations") or []
        arguments = case_input.get("arguments") or []
        for op_index, operation in enumerate(operations):
            values = list(arguments[op_index]) if op_index < len(arguments) else []
            if op_index:
                lines.append('    nf_put(&nf_b, ",");')
            lines.append("    {")
            if operation == class_name:
                params = design["constructorParameters"]
            else:
                method = methods.get(operation)
                if method is None:
                    raise ValueError(f"Unknown operation {operation}")
                params = method["parameters"]
            args = [] if operation == class_name else ["nf_obj"]
            for arg_index, parameter in enumerate(params):
                built, names = build_lines(parameter["kind"], f"nf_a{arg_index}", values[arg_index] if arg_index < len(values) else None)
                lines.extend("        " + line for line in built)
                args.extend(names)
            lines.append("        nf_enter();")
            if operation == class_name:
                lines.append(f"        nf_obj = {prefix}Create({', '.join(args)});")
                lines.append('        nf_put(&nf_b, "null");')
            else:
                body = call_and_serialize(method["returnKind"], f"{prefix}{upper_first(operation)}", args)
                lines.extend("        " + line for line in body)
            lines.append("    }")
        lines.append('    nf_put(&nf_b, "]");')
        lines.append("    nf_emit(&nf_b);")
        lines.append("}")
        return "\n".join(lines)

    args = []
    for arg_index, parameter in enumerate(payload["parameters"]):
        built, names = build_lines(parameter["kind"], f"nf_a{arg_index}", case_input.get(parameter["name"]))
        lines.extend("    " + line for line in built)
        args.extend(names)
    lines.append("    nf_enter();")
    body = call_and_serialize(payload["returnKind"], snake_to_camel(payload["entrypoint"]), args)
    lines.extend("    " + line for line in body)
    lines.append("    nf_emit(&nf_b);")
    lines.append("}")
    return "\n".join(lines)


def generate_source(payload, cases):
    user_code = blank_declarations(payload["code"])
    includes = [
        "#include <stdio.h>",
        "#include <stdlib.h>",
        "#include <string.h>",
        "#include <stdbool.h>",
        "#include <stdint.h>",
        "#include <limits.h>",
        "#include <math.h>",
        "#include <ctype.h>",
    ]
    # LeetCode's C has uthash for hash tables; offer it where it is installed.
    if os.path.exists("/usr/include/uthash.h"):
        includes.append("#include <uthash.h>")
    head = "\n".join(includes + [""] + list(NODE_DEFINITIONS.values()) + [HELPERS, ROUTING])
    user_block = '#line 1 "user.c"\n' + user_code + "\n"
    head_lines = head.count("\n") + 1
    user_lines = user_block.count("\n")
    functions = [case_function(index, payload, case) for index, case in enumerate(cases)]
    dispatch = "\n".join(f"        case {index}: nf_case_{index}(); break;" for index in range(len(cases)))
    tail = "\n".join(
        [
            f'#line {head_lines + user_lines + 1} "harness.c"',
            "#undef malloc",
            "#undef calloc",
            "#undef realloc",
            "#undef free",
            "#undef strdup",
            *functions,
            "",
            "int main(int argc, char** argv) {",
            '    if (getenv("NF_STDOUT")) freopen(getenv("NF_STDOUT"), "w", stdout);',
            "    int which = argc > 1 ? atoi(argv[1]) : 0;",
            "    switch (which) {",
            dispatch,
            "        default: break;",
            "    }",
            "    fflush(stdout);",
            "    return 0;",
            "}",
            "",
        ]
    )
    return head + "\n" + user_block + tail


# ---------------------------------------------------------------------------
# Compile / run / trace
# ---------------------------------------------------------------------------


def failure(error_type, message, started, **extra):
    response = {
        "ok": False,
        "errorType": error_type,
        "message": message,
        "runtimeMs": int((time.perf_counter() - started) * 1000),
    }
    response.update({key: value for key, value in extra.items() if value is not None})
    return response


def clean_compiler_output(text):
    return "\n".join(line.replace(SOURCE_PATH, "harness").replace(WORK_DIR + "/", "") for line in text.splitlines())[:4000]


def compile_source(started):
    try:
        compiled = subprocess.run(
            ["gcc", "-std=gnu17", "-O0", "-g", "-w", "-o", BINARY_PATH, SOURCE_PATH, "-lm"],
            capture_output=True,
            text=True,
            timeout=COMPILE_TIMEOUT,
        )
    except subprocess.TimeoutExpired:
        return failure("Time Limit Exceeded", "Compilation timed out.", started)

    if compiled.returncode == 0:
        return None

    output = clean_compiler_output(compiled.stderr)
    match = re.search(r"user\.c:(\d+):\d+: (?:fatal )?error: (.*)", output)
    if match:
        return failure(
            "Compile Error",
            f"Line {match.group(1)}: {match.group(2)}",
            started,
            traceback=output,
            line=int(match.group(1)),
        )
    return failure(
        "Compile Error",
        "Your C code does not match the expected function signature.",
        started,
        traceback=output,
    )


SIGNAL_MESSAGES = {
    signal.SIGSEGV: "Segmentation fault: invalid memory access (a NULL pointer, or an index out of range).",
    signal.SIGFPE: "Arithmetic error, such as division by zero.",
    signal.SIGBUS: "Bus error: invalid memory access.",
    signal.SIGILL: "Illegal instruction (often a function that does not return a value).",
    signal.SIGABRT: "Your program aborted (often a double free or a corrupted heap).",
}


def run_case(index, timeout_s):
    started = time.perf_counter()
    result_path = os.path.join(WORK_DIR, f"result_{index}.json")
    if os.path.exists(result_path):
        os.remove(result_path)
    env = dict(os.environ, NF_RESULT=result_path)
    try:
        executed = subprocess.run([BINARY_PATH, str(index)], capture_output=True, text=True, timeout=timeout_s, env=env)
    except subprocess.TimeoutExpired as error:
        stdout = error.stdout.decode("utf8", "replace") if isinstance(error.stdout, bytes) else (error.stdout or "")
        return failure("Time Limit Exceeded", "Your code ran longer than the time limit.", started, stdout=stdout[:MAX_STDOUT])

    stdout = executed.stdout[:MAX_STDOUT]
    if executed.returncode != 0:
        code = executed.returncode
        stderr = executed.stderr.strip()
        if code < 0:
            message = SIGNAL_MESSAGES.get(-code, f"Your program was killed by signal {-code}.")
        else:
            message = f"Your program exited with status {code}."
        return failure("Runtime Error", message, started, traceback=stderr[-4000:] or None, stdout=stdout)

    try:
        with open(result_path, encoding="utf8") as handle:
            result = json.loads(handle.read())
    except (OSError, json.JSONDecodeError):
        return failure(
            "Runtime Error",
            "Your function's result could not be read. Check that every array you return is malloc'd and that returnSize is set.",
            started,
            traceback=executed.stderr[-2000:] or None,
            stdout=stdout,
        )

    return {"ok": True, "result": result, "stdout": stdout, "runtimeMs": int((time.perf_counter() - started) * 1000)}


def trace_case(payload, budget_s):
    """Run case 0 under gdb and return (steps, truncated, note)."""
    if os.path.exists(TRACE_PATH):
        os.remove(TRACE_PATH)
    user_source = os.path.join(WORK_DIR, "user_source.txt")
    with open(user_source, "w", encoding="utf8") as handle:
        handle.write(payload.get("code", ""))
    env = dict(
        os.environ,
        NF_TRACE_OUT=TRACE_PATH,
        NF_USER_SOURCE=user_source,
        NF_USER_FILE="user.c",
        NF_LANG="c",
        NF_STEP_LIMIT=str(int(payload.get("stepLimit", 1500))),
        NF_VIS_LIMIT=str(int(payload.get("visualizeLimit", 64))),
        NF_TIME_BUDGET=str(budget_s),
        NF_STDOUT="/dev/null",
        NF_RESULT=os.path.join(WORK_DIR, "trace_result.json"),
    )
    try:
        subprocess.run(
            ["gdb", "-nx", "-batch", "-q", "-x", GDB_TRACER, "--args", BINARY_PATH, "0"],
            capture_output=True,
            text=True,
            timeout=budget_s + 8,
            env=env,
        )
    except subprocess.TimeoutExpired:
        pass
    try:
        with open(TRACE_PATH, encoding="utf8") as handle:
            data = json.load(handle)
    except (OSError, json.JSONDecodeError):
        return [], False, "The C tracer could not record this run."
    return data.get("steps", []), bool(data.get("truncated")), data.get("note")


def run(payload):
    started = time.perf_counter()
    os.makedirs(WORK_DIR, exist_ok=True)
    batch = "cases" in payload
    cases = [case.get("input") or {} for case in payload["cases"]] if batch else [payload.get("input") or {}]
    case_timeout = int(payload.get("caseTimeoutMs", 3000)) / 1000

    try:
        source = generate_source(payload, cases)
    except (ValueError, KeyError, TypeError) as error:
        return failure("Platform Error", f"Could not prepare this problem for C: {error}", started)

    with open(SOURCE_PATH, "w", encoding="utf8") as handle:
        handle.write(source)

    compile_error = compile_source(started)
    if compile_error:
        if not batch:
            compile_error["trace"] = []
        return compile_error

    if batch:
        results = []
        for index in range(len(cases)):
            results.append(run_case(index, case_timeout))
            # Submit stops at the first crash or timeout: the rest could only repeat it.
            if payload.get("stopOnError") and not results[-1].get("ok"):
                break
        return {"ok": True, "cases": results}

    outcome = run_case(0, case_timeout)
    steps, truncated, note = [], False, None
    if payload.get("trace", True):
        budget = 8 if outcome.get("errorType") == "Time Limit Exceeded" else 20
        steps, truncated, note = trace_case(payload, budget_s=budget)

    outcome["trace"] = delta_encode(steps)
    outcome["heapMode"] = "delta"
    if outcome["ok"]:
        outcome["stepsCaptured"] = len(steps)
        if truncated:
            outcome["traceTruncated"] = True
        if note:
            outcome["traceNote"] = note
    elif steps and not outcome.get("line"):
        outcome["line"] = steps[-1].get("line")
    return outcome


if __name__ == "__main__":
    try:
        response = run(json.loads(sys.stdin.read()))
    except Exception as error:  # noqa: BLE001 - last-resort guard, must stay JSON
        response = {"ok": False, "errorType": "Platform Error", "message": f"C harness failed: {error}"}
    sys.stdout.write(dumps(response))
