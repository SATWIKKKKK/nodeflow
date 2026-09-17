from dsl import problem
from graphgen import adjacency, random_dag, random_edges, random_grid

ADJ5 = [[1, 2], [0, 3], [0, 4], [1], [2]]
BIG_UNDIRECTED = adjacency(60, random_edges(60, 70, seed=41))
FOREST = adjacency(40, random_edges(40, 25, seed=42))
DAG_EDGES = random_dag(50, 120, seed=43)
BIG_DAG = adjacency(50, DAG_EDGES, directed=True)
CYCLIC_DIRECTED = adjacency(50, DAG_EDGES + [[DAG_EDGES[-1][1], DAG_EDGES[-1][0]]], directed=True)
TREE_EDGES = random_edges(50, 49, seed=44, connected=True)


def char_grid(rows, fill="0", ones="1"):
    return [[ones if cell else fill for cell in row] for row in rows]


GRAPH_CONSTRAINTS = ["1 <= V <= 10^4", "adj[u] lists the neighbours of u."]

# ---------------------------------------------------------------- traversal

problem(
    id="bfs-dfs-traversal",
    source="Traversal Techniques",
    title="BFS and DFS of a Graph",
    topic="Graph",
    difficulty="Easy",
    structure="graph",
    description="""adj is an undirected graph as an adjacency list. Starting from node 0, return [bfs order, dfs order],
    visiting neighbours in the order they appear in adj[u]. The DFS is recursive: visit a node, then each unvisited
    neighbour in turn. Only nodes reachable from 0 appear.""",
    constraints=GRAPH_CONSTRAINTS,
    fn="bfs_and_dfs",
    params=[("adj", "graph")],
    ret="matrix",
    ref="""
from collections import deque


def bfs_and_dfs(adj):
    seen = [False] * len(adj)
    bfs = []
    queue = deque([0])
    seen[0] = True
    while queue:
        node = queue.popleft()
        bfs.append(node)
        for nxt in adj[node]:
            if not seen[nxt]:
                seen[nxt] = True
                queue.append(nxt)

    visited = [False] * len(adj)
    dfs = []

    def visit(node):
        visited[node] = True
        dfs.append(node)
        for nxt in adj[node]:
            if not visited[nxt]:
                visit(nxt)

    visit(0)
    return [bfs, dfs]
""",
    examples=[({"adj": ADJ5}, [[0, 1, 2, 3, 4], [0, 1, 3, 2, 4]]), ({"adj": [[2, 1], [0], [0]]}, [[0, 2, 1], [0, 2, 1]])],
    tests=[{"adj": [[]]}, {"adj": BIG_UNDIRECTED}, {"adj": FOREST}],
)

problem(
    id="connected-components",
    source="Connected Components",
    title="Count Connected Components",
    topic="Graph",
    difficulty="Easy",
    structure="graph",
    description="""The graph has n nodes (0 to n-1) and undirected edges. Return how many connected components it has.
    Start a traversal from every node that is still unvisited and count the starts.""",
    constraints=["1 <= n <= 10^4", "0 <= edges.length <= 10^5"],
    fn="count_components",
    params=[("n", "int"), ("edges", "matrix")],
    ret="int",
    ref="""
def count_components(n, edges):
    adj = [[] for _ in range(n)]
    for u, v in edges:
        adj[u].append(v)
        adj[v].append(u)
    seen = [False] * n
    components = 0
    for start in range(n):
        if seen[start]:
            continue
        components += 1
        seen[start] = True
        stack = [start]
        while stack:
            node = stack.pop()
            for nxt in adj[node]:
                if not seen[nxt]:
                    seen[nxt] = True
                    stack.append(nxt)
    return components
""",
    examples=[({"n": 5, "edges": [[0, 1], [1, 2], [3, 4]]}, 2), ({"n": 4, "edges": []}, 4)],
    tests=[{"n": 1, "edges": []}, {"n": 40, "edges": random_edges(40, 25, seed=42)}, {"n": 300, "edges": random_edges(300, 280, seed=45)}],
)

problem(
    id="number-of-provinces",
    source="Number of provinces",
    title="Number of Provinces",
    topic="Graph",
    difficulty="Medium",
    structure="graph",
    description="""is_connected[i][j] is 1 when cities i and j are directly linked (the matrix is symmetric with 1s on
    the diagonal). A province is a group of cities linked directly or indirectly. Return the number of provinces.""",
    constraints=["1 <= n <= 200"],
    fn="find_circle_num",
    params=[("is_connected", "matrix")],
    ret="int",
    ref="""
def find_circle_num(is_connected):
    n = len(is_connected)
    seen = [False] * n

    def visit(city):
        seen[city] = True
        for other in range(n):
            if is_connected[city][other] and not seen[other]:
                visit(other)

    provinces = 0
    for city in range(n):
        if not seen[city]:
            provinces += 1
            visit(city)
    return provinces
""",
    examples=[({"is_connected": [[1, 1, 0], [1, 1, 0], [0, 0, 1]]}, 2), ({"is_connected": [[1, 0, 0], [0, 1, 0], [0, 0, 1]]}, 3)],
    tests=[
        {"is_connected": [[1]]},
        {"is_connected": [[1] * 6 for _ in range(6)]},
        {"is_connected": [[1 if r == c or c in FOREST[r] else 0 for c in range(40)] for r in range(40)]},
    ],
)

