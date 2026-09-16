import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.PrintStream;
import java.io.Writer;
import java.lang.reflect.Constructor;
import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Method;
import java.lang.reflect.Modifier;
import java.lang.reflect.ParameterizedType;
import java.lang.reflect.Type;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Paths;
import java.util.*;

/*
 * Noesis Java harness. Precompiled into the sandbox image; the user's
 * Solution.java is compiled against it.
 *
 *   java NfHarness run   spec.json results.jsonl   every case, one JSON line each
 *   java NfHarness trace spec.json results.jsonl   case 0 only (driven by NfTracer)
 *
 * Inputs arrive as JSON and are converted to whatever types the user's method
 * declares (int[] or List<Integer>, and so on), so the starter signature and the
 * harness never drift apart.
 */

class ListNode {
    int val;
    ListNode next;
    ListNode() {}
    ListNode(int val) { this.val = val; }
    ListNode(int val, ListNode next) { this.val = val; this.next = next; }
}

class DListNode {
    int val;
    DListNode prev;
    DListNode next;
    DListNode() {}
    DListNode(int val) { this.val = val; }
}

class RandomNode {
    int val;
    RandomNode next;
    RandomNode random;
    RandomNode(int val) { this.val = val; }
}

class ChildNode {
    int val;
    ChildNode next;
    ChildNode child;
    ChildNode(int val) { this.val = val; }
}

class TreeNode {
    int val;
    TreeNode left;
    TreeNode right;
    TreeNode() {}
    TreeNode(int val) { this.val = val; }
    TreeNode(int val, TreeNode left, TreeNode right) { this.val = val; this.left = left; this.right = right; }
}

public class NfHarness {
    static final int MAX_STDOUT = 64_000;

    /** The tracer puts a breakpoint here; called right before each call into user code. */
    public static void enter() {}

    static final class SetupError extends RuntimeException {
        SetupError(String message) { super(message); }
    }

    // ------------------------------------------------------------------ JSON

    static Object parseJson(String text) { return new JsonParser(text).parse(); }

    static final class JsonParser {
        private final String s;
        private int i;

        JsonParser(String s) { this.s = s; }

        Object parse() {
            Object value = value();
            skip();
            return value;
        }

        private void skip() {
            while (i < s.length() && Character.isWhitespace(s.charAt(i))) i++;
        }

        private Object value() {
            skip();
            char c = s.charAt(i);
            if (c == '{') return object();
            if (c == '[') return array();
            if (c == '"') return string();
            if (s.startsWith("true", i)) { i += 4; return Boolean.TRUE; }
            if (s.startsWith("false", i)) { i += 5; return Boolean.FALSE; }
            if (s.startsWith("null", i)) { i += 4; return null; }
            return number();
        }

        private Map<String, Object> object() {
            Map<String, Object> out = new LinkedHashMap<>();
            i++;
            skip();
            if (s.charAt(i) == '}') { i++; return out; }
            while (true) {
                skip();
                String key = string();
                skip();
                i++; // :
                out.put(key, value());
                skip();
                if (s.charAt(i++) == '}') return out;
            }
        }

        private List<Object> array() {
            List<Object> out = new ArrayList<>();
            i++;
            skip();
            if (s.charAt(i) == ']') { i++; return out; }
            while (true) {
                out.add(value());
                skip();
                if (s.charAt(i++) == ']') return out;
            }
        }

        private String string() {
            StringBuilder out = new StringBuilder();
            i++;
            while (true) {
                char c = s.charAt(i++);
                if (c == '"') return out.toString();
                if (c != '\\') { out.append(c); continue; }
                char e = s.charAt(i++);
                switch (e) {
                    case 'n': out.append('\n'); break;
                    case 't': out.append('\t'); break;
                    case 'r': out.append('\r'); break;
                    case 'b': out.append('\b'); break;
                    case 'f': out.append('\f'); break;
                    case 'u': out.append((char) Integer.parseInt(s.substring(i, i + 4), 16)); i += 4; break;
                    default: out.append(e);
                }
            }
        }

