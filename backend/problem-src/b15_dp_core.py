import random

from dsl import problem

rng = random.Random(81)
HEIGHTS = [rng.randint(0, 10000) for _ in range(800)]
PRICES = [rng.randint(0, 1000) for _ in range(600)]
SMALL = [rng.randint(1, 50) for _ in range(40)]
MOD_NOTE = "Return the count modulo 1,000,000,007."

# ---------------------------------------------------------------- 1D DP

problem(
    id="climbing-stairs",
    source="Climbing stairs",
    title="Climbing Stairs",
    topic="Dynamic Programming",
    difficulty="Easy",
    structure="array",
    description="""You climb a staircase of n steps, one or two steps at a time. Return how many distinct ways reach the
    top. ways(n) = ways(n − 1) + ways(n − 2).""",
    constraints=["1 <= n <= 45"],
    fn="climb_stairs",
    params=[("n", "int")],
    ret="int",
    ref="""
def climb_stairs(n):
    prev, current = 1, 1
    for _ in range(n - 1):
        prev, current = current, prev + current
    return current
""",
    examples=[({"n": 2}, 2), ({"n": 3}, 3)],
    tests=[{"n": 1}, {"n": 10}, {"n": 45}],
)

problem(
    id="frog-jump",
    source="Frog Jump",
    title="Frog Jump",
    topic="Dynamic Programming",
    difficulty="Easy",
    structure="array",
    description="""A frog starts on stone 0 and wants to reach the last stone, jumping one or two stones forward each time.
    A jump from i to j costs |heights[i] − heights[j]|. Return the least total cost.""",
    constraints=["1 <= heights.length <= 10^5", "0 <= heights[i] <= 10^4"],
    fn="frog_jump",
    params=[("heights", "array")],
    ret="int",
    ref="""
def frog_jump(heights):
    prev2, prev = 0, 0
    for i in range(1, len(heights)):
        one = prev + abs(heights[i] - heights[i - 1])
        two = prev2 + abs(heights[i] - heights[i - 2]) if i > 1 else one
        prev2, prev = prev, min(one, two)
    return prev
""",
    examples=[({"heights": [2, 1, 3, 5, 4]}, 2), ({"heights": [7, 5, 1, 2, 6]}, 9)],
    tests=[{"heights": [5]}, {"heights": [10, 20]}, {"heights": HEIGHTS}],
)

problem(
    id="frog-jump-k",
    source="Frog jump with K distances",
    title="Frog Jump with K Distances",
    topic="Dynamic Programming",
    difficulty="Medium",
    structure="array",
    description="""Like Frog Jump, but each jump can move 1 to k stones forward. Return the least total cost to reach the
    last stone.""",
    constraints=["1 <= heights.length <= 10^5", "1 <= k <= 100"],
    fn="frog_jump_k",
    params=[("heights", "array"), ("k", "int")],
    ret="int",
    ref="""
def frog_jump_k(heights, k):
    n = len(heights)
    cost = [0] * n
    for i in range(1, n):
        cost[i] = min(cost[j] + abs(heights[i] - heights[j]) for j in range(max(0, i - k), i))
    return cost[-1]
""",
    examples=[({"heights": [10, 5, 20, 0, 15], "k": 2}, 15), ({"heights": [15, 4, 1, 14, 15], "k": 3}, 2)],
    tests=[{"heights": [3], "k": 4}, {"heights": HEIGHTS[:300], "k": 1}, {"heights": HEIGHTS[:500], "k": 7}],
)

problem(
    id="max-sum-non-adjacent",
    source="Maximum sum of non adjacent elements",
    title="Maximum Sum of Non-Adjacent Elements",
    topic="Dynamic Programming",
    difficulty="Medium",
    structure="array",
    description="""Pick any elements of nums, no two of them next to each other, to maximise their sum. Return that sum
    (picking nothing gives 0). At each index choose between taking it plus the best up to i − 2, or skipping it.""",
    constraints=["1 <= nums.length <= 10^5", "0 <= nums[i] <= 10^4"],
    fn="max_non_adjacent_sum",
    params=[("nums", "array")],
    ret="int",
    ref="""
def max_non_adjacent_sum(nums):
    take_prev, best_prev = 0, 0
    for value in nums:
        take_prev, best_prev = best_prev, max(best_prev, take_prev + value)
    return best_prev
""",
    examples=[({"nums": [1, 2, 4]}, 5), ({"nums": [2, 1, 4, 9]}, 11)],
    tests=[{"nums": [0]}, {"nums": [5, 5, 5, 5, 5]}, {"nums": HEIGHTS}],
)

