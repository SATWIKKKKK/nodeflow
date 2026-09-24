from dsl import design, method, ops, problem
from graphgen import adjacency, random_edges, random_grid, unique_shortest_paths

WEIGHTED = random_edges(60, 150, seed=61, weights=(1, 50), connected=True)
SPARSE_WEIGHTED = random_edges(80, 60, seed=62, weights=(1, 20))


def unique_path_graph(n, m, seed):
    """A connected weighted graph (1-indexed) whose shortest path tree from node 1 is unique."""
    while True:
        edges = random_edges(n, m, seed, weights=(1, 10**6), connected=True)
        if unique_shortest_paths(n, edges, 0):
            return [[u + 1, v + 1, w] for u, v, w in edges]
        seed += 1


# ---------------------------------------------------------------- shortest paths

problem(
    id="dijkstra",
    source="Dijkstra's algorithm",
    title="Dijkstra's Algorithm",
    topic="Graph",
    difficulty="Medium",
    structure="graph",
    description="""The undirected graph has n nodes and edges [u, v, w] with non-negative weights. Return the shortest
    distance from src to every node, using -1 for nodes that cannot be reached. Pop the closest unsettled node from a
    min-heap and relax its edges.""",
    constraints=["1 <= n <= 10^4", "0 <= w <= 10^4"],
    fn="dijkstra",
    params=[("n", "int"), ("edges", "matrix"), ("src", "int")],
    ret="array",
    ref="""
import heapq


def dijkstra(n, edges, src):
    adj = [[] for _ in range(n)]
    for u, v, w in edges:
        adj[u].append((v, w))
        adj[v].append((u, w))
    dist = [-1] * n
    dist[src] = 0
    heap = [(0, src)]
    while heap:
        d, node = heapq.heappop(heap)
        if d > dist[node]:
            continue
        for nxt, w in adj[node]:
            if dist[nxt] == -1 or d + w < dist[nxt]:
                dist[nxt] = d + w
                heapq.heappush(heap, (d + w, nxt))
    return dist
""",
    examples=[
        ({"n": 2, "edges": [[0, 1, 9]], "src": 0}, [0, 9]),
        ({"n": 3, "edges": [[0, 1, 1], [0, 2, 6], [1, 2, 3]], "src": 2}, [4, 3, 0]),
    ],
    tests=[{"n": 1, "edges": [], "src": 0}, {"n": 60, "edges": WEIGHTED, "src": 13}, {"n": 80, "edges": SPARSE_WEIGHTED, "src": 0}, {"n": 3, "edges": [[0, 1, 0], [1, 2, 0]], "src": 0}],
)

problem(
    id="print-shortest-path",
    source="Print Shortest Path",
    title="Print the Shortest Path",
    topic="Graph",
    difficulty="Medium",
    structure="graph",
    description="""Nodes are numbered 1 to n and edges [u, v, w] are undirected with positive weights. Return
    [total weight, 1, ..., n]: the length of the shortest path from node 1 to node n followed by the nodes on it. If
    node n cannot be reached, return [-1]. The shortest path is unique in every test. Track each node's parent while
    running Dijkstra.""",
    constraints=["2 <= n <= 10^5", "1 <= w <= 10^6"],
    fn="shortest_path",
    params=[("n", "int"), ("edges", "matrix")],
    ret="long_array",
    ref="""
import heapq


def shortest_path(n, edges):
    adj = [[] for _ in range(n + 1)]
    for u, v, w in edges:
        adj[u].append((v, w))
        adj[v].append((u, w))
    dist = [None] * (n + 1)
    parent = list(range(n + 1))
    dist[1] = 0
    heap = [(0, 1)]
    while heap:
        d, node = heapq.heappop(heap)
        if d > dist[node]:
            continue
        for nxt, w in adj[node]:
            if dist[nxt] is None or d + w < dist[nxt]:
                dist[nxt] = d + w
                parent[nxt] = node
                heapq.heappush(heap, (d + w, nxt))
    if dist[n] is None:
        return [-1]
    path = [n]
    while path[-1] != 1:
        path.append(parent[path[-1]])
    return [dist[n]] + path[::-1]
""",
    examples=[
        ({"n": 5, "edges": [[1, 2, 2], [2, 5, 5], [2, 3, 4], [1, 4, 1], [4, 3, 3], [3, 5, 1]]}, [5, 1, 4, 3, 5]),
        ({"n": 4, "edges": [[1, 2, 2], [2, 3, 1]]}, [-1]),
    ],
    tests=[{"n": 2, "edges": [[1, 2, 7]]}, {"n": 60, "edges": unique_path_graph(60, 150, seed=63)}, {"n": 200, "edges": unique_path_graph(200, 400, seed=64)}],
)