        private Object number() {
            int start = i;
            while (i < s.length() && "+-0123456789.eE".indexOf(s.charAt(i)) >= 0) i++;
            String token = s.substring(start, i);
            if (token.contains(".") || token.contains("e") || token.contains("E")) return Double.parseDouble(token);
            return Long.parseLong(token);
        }
    }

    static String json(Object value) {
        StringBuilder out = new StringBuilder();
        writeJson(value, out);
        return out.toString();
    }

    @SuppressWarnings("unchecked")
    static void writeJson(Object value, StringBuilder out) {
        if (value == null) { out.append("null"); return; }
        if (value instanceof String) { quote((String) value, out); return; }
        if (value instanceof Boolean) { out.append(value.toString()); return; }
        if (value instanceof Double || value instanceof Float) {
            double d = ((Number) value).doubleValue();
            if (Double.isNaN(d)) out.append("\"nan\"");
            else if (Double.isInfinite(d)) out.append(d > 0 ? "\"inf\"" : "\"-inf\"");
            else if (d == Math.rint(d) && Math.abs(d) < 1e15) out.append((long) d).append(".0");
            else out.append(d);
            return;
        }
        if (value instanceof Number) { out.append(((Number) value).longValue()); return; }
        if (value instanceof Map) {
            out.append('{');
            boolean first = true;
            for (Map.Entry<Object, Object> entry : ((Map<Object, Object>) value).entrySet()) {
                if (!first) out.append(',');
                first = false;
                quote(String.valueOf(entry.getKey()), out);
                out.append(':');
                writeJson(entry.getValue(), out);
            }
            out.append('}');
            return;
        }
        if (value instanceof Collection) {
            out.append('[');
            boolean first = true;
            for (Object item : (Collection<Object>) value) {
                if (!first) out.append(',');
                first = false;
                writeJson(item, out);
            }
            out.append(']');
            return;
        }
        quote(value.toString(), out);
    }

    static void quote(String s, StringBuilder out) {
        out.append('"');
        for (int k = 0; k < s.length(); k++) {
            char c = s.charAt(k);
            switch (c) {
                case '"': out.append("\\\""); break;
                case '\\': out.append("\\\\"); break;
                case '\n': out.append("\\n"); break;
                case '\t': out.append("\\t"); break;
                case '\r': out.append("\\r"); break;
                default:
                    if (c < 0x20) out.append(String.format("\\u%04x", (int) c));
                    else out.append(c);
            }
        }
        out.append('"');
    }

    // -------------------------------------------------------------- builders

    static List<?> list(Object json) {
        return json instanceof List ? (List<?>) json : Collections.emptyList();
    }

    static int toInt(Object json) { return json instanceof Number ? ((Number) json).intValue() : 0; }
    static long toLong(Object json) { return json instanceof Number ? ((Number) json).longValue() : 0L; }
    static double toDouble(Object json) { return json instanceof Number ? ((Number) json).doubleValue() : 0.0; }

    static ListNode buildList(Object json, ListNode tail) {
        List<?> values = list(json);
        ListNode head = tail;
        for (int k = values.size() - 1; k >= 0; k--) head = new ListNode(toInt(values.get(k)), head);
        return head;
    }

    static TreeNode buildTree(Object json) {
        List<?> values = list(json);
        if (values.isEmpty() || values.get(0) == null) return null;
        TreeNode root = new TreeNode(toInt(values.get(0)));
        ArrayDeque<TreeNode> queue = new ArrayDeque<>();
        queue.add(root);
        int k = 1;
        while (!queue.isEmpty() && k < values.size()) {
            TreeNode node = queue.poll();
            if (k < values.size() && values.get(k) != null) { node.left = new TreeNode(toInt(values.get(k))); queue.add(node.left); }
            k++;
            if (k < values.size() && values.get(k) != null) { node.right = new TreeNode(toInt(values.get(k))); queue.add(node.right); }
            k++;
        }
        return root;
    }