problem(
    id="number-of-islands",
    source="Number of islands",
    title="Number of Islands",
    topic="Graph",
    difficulty="Medium",
    structure="matrix",
    description="""grid holds "1" for land and "0" for water. An island is a group of land cells joined horizontally,
    vertically or diagonally (all 8 directions). Return the number of islands.""",
    constraints=["1 <= rows, cols <= 500"],
    fn="num_islands",
    params=[("grid", "char_matrix")],
    ret="int",
    ref="""
def num_islands(grid):
    rows, cols = len(grid), len(grid[0])
    seen = [[False] * cols for _ in range(rows)]
    islands = 0
    for r in range(rows):
        for c in range(cols):
            if grid[r][c] != "1" or seen[r][c]:
                continue
            islands += 1
            seen[r][c] = True
            stack = [(r, c)]
            while stack:
                cr, cc = stack.pop()
                for dr in (-1, 0, 1):
                    for dc in (-1, 0, 1):
                        nr, nc = cr + dr, cc + dc
                        if 0 <= nr < rows and 0 <= nc < cols and grid[nr][nc] == "1" and not seen[nr][nc]:
                            seen[nr][nc] = True
                            stack.append((nr, nc))
    return islands
""",
    examples=[
        ({"grid": [["0", "1"], ["1", "0"], ["1", "1"], ["1", "0"]]}, 1),
        ({"grid": [["0", "1", "1", "1", "0", "0", "0"], ["0", "0", "1", "1", "0", "1", "0"]]}, 2),
    ],
    tests=[{"grid": [["0"]]}, {"grid": [["1"] * 5 for _ in range(5)]}, {"grid": char_grid(random_grid(40, 40, seed=46, weights=[3, 1]))}],
)

problem(
    id="flood-fill",
    source="Flood fill algorithm",
    title="Flood Fill",
    topic="Graph",
    difficulty="Easy",
    structure="matrix",
    description="""Starting at (sr, sc), repaint that pixel and every pixel of the same original colour connected to it
    through up, down, left or right moves with color. Return the image. If the start already has that colour, nothing
    changes.""",
    constraints=["1 <= rows, cols <= 50", "0 <= image[i][j], color < 2^16"],
    fn="flood_fill",
    params=[("image", "matrix"), ("sr", "int"), ("sc", "int"), ("color", "int")],
    ret="matrix",
    ref="""
def flood_fill(image, sr, sc, color):
    original = image[sr][sc]
    if original == color:
        return image
    rows, cols = len(image), len(image[0])
    stack = [(sr, sc)]
    image[sr][sc] = color
    while stack:
        r, c = stack.pop()
        for nr, nc in ((r - 1, c), (r + 1, c), (r, c - 1), (r, c + 1)):
            if 0 <= nr < rows and 0 <= nc < cols and image[nr][nc] == original:
                image[nr][nc] = color
                stack.append((nr, nc))
    return image
""",
    examples=[
        ({"image": [[1, 1, 1], [1, 1, 0], [1, 0, 1]], "sr": 1, "sc": 1, "color": 2}, [[2, 2, 2], [2, 2, 0], [2, 0, 1]]),
        ({"image": [[0, 0, 0], [0, 0, 0]], "sr": 0, "sc": 0, "color": 0}, [[0, 0, 0], [0, 0, 0]]),
    ],
    tests=[
        {"image": [[5]], "sr": 0, "sc": 0, "color": 9},
        {"image": random_grid(30, 30, seed=47, values=(0, 1, 2)), "sr": 15, "sc": 15, "color": 7},
        {"image": [[1] * 50 for _ in range(50)], "sr": 49, "sc": 0, "color": 3},
    ],
)

