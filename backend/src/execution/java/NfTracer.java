import com.sun.jdi.*;
import com.sun.jdi.connect.Connector;
import com.sun.jdi.connect.LaunchingConnector;
import com.sun.jdi.event.*;
import com.sun.jdi.request.*;

import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Paths;
import java.util.*;

/*
 * Records a line-by-line trace of the user's Java code with the Java Debug
 * Interface. Launches `NfHarness trace ...` in a debuggee JVM, waits for
 * NfHarness.enter(), then single-steps the case thread. JDK, harness and node
 * classes are excluded from stepping, so every step event lands on a line of
 * Solution.java. Output matches the Python tracer's step shape.
 *
 *   java NfTracer <classpath> <spec.json> <trace-out.json> <stepLimit> <visLimit> <budgetMs>
 */
public class NfTracer {
    static final int MAX_OBJECTS = 160;
    static final int MAX_STRING = 240;
    static int visLimit = 64;

    static final Map<Long, String> ids = new HashMap<>();
    static Map<String, Object> heap = new LinkedHashMap<>();
    static Set<String> active = new HashSet<>();

    static String ref(ObjectReference object) {
        return ids.computeIfAbsent(object.uniqueID(), key -> "obj_" + (ids.size() + 1));
    }

    static boolean isUser(Location location) {
        try {
            return "Solution.java".equals(location.sourceName());
        } catch (AbsentInformationException e) {
            return false;
        }
    }

    // ------------------------------------------------------------ values

    static Object value(Value v) {
        try {
            return valueOf(v);
        } catch (RuntimeException e) {
            return "<unreadable>";
        }
    }

    static Object number(double d) {
        if (Double.isNaN(d)) return "nan";
        if (Double.isInfinite(d)) return d > 0 ? "inf" : "-inf";
        return d;
    }

    static Object valueOf(Value v) {
        if (v == null) return null;
        if (v instanceof BooleanValue) return ((BooleanValue) v).value();
        if (v instanceof CharValue) return String.valueOf(((CharValue) v).value());
        if (v instanceof ByteValue || v instanceof ShortValue || v instanceof IntegerValue || v instanceof LongValue) {
            return ((PrimitiveValue) v).longValue();
        }
        if (v instanceof FloatValue || v instanceof DoubleValue) return number(((PrimitiveValue) v).doubleValue());
        if (v instanceof StringReference) {
            String text = ((StringReference) v).value();
            return text.length() > MAX_STRING ? text.substring(0, MAX_STRING) + "…" : text;
        }
        if (v instanceof ArrayReference) {
            ArrayReference array = (ArrayReference) v;
            int length = array.length();
            int shown = Math.min(length, visLimit);
            return container(array, "list", shown == 0 ? Collections.emptyList() : array.getValues(0, shown), length - shown);
        }
        if (v instanceof ObjectReference) return object((ObjectReference) v);
        return v.toString();
    }

    static Value field(ObjectReference object, String name) {
        Field f = object.referenceType().fieldByName(name);
        return f == null ? null : object.getValue(f);
    }

    static int intField(ObjectReference object, String name) {
        Value v = field(object, name);
        return v instanceof PrimitiveValue ? ((PrimitiveValue) v).intValue() : 0;
    }

    static String container(ObjectReference owner, String kind, List<? extends Value> items, int truncated) {
        String id = ref(owner);
        if (heap.containsKey(id) || active.contains(id) || heap.size() >= MAX_OBJECTS) return id;
        active.add(id);
        List<Object> out = new ArrayList<>();
        for (Value item : items) out.add(value(item));
        Map<String, Object> entry = new LinkedHashMap<>();
        entry.put("type", kind);
        entry.put("items", out);
        entry.put("truncated", Math.max(0, truncated));
        heap.put(id, entry);
        active.remove(id);
        return id;
    }