problem(
    id="shortest-distance-binary-maze",
    source="Shortest Distance in a Binary Maze",
    title="Shortest Path in a Binary Maze",
    topic="Graph",
    difficulty="Medium",
    structure="matrix",
    description="""grid holds 1 for open cells and 0 for walls. Moving up, down, left or right between open cells costs 1.
    Return the fewest moves from source to destination (both [row, col]), or -1 if it is impossible.""",
    constraints=["1 <= rows, cols <= 500", "source and destination are open cells."],
    fn="shortest_maze_path",
    params=[("grid", "matrix"), ("source", "array"), ("destination", "array")],
    ret="int",
    ref="""
from collections import deque


def shortest_maze_path(grid, source, destination):
    rows, cols = len(grid), len(grid[0])
    start, goal = tuple(source), tuple(destination)
    dist = {start: 0}
    queue = deque([start])
    while queue:
        cell = queue.popleft()
        if cell == goal:
            return dist[cell]
        r, c = cell
        for nr, nc in ((r - 1, c), (r + 1, c), (r, c - 1), (r, c + 1)):
            if 0 <= nr < rows and 0 <= nc < cols and grid[nr][nc] == 1 and (nr, nc) not in dist:
                dist[(nr, nc)] = dist[cell] + 1
                queue.append((nr, nc))
    return -1
""",
    examples=[
        ({"grid": [[1, 1, 1, 1], [1, 1, 0, 1], [1, 1, 1, 1], [1, 1, 0, 0], [1, 0, 0, 1]], "source": [0, 1], "destination": [2, 2]}, 3),
        ({"grid": [[1, 1, 1, 1, 1], [1, 1, 1, 1, 1], [1, 1, 1, 1, 0], [1, 0, 1, 0, 1]], "source": [0, 0], "destination": [3, 4]}, -1),
    ],
    tests=[
        {"grid": [[1]], "source": [0, 0], "destination": [0, 0]},
        {"grid": [[1] * 40 for _ in range(40)], "source": [0, 0], "destination": [39, 39]},
        {"grid": [[1] + row[1:-1] + [1] for row in random_grid(40, 40, seed=65, weights=[1, 3])], "source": [0, 0], "destination": [39, 39]},
    ],
)

problem(
    id="path-minimum-effort",
    source="Path with minimum effort",
    title="Path with Minimum Effort",
    topic="Graph",
    difficulty="Medium",
    structure="matrix",
    description="""heights is a grid. A route from the top-left to the bottom-right cell moves up, down, left or right,
    and its effort is the largest absolute height difference between two consecutive cells. Return the smallest
    possible effort. Run Dijkstra where a path's cost is its maximum step.""",
    constraints=["1 <= rows, cols <= 100", "1 <= heights[i][j] <= 10^6"],
    fn="minimum_effort_path",
    params=[("heights", "matrix")],
    ret="int",
    ref="""
import heapq


def minimum_effort_path(heights):
    rows, cols = len(heights), len(heights[0])
    best = [[None] * cols for _ in range(rows)]
    best[0][0] = 0
    heap = [(0, 0, 0)]
    while heap:
        effort, r, c = heapq.heappop(heap)
        if (r, c) == (rows - 1, cols - 1):
            return effort
        if effort > best[r][c]:
            continue
        for nr, nc in ((r - 1, c), (r + 1, c), (r, c - 1), (r, c + 1)):
            if 0 <= nr < rows and 0 <= nc < cols:
                cost = max(effort, abs(heights[nr][nc] - heights[r][c]))
                if best[nr][nc] is None or cost < best[nr][nc]:
                    best[nr][nc] = cost
                    heapq.heappush(heap, (cost, nr, nc))
    return 0
""",
    examples=[({"heights": [[1, 2, 2], [3, 8, 2], [5, 3, 5]]}, 2), ({"heights": [[1, 2, 1, 1, 1], [1, 2, 1, 2, 1], [1, 2, 1, 2, 1], [1, 2, 1, 2, 1], [1, 1, 1, 2, 1]]}, 0)],
    tests=[{"heights": [[4]]}, {"heights": [[1, 10, 6, 7, 9, 10, 4, 9]]}, {"heights": random_grid(40, 40, seed=66, values=list(range(1, 60)))}],
)

problem(
    id="cheapest-flights-k-stops",
    source="Cheapest flight within K stops",
    title="Cheapest Flights Within K Stops",
    topic="Graph",
    difficulty="Medium",
    structure="graph",
    description="""flights[i] = [from, to, price] are one-way flights between n cities. Return the cheapest price from src
    to dst using at most k stops in between (so at most k + 1 flights), or -1. BFS by number of flights, relaxing
    prices level by level.""",
    constraints=["1 <= n <= 100", "0 <= k < n", "1 <= price <= 10^4"],
    fn="find_cheapest_price",
    params=[("n", "int"), ("flights", "matrix"), ("src", "int"), ("dst", "int"), ("k", "int")],
    ret="int",
    ref="""
def find_cheapest_price(n, flights, src, dst, k):
    cost = [None] * n
    cost[src] = 0
    for _ in range(k + 1):
        updated = list(cost)
        for u, v, price in flights:
            if cost[u] is not None and (updated[v] is None or cost[u] + price < updated[v]):
                updated[v] = cost[u] + price
        cost = updated
    return -1 if cost[dst] is None else cost[dst]
""",
    examples=[
        ({"n": 4, "flights": [[0, 1, 100], [1, 2, 100], [2, 0, 100], [1, 3, 600], [2, 3, 200]], "src": 0, "dst": 3, "k": 1}, 700),
        ({"n": 3, "flights": [[0, 1, 100], [1, 2, 100], [0, 2, 500]], "src": 0, "dst": 2, "k": 0}, 500),
    ],
    tests=[
        {"n": 3, "flights": [[0, 1, 100], [1, 2, 100], [0, 2, 500]], "src": 0, "dst": 2, "k": 1},
        {"n": 3, "flights": [[0, 1, 5]], "src": 0, "dst": 2, "k": 2},
        {"n": 60, "flights": random_edges(60, 300, seed=67, weights=(1, 500), directed=True), "src": 0, "dst": 59, "k": 3},
        {"n": 60, "flights": random_edges(60, 300, seed=67, weights=(1, 500), directed=True), "src": 0, "dst": 59, "k": 30},
    ],
)

