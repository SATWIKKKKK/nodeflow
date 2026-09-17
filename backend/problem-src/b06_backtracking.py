from dsl import problem

SUDOKU = [
    ["5", "3", ".", ".", "7", ".", ".", ".", "."],
    ["6", ".", ".", "1", "9", "5", ".", ".", "."],
    [".", "9", "8", ".", ".", ".", ".", "6", "."],
    ["8", ".", ".", ".", "6", ".", ".", ".", "3"],
    ["4", ".", ".", "8", ".", "3", ".", ".", "1"],
    ["7", ".", ".", ".", "2", ".", ".", ".", "6"],
    [".", "6", ".", ".", ".", ".", "2", "8", "."],
    [".", ".", ".", "4", "1", "9", ".", ".", "5"],
    [".", ".", ".", ".", "8", ".", ".", "7", "9"],
]
SOLVED = [
    ["5", "3", "4", "6", "7", "8", "9", "1", "2"],
    ["6", "7", "2", "1", "9", "5", "3", "4", "8"],
    ["1", "9", "8", "3", "4", "2", "5", "6", "7"],
    ["8", "5", "9", "7", "6", "1", "4", "2", "3"],
    ["4", "2", "6", "8", "5", "3", "7", "9", "1"],
    ["7", "1", "3", "9", "2", "4", "8", "5", "6"],
    ["9", "6", "1", "5", "3", "7", "2", "8", "4"],
    ["2", "8", "7", "4", "1", "9", "6", "3", "5"],
    ["3", "4", "5", "2", "8", "6", "1", "7", "9"],
]


def blanked(cells):
    return [["." if (r, c) in cells else SOLVED[r][c] for c in range(9)] for r in range(9)]


problem(
    id="pow-x-n",
    source="Pow(x,n)",
    title="Fast Power",
    topic="Recursion",
    difficulty="Medium",
    structure="number",
    description="""Return x raised to the integer power n using binary exponentiation: x^n = (x^(n/2))² for even n.
    Negative n means 1 / x^(-n). Answers within 1e-5 are accepted.""",
    constraints=["-100 < x < 100", "-2^31 <= n <= 2^31 - 1", "The result stays within ±10^4 or rounds to 0."],
    fn="my_pow",
    params=[("x", "double"), ("n", "long")],
    ret="double",
    compare="float",
    ref="""
def my_pow(x, n):
    if n < 0:
        x = 1 / x
        n = -n
    result = 1.0
    while n > 0:
        if n % 2 == 1:
            result *= x
        x *= x
        n //= 2
    return result
""",
    examples=[({"x": 2.0, "n": 10}, 1024.0), ({"x": 2.0, "n": -2}, 0.25)],
    tests=[{"x": 2.1, "n": 3}, {"x": 1.0, "n": 2147483647}, {"x": -2.0, "n": 5}, {"x": 0.5, "n": 0}, {"x": 1.00001, "n": 123456}],
)

problem(
    id="generate-parentheses",
    source="Generate Parentheses",
    title="Generate Parentheses",
    topic="Backtracking",
    difficulty="Medium",
    structure="string",
    description="""Return every string of n pairs of well-formed parentheses, in any order. Build them character by
    character: add '(' while some remain, and ')' only while it would still close an open one.""",
    constraints=["1 <= n <= 8"],
    fn="generate_parentheses",
    params=[("n", "int")],
    ret="string_array",
    compare="unordered",
    ref="""
def generate_parentheses(n):
    result = []

    def build(current, opened, closed):
        if len(current) == 2 * n:
            result.append(current)
            return
        if opened < n:
            build(current + "(", opened + 1, closed)
        if closed < opened:
            build(current + ")", opened, closed + 1)

    build("", 0, 0)
    return result
""",
    examples=[({"n": 3}, ["((()))", "(()())", "(())()", "()(())", "()()()"]), ({"n": 1}, ["()"])],
    tests=[{"n": 2}, {"n": 4}, {"n": 8}],
)