    static Type elementType(Type generic) {
        if (generic instanceof ParameterizedType) {
            Type[] args = ((ParameterizedType) generic).getActualTypeArguments();
            if (args.length > 0) return args[0];
        }
        return Object.class;
    }

    /** Converts a JSON value into the Java type `target` for a given wire kind. */
    static Object convert(String kind, Object json, Class<?> target, Type generic, ListNode sharedTail) {
        switch (kind) {
            case "linked_list": return buildList(json, null);
            case "y_list": return buildList(json, sharedTail);
            case "cyclic_list": {
                Map<?, ?> spec = json instanceof Map ? (Map<?, ?>) json : Collections.emptyMap();
                List<?> values = list(spec.get("values"));
                int pos = spec.get("pos") == null ? -1 : toInt(spec.get("pos"));
                List<ListNode> nodes = new ArrayList<>();
                for (Object v : values) nodes.add(new ListNode(toInt(v)));
                for (int k = 0; k + 1 < nodes.size(); k++) nodes.get(k).next = nodes.get(k + 1);
                if (!nodes.isEmpty() && pos >= 0 && pos < nodes.size()) nodes.get(nodes.size() - 1).next = nodes.get(pos);
                return nodes.isEmpty() ? null : nodes.get(0);
            }
            case "doubly_linked_list": {
                DListNode head = null, tail = null;
                for (Object v : list(json)) {
                    DListNode node = new DListNode(toInt(v));
                    if (head == null) { head = node; tail = node; }
                    else { tail.next = node; node.prev = tail; tail = node; }
                }
                return head;
            }
            case "random_list": {
                List<?> pairs = list(json);
                List<RandomNode> nodes = new ArrayList<>();
                for (Object pair : pairs) nodes.add(new RandomNode(toInt(list(pair).get(0))));
                for (int k = 0; k < nodes.size(); k++) {
                    if (k + 1 < nodes.size()) nodes.get(k).next = nodes.get(k + 1);
                    List<?> pair = list(pairs.get(k));
                    Object target2 = pair.size() > 1 ? pair.get(1) : null;
                    if (target2 != null) {
                        int index = toInt(target2);
                        if (index >= 0 && index < nodes.size()) nodes.get(k).random = nodes.get(index);
                    }
                }
                return nodes.isEmpty() ? null : nodes.get(0);
            }
            case "child_list": {
                List<ChildNode> heads = new ArrayList<>();
                for (Object column : list(json)) {
                    ChildNode head = null, tail = null;
                    for (Object v : list(column)) {
                        ChildNode node = new ChildNode(toInt(v));
                        if (head == null) { head = node; tail = node; }
                        else { tail.child = node; tail = node; }
                    }
                    if (head != null) heads.add(head);
                }
                for (int k = 0; k + 1 < heads.size(); k++) heads.get(k).next = heads.get(k + 1);
                return heads.isEmpty() ? null : heads.get(0);
            }
            case "tree": return buildTree(json);
            default: return convertPlain(json, target, generic);
        }
    }

    /** Numbers, strings, arrays and lists, driven by the declared Java type. */
    static Object convertPlain(Object json, Class<?> target, Type generic) {
        if (target == int.class || target == Integer.class) return toInt(json);
        if (target == long.class || target == Long.class) return toLong(json);
        if (target == double.class || target == Double.class) return toDouble(json);
        if (target == float.class || target == Float.class) return (float) toDouble(json);
        if (target == boolean.class || target == Boolean.class) return Boolean.TRUE.equals(json);
        if (target == char.class || target == Character.class) {
            String text = json == null ? "" : json.toString();
            return text.isEmpty() ? '\0' : text.charAt(0);
        }
        if (target == String.class) return json == null ? "" : json.toString();
        if (target.isArray()) {
            List<?> values = list(json);
            Class<?> component = target.getComponentType();
            Object array = java.lang.reflect.Array.newInstance(component, values.size());
            for (int k = 0; k < values.size(); k++) {
                java.lang.reflect.Array.set(array, k, convertPlain(values.get(k), component, component));
            }
            return array;
        }
        if (List.class.isAssignableFrom(target) || Collection.class.isAssignableFrom(target) || target == Object.class) {
            if (!(json instanceof List)) return json;
            Type element = elementType(generic);
            Class<?> elementClass = element instanceof Class ? (Class<?>) element
                : element instanceof ParameterizedType ? (Class<?>) ((ParameterizedType) element).getRawType()
                : Object.class;
            List<Object> out = new ArrayList<>();
            for (Object v : (List<?>) json) {
                if (elementClass == Object.class) {
                    out.add(v instanceof Long ? (Object) ((Long) v).intValue() : v);
                } else {
                    out.add(convertPlain(v, elementClass, element));
                }
            }
            return out;
        }
        return json;
    }