problem(
    id="minimum-multiplications",
    source="Minimum multiplications to reach end",
    title="Minimum Multiplications to Reach End",
    topic="Graph",
    difficulty="Medium",
    structure="graph",
    description="""Starting from start, each step multiplies the current number by any value in arr and takes the result
    modulo 100000. Return the fewest steps to reach end, or -1 if it cannot be reached. BFS over the 100000 possible
    values.""",
    constraints=["1 <= arr.length <= 10^4", "1 <= arr[i] <= 10^5", "0 <= start, end < 10^5"],
    fn="minimum_multiplications",
    params=[("arr", "array"), ("start", "int"), ("end", "int")],
    ret="int",
    ref="""
from collections import deque


def minimum_multiplications(arr, start, end):
    mod = 100000
    dist = {start: 0}
    queue = deque([start])
    while queue:
        value = queue.popleft()
        if value == end:
            return dist[value]
        for factor in arr:
            nxt = value * factor % mod
            if nxt not in dist:
                dist[nxt] = dist[value] + 1
                queue.append(nxt)
    return -1
""",
    examples=[({"arr": [2, 5, 7], "start": 3, "end": 30}, 2), ({"arr": [3, 4, 65], "start": 7, "end": 66175}, 4)],
    tests=[{"arr": [2], "start": 5, "end": 5}, {"arr": [10], "start": 1, "end": 7}, {"arr": [2, 3], "start": 1, "end": 72}, {"arr": [7, 11, 13], "start": 17, "end": 99991}],
)

problem(
    id="ways-to-arrive",
    source="Number of ways to arrive at destination",
    title="Number of Shortest Routes",
    topic="Graph",
    difficulty="Medium",
    structure="graph",
    description="""roads [u, v, time] are two-way roads between n intersections. Return how many different routes from 0
    to n-1 take the shortest possible time, modulo 1,000,000,007. Run Dijkstra and, alongside each distance, count the
    ways to achieve it.""",
    constraints=["1 <= n <= 200", "1 <= time <= 10^9", "The graph is connected."],
    fn="count_paths",
    params=[("n", "int"), ("roads", "matrix")],
    ret="int",
    ref="""
import heapq


def count_paths(n, roads):
    mod = 1000000007
    adj = [[] for _ in range(n)]
    for u, v, t in roads:
        adj[u].append((v, t))
        adj[v].append((u, t))
    dist = [None] * n
    ways = [0] * n
    dist[0] = 0
    ways[0] = 1
    heap = [(0, 0)]
    while heap:
        d, node = heapq.heappop(heap)
        if d > dist[node]:
            continue
        for nxt, t in adj[node]:
            if dist[nxt] is None or d + t < dist[nxt]:
                dist[nxt] = d + t
                ways[nxt] = ways[node]
                heapq.heappush(heap, (d + t, nxt))
            elif d + t == dist[nxt]:
                ways[nxt] = (ways[nxt] + ways[node]) % mod
    return ways[n - 1]
""",
    examples=[
        ({"n": 7, "roads": [[0, 6, 7], [0, 1, 2], [1, 2, 3], [1, 3, 3], [6, 3, 3], [3, 5, 1], [6, 5, 1], [2, 5, 1], [0, 4, 5], [4, 6, 2]]}, 4),
        ({"n": 2, "roads": [[1, 0, 10]]}, 1),
    ],
    tests=[
        {"n": 1, "roads": []},
        {"n": 60, "roads": random_edges(60, 200, seed=68, weights=(1, 3), connected=True)},
        {"n": 61, "roads": [[i, i + 1, 1] for i in range(0, 60, 2)] + [[i, i + 2, 2] for i in range(0, 59, 2)] + [[i + 1, i + 2, 1] for i in range(0, 59, 2)]},
    ],
)