problem(
    id="power-set",
    source="Power Set",
    title="All Subsets",
    topic="Backtracking",
    difficulty="Medium",
    structure="array",
    description="""nums has distinct values. Return all 2^n subsets. Subsets and the values inside them may be in any
    order.""",
    constraints=["1 <= nums.length <= 10", "Values are distinct."],
    fn="power_set",
    params=[("nums", "array")],
    ret="matrix",
    compare="unordered_deep",
    ref="""
def power_set(nums):
    result = []

    def choose(index, current):
        if index == len(nums):
            result.append(list(current))
            return
        current.append(nums[index])
        choose(index + 1, current)
        current.pop()
        choose(index + 1, current)

    choose(0, [])
    return result
""",
    examples=[({"nums": [1, 2]}, [[], [1], [2], [1, 2]]), ({"nums": [0]}, [[], [0]])],
    tests=[{"nums": [1, 2, 3]}, {"nums": [-1, 5, 9, 4]}, {"nums": list(range(10))}],
)

problem(
    id="subsequence-with-sum-k",
    source="Check if there exists a subsequence with sum K",
    title="Is There a Subsequence Summing to K?",
    topic="Recursion",
    difficulty="Medium",
    structure="array",
    description="""nums holds positive integers. Return whether some non-empty subsequence sums to exactly k. Explore
    take / skip for each index and stop a branch as soon as its sum passes k.""",
    constraints=["1 <= nums.length <= 20", "1 <= nums[i], k <= 10^3"],
    fn="has_subsequence_sum",
    params=[("nums", "array"), ("k", "int")],
    ret="bool",
    ref="""
def has_subsequence_sum(nums, k):
    def search(index, total):
        if total == k:
            return True
        if total > k or index == len(nums):
            return False
        return search(index + 1, total + nums[index]) or search(index + 1, total)

    return search(0, 0)
""",
    examples=[({"nums": [1, 2, 3], "k": 5}, True), ({"nums": [2, 4], "k": 5}, False)],
    tests=[{"nums": [7], "k": 7}, {"nums": [3, 34, 4, 12, 5, 2], "k": 9}, {"nums": [3, 34, 4, 12, 5, 2], "k": 30}, {"nums": [10] * 20, "k": 199}],
)

problem(
    id="count-subsequences-sum-k",
    source="Count all subsequences with sum K",
    title="Count Subsequences Summing to K",
    topic="Recursion",
    difficulty="Medium",
    structure="array",
    description="""nums holds positive integers. Return how many subsequences (chosen by index) sum to exactly k.""",
    constraints=["1 <= nums.length <= 20", "1 <= nums[i], k <= 10^3"],
    fn="count_subsequences_sum",
    params=[("nums", "array"), ("k", "int")],
    ret="int",
    ref="""
def count_subsequences_sum(nums, k):
    def count(index, total):
        if total > k:
            return 0
        if index == len(nums):
            return 1 if total == k else 0
        return count(index + 1, total + nums[index]) + count(index + 1, total)

    return count(0, 0)
""",
    examples=[({"nums": [1, 2, 1], "k": 3}, 2), ({"nums": [4, 9, 2, 5, 1], "k": 10}, 2)],
    tests=[{"nums": [5], "k": 5}, {"nums": [1, 1, 1, 1], "k": 2}, {"nums": [2, 3, 5, 6, 8, 10], "k": 10}, {"nums": [1] * 18, "k": 9}],
)

problem(
    id="combination-sum",
    source="Combination Sum",
    title="Combination Sum",
    topic="Backtracking",
    difficulty="Medium",
    structure="array",
    description="""candidates holds distinct positive integers, and each may be used any number of times. Return every
    unique combination that sums to target, in any order.""",
    constraints=["1 <= candidates.length <= 30", "2 <= candidates[i] <= 40", "1 <= target <= 40"],
    fn="combination_sum",
    params=[("candidates", "array"), ("target", "int")],
    ret="matrix",
    compare="unordered_deep",
    ref="""
def combination_sum(candidates, target):
    result = []

    def pick(index, remaining, current):
        if remaining == 0:
            result.append(list(current))
            return
        if index == len(candidates) or remaining < 0:
            return
        current.append(candidates[index])
        pick(index, remaining - candidates[index], current)
        current.pop()
        pick(index + 1, remaining, current)

    pick(0, target, [])
    return result
""",
    examples=[({"candidates": [2, 3, 6, 7], "target": 7}, [[2, 2, 3], [7]]), ({"candidates": [2], "target": 1}, [])],
    tests=[{"candidates": [2, 3, 5], "target": 8}, {"candidates": [7, 3, 2], "target": 18}, {"candidates": [8, 7, 4, 3], "target": 11}],
)

