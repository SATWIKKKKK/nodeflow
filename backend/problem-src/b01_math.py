from dsl import problem

problem(
    id="count-digits",
    source="Count all Digits of a Number",
    title="Count the Digits",
    topic="Math",
    difficulty="Easy",
    structure="number",
    description="""Given a non-negative integer n, return how many digits it has when written in base 10.
    Watch the number shrink one digit at a time as you divide it by 10.""",
    constraints=["0 <= n <= 10^9", "0 has one digit."],
    fn="count_digits",
    params=[("n", "int")],
    ret="int",
    ref="""
def count_digits(n):
    if n == 0:
        return 1
    count = 0
    while n > 0:
        n //= 10
        count += 1
    return count
""",
    examples=[({"n": 4096}, 4, "4096 → 409 → 40 → 4 → 0 takes four divisions."), ({"n": 0}, 1)],
    tests=[{"n": 7}, {"n": 10}, {"n": 999999999}, {"n": 1000000000}],
)

problem(
    id="count-odd-digits",
    source="Count number of odd digits in a number",
    title="Count the Odd Digits",
    topic="Math",
    difficulty="Easy",
    structure="number",
    description="""Given a non-negative integer n, return how many of its digits are odd (1, 3, 5, 7 or 9).""",
    constraints=["0 <= n <= 10^9"],
    fn="count_odd_digits",
    params=[("n", "int")],
    ret="int",
    ref="""
def count_odd_digits(n):
    odd = 0
    while n > 0:
        digit = n % 10
        if digit % 2 == 1:
            odd += 1
        n //= 10
    return odd
""",
    examples=[({"n": 5623}, 2, "5 and 3 are odd."), ({"n": 2048}, 0)],
    tests=[{"n": 0}, {"n": 13579}, {"n": 1000000001}, {"n": 7}],
)

problem(
    id="reverse-number",
    source="Reverse a number",
    title="Reverse a Number",
    topic="Math",
    difficulty="Easy",
    structure="number",
    description="""Given a non-negative integer n, return the number formed by its digits in reverse order.
    Leading zeros in the result disappear, so 1200 becomes 21.""",
    constraints=["0 <= n <= 10^9"],
    fn="reverse_number",
    params=[("n", "int")],
    ret="long",
    ref="""
def reverse_number(n):
    reversed_value = 0
    while n > 0:
        reversed_value = reversed_value * 10 + n % 10
        n //= 10
    return reversed_value
""",
    examples=[({"n": 1234}, 4321), ({"n": 1200}, 21, "The trailing zeros become leading zeros and drop off.")],
    tests=[{"n": 0}, {"n": 7}, {"n": 1000000000}, {"n": 987654321}],
)

problem(
    id="palindrome-number",
    source="Palindrome Number",
    title="Palindrome Number",
    topic="Math",
    difficulty="Easy",
    structure="number",
    description="""Return true if the integer n reads the same forwards and backwards, and false otherwise.
    Negative numbers are never palindromes because of the minus sign. Solve it without converting n to a string.""",
    constraints=["-10^9 <= n <= 10^9"],
    fn="is_palindrome_number",
    params=[("n", "int")],
    ret="bool",
    ref="""
def is_palindrome_number(n):
    if n < 0:
        return False
    original = n
    reversed_value = 0
    while n > 0:
        reversed_value = reversed_value * 10 + n % 10
        n //= 10
    return reversed_value == original
""",
    examples=[({"n": 12321}, True), ({"n": -121}, False, "The minus sign only appears on the left."), ({"n": 10}, False)],
    tests=[{"n": 0}, {"n": 7}, {"n": 123321}, {"n": 1000000001}, {"n": 123}],
)

problem(
    id="largest-digit",
    source="Return the Largest Digit in a Number",
    title="Largest Digit",
    topic="Math",
    difficulty="Easy",
    structure="number",
    description="""Given a non-negative integer n, return its largest digit.""",
    constraints=["0 <= n <= 10^9"],
    fn="largest_digit",
    params=[("n", "int")],
    ret="int",
    ref="""
def largest_digit(n):
    best = 0
    while n > 0:
        best = max(best, n % 10)
        n //= 10
    return best
""",
    examples=[({"n": 25843}, 8), ({"n": 0}, 0)],
    tests=[{"n": 11111}, {"n": 90000}, {"n": 123456789}, {"n": 5}],
)

problem(
    id="factorial",
    source="Factorial of a given number",
    title="Factorial",
    topic="Math",
    difficulty="Easy",
    structure="number",
    description="""Return n!, the product of every integer from 1 to n. By definition 0! is 1.""",
    constraints=["0 <= n <= 20", "The answer fits in a 64-bit integer."],
    fn="factorial",
    params=[("n", "int")],
    ret="long",
    ref="""
def factorial(n):
    result = 1
    for value in range(2, n + 1):
        result *= value
    return result
""",
    examples=[({"n": 5}, 120, "1 × 2 × 3 × 4 × 5"), ({"n": 0}, 1)],
    tests=[{"n": 1}, {"n": 10}, {"n": 20}, {"n": 13}],
)