    static String mapping(ObjectReference owner, List<Value[]> pairs, int truncated) {
        String id = ref(owner);
        if (heap.containsKey(id) || active.contains(id) || heap.size() >= MAX_OBJECTS) return id;
        active.add(id);
        Map<String, Object> fields = new LinkedHashMap<>();
        for (Value[] pair : pairs) fields.put(String.valueOf(value(pair[0])), value(pair[1]));
        Map<String, Object> entry = new LinkedHashMap<>();
        entry.put("type", "dict");
        entry.put("fields", fields);
        entry.put("truncated", Math.max(0, truncated));
        heap.put(id, entry);
        active.remove(id);
        return id;
    }

    static List<Value> arrayPrefix(Value array, int count) {
        if (!(array instanceof ArrayReference)) return Collections.emptyList();
        ArrayReference a = (ArrayReference) array;
        int n = Math.min(Math.min(count, a.length()), visLimit);
        return n <= 0 ? Collections.emptyList() : a.getValues(0, n);
    }

    static List<Value> hashMapKeysOrPairs(ObjectReference map, List<Value[]> pairs) {
        List<Value> keys = new ArrayList<>();
        Value tableValue = field(map, "table");
        if (tableValue instanceof ArrayReference) {
            ArrayReference table = (ArrayReference) tableValue;
            outer:
            for (Value bucket : table.getValues()) {
                ObjectReference node = (ObjectReference) bucket;
                int guard = 0;
                while (node != null && guard++ < 64) {
                    if (keys.size() >= visLimit) break outer;
                    Value key = field(node, "key");
                    keys.add(key);
                    if (pairs != null) pairs.add(new Value[] {key, field(node, "value")});
                    node = (ObjectReference) field(node, "next");
                }
            }
        }
        return keys;
    }

    static List<Value[]> linkedHashPairs(ObjectReference map) {
        List<Value[]> pairs = new ArrayList<>();
        ObjectReference node = (ObjectReference) field(map, "head");
        while (node != null && pairs.size() < visLimit) {
            pairs.add(new Value[] {field(node, "key"), field(node, "value")});
            node = (ObjectReference) field(node, "after");
        }
        return pairs;
    }

    static void treeMapInOrder(ObjectReference node, List<Value[]> pairs) {
        if (node == null || pairs.size() >= visLimit) return;
        treeMapInOrder((ObjectReference) field(node, "left"), pairs);
        if (pairs.size() < visLimit) pairs.add(new Value[] {field(node, "key"), field(node, "value")});
        treeMapInOrder((ObjectReference) field(node, "right"), pairs);
    }