problem(
    id="number-of-enclaves",
    source="Number of enclaves",
    title="Number of Enclaves",
    topic="Graph",
    difficulty="Medium",
    structure="matrix",
    description="""grid holds 1 for land and 0 for sea. You can walk between land cells up, down, left or right, and you
    leave the grid by walking off its edge. Return how many land cells cannot reach the edge. Flood from every
    boundary land cell first.""",
    constraints=["1 <= rows, cols <= 500"],
    fn="num_enclaves",
    params=[("grid", "matrix")],
    ret="int",
    ref="""
def num_enclaves(grid):
    rows, cols = len(grid), len(grid[0])
    stack = [(r, c) for r in range(rows) for c in range(cols) if grid[r][c] == 1 and (r in (0, rows - 1) or c in (0, cols - 1))]
    for r, c in stack:
        grid[r][c] = 0
    while stack:
        r, c = stack.pop()
        for nr, nc in ((r - 1, c), (r + 1, c), (r, c - 1), (r, c + 1)):
            if 0 <= nr < rows and 0 <= nc < cols and grid[nr][nc] == 1:
                grid[nr][nc] = 0
                stack.append((nr, nc))
    return sum(map(sum, grid))
""",
    examples=[
        ({"grid": [[0, 0, 0, 0], [1, 0, 1, 0], [0, 1, 1, 0], [0, 0, 0, 0]]}, 3),
        ({"grid": [[0, 1, 1, 0], [0, 0, 1, 0], [0, 0, 1, 0], [0, 0, 0, 0]]}, 0),
    ],
    tests=[{"grid": [[1]]}, {"grid": [[0, 0, 0], [0, 1, 0], [0, 0, 0]]}, {"grid": random_grid(40, 40, seed=48)}],
)

problem(
    id="rotting-oranges",
    source="Rotten Oranges",
    title="Rotting Oranges",
    topic="Graph",
    difficulty="Medium",
    structure="matrix",
    description="""Each cell is 0 (empty), 1 (fresh orange) or 2 (rotten orange). Every minute, fresh oranges next to a
    rotten one (up, down, left, right) rot. Return the minutes until no fresh orange is left, or -1 if that never
    happens. Run a multi-source BFS from all rotten oranges at once.""",
    constraints=["1 <= rows, cols <= 100"],
    fn="oranges_rotting",
    params=[("grid", "matrix")],
    ret="int",
    ref="""
from collections import deque


def oranges_rotting(grid):
    rows, cols = len(grid), len(grid[0])
    queue = deque()
    fresh = 0
    for r in range(rows):
        for c in range(cols):
            if grid[r][c] == 2:
                queue.append((r, c))
            elif grid[r][c] == 1:
                fresh += 1
    minutes = 0
    while queue and fresh:
        minutes += 1
        for _ in range(len(queue)):
            r, c = queue.popleft()
            for nr, nc in ((r - 1, c), (r + 1, c), (r, c - 1), (r, c + 1)):
                if 0 <= nr < rows and 0 <= nc < cols and grid[nr][nc] == 1:
                    grid[nr][nc] = 2
                    fresh -= 1
                    queue.append((nr, nc))
    return minutes if fresh == 0 else -1
""",
    examples=[({"grid": [[2, 1, 1], [1, 1, 0], [0, 1, 1]]}, 4), ({"grid": [[2, 1, 1], [0, 1, 1], [1, 0, 1]]}, -1), ({"grid": [[0, 2]]}, 0)],
    tests=[{"grid": [[1]]}, {"grid": [[2] + [1] * 99]}, {"grid": random_grid(30, 30, seed=49, values=(0, 1, 2), weights=[1, 6, 1])}],
)

problem(
    id="distance-nearest-one",
    source="Distance of nearest cell having one",
    title="Distance to the Nearest 1",
    topic="Graph",
    difficulty="Medium",
    structure="matrix",
    description="""grid holds 0s and 1s and contains at least one 1. For every cell return the number of up, down, left
    or right steps to the nearest 1 (so cells holding 1 get 0). Start a BFS from every 1 at once.""",
    constraints=["1 <= rows, cols <= 500", "grid contains at least one 1."],
    fn="nearest_one",
    params=[("grid", "matrix")],
    ret="matrix",
    ref="""
from collections import deque


def nearest_one(grid):
    rows, cols = len(grid), len(grid[0])
    dist = [[-1] * cols for _ in range(rows)]
    queue = deque()
    for r in range(rows):
        for c in range(cols):
            if grid[r][c] == 1:
                dist[r][c] = 0
                queue.append((r, c))
    while queue:
        r, c = queue.popleft()
        for nr, nc in ((r - 1, c), (r + 1, c), (r, c - 1), (r, c + 1)):
            if 0 <= nr < rows and 0 <= nc < cols and dist[nr][nc] == -1:
                dist[nr][nc] = dist[r][c] + 1
                queue.append((nr, nc))
    return dist
""",
    examples=[
        ({"grid": [[0, 1, 1, 0], [1, 1, 0, 0], [0, 0, 1, 1]]}, [[1, 0, 0, 1], [0, 0, 1, 1], [1, 1, 0, 0]]),
        ({"grid": [[1, 0, 1], [1, 1, 0], [1, 0, 0]]}, [[0, 1, 0], [0, 0, 1], [0, 1, 2]]),
    ],
    tests=[{"grid": [[1]]}, {"grid": [[0] * 30 for _ in range(29)] + [[0] * 29 + [1]]}, {"grid": random_grid(25, 25, seed=50, weights=[9, 1])}],
)