    // ----------------------------------------------------------- serialisers

    static List<Object> listValues(ListNode head) {
        List<Object> out = new ArrayList<>();
        Set<ListNode> seen = Collections.newSetFromMap(new IdentityHashMap<>());
        for (ListNode cur = head; cur != null; cur = cur.next) {
            if (!seen.add(cur)) { out.add("<cycle>"); break; }
            if (out.size() >= 500) { out.add("<too long>"); break; }
            out.add((long) cur.val);
        }
        return out;
    }

    static List<Object> dllValues(DListNode head) {
        List<Object> out = new ArrayList<>();
        Set<DListNode> seen = Collections.newSetFromMap(new IdentityHashMap<>());
        DListNode previous = null;
        for (DListNode cur = head; cur != null; previous = cur, cur = cur.next) {
            if (!seen.add(cur)) { out.add("<cycle>"); break; }
            if (cur.prev != previous) { out.add("<prev link broken>"); break; }
            if (out.size() >= 500) { out.add("<too long>"); break; }
            out.add((long) cur.val);
        }
        return out;
    }

    static List<Object> randomValues(RandomNode head) {
        List<RandomNode> nodes = new ArrayList<>();
        Map<RandomNode, Integer> index = new IdentityHashMap<>();
        for (RandomNode cur = head; cur != null && !index.containsKey(cur) && nodes.size() <= 500; cur = cur.next) {
            index.put(cur, nodes.size());
            nodes.add(cur);
        }
        List<Object> out = new ArrayList<>();
        for (RandomNode node : nodes) {
            Object target = node.random == null ? null : index.containsKey(node.random) ? (Object) (long) index.get(node.random) : "<outside list>";
            out.add(Arrays.asList((long) node.val, target));
        }
        return out;
    }

    static List<Object> childValues(ChildNode head) {
        List<Object> out = new ArrayList<>();
        Set<ChildNode> seen = Collections.newSetFromMap(new IdentityHashMap<>());
        for (ChildNode cur = head; cur != null; cur = cur.child) {
            if (!seen.add(cur)) { out.add("<cycle>"); break; }
            if (out.size() >= 500) { out.add("<too long>"); break; }
            out.add((long) cur.val);
        }
        return out;
    }

    static List<Object> treeValues(TreeNode root) {
        List<Object> out = new ArrayList<>();
        if (root == null) return out;
        ArrayDeque<Object> queue = new ArrayDeque<>();
        Set<TreeNode> seen = Collections.newSetFromMap(new IdentityHashMap<>());
        final Object NULL = new Object();
        queue.add(root);
        while (!queue.isEmpty() && out.size() < 2000) {
            Object item = queue.poll();
            if (item == NULL) { out.add(null); continue; }
            TreeNode node = (TreeNode) item;
            if (!seen.add(node)) { out.add("<cycle>"); break; }
            out.add((long) node.val);
            queue.add(node.left == null ? NULL : node.left);
            queue.add(node.right == null ? NULL : node.right);
        }
        while (!out.isEmpty() && out.get(out.size() - 1) == null) out.remove(out.size() - 1);
        return out;
    }