problem(
    id="combination-sum-ii",
    source="Combination Sum II",
    title="Combination Sum II",
    topic="Backtracking",
    difficulty="Medium",
    structure="array",
    description="""Each value in candidates may be used at most once, and candidates may contain duplicates. Return
    every unique combination summing to target, in any order. Sort first and skip equal values at the same depth.""",
    constraints=["1 <= candidates.length <= 100", "1 <= candidates[i] <= 50", "1 <= target <= 30"],
    fn="combination_sum2",
    params=[("candidates", "array"), ("target", "int")],
    ret="matrix",
    compare="unordered_deep",
    ref="""
def combination_sum2(candidates, target):
    candidates.sort()
    result = []

    def pick(start, remaining, current):
        if remaining == 0:
            result.append(list(current))
            return
        for index in range(start, len(candidates)):
            if index > start and candidates[index] == candidates[index - 1]:
                continue
            if candidates[index] > remaining:
                break
            current.append(candidates[index])
            pick(index + 1, remaining - candidates[index], current)
            current.pop()

    pick(0, target, [])
    return result
""",
    examples=[({"candidates": [10, 1, 2, 7, 6, 1, 5], "target": 8}, [[1, 1, 6], [1, 2, 5], [1, 7], [2, 6]]), ({"candidates": [2, 5, 2, 1, 2], "target": 5}, [[1, 2, 2], [5]])],
    tests=[{"candidates": [1], "target": 2}, {"candidates": [1] * 30, "target": 5}, {"candidates": [3, 1, 3, 5, 1, 1], "target": 8}],
)

problem(
    id="subset-sums",
    source="Subsets I",
    title="All Subset Sums",
    topic="Recursion",
    difficulty="Medium",
    structure="array",
    description="""Return the sums of all 2^n subsets of nums (the empty subset contributes 0), sorted ascending.""",
    constraints=["1 <= nums.length <= 15", "0 <= nums[i] <= 10^4"],
    fn="subset_sums",
    params=[("nums", "array")],
    ret="array",
    ref="""
def subset_sums(nums):
    sums = []

    def walk(index, total):
        if index == len(nums):
            sums.append(total)
            return
        walk(index + 1, total + nums[index])
        walk(index + 1, total)

    walk(0, 0)
    return sorted(sums)
""",
    examples=[({"nums": [2, 3]}, [0, 2, 3, 5]), ({"nums": [5]}, [0, 5])],
    tests=[{"nums": [5, 2, 1]}, {"nums": [0, 0]}, {"nums": [3, 1, 4, 1, 5, 9, 2, 6, 5, 3, 5, 8]}],
)

problem(
    id="subsets-with-duplicates",
    source="Subsets II",
    title="Subsets with Duplicates",
    topic="Backtracking",
    difficulty="Medium",
    structure="array",
    description="""nums may contain duplicates. Return every distinct subset (as a multiset of values), in any order.""",
    constraints=["1 <= nums.length <= 10", "-10 <= nums[i] <= 10"],
    fn="subsets_with_dup",
    params=[("nums", "array")],
    ret="matrix",
    compare="unordered_deep",
    ref="""
def subsets_with_dup(nums):
    nums.sort()
    result = []

    def build(start, current):
        result.append(list(current))
        for index in range(start, len(nums)):
            if index > start and nums[index] == nums[index - 1]:
                continue
            current.append(nums[index])
            build(index + 1, current)
            current.pop()

    build(0, [])
    return result
""",
    examples=[({"nums": [1, 2, 2]}, [[], [1], [1, 2], [1, 2, 2], [2], [2, 2]]), ({"nums": [0]}, [[], [0]])],
    tests=[{"nums": [4, 4, 4, 1, 4]}, {"nums": [1, 2, 3]}, {"nums": [-1, 1, -1, 1, 0, 0]}],
)