problem(
    id="surrounded-regions",
    source="Surrounded Regions",
    title="Surrounded Regions",
    topic="Graph",
    difficulty="Medium",
    structure="matrix",
    description="""board holds "X" and "O". Replace every "O" that cannot reach the border through up, down, left or
    right moves over other "O"s with "X", and return the board. Mark the border-connected "O"s first.""",
    constraints=["1 <= rows, cols <= 200"],
    fn="solve_regions",
    params=[("board", "char_matrix")],
    ret="char_matrix",
    ref="""
def solve_regions(board):
    rows, cols = len(board), len(board[0])
    safe = [[False] * cols for _ in range(rows)]
    stack = [(r, c) for r in range(rows) for c in range(cols) if board[r][c] == "O" and (r in (0, rows - 1) or c in (0, cols - 1))]
    for r, c in stack:
        safe[r][c] = True
    while stack:
        r, c = stack.pop()
        for nr, nc in ((r - 1, c), (r + 1, c), (r, c - 1), (r, c + 1)):
            if 0 <= nr < rows and 0 <= nc < cols and board[nr][nc] == "O" and not safe[nr][nc]:
                safe[nr][nc] = True
                stack.append((nr, nc))
    for r in range(rows):
        for c in range(cols):
            if board[r][c] == "O" and not safe[r][c]:
                board[r][c] = "X"
    return board
""",
    examples=[
        (
            {"board": [["X", "X", "X", "X"], ["X", "O", "O", "X"], ["X", "X", "O", "X"], ["X", "O", "X", "X"]]},
            [["X", "X", "X", "X"], ["X", "X", "X", "X"], ["X", "X", "X", "X"], ["X", "O", "X", "X"]],
        ),
        ({"board": [["X"]]}, [["X"]]),
    ],
    tests=[{"board": [["O", "O"], ["O", "O"]]}, {"board": [["X", "X", "X"], ["X", "O", "X"], ["X", "X", "X"]]}, {"board": char_grid(random_grid(30, 30, seed=51), fill="X", ones="O")}],
)

problem(
    id="distinct-islands",
    source="Number of distinct islands",
    title="Number of Distinct Islands",
    topic="Graph",
    difficulty="Medium",
    structure="matrix",
    description="""grid holds 1 for land. Islands connect up, down, left and right. Two islands are the same when one
    can be slid (not rotated or flipped) onto the other. Return how many different island shapes there are. Record
    each island's cells relative to its first cell.""",
    constraints=["1 <= rows, cols <= 500"],
    fn="count_distinct_islands",
    params=[("grid", "matrix")],
    ret="int",
    ref="""
def count_distinct_islands(grid):
    rows, cols = len(grid), len(grid[0])
    seen = [[False] * cols for _ in range(rows)]
    shapes = set()
    for r in range(rows):
        for c in range(cols):
            if grid[r][c] != 1 or seen[r][c]:
                continue
            seen[r][c] = True
            stack = [(r, c)]
            cells = []
            while stack:
                cr, cc = stack.pop()
                cells.append((cr - r, cc - c))
                for nr, nc in ((cr - 1, cc), (cr + 1, cc), (cr, cc - 1), (cr, cc + 1)):
                    if 0 <= nr < rows and 0 <= nc < cols and grid[nr][nc] == 1 and not seen[nr][nc]:
                        seen[nr][nc] = True
                        stack.append((nr, nc))
            shapes.add(tuple(sorted(cells)))
    return len(shapes)
""",
    examples=[
        ({"grid": [[1, 1, 0, 0, 0], [1, 1, 0, 0, 0], [0, 0, 0, 1, 1], [0, 0, 0, 1, 1]]}, 1),
        ({"grid": [[1, 1, 0, 1, 1], [1, 0, 0, 0, 0], [0, 0, 0, 0, 1], [1, 1, 0, 1, 1]]}, 3),
    ],
    tests=[{"grid": [[0]]}, {"grid": [[1, 0, 1, 0, 1]]}, {"grid": random_grid(40, 40, seed=52, weights=[2, 1])}],
)

# ---------------------------------------------------------------- cycles and bipartite

problem(
    id="cycle-undirected",
    source="Detect a cycle in an undirected graph",
    title="Cycle in an Undirected Graph",
    topic="Graph",
    difficulty="Medium",
    structure="graph",
    description="""adj is an undirected graph (possibly disconnected, no repeated edges). Return whether it contains a
    cycle. During a traversal, reaching a visited node that is not your parent means a cycle.""",
    constraints=GRAPH_CONSTRAINTS,
    fn="has_cycle_undirected",
    params=[("adj", "graph")],
    ret="bool",
    ref="""
from collections import deque


def has_cycle_undirected(adj):
    seen = [False] * len(adj)
    for start in range(len(adj)):
        if seen[start]:
            continue
        seen[start] = True
        queue = deque([(start, -1)])
        while queue:
            node, parent = queue.popleft()
            for nxt in adj[node]:
                if not seen[nxt]:
                    seen[nxt] = True
                    queue.append((nxt, node))
                elif nxt != parent:
                    return True
    return False
""",
    examples=[({"adj": [[1], [0, 2, 4], [1, 3], [2, 4], [1, 3]]}, True), ({"adj": [[], [2], [1, 3], [2]]}, False)],
    tests=[{"adj": [[]]}, {"adj": adjacency(50, TREE_EDGES)}, {"adj": adjacency(50, TREE_EDGES + [[TREE_EDGES[5][0], TREE_EDGES[40][1]]] if TREE_EDGES[5][0] != TREE_EDGES[40][1] else TREE_EDGES)}, {"adj": FOREST}],
)