    /** Anything a user might return, as JSON-able Java values. */
    static Object plain(Object value) {
        if (value == null || value instanceof String || value instanceof Boolean) return value;
        if (value instanceof Character) return value.toString();
        if (value instanceof Double || value instanceof Float) return ((Number) value).doubleValue();
        if (value instanceof Number) return ((Number) value).longValue();
        if (value instanceof CharSequence) return value.toString();
        if (value instanceof ListNode) return listValues((ListNode) value);
        if (value instanceof DListNode) return dllValues((DListNode) value);
        if (value instanceof RandomNode) return randomValues((RandomNode) value);
        if (value instanceof ChildNode) return childValues((ChildNode) value);
        if (value instanceof TreeNode) return treeValues((TreeNode) value);
        if (value.getClass().isArray()) {
            int length = java.lang.reflect.Array.getLength(value);
            List<Object> out = new ArrayList<>();
            for (int k = 0; k < length; k++) out.add(plain(java.lang.reflect.Array.get(value, k)));
            return out;
        }
        if (value instanceof Collection) {
            List<Object> out = new ArrayList<>();
            for (Object item : (Collection<?>) value) out.add(plain(item));
            return out;
        }
        if (value instanceof Map) {
            Map<String, Object> out = new LinkedHashMap<>();
            for (Map.Entry<?, ?> entry : ((Map<?, ?>) value).entrySet()) out.put(String.valueOf(entry.getKey()), plain(entry.getValue()));
            return out;
        }
        return value.toString();
    }

    static Object output(String kind, Object value) {
        switch (kind) {
            case "void": return null;
            case "list_node_value":
            case "tree_node_value":
                if (value == null) return -1L;
                if (value instanceof ListNode) return (long) ((ListNode) value).val;
                if (value instanceof TreeNode) return (long) ((TreeNode) value).val;
                return plain(value);
            case "double":
                return value instanceof Number ? ((Number) value).doubleValue() : plain(value);
            case "linked_list":
            case "cyclic_list":
            case "y_list":
            case "doubly_linked_list":
            case "random_list":
            case "child_list":
            case "tree":
                // An empty structure is `null` in Java but `[]` on the wire.
                return value == null ? new ArrayList<>() : plain(value);
            default:
                return plain(value);
        }
    }

    // -------------------------------------------------------------- invoking

    static String camel(String snake) {
        StringBuilder out = new StringBuilder();
        boolean upper = false;
        for (char c : snake.toCharArray()) {
            if (c == '_') { upper = true; continue; }
            out.append(upper ? Character.toUpperCase(c) : c);
            upper = false;
        }
        return out.toString();
    }

    static Class<?> userClass(String name) {
        try {
            return Class.forName(name);
        } catch (ClassNotFoundException e) {
            throw new SetupError("Expected a class named " + name + ".");
        }
    }

    static Method findMethod(Class<?> cls, String name, int arity) {
        for (Class<?> c = cls; c != null && c != Object.class; c = c.getSuperclass()) {
            for (Method m : c.getDeclaredMethods()) {
                if (m.getName().equals(name) && m.getParameterCount() == arity && !m.isSynthetic()) {
                    m.setAccessible(true);
                    return m;
                }
            }
        }
        throw new SetupError("Expected a method " + name + " with " + arity + " parameter" + (arity == 1 ? "" : "s") + " in " + cls.getSimpleName() + ".");
    }

    static Object instantiate(Class<?> cls) throws Exception {
        Constructor<?> ctor;
        try {
            ctor = cls.getDeclaredConstructor();
        } catch (NoSuchMethodException e) {
            throw new SetupError(cls.getSimpleName() + " needs a constructor with no parameters.");
        }
        ctor.setAccessible(true);
        return ctor.newInstance();
    }

    @SuppressWarnings("unchecked")
    static Object[] arguments(List<Map<String, Object>> params, List<?> values, Class<?>[] types, Type[] generics, ListNode shared) {
        Object[] args = new Object[params.size()];
        for (int k = 0; k < params.size(); k++) {
            Object json = k < values.size() ? values.get(k) : null;
            args[k] = convert((String) params.get(k).get("kind"), json, types[k], generics[k], shared);
        }
        return args;
    }