problem(
    id="combination-sum-iii",
    source="Combination Sum III",
    title="Combination Sum III",
    topic="Backtracking",
    difficulty="Medium",
    structure="array",
    description="""Return every combination of k distinct numbers from 1 to 9 that adds up to n, in any order.""",
    constraints=["2 <= k <= 9", "1 <= n <= 60"],
    fn="combination_sum3",
    params=[("k", "int"), ("n", "int")],
    ret="matrix",
    compare="unordered_deep",
    ref="""
def combination_sum3(k, n):
    result = []

    def pick(start, remaining, current):
        if len(current) == k:
            if remaining == 0:
                result.append(list(current))
            return
        for value in range(start, 10):
            if value > remaining:
                break
            current.append(value)
            pick(value + 1, remaining - value, current)
            current.pop()

    pick(1, n, [])
    return result
""",
    examples=[({"k": 3, "n": 7}, [[1, 2, 4]]), ({"k": 3, "n": 9}, [[1, 2, 6], [1, 3, 5], [2, 3, 4]]), ({"k": 4, "n": 1}, [])],
    tests=[{"k": 9, "n": 45}, {"k": 2, "n": 18}, {"k": 4, "n": 20}],
)

problem(
    id="letter-combinations",
    source="Letter Combinations of a Phone Number",
    title="Phone Keypad Combinations",
    topic="Backtracking",
    difficulty="Medium",
    structure="string",
    description="""Each digit from 2 to 9 maps to letters as on a phone keypad (2 → abc, ..., 7 → pqrs, 9 → wxyz). Return
    every string the digits could spell, in any order. An empty input gives an empty list.""",
    constraints=["0 <= digits.length <= 4", "digits[i] is between '2' and '9'."],
    fn="letter_combinations",
    params=[("digits", "string")],
    ret="string_array",
    compare="unordered",
    ref="""
def letter_combinations(digits):
    keypad = {"2": "abc", "3": "def", "4": "ghi", "5": "jkl", "6": "mno", "7": "pqrs", "8": "tuv", "9": "wxyz"}
    if not digits:
        return []
    result = []

    def spell(index, current):
        if index == len(digits):
            result.append(current)
            return
        for letter in keypad[digits[index]]:
            spell(index + 1, current + letter)

    spell(0, "")
    return result
""",
    examples=[({"digits": "23"}, ["ad", "ae", "af", "bd", "be", "bf", "cd", "ce", "cf"]), ({"digits": ""}, [])],
    tests=[{"digits": "2"}, {"digits": "79"}, {"digits": "9999"}],
)

problem(
    id="palindrome-partitioning",
    source="Palindrome partitioning",
    title="Palindrome Partitioning",
    topic="Backtracking",
    difficulty="Medium",
    structure="string",
    description="""Split s into pieces so that every piece is a palindrome. Return every such split (each as the list of
    pieces in order); the splits may be listed in any order.""",
    constraints=["1 <= s.length <= 12", "Lowercase English letters."],
    fn="partition_palindromes",
    params=[("s", "string")],
    ret="string_matrix",
    compare="unordered",
    ref="""
def partition_palindromes(s):
    result = []

    def split(start, pieces):
        if start == len(s):
            result.append(list(pieces))
            return
        for end in range(start + 1, len(s) + 1):
            piece = s[start:end]
            if piece == piece[::-1]:
                pieces.append(piece)
                split(end, pieces)
                pieces.pop()

    split(0, [])
    return result
""",
    examples=[({"s": "aab"}, [["a", "a", "b"], ["aa", "b"]]), ({"s": "a"}, [["a"]])],
    tests=[{"s": "abba"}, {"s": "racecar"}, {"s": "aaaaaaaa"}],
)