problem(
    id="house-robber-circle",
    source="House robber",
    title="House Robber in a Circle",
    topic="Dynamic Programming",
    difficulty="Medium",
    structure="array",
    description="""Houses stand in a circle, so the first and last are neighbours. You cannot rob two neighbouring houses.
    Return the most money you can rob. Solve the line twice: once without the last house and once without the
    first.""",
    constraints=["1 <= money.length <= 10^5", "0 <= money[i] <= 1000"],
    fn="rob_circle",
    params=[("money", "array")],
    ret="int",
    ref="""
def rob_circle(money):
    def rob_line(values):
        take_prev, best_prev = 0, 0
        for value in values:
            take_prev, best_prev = best_prev, max(best_prev, take_prev + value)
        return best_prev

    if len(money) == 1:
        return money[0]
    return max(rob_line(money[:-1]), rob_line(money[1:]))
""",
    examples=[({"money": [2, 3, 2]}, 3), ({"money": [1, 2, 3, 1]}, 4), ({"money": [1, 5, 1, 2, 6]}, 11)],
    tests=[{"money": [9]}, {"money": [4, 4]}, {"money": PRICES}],
)

problem(
    id="ninja-training",
    source="Ninja's training",
    title="Ninja's Training",
    topic="Dynamic Programming",
    difficulty="Medium",
    structure="matrix",
    description="""points[day][task] is what a ninja earns for doing task 0, 1 or 2 on that day. Exactly one task is done
    per day and the same task cannot be done two days in a row. Return the most points possible.""",
    constraints=["1 <= days <= 10^5", "points[i].length == 3", "0 <= points[i][j] <= 100"],
    fn="ninja_training",
    params=[("points", "matrix")],
    ret="int",
    ref="""
def ninja_training(points):
    best = list(points[0])
    for day in points[1:]:
        best = [day[task] + max(best[other] for other in range(3) if other != task) for task in range(3)]
    return max(best)
""",
    examples=[({"points": [[10, 40, 70], [20, 50, 80], [30, 60, 90]]}, 210), ({"points": [[70, 40, 10], [180, 20, 5], [200, 60, 30]]}, 290)],
    tests=[{"points": [[1, 2, 3]]}, {"points": [[5, 5, 5]] * 20}, {"points": [[rng.randint(0, 100) for _ in range(3)] for _ in range(500)]}],
)

# ---------------------------------------------------------------- grid DP

problem(
    id="grid-unique-paths",
    source="Grid unique paths",
    title="Unique Grid Paths",
    topic="Dynamic Programming",
    difficulty="Medium",
    structure="matrix",
    description="""A robot starts at the top-left of an m × n grid and moves only right or down. Return how many
    different paths reach the bottom-right cell.""",
    constraints=["1 <= m, n <= 100", "The answer fits in a 32-bit signed integer for all tests."],
    fn="unique_paths",
    params=[("m", "int"), ("n", "int")],
    ret="int",
    ref="""
def unique_paths(m, n):
    row = [1] * n
    for _ in range(1, m):
        for col in range(1, n):
            row[col] += row[col - 1]
    return row[-1]
""",
    examples=[({"m": 3, "n": 7}, 28), ({"m": 3, "n": 2}, 3)],
    tests=[{"m": 1, "n": 1}, {"m": 1, "n": 100}, {"m": 16, "n": 16}, {"m": 10, "n": 20}],
)