problem(
    id="bellman-ford",
    source="Bellman ford algorithm",
    title="Bellman-Ford",
    topic="Graph",
    difficulty="Medium",
    structure="graph",
    description="""edges [u, v, w] are directed and weights may be negative. Return the shortest distance from src to every
    node, using 100000000 for unreachable nodes. If a negative cycle is reachable from src, return [-1] instead. Relax
    every edge n − 1 times, then check whether one more pass still improves anything.""",
    constraints=["1 <= n <= 500", "-1000 <= w <= 1000"],
    fn="bellman_ford",
    params=[("n", "int"), ("edges", "matrix"), ("src", "int")],
    ret="array",
    ref="""
def bellman_ford(n, edges, src):
    inf = 100000000
    dist = [inf] * n
    dist[src] = 0
    for _ in range(n - 1):
        changed = False
        for u, v, w in edges:
            if dist[u] != inf and dist[u] + w < dist[v]:
                dist[v] = dist[u] + w
                changed = True
        if not changed:
            break
    for u, v, w in edges:
        if dist[u] != inf and dist[u] + w < dist[v]:
            return [-1]
    return dist
""",
    examples=[
        ({"n": 3, "edges": [[0, 1, 5], [1, 0, 3], [1, 2, -1], [2, 0, 1]], "src": 2}, [1, 6, 0]),
        ({"n": 2, "edges": [[0, 1, 9]], "src": 1}, [100000000, 0]),
        ({"n": 3, "edges": [[0, 1, 1], [1, 2, -2], [2, 1, 1]], "src": 0}, [-1]),
    ],
    tests=[
        {"n": 1, "edges": [], "src": 0},
        {"n": 50, "edges": [[u, v, w] for u, v, w in random_edges(50, 200, seed=69, weights=(-5, 40), directed=True) if u < v], "src": 0},
        {"n": 4, "edges": [[1, 2, -3], [2, 1, 1], [0, 3, 2]], "src": 0},
    ],
)

problem(
    id="floyd-warshall",
    source="Floyd warshall algorithm",
    title="Floyd-Warshall",
    topic="Graph",
    difficulty="Medium",
    structure="graph",
    description="""matrix[i][j] is the weight of the directed edge i → j, or -1 if there is none (the diagonal is 0).
    Return the matrix of shortest distances between every pair, keeping -1 for pairs with no path. For each middle
    node k, try routing every pair through k. There are no negative cycles.""",
    constraints=["1 <= n <= 100", "-1 <= matrix[i][j] <= 1000"],
    fn="floyd_warshall",
    params=[("matrix", "matrix")],
    ret="matrix",
    ref="""
def floyd_warshall(matrix):
    n = len(matrix)
    inf = float("inf")
    dist = [[inf if value == -1 else value for value in row] for row in matrix]
    for k in range(n):
        for i in range(n):
            if dist[i][k] == inf:
                continue
            for j in range(n):
                if dist[i][k] + dist[k][j] < dist[i][j]:
                    dist[i][j] = dist[i][k] + dist[k][j]
    return [[-1 if value == inf else value for value in row] for row in dist]
""",
    examples=[
        ({"matrix": [[0, 25], [-1, 0]]}, [[0, 25], [-1, 0]]),
        ({"matrix": [[0, 1, 43], [1, 0, 6], [-1, -1, 0]]}, [[0, 1, 7], [1, 0, 6], [-1, -1, 0]]),
    ],
    tests=[
        {"matrix": [[0]]},
        {"matrix": [[0 if r == c else (((r * 7 + c * 13) % 50) if (r + 2 * c) % 3 else -1) for c in range(30)] for r in range(30)]},
        {"matrix": [[0, 4, -1, -1], [-1, 0, 2, -1], [-1, -1, 0, 1], [3, -1, -1, 0]]},
    ],
)

problem(
    id="city-fewest-neighbours",
    source="Find the city with the smallest number of neighbors",
    title="City with the Fewest Reachable Neighbours",
    topic="Graph",
    difficulty="Medium",
    structure="graph",
    description="""edges [u, v, w] are two-way roads between n cities. For each city, count the other cities whose
    shortest distance is at most threshold. Return the city with the smallest count; on a tie, return the largest city
    number.""",
    constraints=["2 <= n <= 100", "1 <= w, threshold <= 10^4"],
    fn="find_the_city",
    params=[("n", "int"), ("edges", "matrix"), ("threshold", "int")],
    ret="int",
    ref="""
def find_the_city(n, edges, threshold):
    inf = float("inf")
    dist = [[0 if i == j else inf for j in range(n)] for i in range(n)]
    for u, v, w in edges:
        dist[u][v] = min(dist[u][v], w)
        dist[v][u] = min(dist[v][u], w)
    for k in range(n):
        for i in range(n):
            for j in range(n):
                if dist[i][k] + dist[k][j] < dist[i][j]:
                    dist[i][j] = dist[i][k] + dist[k][j]
    best_city, best_count = -1, n + 1
    for city in range(n):
        count = sum(1 for other in range(n) if other != city and dist[city][other] <= threshold)
        if count <= best_count:
            best_city, best_count = city, count
    return best_city
""",
    examples=[
        ({"n": 4, "edges": [[0, 1, 3], [1, 2, 1], [1, 3, 4], [2, 3, 1]], "threshold": 4}, 3),
        ({"n": 5, "edges": [[0, 1, 2], [0, 4, 8], [1, 2, 3], [1, 4, 2], [2, 3, 1], [3, 4, 1]], "threshold": 2}, 0),
    ],
    tests=[{"n": 2, "edges": [], "threshold": 5}, {"n": 60, "edges": WEIGHTED, "threshold": 30}, {"n": 80, "edges": SPARSE_WEIGHTED, "threshold": 25}],
)