problem(
    id="word-search",
    source="Word Search",
    title="Word Search",
    topic="Backtracking",
    difficulty="Medium",
    structure="matrix",
    description="""Return whether word can be traced through board by moving between horizontally or vertically
    adjacent cells, using each cell at most once.""",
    constraints=["1 <= rows, cols <= 6", "1 <= word.length <= 15", "Letters only."],
    fn="exist",
    params=[("board", "char_matrix"), ("word", "string")],
    ret="bool",
    ref="""
def exist(board, word):
    rows, cols = len(board), len(board[0])

    def trace(r, c, index):
        if index == len(word):
            return True
        if r < 0 or c < 0 or r >= rows or c >= cols or board[r][c] != word[index]:
            return False
        saved = board[r][c]
        board[r][c] = "#"
        found = (trace(r + 1, c, index + 1) or trace(r - 1, c, index + 1)
                 or trace(r, c + 1, index + 1) or trace(r, c - 1, index + 1))
        board[r][c] = saved
        return found

    return any(trace(r, c, 0) for r in range(rows) for c in range(cols))
""",
    examples=[
        ({"board": [["A", "B", "C", "E"], ["S", "F", "C", "S"], ["A", "D", "E", "E"]], "word": "ABCCED"}, True),
        ({"board": [["A", "B", "C", "E"], ["S", "F", "C", "S"], ["A", "D", "E", "E"]], "word": "ABCB"}, False),
    ],
    tests=[
        {"board": [["A"]], "word": "A"},
        {"board": [["A", "B", "C", "E"], ["S", "F", "C", "S"], ["A", "D", "E", "E"]], "word": "SEE"},
        {"board": [["a", "a"]], "word": "aaa"},
        {"board": [["A"] * 6 for _ in range(6)], "word": "AAAAAAAAAAAAAAB"},
    ],
)

problem(
    id="n-queens",
    source="N Queen",
    title="N-Queens",
    topic="Backtracking",
    difficulty="Hard",
    structure="matrix",
    description="""Place n queens on an n × n board so that none attack each other. Return every distinct board, each
    written as n strings where 'Q' is a queen and '.' is empty. Boards may be listed in any order.""",
    constraints=["1 <= n <= 8"],
    fn="solve_n_queens",
    params=[("n", "int")],
    ret="string_matrix",
    compare="unordered",
    ref="""
def solve_n_queens(n):
    boards = []
    columns = set()
    diagonals = set()
    anti_diagonals = set()
    placement = []

    def place(row):
        if row == n:
            boards.append(["." * col + "Q" + "." * (n - col - 1) for col in placement])
            return
        for col in range(n):
            if col in columns or row - col in diagonals or row + col in anti_diagonals:
                continue
            columns.add(col)
            diagonals.add(row - col)
            anti_diagonals.add(row + col)
            placement.append(col)
            place(row + 1)
            placement.pop()
            columns.discard(col)
            diagonals.discard(row - col)
            anti_diagonals.discard(row + col)

    place(0)
    return boards
""",
    examples=[({"n": 4}, [[".Q..", "...Q", "Q...", "..Q."], ["..Q.", "Q...", "...Q", ".Q.."]]), ({"n": 1}, [["Q"]])],
    tests=[{"n": 2}, {"n": 5}, {"n": 8}],
)

problem(
    id="rat-in-maze",
    source="Rat in a Maze",
    title="Rat in a Maze",
    topic="Backtracking",
    difficulty="Medium",
    structure="matrix",
    description="""A rat starts at the top-left of an n × n maze and must reach the bottom-right, moving up (U), down (D),
    left (L) or right (R) through cells marked 1 and never revisiting a cell. Return every path as a string of moves,
    sorted alphabetically. Return an empty list if the start or end is blocked or no path exists.""",
    constraints=["2 <= n <= 5", "maze[i][j] is 0 or 1."],
    fn="find_paths",
    params=[("maze", "matrix")],
    ret="string_array",
    ref="""
def find_paths(maze):
    n = len(maze)
    paths = []
    if maze[0][0] == 0 or maze[n - 1][n - 1] == 0:
        return paths
    visited = [[False] * n for _ in range(n)]
    moves = [("D", 1, 0), ("L", 0, -1), ("R", 0, 1), ("U", -1, 0)]

    def walk(r, c, path):
        if r == n - 1 and c == n - 1:
            paths.append(path)
            return
        visited[r][c] = True
        for letter, dr, dc in moves:
            nr, nc = r + dr, c + dc
            if 0 <= nr < n and 0 <= nc < n and maze[nr][nc] == 1 and not visited[nr][nc]:
                walk(nr, nc, path + letter)
        visited[r][c] = False

    walk(0, 0, "")
    return sorted(paths)
""",
    examples=[({"maze": [[1, 0, 0, 0], [1, 1, 0, 1], [1, 1, 0, 0], [0, 1, 1, 1]]}, ["DDRDRR", "DRDDRR"]), ({"maze": [[1, 0], [1, 0]]}, [])],
    tests=[{"maze": [[1, 1], [1, 1]]}, {"maze": [[1, 1, 1], [1, 0, 1], [1, 1, 1]]}, {"maze": [[1] * 4 for _ in range(4)]}],
)