    @SuppressWarnings("unchecked")
    static Object invoke(Map<String, Object> spec, Map<String, Object> input) throws Throwable {
        String sharedKey = (String) spec.get("sharedTail");
        ListNode shared = sharedKey == null ? null : buildList(input.get(sharedKey), null);
        Map<String, Object> design = (Map<String, Object>) spec.get("design");

        if (design != null) {
            String className = (String) design.get("className");
            Class<?> cls = userClass(className);
            Map<String, Map<String, Object>> methods = new HashMap<>();
            for (Object m : (List<Object>) design.get("methods")) {
                Map<String, Object> method = (Map<String, Object>) m;
                methods.put((String) method.get("name"), method);
            }
            List<?> operations = list(input.get("operations"));
            List<?> argumentLists = list(input.get("arguments"));
            List<Object> out = new ArrayList<>();
            Object instance = null;
            for (int k = 0; k < operations.size(); k++) {
                String op = (String) operations.get(k);
                List<?> values = k < argumentLists.size() ? list(argumentLists.get(k)) : Collections.emptyList();
                if (op.equals(className)) {
                    List<Map<String, Object>> params = (List<Map<String, Object>>) (List<?>) design.get("constructorParameters");
                    Constructor<?> ctor = null;
                    for (Constructor<?> candidate : cls.getDeclaredConstructors()) {
                        if (candidate.getParameterCount() == params.size()) ctor = candidate;
                    }
                    if (ctor == null) throw new SetupError(className + " needs a constructor with " + params.size() + " parameter(s).");
                    ctor.setAccessible(true);
                    Object[] args = arguments(params, values, ctor.getParameterTypes(), ctor.getGenericParameterTypes(), shared);
                    enter();
                    instance = callConstructor(ctor, args);
                    out.add(null);
                    continue;
                }
                Map<String, Object> method = methods.get(op);
                if (method == null || instance == null) throw new SetupError("Unknown operation " + op + ".");
                List<Map<String, Object>> params = (List<Map<String, Object>>) (List<?>) method.get("parameters");
                Method m = findMethod(cls, op, params.size());
                Object[] args = arguments(params, values, m.getParameterTypes(), m.getGenericParameterTypes(), shared);
                enter();
                Object result = call(m, instance, args);
                out.add(output((String) method.get("returnKind"), result));
            }
            return out;
        }

        Class<?> cls = userClass("Solution");
        List<Map<String, Object>> params = (List<Map<String, Object>>) (List<?>) spec.get("parameters");
        Method m = findMethod(cls, camel((String) spec.get("entrypoint")), params.size());
        Object target = Modifier.isStatic(m.getModifiers()) ? null : instantiate(cls);
        List<Object> values = new ArrayList<>();
        for (Map<String, Object> p : params) values.add(input.get((String) p.get("name")));
        Object[] args = arguments(params, values, m.getParameterTypes(), m.getGenericParameterTypes(), shared);
        enter();
        Object result = call(m, target, args);
        return output((String) spec.get("returnKind"), result);
    }

    static Object call(Method m, Object target, Object[] args) throws Throwable {
        try {
            return m.invoke(target, args);
        } catch (InvocationTargetException e) {
            throw e.getCause();
        }
    }

    static Object callConstructor(Constructor<?> ctor, Object[] args) throws Throwable {
        try {
            return ctor.newInstance(args);
        } catch (InvocationTargetException e) {
            throw e.getCause();
        }
    }

    // ------------------------------------------------------------ case loop

    static Integer userLine(Throwable error) {
        for (StackTraceElement element : error.getStackTrace()) {
            if ("Solution.java".equals(element.getFileName())) return element.getLineNumber();
        }
        return null;
    }

    static String userTrace(Throwable error) {
        StringBuilder out = new StringBuilder(error.toString());
        for (StackTraceElement element : error.getStackTrace()) {
            if ("Solution.java".equals(element.getFileName())) {
                out.append("\n    at ").append(element.getClassName()).append('.').append(element.getMethodName())
                    .append(" (line ").append(element.getLineNumber()).append(')');
            }
        }
        return out.toString();
    }