# ---------------------------------------------------------------- MST and disjoint sets

problem(
    id="disjoint-set",
    source="Disjoint Set",
    title="Disjoint Set Union",
    topic="Graph",
    difficulty="Medium",
    structure="graph",
    description="""Build DisjointSet(n) over elements 0 to n-1, each starting in its own set. unite(u, v) merges their
    sets and returns true, or returns false if they were already together. connected(u, v) says whether they share a
    set, size(u) returns the size of u's set, and count() returns the number of sets. Use union by size with path
    compression.""",
    constraints=["1 <= n <= 10^5", "At most 10^5 operations."],
    design=design(
        "DisjointSet",
        ctor=[("n", "int")],
        methods=[
            method("unite", [("u", "int"), ("v", "int")], ret="bool"),
            method("connected", [("u", "int"), ("v", "int")], ret="bool"),
            method("size", [("u", "int")], ret="int"),
            method("count", ret="int"),
        ],
    ),
    ref="""
class DisjointSet:
    def __init__(self, n):
        self.parent = list(range(n))
        self.sizes = [1] * n
        self.sets = n

    def find(self, u):
        root = u
        while self.parent[root] != root:
            root = self.parent[root]
        while self.parent[u] != root:
            self.parent[u], u = root, self.parent[u]
        return root

    def unite(self, u, v):
        a, b = self.find(u), self.find(v)
        if a == b:
            return False
        if self.sizes[a] < self.sizes[b]:
            a, b = b, a
        self.parent[b] = a
        self.sizes[a] += self.sizes[b]
        self.sets -= 1
        return True

    def connected(self, u, v):
        return self.find(u) == self.find(v)

    def size(self, u):
        return self.sizes[self.find(u)]

    def count(self):
        return self.sets
""",
    examples=[
        (
            ops(("DisjointSet", 7), ("unite", 1, 2), ("unite", 2, 3), ("connected", 3, 1), ("unite", 4, 5), ("connected", 3, 5), ("unite", 3, 1), ("size", 1), ("count",)),
            [None, True, True, True, True, False, False, 3, 4],
        ),
        (ops(("DisjointSet", 2), ("connected", 0, 1), ("count",)), [None, False, 2]),
    ],
    tests=[
        ops(("DisjointSet", 1), ("size", 0), ("unite", 0, 0), ("count",)),
        ops(("DisjointSet", 100), *[("unite", u, v) for u, v in random_edges(100, 120, seed=70)], ("count",), ("size", 0), ("connected", 3, 97)),
        ops(("DisjointSet", 50), *[("unite", i, i + 1) for i in range(0, 48, 2)], *[("size", i) for i in range(0, 10)], ("count",)),
    ],
)

problem(
    id="mst-weight",
    source="Find the MST weight",
    title="Minimum Spanning Tree Weight",
    topic="Graph",
    difficulty="Medium",
    structure="graph",
    description="""The connected undirected graph has n nodes and weighted edges [u, v, w]. Return the total weight of a
    minimum spanning tree. Kruskal: sort edges by weight and keep each one that joins two different components.""",
    constraints=["1 <= n <= 1000", "0 <= w <= 10^4", "The graph is connected."],
    fn="spanning_tree",
    params=[("n", "int"), ("edges", "matrix")],
    ret="int",
    ref="""
def spanning_tree(n, edges):
    parent = list(range(n))

    def find(u):
        while parent[u] != u:
            parent[u] = parent[parent[u]]
            u = parent[u]
        return u

    total = 0
    for u, v, w in sorted(edges, key=lambda edge: edge[2]):
        a, b = find(u), find(v)
        if a != b:
            parent[a] = b
            total += w
    return total
""",
    examples=[({"n": 3, "edges": [[0, 1, 5], [1, 2, 3], [0, 2, 1]]}, 4), ({"n": 2, "edges": [[0, 1, 5]]}, 5)],
    tests=[{"n": 1, "edges": []}, {"n": 60, "edges": WEIGHTED}, {"n": 200, "edges": random_edges(200, 900, seed=71, weights=(0, 10000), connected=True)}],
)