problem(
    id="m-coloring",
    source="M Coloring Problem",
    title="Graph Coloring with M Colours",
    topic="Backtracking",
    difficulty="Medium",
    structure="graph",
    description="""An undirected graph has n vertices (0 to n - 1) and the given edges. Return whether its vertices can
    be coloured with at most m colours so that no edge joins two vertices of the same colour.""",
    constraints=["1 <= n <= 20", "1 <= m <= n", "0 <= edges.length <= n(n - 1)/2"],
    fn="graph_coloring",
    params=[("n", "int"), ("edges", "matrix"), ("m", "int")],
    ret="bool",
    ref="""
def graph_coloring(n, edges, m):
    adjacency = [[] for _ in range(n)]
    for u, v in edges:
        adjacency[u].append(v)
        adjacency[v].append(u)
    colours = [0] * n

    def paint(node):
        if node == n:
            return True
        for colour in range(1, m + 1):
            if all(colours[neighbour] != colour for neighbour in adjacency[node]):
                colours[node] = colour
                if paint(node + 1):
                    return True
                colours[node] = 0
        return False

    return paint(0)
""",
    examples=[
        ({"n": 4, "edges": [[0, 1], [1, 2], [2, 3], [3, 0], [0, 2]], "m": 3}, True),
        ({"n": 4, "edges": [[0, 1], [1, 2], [2, 3], [3, 0], [0, 2]], "m": 2}, False, "0, 1 and 2 form a triangle."),
    ],
    tests=[
        {"n": 1, "edges": [], "m": 1},
        {"n": 5, "edges": [[0, 1], [0, 2], [0, 3], [0, 4], [1, 2], [2, 3], [3, 4], [4, 1]], "m": 3},
        {"n": 4, "edges": [[0, 1], [0, 2], [0, 3], [1, 2], [1, 3], [2, 3]], "m": 3},
        {"n": 10, "edges": [[i, (i + 1) % 10] for i in range(10)], "m": 2},
    ],
)

problem(
    id="sudoku-solver",
    source="Sudoku Solver",
    title="Sudoku Solver",
    topic="Backtracking",
    difficulty="Hard",
    structure="matrix",
    description="""Fill the empty cells ('.') so that every row, column and 3 × 3 box contains the digits 1 to 9 exactly
    once, then return the board. Every puzzle here has exactly one solution.""",
    constraints=["board is 9 × 9", "Cells are digits '1'-'9' or '.'", "The puzzle has a unique solution."],
    fn="solve_sudoku",
    params=[("board", "char_matrix")],
    ret="char_matrix",
    ref="""
def solve_sudoku(board):
    def allowed(r, c, digit):
        for i in range(9):
            if board[r][i] == digit or board[i][c] == digit:
                return False
            if board[3 * (r // 3) + i // 3][3 * (c // 3) + i % 3] == digit:
                return False
        return True

    def solve():
        for r in range(9):
            for c in range(9):
                if board[r][c] == ".":
                    for digit in "123456789":
                        if allowed(r, c, digit):
                            board[r][c] = digit
                            if solve():
                                return True
                            board[r][c] = "."
                    return False
        return True

    solve()
    return board
""",
    examples=[({"board": SUDOKU}, SOLVED), ({"board": blanked({(0, 0), (4, 4), (8, 8)})}, SOLVED)],
    tests=[{"board": blanked({(0, c) for c in range(9)})}, {"board": blanked({(i, i) for i in range(9)})}, {"board": [row[:] for row in SOLVED]}],
    default_input={"board": blanked({(0, 0), (0, 1), (1, 1), (4, 4), (7, 2), (8, 8)})},
)