problem(
    id="unique-paths-obstacles",
    source="Unique paths II",
    title="Unique Paths with Obstacles",
    topic="Dynamic Programming",
    difficulty="Medium",
    structure="matrix",
    description="""grid marks obstacles with 1. Moving only right or down, return how many paths go from the top-left to
    the bottom-right without touching an obstacle.""",
    constraints=["1 <= m, n <= 100", "The answer fits in a 32-bit signed integer for all tests."],
    fn="unique_paths_with_obstacles",
    params=[("grid", "matrix")],
    ret="int",
    ref="""
def unique_paths_with_obstacles(grid):
    cols = len(grid[0])
    row = [0] * cols
    row[0] = 1
    for line in grid:
        for col in range(cols):
            if line[col] == 1:
                row[col] = 0
            elif col > 0:
                row[col] += row[col - 1]
    return row[-1]
""",
    examples=[({"grid": [[0, 0, 0], [0, 1, 0], [0, 0, 0]]}, 2), ({"grid": [[0, 1], [0, 0]]}, 1)],
    tests=[{"grid": [[1]]}, {"grid": [[0]]}, {"grid": [[0, 0], [1, 1], [0, 0]]}, {"grid": [[1 if (r * 7 + c * 3) % 11 == 0 and (r, c) != (0, 0) else 0 for c in range(15)] for r in range(15)]}],
)

problem(
    id="min-falling-path-sum",
    source="Minimum Falling Path Sum",
    title="Minimum Falling Path Sum",
    topic="Dynamic Programming",
    difficulty="Medium",
    structure="matrix",
    description="""A falling path starts at any cell in the first row and moves to the row below, into the same column or
    one column left or right. Return the smallest possible sum of a falling path through the n × n matrix.""",
    constraints=["1 <= n <= 100", "-100 <= matrix[i][j] <= 100"],
    fn="min_falling_path_sum",
    params=[("matrix", "matrix")],
    ret="int",
    ref="""
def min_falling_path_sum(matrix):
    best = list(matrix[0])
    n = len(matrix)
    for row in matrix[1:]:
        best = [row[c] + min(best[max(c - 1, 0):min(c + 2, n)]) for c in range(n)]
    return min(best)
""",
    examples=[({"matrix": [[2, 1, 3], [6, 5, 4], [7, 8, 9]]}, 13), ({"matrix": [[-19, 57], [-40, -5]]}, -59)],
    tests=[{"matrix": [[7]]}, {"matrix": [[rng.randint(-100, 100) for _ in range(60)] for _ in range(60)]}, {"matrix": [[100] * 10 for _ in range(10)]}],
)

problem(
    id="triangle-min-path",
    source="Triangle",
    title="Triangle Minimum Path",
    topic="Dynamic Programming",
    difficulty="Medium",
    structure="matrix",
    description="""triangle[i] has i + 1 numbers. From position j in a row you may step to position j or j + 1 in the
    next row. Return the smallest sum of a path from the top to the bottom row. Work upward from the bottom.""",
    constraints=["1 <= triangle.length <= 200", "-10^4 <= triangle[i][j] <= 10^4"],
    fn="minimum_total",
    params=[("triangle", "matrix")],
    ret="int",
    ref="""
def minimum_total(triangle):
    best = list(triangle[-1])
    for row in reversed(triangle[:-1]):
        best = [row[j] + min(best[j], best[j + 1]) for j in range(len(row))]
    return best[0]
""",
    examples=[({"triangle": [[2], [3, 4], [6, 5, 7], [4, 1, 8, 3]]}, 11), ({"triangle": [[-10]]}, -10)],
    tests=[{"triangle": [[1], [2, 3]]}, {"triangle": [[rng.randint(-50, 50) for _ in range(i + 1)] for i in range(80)]}, {"triangle": [[0] * (i + 1) for i in range(30)]}],
)