problem(
    id="armstrong-number",
    source="Check if the Number is Armstrong",
    title="Armstrong Number",
    topic="Math",
    difficulty="Easy",
    structure="number",
    description="""A number with k digits is an Armstrong number when the sum of each digit raised to the power k
    equals the number itself. Return whether n is an Armstrong number.""",
    constraints=["0 <= n <= 10^9"],
    fn="is_armstrong",
    params=[("n", "int")],
    ret="bool",
    ref="""
def is_armstrong(n):
    digits = len(str(n))
    total = 0
    value = n
    while value > 0:
        total += (value % 10) ** digits
        value //= 10
    return total == n
""",
    examples=[({"n": 153}, True, "1³ + 5³ + 3³ = 153"), ({"n": 154}, False)],
    tests=[{"n": 0}, {"n": 9}, {"n": 9474}, {"n": 9475}, {"n": 370}],
)

problem(
    id="perfect-number",
    source="Check for Perfect Number",
    title="Perfect Number",
    topic="Math",
    difficulty="Easy",
    structure="number",
    description="""A perfect number equals the sum of its proper divisors (every positive divisor except itself).
    Return whether n is perfect. Checking divisors only up to √n keeps it fast.""",
    constraints=["1 <= n <= 10^9"],
    fn="is_perfect",
    params=[("n", "int")],
    ret="bool",
    ref="""
def is_perfect(n):
    if n < 2:
        return False
    total = 1
    d = 2
    while d * d <= n:
        if n % d == 0:
            total += d
            if d != n // d:
                total += n // d
        d += 1
    return total == n
""",
    examples=[({"n": 28}, True, "1 + 2 + 4 + 7 + 14 = 28"), ({"n": 12}, False)],
    tests=[{"n": 1}, {"n": 6}, {"n": 496}, {"n": 8128}, {"n": 33550336}, {"n": 999999937}],
)

problem(
    id="prime-check",
    source="Check for Prime Number",
    title="Is It Prime?",
    topic="Math",
    difficulty="Easy",
    structure="number",
    description="""Return whether n is prime: greater than 1 and divisible only by 1 and itself.""",
    constraints=["1 <= n <= 10^9"],
    fn="is_prime",
    params=[("n", "int")],
    ret="bool",
    ref="""
def is_prime(n):
    if n < 2:
        return False
    d = 2
    while d * d <= n:
        if n % d == 0:
            return False
        d += 1
    return True
""",
    examples=[({"n": 29}, True), ({"n": 91}, False, "91 = 7 × 13")],
    tests=[{"n": 1}, {"n": 2}, {"n": 4}, {"n": 999999937}, {"n": 1000000000}],
)

problem(
    id="count-primes-up-to-n",
    source="Count of Prime Numbers till N",
    title="Count Primes up to N",
    topic="Math",
    difficulty="Medium",
    structure="array",
    description="""Return how many prime numbers p satisfy 2 <= p <= n. A sieve that crosses out multiples in a
    boolean array is the classic approach.""",
    constraints=["0 <= n <= 10^5"],
    fn="count_primes",
    params=[("n", "int")],
    ret="int",
    ref="""
def count_primes(n):
    if n < 2:
        return 0
    is_prime = [True] * (n + 1)
    is_prime[0] = is_prime[1] = False
    p = 2
    while p * p <= n:
        if is_prime[p]:
            for multiple in range(p * p, n + 1, p):
                is_prime[multiple] = False
        p += 1
    return sum(1 for flag in is_prime if flag)
""",
    examples=[({"n": 10}, 4, "2, 3, 5 and 7"), ({"n": 1}, 0)],
    tests=[{"n": 2}, {"n": 30}, {"n": 100}, {"n": 100000}],
)

problem(
    id="gcd-two-numbers",
    source="GCD of Two Numbers",
    title="Greatest Common Divisor",
    topic="Math",
    difficulty="Easy",
    structure="number",
    description="""Return the greatest common divisor of two positive integers a and b. Euclid's algorithm
    replaces (a, b) with (b, a mod b) until b is zero.""",
    constraints=["1 <= a, b <= 10^9"],
    fn="gcd",
    params=[("a", "int"), ("b", "int")],
    ret="int",
    ref="""
def gcd(a, b):
    while b:
        a, b = b, a % b
    return a
""",
    examples=[({"a": 48, "b": 18}, 6), ({"a": 7, "b": 13}, 1)],
    tests=[{"a": 1, "b": 1}, {"a": 1000000000, "b": 10}, {"a": 270, "b": 192}, {"a": 17, "b": 17}],
)