problem(
    id="network-connected",
    source="Number of operations to make network connected",
    title="Operations to Connect a Network",
    topic="Graph",
    difficulty="Medium",
    structure="graph",
    description="""n computers are linked by cables [a, b]. You may unplug any cable and use it to join two other
    computers. Return the fewest moves to connect every computer, or -1 if there are not enough cables. You need
    (components − 1) moves and at least n − 1 cables.""",
    constraints=["1 <= n <= 10^5", "1 <= connections.length <= 10^5"],
    fn="make_connected",
    params=[("n", "int"), ("connections", "matrix")],
    ret="int",
    ref="""
def make_connected(n, connections):
    if len(connections) < n - 1:
        return -1
    parent = list(range(n))

    def find(u):
        while parent[u] != u:
            parent[u] = parent[parent[u]]
            u = parent[u]
        return u

    components = n
    for a, b in connections:
        ra, rb = find(a), find(b)
        if ra != rb:
            parent[ra] = rb
            components -= 1
    return components - 1
""",
    examples=[({"n": 4, "connections": [[0, 1], [0, 2], [1, 2]]}, 1), ({"n": 6, "connections": [[0, 1], [0, 2], [0, 3], [1, 2]]}, -1)],
    tests=[{"n": 1, "connections": []}, {"n": 6, "connections": [[0, 1], [0, 2], [0, 3], [1, 2], [1, 3]]}, {"n": 100, "connections": random_edges(100, 110, seed=72)}],
)

problem(
    id="accounts-merge",
    source="Accounts merge",
    title="Accounts Merge",
    topic="Graph",
    difficulty="Medium",
    structure="graph",
    description="""Each account is [name, email, email, ...]. Accounts that share any email belong to the same person
    (and then have the same name). Merge them and return one entry per person as [name, emails in sorted order]. The
    entries may be in any order. Union the emails with a disjoint set.""",
    constraints=["1 <= accounts.length <= 1000", "2 <= accounts[i].length <= 10"],
    fn="accounts_merge",
    params=[("accounts", "string_matrix")],
    ret="string_matrix",
    compare="unordered",
    ref="""
def accounts_merge(accounts):
    parent = list(range(len(accounts)))

    def find(u):
        while parent[u] != u:
            parent[u] = parent[parent[u]]
            u = parent[u]
        return u

    owner = {}
    for index, account in enumerate(accounts):
        for email in account[1:]:
            if email in owner:
                parent[find(index)] = find(owner[email])
            else:
                owner[email] = index
    groups = {}
    for email, index in owner.items():
        groups.setdefault(find(index), []).append(email)
    return [[accounts[root][0]] + sorted(emails) for root, emails in groups.items()]
""",
    examples=[
        (
            {"accounts": [["John", "johnsmith@mail.com", "john_newyork@mail.com"], ["John", "johnsmith@mail.com", "john00@mail.com"], ["Mary", "mary@mail.com"], ["John", "johnnybravo@mail.com"]]},
            [["John", "john00@mail.com", "john_newyork@mail.com", "johnsmith@mail.com"], ["Mary", "mary@mail.com"], ["John", "johnnybravo@mail.com"]],
        ),
        ({"accounts": [["Ada", "a@x.com"], ["Ada", "a@x.com", "b@x.com"]]}, [["Ada", "a@x.com", "b@x.com"]]),
    ],
    tests=[
        {"accounts": [["Kai", "k@k.com"]]},
        {"accounts": [["P", "a", "b"], ["P", "c", "d"], ["P", "b", "c"], ["Q", "e"]]},
        {"accounts": [["U" + str(i % 7), "m" + str(i % 7) + "_" + str(i), "m" + str(i % 7) + "_" + str(i + 7)] for i in range(80)]},
    ],
)

problem(
    id="number-of-islands-ii",
    source="Number of islands II",
    title="Number of Islands II",
    topic="Graph",
    difficulty="Hard",
    structure="matrix",
    description="""A rows × cols grid starts as all water. Each operation [r, c] turns that cell into land (it may already
    be land). After every operation, report the number of islands, where land connects up, down, left and right.
    Union each new cell with its land neighbours.""",
    constraints=["1 <= rows, cols <= 1000", "1 <= operators.length <= 10^4"],
    fn="num_islands_ii",
    params=[("rows", "int"), ("cols", "int"), ("operators", "matrix")],
    ret="array",
    ref="""
def num_islands_ii(rows, cols, operators):
    parent = {}

    def find(u):
        while parent[u] != u:
            parent[u] = parent[parent[u]]
            u = parent[u]
        return u

    count = 0
    result = []
    for r, c in operators:
        cell = r * cols + c
        if cell not in parent:
            parent[cell] = cell
            count += 1
            for nr, nc in ((r - 1, c), (r + 1, c), (r, c - 1), (r, c + 1)):
                other = nr * cols + nc
                if 0 <= nr < rows and 0 <= nc < cols and other in parent:
                    a, b = find(cell), find(other)
                    if a != b:
                        parent[a] = b
                        count -= 1
        result.append(count)
    return result
""",
    examples=[
        ({"rows": 4, "cols": 5, "operators": [[1, 1], [0, 1], [3, 3], [3, 4]]}, [1, 1, 2, 2]),
        ({"rows": 4, "cols": 5, "operators": [[0, 0], [1, 1], [2, 2], [3, 3], [1, 0]]}, [1, 2, 3, 4, 3]),
    ],
    tests=[
        {"rows": 1, "cols": 1, "operators": [[0, 0], [0, 0]]},
        {"rows": 3, "cols": 3, "operators": [[0, 0], [0, 2], [2, 0], [2, 2], [1, 1], [0, 1], [1, 0], [1, 2], [2, 1]]},
        {"rows": 30, "cols": 30, "operators": [[(i * 7) % 30, (i * 11) % 30] for i in range(600)]},
    ],
)