problem(
    id="bipartite-graph",
    source="Bipartite graph",
    title="Is the Graph Bipartite?",
    topic="Graph",
    difficulty="Medium",
    structure="graph",
    description="""adj is an undirected graph, possibly disconnected. Return whether its nodes can be split into two
    groups so that every edge joins nodes from different groups. Try to 2-colour each component.""",
    constraints=["1 <= V <= 100"],
    fn="is_bipartite",
    params=[("adj", "graph")],
    ret="bool",
    ref="""
def is_bipartite(adj):
    color = [-1] * len(adj)
    for start in range(len(adj)):
        if color[start] != -1:
            continue
        color[start] = 0
        stack = [start]
        while stack:
            node = stack.pop()
            for nxt in adj[node]:
                if color[nxt] == -1:
                    color[nxt] = 1 - color[node]
                    stack.append(nxt)
                elif color[nxt] == color[node]:
                    return False
    return True
""",
    examples=[({"adj": [[1, 2, 3], [0, 2], [0, 1, 3], [0, 2]]}, False), ({"adj": [[1, 3], [0, 2], [1, 3], [0, 2]]}, True)],
    tests=[{"adj": [[]]}, {"adj": adjacency(50, TREE_EDGES)}, {"adj": adjacency(8, [[i, (i + 1) % 7] for i in range(7)])}, {"adj": BIG_UNDIRECTED}],
)

problem(
    id="cycle-directed",
    source="Detect a cycle in a directed graph",
    title="Cycle in a Directed Graph",
    topic="Graph",
    difficulty="Medium",
    structure="graph",
    description="""adj is a directed graph. Return whether it has a cycle. A DFS finds one when it reaches a node that is
    still on the current recursion path.""",
    constraints=GRAPH_CONSTRAINTS,
    fn="has_cycle_directed",
    params=[("adj", "graph")],
    ret="bool",
    ref="""
def has_cycle_directed(adj):
    state = [0] * len(adj)

    def visit(node):
        state[node] = 1
        for nxt in adj[node]:
            if state[nxt] == 1:
                return True
            if state[nxt] == 0 and visit(nxt):
                return True
        state[node] = 2
        return False

    return any(state[node] == 0 and visit(node) for node in range(len(adj)))
""",
    examples=[({"adj": [[1], [2], [3], [3]]}, True), ({"adj": [[1], [2], []]}, False)],
    tests=[{"adj": [[]]}, {"adj": BIG_DAG}, {"adj": CYCLIC_DIRECTED}, {"adj": [[1], [0], [], [2]]}],
)

# ---------------------------------------------------------------- topological sort

problem(
    id="topological-sort",
    source="Topological sort or Kahn's algorithm",
    title="Topological Sort (Kahn)",
    topic="Graph",
    difficulty="Medium",
    structure="graph",
    description="""adj is a directed acyclic graph. Return a topological order using Kahn's algorithm exactly like this:
    put every node with in-degree 0 in a FIFO queue in increasing order; repeatedly pop a node, append it, and lower the
    in-degree of its neighbours in adj order, queueing any that reach 0.""",
    constraints=GRAPH_CONSTRAINTS,
    fn="topo_sort",
    params=[("adj", "graph")],
    ret="array",
    ref="""
from collections import deque


def topo_sort(adj):
    indegree = [0] * len(adj)
    for row in adj:
        for nxt in row:
            indegree[nxt] += 1
    queue = deque(node for node in range(len(adj)) if indegree[node] == 0)
    order = []
    while queue:
        node = queue.popleft()
        order.append(node)
        for nxt in adj[node]:
            indegree[nxt] -= 1
            if indegree[nxt] == 0:
                queue.append(nxt)
    return order
""",
    examples=[({"adj": [[], [], [3], [1], [0, 1], [0, 2]]}, [4, 5, 0, 2, 3, 1]), ({"adj": [[1], [2], []]}, [0, 1, 2])],
    tests=[{"adj": [[]]}, {"adj": [[], [], []]}, {"adj": BIG_DAG}],
)