problem(
    id="lcm-two-numbers",
    source="LCM of two numbers",
    title="Least Common Multiple",
    topic="Math",
    difficulty="Easy",
    structure="number",
    description="""Return the least common multiple of two positive integers a and b. It equals a × b divided by
    their greatest common divisor.""",
    constraints=["1 <= a, b <= 10^6", "The answer fits in a 64-bit integer."],
    fn="lcm",
    params=[("a", "int"), ("b", "int")],
    ret="long",
    ref="""
def lcm(a, b):
    x, y = a, b
    while y:
        x, y = y, x % y
    return a // x * b
""",
    examples=[({"a": 4, "b": 6}, 12), ({"a": 5, "b": 7}, 35)],
    tests=[{"a": 1, "b": 1}, {"a": 1000000, "b": 999999}, {"a": 12, "b": 18}, {"a": 9, "b": 3}],
)

problem(
    id="divisors-of-number",
    source="Divisors of a Number",
    title="All Divisors",
    topic="Math",
    difficulty="Easy",
    structure="array",
    description="""Return every positive divisor of n in increasing order.""",
    constraints=["1 <= n <= 10^9"],
    fn="divisors",
    params=[("n", "int")],
    ret="array",
    ref="""
def divisors(n):
    small = []
    large = []
    d = 1
    while d * d <= n:
        if n % d == 0:
            small.append(d)
            if d != n // d:
                large.append(n // d)
        d += 1
    return small + large[::-1]
""",
    examples=[({"n": 12}, [1, 2, 3, 4, 6, 12]), ({"n": 1}, [1])],
    tests=[{"n": 36}, {"n": 97}, {"n": 1000000000}, {"n": 2}],
)

problem(
    id="primes-up-to-n",
    source="Print all primes till N",
    title="List Primes up to N",
    topic="Math",
    difficulty="Medium",
    structure="array",
    description="""Return every prime number from 2 to n (inclusive) in increasing order.""",
    constraints=["1 <= n <= 10^4"],
    fn="primes_up_to",
    params=[("n", "int")],
    ret="array",
    ref="""
def primes_up_to(n):
    if n < 2:
        return []
    sieve = [True] * (n + 1)
    sieve[0] = sieve[1] = False
    p = 2
    while p * p <= n:
        if sieve[p]:
            for multiple in range(p * p, n + 1, p):
                sieve[multiple] = False
        p += 1
    return [value for value in range(n + 1) if sieve[value]]
""",
    examples=[({"n": 20}, [2, 3, 5, 7, 11, 13, 17, 19]), ({"n": 1}, [])],
    tests=[{"n": 2}, {"n": 50}, {"n": 3}, {"n": 1000}],
)

problem(
    id="prime-factorisation",
    source="Prime factorisation of a Number",
    title="Prime Factorisation",
    topic="Math",
    difficulty="Medium",
    structure="array",
    description="""Return the prime factors of n in increasing order, repeating each factor as many times as it
    divides n. For n = 1 return an empty list.""",
    constraints=["1 <= n <= 10^9"],
    fn="prime_factors",
    params=[("n", "int")],
    ret="array",
    ref="""
def prime_factors(n):
    factors = []
    d = 2
    while d * d <= n:
        while n % d == 0:
            factors.append(d)
            n //= d
        d += 1
    if n > 1:
        factors.append(n)
    return factors
""",
    examples=[({"n": 60}, [2, 2, 3, 5]), ({"n": 13}, [13])],
    tests=[{"n": 1}, {"n": 1024}, {"n": 999999937}, {"n": 1000000000}, {"n": 360}],
)

problem(
    id="count-primes-in-ranges",
    source="Count primes in range L to R",
    title="Primes in Ranges",
    topic="Math",
    difficulty="Medium",
    structure="array",
    description="""You are given several queries, each a pair [L, R]. For every query return how many primes lie
    in the closed range from L to R. Build one sieve and a prefix count so each query is answered in constant time.""",
    constraints=["1 <= number of queries <= 1000", "1 <= L <= R <= 10^5"],
    fn="count_primes_in_ranges",
    params=[("queries", "matrix")],
    ret="array",
    ref="""
def count_primes_in_ranges(queries):
    limit = max((right for _, right in queries), default=1)
    sieve = [True] * (limit + 1)
    sieve[0] = False
    if limit >= 1:
        sieve[1] = False
    p = 2
    while p * p <= limit:
        if sieve[p]:
            for multiple in range(p * p, limit + 1, p):
                sieve[multiple] = False
        p += 1
    prefix = [0] * (limit + 1)
    for value in range(1, limit + 1):
        prefix[value] = prefix[value - 1] + (1 if sieve[value] else 0)
    return [prefix[right] - prefix[left - 1] for left, right in queries]
""",
    examples=[({"queries": [[1, 10], [10, 20]]}, [4, 4], "2, 3, 5, 7 and then 11, 13, 17, 19"), ({"queries": [[14, 16]]}, [0])],
    tests=[{"queries": [[1, 1]]}, {"queries": [[2, 2], [1, 100], [50, 60]]}, {"queries": [[1, 100000], [99990, 100000]]}],
)