problem(
    id="making-large-island",
    source="Making a large island",
    title="Making a Large Island",
    topic="Graph",
    difficulty="Hard",
    structure="matrix",
    description="""grid is n × n with 1 for land. You may change at most one 0 into a 1. Return the size of the largest
    island (up, down, left, right connections) you can end up with. Label each island with its size, then try every 0
    and add up its distinct neighbouring islands.""",
    constraints=["1 <= n <= 500"],
    fn="largest_island",
    params=[("grid", "matrix")],
    ret="int",
    ref="""
def largest_island(grid):
    n = len(grid)
    label = [[0] * n for _ in range(n)]
    sizes = {}
    next_label = 1
    for r in range(n):
        for c in range(n):
            if grid[r][c] != 1 or label[r][c]:
                continue
            label[r][c] = next_label
            stack = [(r, c)]
            size = 0
            while stack:
                cr, cc = stack.pop()
                size += 1
                for nr, nc in ((cr - 1, cc), (cr + 1, cc), (cr, cc - 1), (cr, cc + 1)):
                    if 0 <= nr < n and 0 <= nc < n and grid[nr][nc] == 1 and not label[nr][nc]:
                        label[nr][nc] = next_label
                        stack.append((nr, nc))
            sizes[next_label] = size
            next_label += 1
    best = max(sizes.values(), default=0)
    for r in range(n):
        for c in range(n):
            if grid[r][c] == 0:
                around = {label[nr][nc] for nr, nc in ((r - 1, c), (r + 1, c), (r, c - 1), (r, c + 1)) if 0 <= nr < n and 0 <= nc < n and label[nr][nc]}
                best = max(best, 1 + sum(sizes[item] for item in around))
    return best
""",
    examples=[({"grid": [[1, 0], [0, 1]]}, 3), ({"grid": [[1, 1], [1, 1]]}, 4)],
    tests=[{"grid": [[0]]}, {"grid": [[1, 1, 0], [0, 0, 1], [1, 1, 1]]}, {"grid": random_grid(40, 40, seed=73, weights=[1, 1])}],
)

problem(
    id="most-stones-removed",
    source="Most stones removed with same row or column",
    title="Most Stones Removed",
    topic="Graph",
    difficulty="Medium",
    structure="graph",
    description="""Each stone sits at [row, col], one per position. A stone can be removed if another remaining stone
    shares its row or column. Return the most stones you can remove. Every connected group (linked through rows and
    columns) can be reduced to one stone, so the answer is stones − groups.""",
    constraints=["1 <= stones.length <= 1000", "0 <= row, col <= 10^4"],
    fn="remove_stones",
    params=[("stones", "matrix")],
    ret="int",
    ref="""
def remove_stones(stones):
    parent = {}

    def find(u):
        parent.setdefault(u, u)
        while parent[u] != u:
            parent[u] = parent[parent[u]]
            u = parent[u]
        return u

    for row, col in stones:
        parent[find(("r", row))] = find(("c", col))
    groups = len({find(("r", row)) for row, _ in stones})
    return len(stones) - groups
""",
    examples=[({"stones": [[0, 0], [0, 1], [1, 0], [1, 2], [2, 1], [2, 2]]}, 5), ({"stones": [[0, 0], [0, 2], [1, 1], [2, 0], [2, 2]]}, 3)],
    tests=[{"stones": [[0, 0]]}, {"stones": [[i, i] for i in range(50)]}, {"stones": [[(i * 7) % 40, (i * 13) % 37] for i in range(300)]}],
)

# ---------------------------------------------------------------- SCC, bridges, articulation points

problem(
    id="kosaraju-scc",
    source="Kosaraju's algorithm",
    title="Strongly Connected Components",
    topic="Graph",
    difficulty="Hard",
    structure="graph",
    description="""adj is a directed graph. Return the number of strongly connected components. Kosaraju: record DFS
    finish order, reverse every edge, then run DFS in decreasing finish order; each new start is a component.""",
    constraints=["1 <= V <= 5000"],
    fn="kosaraju",
    params=[("adj", "graph")],
    ret="int",
    ref="""
def kosaraju(adj):
    n = len(adj)
    seen = [False] * n
    order = []
    for start in range(n):
        if seen[start]:
            continue
        seen[start] = True
        stack = [(start, iter(adj[start]))]
        while stack:
            node, neighbours = stack[-1]
            for nxt in neighbours:
                if not seen[nxt]:
                    seen[nxt] = True
                    stack.append((nxt, iter(adj[nxt])))
                    break
            else:
                stack.pop()
                order.append(node)
    reverse = [[] for _ in range(n)]
    for node in range(n):
        for nxt in adj[node]:
            reverse[nxt].append(node)
    assigned = [False] * n
    components = 0
    for start in reversed(order):
        if assigned[start]:
            continue
        components += 1
        assigned[start] = True
        stack = [start]
        while stack:
            node = stack.pop()
            for nxt in reverse[node]:
                if not assigned[nxt]:
                    assigned[nxt] = True
                    stack.append(nxt)
    return components
""",
    examples=[({"adj": [[2, 3], [0], [1], [4], []]}, 3), ({"adj": [[1], [2], [0]]}, 1)],
    tests=[{"adj": [[]]}, {"adj": [[1], [], [3], []]}, {"adj": adjacency(80, random_edges(80, 140, seed=74, directed=True), directed=True)}],
)