    static Object object(ObjectReference object) {
        String type = object.referenceType().name();
        switch (type) {
            case "java.lang.Integer":
            case "java.lang.Long":
            case "java.lang.Short":
            case "java.lang.Byte":
            case "java.lang.Double":
            case "java.lang.Float":
            case "java.lang.Boolean":
            case "java.lang.Character":
                return value(field(object, "value"));
            case "java.lang.StringBuilder":
            case "java.lang.StringBuffer": {
                Value bytes = field(object, "value");
                int count = intField(object, "count");
                int coder = intField(object, "coder");
                if (!(bytes instanceof ArrayReference)) return "";
                List<Value> raw = ((ArrayReference) bytes).getValues(0, Math.min(((ArrayReference) bytes).length(), coder == 0 ? count : count * 2));
                byte[] data = new byte[raw.size()];
                for (int k = 0; k < raw.size(); k++) data[k] = ((ByteValue) raw.get(k)).value();
                String text = new String(data, coder == 0 ? StandardCharsets.ISO_8859_1 : StandardCharsets.UTF_16LE);
                return text.length() > MAX_STRING ? text.substring(0, MAX_STRING) + "…" : text;
            }
            case "java.util.ArrayList":
            case "java.util.Vector": {
                int size = intField(object, type.endsWith("ArrayList") ? "size" : "elementCount");
                return container(object, "list", arrayPrefix(field(object, "elementData"), size), size - visLimit);
            }
            case "java.util.Stack": {
                int size = intField(object, "elementCount");
                return container(object, "stack", arrayPrefix(field(object, "elementData"), size), size - visLimit);
            }
            case "java.util.PriorityQueue": {
                int size = intField(object, "size");
                return container(object, "heap", arrayPrefix(field(object, "queue"), size), size - visLimit);
            }
            case "java.util.ArrayDeque": {
                Value elements = field(object, "elements");
                int head = intField(object, "head");
                int tail = intField(object, "tail");
                List<Value> items = new ArrayList<>();
                if (elements instanceof ArrayReference) {
                    ArrayReference array = (ArrayReference) elements;
                    int capacity = array.length();
                    int k = head;
                    while (k != tail && items.size() < visLimit && capacity > 0) {
                        items.add(array.getValue(k));
                        k = (k + 1) % capacity;
                    }
                }
                return container(object, "deque", items, 0);
            }
            case "java.util.LinkedList": {
                List<Value> items = new ArrayList<>();
                ObjectReference node = (ObjectReference) field(object, "first");
                while (node != null && items.size() < visLimit) {
                    items.add(field(node, "item"));
                    node = (ObjectReference) field(node, "next");
                }
                return container(object, "list", items, intField(object, "size") - items.size());
            }
            case "java.util.HashMap": {
                List<Value[]> pairs = new ArrayList<>();
                hashMapKeysOrPairs(object, pairs);
                return mapping(object, pairs, intField(object, "size") - pairs.size());
            }
            case "java.util.LinkedHashMap": {
                List<Value[]> pairs = linkedHashPairs(object);
                return mapping(object, pairs, intField(object, "size") - pairs.size());
            }
            case "java.util.TreeMap": {
                List<Value[]> pairs = new ArrayList<>();
                treeMapInOrder((ObjectReference) field(object, "root"), pairs);
                return mapping(object, pairs, intField(object, "size") - pairs.size());
            }
            case "java.util.HashSet":
            case "java.util.LinkedHashSet": {
                ObjectReference map = (ObjectReference) field(object, "map");
                List<Value> keys = new ArrayList<>();
                if (map != null) {
                    if (map.referenceType().name().equals("java.util.LinkedHashMap")) {
                        for (Value[] pair : linkedHashPairs(map)) keys.add(pair[0]);
                    } else {
                        keys = hashMapKeysOrPairs(map, null);
                    }
                }
                return container(object, "set", keys, (map == null ? 0 : intField(map, "size")) - keys.size());
            }
            case "java.util.TreeSet": {
                ObjectReference map = (ObjectReference) field(object, "m");
                List<Value[]> pairs = new ArrayList<>();
                if (map != null) treeMapInOrder((ObjectReference) field(map, "root"), pairs);
                List<Value> keys = new ArrayList<>();
                for (Value[] pair : pairs) keys.add(pair[0]);
                return container(object, "set", keys, 0);
            }
            case "java.util.Arrays$ArrayList": {
                Value array = field(object, "a");
                return container(object, "list", arrayPrefix(array, Integer.MAX_VALUE), 0);
            }
            default:
                break;
        }
        if (type.startsWith("java.util.ImmutableCollections$List")) {
            Value elements = field(object, "elements");
            if (elements != null) return container(object, "list", arrayPrefix(elements, Integer.MAX_VALUE), 0);
            List<Value> items = new ArrayList<>();
            Value e0 = field(object, "e0");
            Value e1 = field(object, "e1");
            if (e0 != null) items.add(e0);
            if (e1 != null && !(e1 instanceof ObjectReference && ((ObjectReference) e1).referenceType().name().equals("java.lang.Object"))) items.add(e1);
            return container(object, "list", items, 0);
        }
        if (type.startsWith("java.") || type.startsWith("jdk.") || type.startsWith("sun.")) {
            return "<" + type.substring(type.lastIndexOf('.') + 1) + ">";
        }
        return struct(object, type);
    }

