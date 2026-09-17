"""Deterministic graph and grid inputs for hidden tests."""

import heapq
import random


def random_edges(n, m, seed, weights=None, directed=False, connected=False):
    """m distinct edges on n nodes, no self loops. weights=(lo, hi) adds a weight column."""
    rng = random.Random(seed)
    seen = set()
    edges = []

    def add(u, v):
        key = (u, v) if directed else (min(u, v), max(u, v))
        if u == v or key in seen:
            return False
        seen.add(key)
        edge = [u, v]
        if weights:
            edge.append(rng.randint(*weights))
        edges.append(edge)
        return True

    if connected:
        order = list(range(n))
        rng.shuffle(order)
        for index in range(1, n):
            add(order[rng.randrange(index)], order[index])
    limit = n * (n - 1) // (1 if directed else 2)
    m = min(m, limit)
    while len(edges) < m:
        add(rng.randrange(n), rng.randrange(n))
    return edges


def adjacency(n, edges, directed=False):
    adj = [[] for _ in range(n)]
    for edge in edges:
        u, v = edge[0], edge[1]
        adj[u].append(v)
        if not directed:
            adj[v].append(u)
    for row in adj:
        row.sort()
    return adj


def random_dag(n, m, seed, weights=None):
    rng = random.Random(seed)
    order = list(range(n))
    rng.shuffle(order)
    edges = random_edges(n, m, seed + 1, weights=weights)
    rank = {node: index for index, node in enumerate(order)}
    result = []
    for edge in edges:
        u, v = edge[0], edge[1]
        if rank[u] > rank[v]:
            u, v = v, u
        result.append([u, v] + edge[2:])
    return result


def random_grid(rows, cols, seed, values=(0, 1), weights=None):
    rng = random.Random(seed)
    return [[rng.choices(values, weights=weights)[0] for _ in range(cols)] for _ in range(rows)]


def unique_shortest_paths(n, edges, source):
    """True when every reachable node has exactly one shortest path from source (undirected)."""
    adj = [[] for _ in range(n)]
    for u, v, w in edges:
        adj[u].append((v, w))
        adj[v].append((u, w))
    dist = [None] * n
    ways = [0] * n
    dist[source] = 0
    ways[source] = 1
    heap = [(0, source)]
    done = set()
    while heap:
        d, u = heapq.heappop(heap)
        if u in done:
            continue
        done.add(u)
        for v, w in adj[u]:
            if dist[v] is None or d + w < dist[v]:
                dist[v] = d + w
                ways[v] = ways[u]
                heapq.heappush(heap, (dist[v], v))
            elif d + w == dist[v]:
                ways[v] += ways[u]
    return all(count <= 1 for count in ways)