problem(
    id="bridges-in-graph",
    source="Bridges in graph",
    title="Bridges (Critical Connections)",
    topic="Graph",
    difficulty="Hard",
    structure="graph",
    description="""n servers are joined by undirected connections. A bridge is a connection whose removal disconnects some
    servers. Return every bridge as [smaller, larger], with the list sorted. Tarjan: an edge (u, v) is a bridge when
    the lowest discovery time reachable from v's subtree is later than u's.""",
    constraints=["2 <= n <= 10^5", "No repeated connections."],
    fn="critical_connections",
    params=[("n", "int"), ("connections", "matrix")],
    ret="matrix",
    ref="""
def critical_connections(n, connections):
    adj = [[] for _ in range(n)]
    for u, v in connections:
        adj[u].append(v)
        adj[v].append(u)
    tin = [-1] * n
    low = [0] * n
    timer = 0
    bridges = []
    for root in range(n):
        if tin[root] != -1:
            continue
        tin[root] = low[root] = timer
        timer += 1
        stack = [(root, -1, iter(adj[root]))]
        while stack:
            node, parent, neighbours = stack[-1]
            advanced = False
            for nxt in neighbours:
                if nxt == parent:
                    continue
                if tin[nxt] == -1:
                    tin[nxt] = low[nxt] = timer
                    timer += 1
                    stack.append((nxt, node, iter(adj[nxt])))
                    advanced = True
                    break
                low[node] = min(low[node], tin[nxt])
            if advanced:
                continue
            stack.pop()
            if parent != -1:
                low[parent] = min(low[parent], low[node])
                if low[node] > tin[parent]:
                    bridges.append(sorted([parent, node]))
    return sorted(bridges)
""",
    examples=[({"n": 4, "connections": [[0, 1], [1, 2], [2, 0], [1, 3]]}, [[1, 3]]), ({"n": 2, "connections": [[0, 1]]}, [[0, 1]])],
    tests=[
        {"n": 3, "connections": [[0, 1], [1, 2], [2, 0]]},
        {"n": 50, "connections": random_edges(50, 49, seed=44, connected=True)},
        {"n": 80, "connections": random_edges(80, 100, seed=75)},
    ],
)

problem(
    id="articulation-points",
    source="Articulation point in graph",
    title="Articulation Points",
    topic="Graph",
    difficulty="Hard",
    structure="graph",
    description="""adj is an undirected graph, possibly disconnected. An articulation point is a node whose removal
    increases the number of connected components. Return them in increasing order (empty if none). A non-root node u
    qualifies when some child v has low[v] >= tin[u]; a DFS root qualifies when it has two or more DFS children.""",
    constraints=["1 <= V <= 10^4"],
    fn="articulation_points",
    params=[("adj", "graph")],
    ret="array",
    ref="""
def articulation_points(adj):
    n = len(adj)
    tin = [-1] * n
    low = [0] * n
    marked = [False] * n
    timer = 0
    for root in range(n):
        if tin[root] != -1:
            continue
        tin[root] = low[root] = timer
        timer += 1
        root_children = 0
        stack = [(root, -1, iter(adj[root]))]
        while stack:
            node, parent, neighbours = stack[-1]
            advanced = False
            for nxt in neighbours:
                if nxt == parent:
                    continue
                if tin[nxt] == -1:
                    tin[nxt] = low[nxt] = timer
                    timer += 1
                    if node == root:
                        root_children += 1
                    stack.append((nxt, node, iter(adj[nxt])))
                    advanced = True
                    break
                low[node] = min(low[node], tin[nxt])
            if advanced:
                continue
            stack.pop()
            if parent != -1:
                low[parent] = min(low[parent], low[node])
                if parent != root and low[node] >= tin[parent]:
                    marked[parent] = True
        if root_children > 1:
            marked[root] = True
    return [node for node in range(n) if marked[node]]
""",
    examples=[({"adj": [[1], [0, 4], [3, 4], [2, 4], [1, 2, 3]]}, [1, 4]), ({"adj": [[1, 2], [0, 2], [0, 1]]}, [])],
    tests=[{"adj": [[]]}, {"adj": adjacency(50, random_edges(50, 49, seed=44, connected=True))}, {"adj": adjacency(80, random_edges(80, 100, seed=75))}],
)