    static String struct(ObjectReference object, String type) {
        String id = ref(object);
        if (heap.containsKey(id) || active.contains(id) || heap.size() >= MAX_OBJECTS) return id;
        active.add(id);
        Map<String, Object> fields = new LinkedHashMap<>();
        List<Field> instanceFields = new ArrayList<>();
        for (Field f : object.referenceType().allFields()) {
            if (!f.isStatic() && !f.isSynthetic()) instanceFields.add(f);
        }
        Map<Field, Value> values = object.getValues(instanceFields);
        for (Field f : instanceFields) fields.put(f.name(), value(values.get(f)));
        Map<String, Object> entry = new LinkedHashMap<>();
        String simple = type.substring(type.lastIndexOf('.') + 1);
        entry.put("type", simple.contains("$") ? simple.substring(simple.lastIndexOf('$') + 1) : simple);
        entry.put("fields", fields);
        heap.put(id, entry);
        active.remove(id);
        return id;
    }

    // ------------------------------------------------------------ frames

    static Map<String, Object> frameVariables(StackFrame frame) {
        Map<String, Object> out = new LinkedHashMap<>();
        ObjectReference self = frame.thisObject();
        if (self != null) {
            boolean hasFields = false;
            for (Field f : self.referenceType().allFields()) {
                if (!f.isStatic() && !f.isSynthetic()) { hasFields = true; break; }
            }
            if (hasFields) out.put("this", value(self));
        }
        try {
            List<LocalVariable> variables = frame.visibleVariables();
            Map<LocalVariable, Value> values = frame.getValues(variables);
            for (LocalVariable variable : variables) {
                if (variable.name().startsWith("nf")) continue;
                out.put(variable.name(), value(values.get(variable)));
            }
        } catch (AbsentInformationException ignored) {
            // compiled without -g; nothing to show
        }
        return out;
    }

    static Map<String, Object> capture(ThreadReference thread, String event) throws IncompatibleThreadStateException {
        heap = new LinkedHashMap<>();
        active = new HashSet<>();
        List<StackFrame> userFrames = new ArrayList<>();
        for (StackFrame frame : thread.frames()) {
            if (isUser(frame.location())) userFrames.add(frame);
            else break;
        }
        Map<String, Object> step = new LinkedHashMap<>();
        if (userFrames.isEmpty()) return null;
        StackFrame top = userFrames.get(0);
        Map<String, Object> variables = frameVariables(top);
        step.put("line", (long) top.location().lineNumber());
        step.put("event", event);
        step.put("variables", variables);
        if (userFrames.size() > 1) {
            List<Object> stack = new ArrayList<>();
            for (int k = userFrames.size() - 1; k >= 0; k--) {
                StackFrame frame = userFrames.get(k);
                Map<String, Object> entry = new LinkedHashMap<>();
                entry.put("function", frame.location().method().name());
                entry.put("line", (long) frame.location().lineNumber());
                entry.put("variables", k == 0 ? variables : frameVariables(frame));
                stack.add(entry);
            }
            step.put("stack", stack);
        }
        step.put("heap", heap);
        return step;
    }

    // ------------------------------------------------------------ driver

    static void drain(InputStream stream) {
        Thread t = new Thread(() -> {
            byte[] buffer = new byte[8192];
            try {
                while (stream.read(buffer) >= 0) {
                    // discarded: the traced run's output is not shown
                }
            } catch (Exception ignored) {
                // stream closed
            }
        });
        t.setDaemon(true);
        t.start();
    }