problem(
    id="eventual-safe-states",
    source="Find eventual safe states",
    title="Eventual Safe States",
    topic="Graph",
    difficulty="Medium",
    structure="graph",
    description="""adj is a directed graph. A node is safe when every path starting from it ends at a node with no
    outgoing edges. Return all safe nodes in increasing order. Reverse the edges and run Kahn's algorithm from the
    terminal nodes.""",
    constraints=GRAPH_CONSTRAINTS,
    fn="eventual_safe_nodes",
    params=[("adj", "graph")],
    ret="array",
    ref="""
from collections import deque


def eventual_safe_nodes(adj):
    n = len(adj)
    reverse = [[] for _ in range(n)]
    outdegree = [len(row) for row in adj]
    for node in range(n):
        for nxt in adj[node]:
            reverse[nxt].append(node)
    queue = deque(node for node in range(n) if outdegree[node] == 0)
    safe = []
    while queue:
        node = queue.popleft()
        safe.append(node)
        for prev in reverse[node]:
            outdegree[prev] -= 1
            if outdegree[prev] == 0:
                queue.append(prev)
    return sorted(safe)
""",
    examples=[({"adj": [[1, 2], [2, 3], [5], [0], [5], [], []]}, [2, 4, 5, 6]), ({"adj": [[1, 2, 3, 4], [1, 2], [3, 4], [0, 4], []]}, [4])],
    tests=[{"adj": [[]]}, {"adj": [[0]]}, {"adj": BIG_DAG}, {"adj": CYCLIC_DIRECTED}],
)

problem(
    id="course-schedule",
    source="Course Schedule I",
    title="Course Schedule",
    topic="Graph",
    difficulty="Medium",
    structure="graph",
    description="""There are n courses. Each pair [a, b] in prerequisites means course b must be taken before course a.
    Return whether all courses can be finished, i.e. whether the prerequisite graph has no cycle.""",
    constraints=["1 <= n <= 2000", "0 <= prerequisites.length <= 5000"],
    fn="can_finish",
    params=[("n", "int"), ("prerequisites", "matrix")],
    ret="bool",
    ref="""
from collections import deque


def can_finish(n, prerequisites):
    adj = [[] for _ in range(n)]
    indegree = [0] * n
    for course, before in prerequisites:
        adj[before].append(course)
        indegree[course] += 1
    queue = deque(node for node in range(n) if indegree[node] == 0)
    taken = 0
    while queue:
        node = queue.popleft()
        taken += 1
        for nxt in adj[node]:
            indegree[nxt] -= 1
            if indegree[nxt] == 0:
                queue.append(nxt)
    return taken == n
""",
    examples=[({"n": 2, "prerequisites": [[1, 0]]}, True), ({"n": 2, "prerequisites": [[1, 0], [0, 1]]}, False)],
    tests=[
        {"n": 1, "prerequisites": []},
        {"n": 50, "prerequisites": [[v, u] for u, v in DAG_EDGES]},
        {"n": 50, "prerequisites": [[v, u] for u, v in DAG_EDGES] + [[DAG_EDGES[0][0], DAG_EDGES[0][1]]]},
    ],
)

problem(
    id="course-schedule-ii",
    source="Course Schedule II",
    title="Course Schedule II",
    topic="Graph",
    difficulty="Medium",
    structure="graph",
    description="""Same setup as Course Schedule: [a, b] means b comes before a. Return an order to take all n courses,
    or an empty list if it is impossible. Many orders can be valid, so return the one that is smallest when compared
    position by position: always take the lowest-numbered course that is available (Kahn's algorithm with a
    min-heap).""",
    constraints=["1 <= n <= 2000", "0 <= prerequisites.length <= n * (n - 1)"],
    fn="find_order",
    params=[("n", "int"), ("prerequisites", "matrix")],
    ret="array",
    ref="""
import heapq


def find_order(n, prerequisites):
    adj = [[] for _ in range(n)]
    indegree = [0] * n
    for course, before in prerequisites:
        adj[before].append(course)
        indegree[course] += 1
    heap = [node for node in range(n) if indegree[node] == 0]
    heapq.heapify(heap)
    order = []
    while heap:
        node = heapq.heappop(heap)
        order.append(node)
        for nxt in adj[node]:
            indegree[nxt] -= 1
            if indegree[nxt] == 0:
                heapq.heappush(heap, nxt)
    return order if len(order) == n else []
""",
    examples=[({"n": 4, "prerequisites": [[1, 0], [2, 0], [3, 1], [3, 2]]}, [0, 1, 2, 3]), ({"n": 2, "prerequisites": [[0, 1], [1, 0]]}, [])],
    tests=[
        {"n": 1, "prerequisites": []},
        {"n": 3, "prerequisites": [[0, 2]]},
        {"n": 50, "prerequisites": [[v, u] for u, v in DAG_EDGES]},
        {"n": 50, "prerequisites": [[v, u] for u, v in DAG_EDGES] + [[DAG_EDGES[0][0], DAG_EDGES[0][1]]]},
    ],
)