problem(
    id="cherry-pickup-ii",
    source="Cherry pickup II",
    title="Cherry Pickup II",
    topic="Dynamic Programming",
    difficulty="Hard",
    structure="matrix",
    description="""Two robots start at the top row, one in the first column and one in the last. Each step both move down
    one row, and each may shift one column left, right or stay. They collect the cherries in the cells they visit, but a
    cell visited by both counts once. Return the most cherries they can collect by the bottom row.""",
    constraints=["2 <= rows, cols <= 70", "0 <= grid[i][j] <= 100"],
    fn="cherry_pickup",
    params=[("grid", "matrix")],
    ret="int",
    ref="""
def cherry_pickup(grid):
    rows, cols = len(grid), len(grid[0])
    neg = float("-inf")
    best = [[neg] * cols for _ in range(cols)]
    best[0][cols - 1] = grid[0][0] + grid[0][cols - 1]
    for r in range(1, rows):
        nxt = [[neg] * cols for _ in range(cols)]
        for a in range(cols):
            for b in range(cols):
                if best[a][b] == neg:
                    continue
                for na in (a - 1, a, a + 1):
                    for nb in (b - 1, b, b + 1):
                        if 0 <= na < cols and 0 <= nb < cols:
                            gain = grid[r][na] + (grid[r][nb] if na != nb else 0)
                            if best[a][b] + gain > nxt[na][nb]:
                                nxt[na][nb] = best[a][b] + gain
        best = nxt
    return max(max(row) for row in best)
""",
    examples=[({"grid": [[3, 1, 1], [2, 5, 1], [1, 5, 5], [2, 1, 1]]}, 24), ({"grid": [[1, 0, 0, 0, 0, 0, 1], [2, 0, 0, 0, 0, 3, 0], [2, 0, 9, 0, 0, 0, 0], [0, 3, 0, 5, 4, 0, 0], [1, 0, 2, 3, 0, 0, 6]]}, 28)],
    tests=[{"grid": [[1, 1], [1, 1]]}, {"grid": [[rng.randint(0, 100) for _ in range(20)] for _ in range(30)]}, {"grid": [[0, 9, 0]] * 5}],
)

# ---------------------------------------------------------------- stocks

problem(
    id="stock-buy-sell",
    source="Best time to buy and sell stock",
    title="Best Time to Buy and Sell Stock",
    topic="Dynamic Programming",
    difficulty="Easy",
    structure="array",
    description="""prices[i] is the stock price on day i. Buy once and sell once on a later day. Return the largest profit,
    or 0 if no trade makes money. Track the cheapest price so far.""",
    constraints=["1 <= prices.length <= 10^5", "0 <= prices[i] <= 10^4"],
    fn="max_profit",
    params=[("prices", "array")],
    ret="int",
    ref="""
def max_profit(prices):
    cheapest = prices[0]
    best = 0
    for price in prices:
        cheapest = min(cheapest, price)
        best = max(best, price - cheapest)
    return best
""",
    examples=[({"prices": [7, 1, 5, 3, 6, 4]}, 5), ({"prices": [7, 6, 4, 3, 1]}, 0)],
    tests=[{"prices": [3]}, {"prices": [1, 2]}, {"prices": PRICES}],
)

problem(
    id="stock-buy-sell-ii",
    source="Best time to buy and sell stock II",
    title="Buy and Sell Stock, Many Trades",
    topic="Dynamic Programming",
    difficulty="Medium",
    structure="array",
    description="""You may trade as many times as you like but can hold at most one share at a time. Return the largest
    total profit. Track the best result while holding and while not holding.""",
    constraints=["1 <= prices.length <= 3 * 10^4", "0 <= prices[i] <= 10^4"],
    fn="max_profit_many",
    params=[("prices", "array")],
    ret="int",
    ref="""
def max_profit_many(prices):
    free, holding = 0, -prices[0]
    for price in prices[1:]:
        free, holding = max(free, holding + price), max(holding, free - price)
    return free
""",
    examples=[({"prices": [7, 1, 5, 3, 6, 4]}, 7), ({"prices": [1, 2, 3, 4, 5]}, 4)],
    tests=[{"prices": [3]}, {"prices": [5, 4, 3]}, {"prices": PRICES}],
)