    public static void main(String[] args) throws Exception {
        String classpath = args[0];
        String specPath = args[1];
        String outPath = args[2];
        int stepLimit = Integer.parseInt(args[3]);
        visLimit = Integer.parseInt(args[4]);
        long budgetMs = Long.parseLong(args[5]);
        long deadline = System.currentTimeMillis() + budgetMs;

        List<Object> steps = new ArrayList<>();
        boolean truncated = false;
        String note = null;
        VirtualMachine vm = null;

        try {
            LaunchingConnector connector = Bootstrap.virtualMachineManager().defaultConnector();
            Map<String, Connector.Argument> arguments = connector.defaultArguments();
            arguments.get("main").setValue("NfHarness trace " + specPath + " /tmp/work/trace_results.jsonl");
            arguments.get("options").setValue("-cp " + classpath + " -Xmx256m -XX:+UseSerialGC -XX:TieredStopAtLevel=1 -Xshare:auto");
            arguments.get("suspend").setValue("true");
            vm = connector.launch(arguments);
            drain(vm.process().getInputStream());
            drain(vm.process().getErrorStream());

            EventRequestManager requests = vm.eventRequestManager();
            ClassPrepareRequest prepare = requests.createClassPrepareRequest();
            prepare.addClassFilter("NfHarness");
            prepare.enable();

            StepRequest stepper = null;
            EventQueue queue = vm.eventQueue();
            boolean done = false;
            vm.resume();

            while (!done) {
                long remaining = deadline - System.currentTimeMillis();
                if (remaining <= 0) {
                    truncated = true;
                    note = "Tracing stopped at the time budget; the replay shows the steps recorded so far.";
                    break;
                }
                EventSet events = queue.remove(Math.min(remaining, 2000));
                if (events == null) {
                    // Nothing for 2s: most likely one line spinning in an infinite loop.
                    if (stepper != null) {
                        truncated = true;
                        note = "Tracing stopped: one line kept running without finishing, which usually means an infinite loop.";
                        break;
                    }
                    continue;
                }
                for (Event event : events) {
                    if (event instanceof ClassPrepareEvent) {
                        ReferenceType harness = ((ClassPrepareEvent) event).referenceType();
                        for (Method method : harness.methodsByName("enter")) {
                            BreakpointRequest breakpoint = requests.createBreakpointRequest(method.location());
                            breakpoint.setSuspendPolicy(EventRequest.SUSPEND_EVENT_THREAD);
                            breakpoint.enable();
                        }
                    } else if (event instanceof BreakpointEvent) {
                        if (stepper == null) {
                            stepper = requests.createStepRequest(((BreakpointEvent) event).thread(), StepRequest.STEP_LINE, StepRequest.STEP_INTO);
                            for (String pattern : new String[] {"java.*", "javax.*", "jdk.*", "sun.*", "com.sun.*", "NfHarness*",
                                    "ListNode", "DListNode", "RandomNode", "ChildNode", "TreeNode"}) {
                                stepper.addClassExclusionFilter(pattern);
                            }
                            stepper.setSuspendPolicy(EventRequest.SUSPEND_EVENT_THREAD);
                            stepper.enable();
                        }
                    } else if (event instanceof StepEvent) {
                        StepEvent step = (StepEvent) event;
                        if (isUser(step.location())) {
                            if (steps.size() >= stepLimit) {
                                truncated = true;
                                done = true;
                                break;
                            }
                            Map<String, Object> captured = capture(step.thread(), "line");
                            if (captured != null) steps.add(captured);
                        }
                    } else if (event instanceof VMDeathEvent || event instanceof VMDisconnectEvent) {
                        done = true;
                    }
                }
                if (!done) events.resume();
            }
        } catch (VMDisconnectedException ignored) {
            // the program finished
        } catch (Exception error) {
            note = "The Java tracer failed: " + error;
        } finally {
            if (vm != null) {
                try {
                    vm.exit(0);
                } catch (Exception ignored) {
                    // already gone
                }
                try {
                    vm.process().destroyForcibly();
                } catch (Exception ignored) {
                    // already gone
                }
            }
        }

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("steps", steps);
        out.put("truncated", truncated);
        out.put("note", note);
        Files.write(Paths.get(outPath), NfHarness.json(out).getBytes(StandardCharsets.UTF_8));
        Runtime.getRuntime().halt(0);
    }
}