    static Map<String, Object> failure(String type, String message, long startedNs, String stdout) {
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("ok", false);
        out.put("errorType", type);
        out.put("message", message);
        out.put("runtimeMs", (System.nanoTime() - startedNs) / 1_000_000);
        if (stdout != null) out.put("stdout", stdout);
        return out;
    }

    @SuppressWarnings("unchecked")
    static Map<String, Object> runCase(Map<String, Object> spec, Map<String, Object> input, long timeoutMs, PrintStream realOut) {
        ByteArrayOutputStream buffer = new ByteArrayOutputStream();
        PrintStream capture = new PrintStream(buffer, true, StandardCharsets.UTF_8);
        final Object[] box = new Object[2];
        Thread worker = new Thread(null, () -> {
            try {
                box[0] = invoke(spec, input);
            } catch (Throwable error) {
                box[1] = error;
            }
        }, "nf-case", 512L << 20);
        worker.setDaemon(true);
        long started = System.nanoTime();
        System.setOut(capture);
        worker.start();
        try {
            worker.join(timeoutMs);
        } catch (InterruptedException ignored) {
            // treated as a timeout below
        }
        System.setOut(realOut);
        capture.flush();
        String stdout = buffer.toString(StandardCharsets.UTF_8);
        if (stdout.length() > MAX_STDOUT) stdout = stdout.substring(0, MAX_STDOUT);

        if (worker.isAlive()) {
            Map<String, Object> out = failure("Time Limit Exceeded", "Your code ran longer than the time limit.", started, stdout);
            out.put("timedOut", true);
            return out;
        }
        if (box[1] != null) {
            Throwable error = (Throwable) box[1];
            Map<String, Object> out;
            if (error instanceof SetupError) {
                out = failure("Runtime Error", error.getMessage(), started, stdout);
            } else if (error instanceof StackOverflowError) {
                out = failure("Runtime Error", "StackOverflowError: recursion went too deep. Check your base case.", started, stdout);
            } else if (error instanceof OutOfMemoryError) {
                out = failure("Runtime Error", "OutOfMemoryError: your code used more memory than allowed.", started, stdout);
            } else {
                String message = error.getMessage();
                out = failure("Runtime Error", error.getClass().getSimpleName() + (message == null ? "" : ": " + message), started, stdout);
            }
            Integer line = userLine(error);
            if (line != null) out.put("line", (long) line);
            out.put("traceback", userTrace(error));
            return out;
        }
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("ok", true);
        out.put("result", box[0]);
        out.put("stdout", stdout);
        out.put("runtimeMs", (System.nanoTime() - started) / 1_000_000);
        return out;
    }

    @SuppressWarnings("unchecked")
    public static void main(String[] args) throws IOException {
        String mode = args[0];
        Map<String, Object> spec = (Map<String, Object>) parseJson(new String(Files.readAllBytes(Paths.get(args[1])), StandardCharsets.UTF_8));
        List<Object> cases = (List<Object>) spec.get("cases");
        long timeoutMs = spec.get("caseTimeoutMs") instanceof Number ? ((Number) spec.get("caseTimeoutMs")).longValue() : 4000;
        int count = mode.equals("trace") ? Math.min(1, cases.size()) : cases.size();
        PrintStream realOut = System.out;

        try (Writer writer = Files.newBufferedWriter(Paths.get(args[2]), StandardCharsets.UTF_8)) {
            for (int k = 0; k < count; k++) {
                Map<String, Object> result = runCase(spec, (Map<String, Object>) cases.get(k), timeoutMs, realOut);
                writer.write(json(result));
                writer.write('\n');
                writer.flush();
                if (Boolean.TRUE.equals(result.get("timedOut"))) break;
            }
        }
        realOut.flush();
        // halt, not exit: a timed-out case thread may still be spinning.
        Runtime.getRuntime().halt(0);
    }
}