problem(
    id="stock-buy-sell-iii",
    source="Best time to buy and sell stock III",
    title="Buy and Sell Stock, Two Trades",
    topic="Dynamic Programming",
    difficulty="Hard",
    structure="array",
    description="""You may complete at most two trades (buy then sell), holding at most one share at a time. Return the
    largest total profit.""",
    constraints=["1 <= prices.length <= 10^5", "0 <= prices[i] <= 10^5"],
    fn="max_profit_two",
    params=[("prices", "array")],
    ret="int",
    ref="""
def max_profit_two(prices):
    buy1 = buy2 = float("-inf")
    sell1 = sell2 = 0
    for price in prices:
        buy1 = max(buy1, -price)
        sell1 = max(sell1, buy1 + price)
        buy2 = max(buy2, sell1 - price)
        sell2 = max(sell2, buy2 + price)
    return sell2
""",
    examples=[({"prices": [3, 3, 5, 0, 0, 3, 1, 4]}, 6), ({"prices": [1, 2, 3, 4, 5]}, 4)],
    tests=[{"prices": [1]}, {"prices": [7, 6, 4, 3, 1]}, {"prices": PRICES}],
)

problem(
    id="stock-buy-sell-iv",
    source="Best time to buy and sell stock IV",
    title="Buy and Sell Stock, K Trades",
    topic="Dynamic Programming",
    difficulty="Hard",
    structure="array",
    description="""You may complete at most k trades, holding at most one share at a time. Return the largest total
    profit. Keep a buy and a sell state for each trade number.""",
    constraints=["1 <= k <= 100", "1 <= prices.length <= 1000"],
    fn="max_profit_k",
    params=[("k", "int"), ("prices", "array")],
    ret="int",
    ref="""
def max_profit_k(k, prices):
    buy = [float("-inf")] * (k + 1)
    sell = [0] * (k + 1)
    for price in prices:
        for trade in range(1, k + 1):
            buy[trade] = max(buy[trade], sell[trade - 1] - price)
            sell[trade] = max(sell[trade], buy[trade] + price)
    return sell[k]
""",
    examples=[({"k": 2, "prices": [2, 4, 1]}, 2), ({"k": 2, "prices": [3, 2, 6, 5, 0, 3]}, 7)],
    tests=[{"k": 1, "prices": [5]}, {"k": 3, "prices": PRICES[:200]}, {"k": 100, "prices": PRICES}],
)

problem(
    id="stock-transaction-fee",
    source="Best time to buy and sell stock with transaction fees",
    title="Buy and Sell Stock with a Fee",
    topic="Dynamic Programming",
    difficulty="Medium",
    structure="array",
    description="""You may trade any number of times, holding at most one share, and each completed trade costs fee.
    Return the largest total profit.""",
    constraints=["1 <= prices.length <= 5 * 10^4", "0 <= fee <= 5 * 10^4"],
    fn="max_profit_fee",
    params=[("prices", "array"), ("fee", "int")],
    ret="int",
    ref="""
def max_profit_fee(prices, fee):
    free, holding = 0, -prices[0]
    for price in prices[1:]:
        free, holding = max(free, holding + price - fee), max(holding, free - price)
    return free
""",
    examples=[({"prices": [1, 3, 2, 8, 4, 9], "fee": 2}, 8), ({"prices": [1, 3, 7, 5, 10, 3], "fee": 3}, 6)],
    tests=[{"prices": [4], "fee": 0}, {"prices": PRICES, "fee": 0}, {"prices": PRICES, "fee": 300}],
)

# ---------------------------------------------------------------- subsets

problem(
    id="subset-sum-target",
    source="Subset sum equals to target",
    title="Subset Sum",
    topic="Dynamic Programming",
    difficulty="Medium",
    structure="array",
    description="""Return whether some subset of nums (possibly empty) adds up to exactly target. Keep a boolean table of
    reachable sums.""",
    constraints=["1 <= nums.length <= 100", "1 <= nums[i] <= 100", "0 <= target <= 10^4"],
    fn="subset_sum",
    params=[("nums", "array"), ("target", "int")],
    ret="bool",
    ref="""
def subset_sum(nums, target):
    reachable = [True] + [False] * target
    for value in nums:
        for total in range(target, value - 1, -1):
            if reachable[total - value]:
                reachable[total] = True
    return reachable[target]
""",
    examples=[({"nums": [1, 2, 7, 3], "target": 6}, True), ({"nums": [2, 3, 5], "target": 6}, False)],
    tests=[{"nums": [5], "target": 0}, {"nums": SMALL, "target": 777}, {"nums": [2] * 50, "target": 99}],
)