problem(
    id="alien-dictionary",
    source="Alien Dictionary",
    title="Alien Dictionary",
    topic="Graph",
    difficulty="Hard",
    structure="graph",
    description="""words is sorted by an unknown alphabet over lowercase letters. Return an ordering of the letters that
    appear in words, consistent with that sort. Compare neighbouring words: their first differing letters give an
    edge. If several orderings fit, return the one that always takes the alphabetically smallest available letter. If
    no ordering fits (a cycle, or a word placed before its own prefix), return "".""",
    constraints=["1 <= words.length <= 100", "1 <= words[i].length <= 100"],
    fn="alien_order",
    params=[("words", "string_array")],
    ret="string",
    ref="""
import heapq


def alien_order(words):
    letters = sorted({char for word in words for char in word})
    adj = {char: set() for char in letters}
    indegree = {char: 0 for char in letters}
    for first, second in zip(words, words[1:]):
        for a, b in zip(first, second):
            if a != b:
                if b not in adj[a]:
                    adj[a].add(b)
                    indegree[b] += 1
                break
        else:
            if len(first) > len(second):
                return ""
    heap = [char for char in letters if indegree[char] == 0]
    heapq.heapify(heap)
    order = []
    while heap:
        char = heapq.heappop(heap)
        order.append(char)
        for nxt in adj[char]:
            indegree[nxt] -= 1
            if indegree[nxt] == 0:
                heapq.heappush(heap, nxt)
    return "".join(order) if len(order) == len(letters) else ""
""",
    examples=[({"words": ["baa", "abcd", "abca", "cab", "cad"]}, "bdac"), ({"words": ["z", "x", "z"]}, "")],
    tests=[{"words": ["abc", "ab"]}, {"words": ["wrt", "wrf", "er", "ett", "rftt"]}, {"words": ["z", "z"]}, {"words": ["zy", "zx", "yz", "yx", "xz"]}],
)

# ---------------------------------------------------------------- unweighted / DAG shortest paths

problem(
    id="shortest-path-dag",
    source="Shortest path in DAG",
    title="Shortest Paths in a DAG",
    topic="Graph",
    difficulty="Medium",
    structure="graph",
    description="""The directed acyclic graph has n nodes and weighted edges [u, v, w]. Return the shortest distance from
    node 0 to every node, with -1 for unreachable nodes. Relax edges in topological order.""",
    constraints=["1 <= n <= 100", "1 <= w <= 10^4"],
    fn="shortest_path_dag",
    params=[("n", "int"), ("edges", "matrix")],
    ret="array",
    ref="""
def shortest_path_dag(n, edges):
    adj = [[] for _ in range(n)]
    for u, v, w in edges:
        adj[u].append((v, w))
    order = []
    seen = [False] * n

    def visit(node):
        seen[node] = True
        for nxt, _ in adj[node]:
            if not seen[nxt]:
                visit(nxt)
        order.append(node)

    for node in range(n):
        if not seen[node]:
            visit(node)
    dist = [None] * n
    dist[0] = 0
    for node in reversed(order):
        if dist[node] is None:
            continue
        for nxt, w in adj[node]:
            if dist[nxt] is None or dist[node] + w < dist[nxt]:
                dist[nxt] = dist[node] + w
    return [-1 if d is None else d for d in dist]
""",
    examples=[
        ({"n": 4, "edges": [[0, 1, 2], [0, 2, 1]]}, [0, 2, 1, -1]),
        ({"n": 6, "edges": [[0, 1, 2], [0, 4, 1], [4, 5, 4], [4, 2, 2], [1, 2, 3], [2, 3, 6], [5, 3, 1]]}, [0, 2, 3, 6, 1, 5]),
    ],
    tests=[{"n": 1, "edges": []}, {"n": 50, "edges": random_dag(50, 150, seed=53, weights=(1, 100))}, {"n": 5, "edges": [[1, 2, 1], [2, 3, 1]]}],
)

problem(
    id="shortest-path-unit-weights",
    source="Shortest path in undirected graph with unit weights",
    title="Shortest Paths with Unit Weights",
    topic="Graph",
    difficulty="Medium",
    structure="graph",
    description="""The undirected graph has n nodes and edges of length 1. Return the shortest distance from src to every
    node, using -1 when a node cannot be reached. A plain BFS finds them.""",
    constraints=["1 <= n <= 10^4"],
    fn="shortest_path_unit",
    params=[("n", "int"), ("edges", "matrix"), ("src", "int")],
    ret="array",
    ref="""
from collections import deque


def shortest_path_unit(n, edges, src):
    adj = [[] for _ in range(n)]
    for u, v in edges:
        adj[u].append(v)
        adj[v].append(u)
    dist = [-1] * n
    dist[src] = 0
    queue = deque([src])
    while queue:
        node = queue.popleft()
        for nxt in adj[node]:
            if dist[nxt] == -1:
                dist[nxt] = dist[node] + 1
                queue.append(nxt)
    return dist
""",
    examples=[
        ({"n": 9, "edges": [[0, 1], [0, 3], [3, 4], [4, 5], [5, 6], [1, 2], [2, 6], [6, 7], [7, 8], [6, 8]], "src": 0}, [0, 1, 2, 1, 2, 3, 3, 4, 4]),
        ({"n": 4, "edges": [[0, 1]], "src": 3}, [-1, -1, -1, 0]),
    ],
    tests=[{"n": 1, "edges": [], "src": 0}, {"n": 60, "edges": random_edges(60, 70, seed=41), "src": 7}, {"n": 300, "edges": random_edges(300, 600, seed=54), "src": 0}],
)