problem(
    id="partition-equal-subset",
    source="Partition equal subset sum",
    title="Partition into Equal Sums",
    topic="Dynamic Programming",
    difficulty="Medium",
    structure="array",
    description="""Return whether nums can be split into two groups with equal sums. That needs an even total and a subset
    summing to half of it.""",
    constraints=["1 <= nums.length <= 200", "1 <= nums[i] <= 100"],
    fn="can_partition",
    params=[("nums", "array")],
    ret="bool",
    ref="""
def can_partition(nums):
    total = sum(nums)
    if total % 2:
        return False
    half = total // 2
    reachable = [True] + [False] * half
    for value in nums:
        for s in range(half, value - 1, -1):
            if reachable[s - value]:
                reachable[s] = True
    return reachable[half]
""",
    examples=[({"nums": [1, 5, 11, 5]}, True), ({"nums": [1, 2, 3, 5]}, False)],
    tests=[{"nums": [2]}, {"nums": [1, 1]}, {"nums": SMALL + SMALL}, {"nums": SMALL + [1]}],
)

problem(
    id="partition-min-difference",
    source="Partition a set into two subsets with minimum absolute sum difference",
    title="Partition with Minimum Difference",
    topic="Dynamic Programming",
    difficulty="Hard",
    structure="array",
    description="""Split nums into two groups (either may be empty). Return the smallest possible absolute difference
    between their sums. Find every reachable subset sum and pick the one closest to half the total.""",
    constraints=["1 <= nums.length <= 100", "0 <= nums[i] <= 100"],
    fn="minimum_difference",
    params=[("nums", "array")],
    ret="int",
    ref="""
def minimum_difference(nums):
    total = sum(nums)
    reachable = [True] + [False] * total
    for value in nums:
        for s in range(total, value - 1, -1):
            if reachable[s - value]:
                reachable[s] = True
    return min(abs(total - 2 * s) for s in range(total + 1) if reachable[s])
""",
    examples=[({"nums": [1, 2, 3, 4]}, 0), ({"nums": [8, 6, 5]}, 3)],
    tests=[{"nums": [7]}, {"nums": [0, 0]}, {"nums": SMALL}, {"nums": [100, 1, 1, 1]}],
)

problem(
    id="count-subsets-sum-k",
    source="Count subsets with sum K",
    title="Count Subsets with Sum K",
    topic="Dynamic Programming",
    difficulty="Medium",
    structure="array",
    description=f"""Return how many subsets of nums (chosen by position, so equal values at different positions count as
    different) add up to k. Values can be 0. {MOD_NOTE}""",
    constraints=["1 <= nums.length <= 100", "0 <= nums[i] <= 1000", "1 <= k <= 1000"],
    fn="count_subsets",
    params=[("nums", "array"), ("k", "int")],
    ret="int",
    ref="""
def count_subsets(nums, k):
    mod = 1000000007
    ways = [1] + [0] * k
    for value in nums:
        for total in range(k, value - 1, -1):
            ways[total] = (ways[total] + ways[total - value]) % mod
    return ways[k]
""",
    examples=[({"nums": [1, 2, 2, 3], "k": 3}, 3), ({"nums": [0, 1, 3], "k": 4}, 2)],
    tests=[{"nums": [5], "k": 1}, {"nums": [1] * 100, "k": 50}, {"nums": SMALL, "k": 300}],
)

problem(
    id="count-partitions-difference",
    source="Count partitions with given difference",
    title="Count Partitions with a Given Difference",
    topic="Dynamic Programming",
    difficulty="Medium",
    structure="array",
    description=f"""Split nums into two groups S1 and S2 (by position) so that sum(S1) − sum(S2) = diff, with
    sum(S1) ≥ sum(S2). Return how many splits work. That is the number of subsets summing to (total − diff) / 2.
    {MOD_NOTE}""",
    constraints=["1 <= nums.length <= 500", "0 <= nums[i] <= 50", "0 <= diff <= 10^4"],
    fn="count_partitions",
    params=[("nums", "array"), ("diff", "int")],
    ret="int",
    ref="""
def count_partitions(nums, diff):
    mod = 1000000007
    total = sum(nums)
    if total < diff or (total - diff) % 2:
        return 0
    target = (total - diff) // 2
    ways = [1] + [0] * target
    for value in nums:
        for s in range(target, value - 1, -1):
            ways[s] = (ways[s] + ways[s - value]) % mod
    return ways[target]
""",
    examples=[({"nums": [5, 2, 6, 4], "diff": 3}, 1), ({"nums": [1, 1, 1, 1], "diff": 0}, 6)],
    tests=[{"nums": [3], "diff": 5}, {"nums": [0, 0, 1], "diff": 1}, {"nums": SMALL * 3, "diff": 40}],
)

problem(
    id="knapsack-01",
    source="0 and 1 Knapsack",
    title="0/1 Knapsack",
    topic="Dynamic Programming",
    difficulty="Medium",
    structure="array",
    description="""Item i weighs weights[i] and is worth values[i]. Each item can be taken at most once. Return the largest
    total value that fits in a bag of capacity W. Fill the table from high capacity to low so items are not reused.""",
    constraints=["1 <= n <= 1000", "1 <= W <= 1000"],
    fn="knapsack",
    params=[("weights", "array"), ("values", "array"), ("W", "int")],
    ret="int",
    ref="""
def knapsack(weights, values, W):
    best = [0] * (W + 1)
    for weight, value in zip(weights, values):
        for cap in range(W, weight - 1, -1):
            best[cap] = max(best[cap], best[cap - weight] + value)
    return best[W]
""",
    examples=[({"weights": [1, 2, 4, 5], "values": [5, 4, 8, 6], "W": 5}, 13), ({"weights": [4, 5, 1], "values": [1, 2, 3], "W": 4}, 3)],
    tests=[{"weights": [5], "values": [10], "W": 4}, {"weights": SMALL, "values": [rng.randint(1, 100) for _ in SMALL], "W": 300}, {"weights": [1] * 30, "values": list(range(30)), "W": 10}],
)

problem(
    id="minimum-coins",
    source="Minimum coins",
    title="Minimum Coins",
    topic="Dynamic Programming",
    difficulty="Medium",
    structure="array",
    description="""Each coin value can be used any number of times. Return the fewest coins that add up to amount, or -1 if
    it cannot be made.""",
    constraints=["1 <= coins.length <= 12", "1 <= coins[i] <= 2^31 - 1", "0 <= amount <= 10^4"],
    fn="coin_change",
    params=[("coins", "array"), ("amount", "int")],
    ret="int",
    ref="""
def coin_change(coins, amount):
    inf = amount + 1
    best = [0] + [inf] * amount
    for total in range(1, amount + 1):
        for coin in coins:
            if coin <= total and best[total - coin] + 1 < best[total]:
                best[total] = best[total - coin] + 1
    return -1 if best[amount] == inf else best[amount]
""",
    examples=[({"coins": [1, 2, 5], "amount": 11}, 3), ({"coins": [2], "amount": 3}, -1), ({"coins": [1], "amount": 0}, 0)],
    tests=[{"coins": [186, 419, 83, 408], "amount": 6249}, {"coins": [2147483647], "amount": 2}, {"coins": [3, 7], "amount": 10000}],
)

problem(
    id="target-sum",
    source="Target sum",
    title="Target Sum",
    topic="Dynamic Programming",
    difficulty="Medium",
    structure="array",
    description="""Put a + or − in front of every number in nums. Return how many sign choices make the expression equal
    target. It reduces to counting subsets that sum to (total + target) / 2.""",
    constraints=["1 <= nums.length <= 20", "0 <= nums[i] <= 1000", "-1000 <= target <= 1000"],
    fn="find_target_sum_ways",
    params=[("nums", "array"), ("target", "int")],
    ret="int",
    ref="""
def find_target_sum_ways(nums, target):
    total = sum(nums)
    if abs(target) > total or (total + target) % 2:
        return 0
    goal = (total + target) // 2
    ways = [1] + [0] * goal
    for value in nums:
        for s in range(goal, value - 1, -1):
            ways[s] += ways[s - value]
    return ways[goal]
""",
    examples=[({"nums": [1, 1, 1, 1, 1], "target": 3}, 5), ({"nums": [1], "target": 1}, 1)],
    tests=[{"nums": [0, 0, 1], "target": 1}, {"nums": [1] * 20, "target": 0}, {"nums": SMALL[:20], "target": -30}, {"nums": [5], "target": 3}],
)