problem(
    id="word-ladder",
    source="Word ladder I",
    title="Word Ladder",
    topic="Graph",
    difficulty="Hard",
    structure="graph",
    description="""Change begin_word into end_word one letter at a time, where every intermediate word must be in
    word_list. Return the number of words in the shortest such sequence (counting both ends), or 0 if none exists.
    BFS over words, trying every letter at every position.""",
    constraints=["1 <= word length <= 10", "1 <= word_list.length <= 5000", "All words are lowercase and the same length."],
    fn="ladder_length",
    params=[("begin_word", "string"), ("end_word", "string"), ("word_list", "string_array")],
    ret="int",
    ref="""
from collections import deque


def ladder_length(begin_word, end_word, word_list):
    words = set(word_list)
    if end_word not in words:
        return 0
    queue = deque([(begin_word, 1)])
    words.discard(begin_word)
    while queue:
        word, steps = queue.popleft()
        if word == end_word:
            return steps
        for index in range(len(word)):
            for letter in "abcdefghijklmnopqrstuvwxyz":
                candidate = word[:index] + letter + word[index + 1:]
                if candidate in words:
                    words.remove(candidate)
                    queue.append((candidate, steps + 1))
    return 0
""",
    examples=[
        ({"begin_word": "hit", "end_word": "cog", "word_list": ["hot", "dot", "dog", "lot", "log", "cog"]}, 5),
        ({"begin_word": "hit", "end_word": "cog", "word_list": ["hot", "dot", "dog", "lot", "log"]}, 0),
    ],
    tests=[
        {"begin_word": "a", "end_word": "c", "word_list": ["a", "b", "c"]},
        {"begin_word": "abc", "end_word": "abc", "word_list": ["abc"]},
        {"begin_word": "aaaa", "end_word": "dddd", "word_list": [a + b + c + d for a in "abcd" for b in "abcd" for c in "abcd" for d in "abcd"]},
        {"begin_word": "red", "end_word": "tax", "word_list": ["ted", "tex", "red", "tax", "tad", "den", "rex", "pee"]},
    ],
)

problem(
    id="word-ladder-ii",
    source="Word ladder II",
    title="Word Ladder II",
    topic="Graph",
    difficulty="Hard",
    structure="graph",
    description="""Same rules as Word Ladder, but return every shortest transformation sequence from begin_word to
    end_word (each as a list of words), in any order, or an empty list if there is none. BFS level by level to record
    parents, then backtrack from end_word.""",
    constraints=["1 <= word length <= 5", "1 <= word_list.length <= 500"],
    fn="find_ladders",
    params=[("begin_word", "string"), ("end_word", "string"), ("word_list", "string_array")],
    ret="string_matrix",
    compare="unordered",
    ref="""
def find_ladders(begin_word, end_word, word_list):
    words = set(word_list)
    if end_word not in words:
        return []
    parents = {begin_word: []}
    level = {begin_word}
    words.discard(begin_word)
    found = False
    while level and not found:
        next_level = {}
        for word in level:
            for index in range(len(word)):
                for letter in "abcdefghijklmnopqrstuvwxyz":
                    candidate = word[:index] + letter + word[index + 1:]
                    if candidate in words:
                        next_level.setdefault(candidate, []).append(word)
                        if candidate == end_word:
                            found = True
        words -= set(next_level)
        parents.update(next_level)
        level = set(next_level)
    if not found:
        return []
    paths = []

    def build(word, path):
        if word == begin_word:
            paths.append(path[::-1])
            return
        for parent in parents[word]:
            build(parent, path + [parent])

    build(end_word, [end_word])
    return paths
""",
    examples=[
        (
            {"begin_word": "hit", "end_word": "cog", "word_list": ["hot", "dot", "dog", "lot", "log", "cog"]},
            [["hit", "hot", "dot", "dog", "cog"], ["hit", "hot", "lot", "log", "cog"]],
        ),
        ({"begin_word": "hit", "end_word": "cog", "word_list": ["hot", "dot", "dog", "lot", "log"]}, []),
    ],
    tests=[
        {"begin_word": "a", "end_word": "c", "word_list": ["a", "b", "c"]},
        {"begin_word": "aaa", "end_word": "ccc", "word_list": [a + b + c for a in "abc" for b in "abc" for c in "abc"]},
        {"begin_word": "red", "end_word": "tax", "word_list": ["ted", "tex", "red", "tax", "tad", "den", "rex", "pee"]},
    ],
)