problem(
    id="coin-change-ii",
    source="Coin change II",
    title="Coin Change II",
    topic="Dynamic Programming",
    difficulty="Medium",
    structure="array",
    description="""Each coin value can be used any number of times. Return how many different combinations (order does not
    matter) add up to amount. Loop over coins in the outer loop so each combination is counted once.""",
    constraints=["1 <= coins.length <= 300", "0 <= amount <= 5000", "The answer fits in a 32-bit signed integer."],
    fn="change",
    params=[("amount", "int"), ("coins", "array")],
    ret="int",
    ref="""
def change(amount, coins):
    ways = [1] + [0] * amount
    for coin in coins:
        for total in range(coin, amount + 1):
            ways[total] += ways[total - coin]
    return ways[amount]
""",
    examples=[({"amount": 5, "coins": [1, 2, 5]}, 4), ({"amount": 3, "coins": [2]}, 0)],
    tests=[{"amount": 0, "coins": [7]}, {"amount": 500, "coins": [3, 5, 7, 8, 9, 10, 11]}, {"amount": 100, "coins": [1, 2, 5, 10, 20, 50]}],
)

problem(
    id="unbounded-knapsack",
    source="Unbounded knapsack",
    title="Unbounded Knapsack",
    topic="Dynamic Programming",
    difficulty="Medium",
    structure="array",
    description="""Like 0/1 knapsack, but each item can be taken any number of times. Return the largest total value that
    fits in capacity W.""",
    constraints=["1 <= n <= 1000", "1 <= W <= 1000"],
    fn="unbounded_knapsack",
    params=[("weights", "array"), ("values", "array"), ("W", "int")],
    ret="int",
    ref="""
def unbounded_knapsack(weights, values, W):
    best = [0] * (W + 1)
    for cap in range(1, W + 1):
        for weight, value in zip(weights, values):
            if weight <= cap:
                best[cap] = max(best[cap], best[cap - weight] + value)
    return best[W]
""",
    examples=[({"weights": [2, 4, 6], "values": [5, 11, 13], "W": 10}, 27), ({"weights": [5, 10, 20], "values": [7, 2, 4], "W": 15}, 21)],
    tests=[{"weights": [3], "values": [4], "W": 2}, {"weights": SMALL, "values": [rng.randint(1, 100) for _ in SMALL], "W": 1000}, {"weights": [1], "values": [1], "W": 1000}],
)

problem(
    id="rod-cutting",
    source="Rod cutting problem",
    title="Rod Cutting",
    topic="Dynamic Programming",
    difficulty="Medium",
    structure="array",
    description="""A rod of length n = price.length can be cut into pieces of whole lengths; a piece of length i + 1 sells
    for price[i]. Return the most money you can make.""",
    constraints=["1 <= n <= 1000", "1 <= price[i] <= 10^5"],
    fn="cut_rod",
    params=[("price", "array")],
    ret="int",
    ref="""
def cut_rod(price):
    n = len(price)
    best = [0] * (n + 1)
    for length in range(1, n + 1):
        best[length] = max(price[piece - 1] + best[length - piece] for piece in range(1, length + 1))
    return best[n]
""",
    examples=[({"price": [1, 5, 8, 9, 10, 17, 17, 20]}, 22), ({"price": [3, 5, 8, 9, 10, 17, 17, 20]}, 24)],
    tests=[{"price": [2]}, {"price": [1, 1, 1, 100]}, {"price": [rng.randint(1, 100000) for _ in range(300)]}],
)
