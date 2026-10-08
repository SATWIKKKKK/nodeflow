import type { Badge, Difficulty, StructureType } from "@nodeflow/shared";

/**
 * Badges, worked out from a learner's submissions and coins rather than
 * stored, so every one can be explained and none can drift out of step.
 *
 * The catalogue borrows what the DSA sites have found keeps people coming
 * back, in Noesis's own terms:
 *
 *  - milestones and difficulty counts (LeetCode's solved totals),
 *  - per-topic mastery in bronze, silver and gold (HackerRank's domain stars),
 *  - streaks and active days (LeetCode's annual badges, GeeksforGeeks's
 *    problem-of-the-day streaks),
 *  - a badge for each month with 20 active days (LeetCode's monthly
 *    challenge),
 *  - performance: right first time, coming back after failing, acceptance
 *    rate, and solving in several languages,
 *  - coins earned, from solving and from the waiting game.
 *
 * The history is replayed in order, so each tier knows when it was reached.
 */

export interface BadgeSubmission {
  problemId: string;
  verdict: string;
  timestamp: string;
  language?: string;
}

export interface BadgeProblem {
  id: string;
  difficulty: Difficulty;
  structureType: StructureType;
}

export interface BadgeInput {
  /** Oldest first. */
  submissions: BadgeSubmission[];
  problems: BadgeProblem[];
  /** Coins earned (never minus losses), with when, oldest first. */
  coinEvents: Array<{ amount: number; at: string }>;
  /** Day keys ("YYYY-MM-DD") in the learner's time zone. */
  dayOf: (timestamp: string) => string;
  /** Today's key in the same zone. */
  today: string;
}

const TOPIC_NAMES: Partial<Record<StructureType, string>> = {
  array: "Arrays",
  string: "Strings",
  matrix: "Matrices",
  linked_list: "Linked Lists",
  stack: "Stacks",
  queue: "Queues",
  hashmap: "Hash Maps",
  tree: "Trees",
  heap: "Heaps",
  graph: "Graphs",
  trie: "Tries",
  number: "Numbers"
};

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
export const MONTH_DAYS = 20;

/** Tiers above what can ever be reached are dropped, so every badge can be finished. */
const reachable = (thresholds: number[], most: number) => {
  const kept = thresholds.filter((value) => value <= most);
  return kept.length ? kept : most > 0 ? [most] : [];
};

const dayNumber = (key: string) => Math.round(Date.parse(`${key}T00:00:00Z`) / 86_400_000);

/** A running count, and the moment it first reached each threshold. */
class Track {
  value = 0;
  private reached: Array<string | undefined>;

  constructor(private thresholds: number[]) {
    this.reached = thresholds.map(() => undefined);
  }

  set(value: number, at: string) {
    this.value = value;
    this.thresholds.forEach((threshold, index) => {
      if (!this.reached[index] && value >= threshold) this.reached[index] = at;
    });
  }

  badge(base: Omit<Badge, "tier" | "thresholds" | "value" | "earnedAt">): Badge {
    const tier = this.reached.filter(Boolean).length;
    return {
      ...base,
      tier,
      thresholds: this.thresholds,
      value: this.value,
      earnedAt: tier ? this.reached[tier - 1] : undefined
    };
  }
}

export const computeBadges = (input: BadgeInput): Badge[] => {
  const { submissions, problems, coinEvents, dayOf } = input;
  const byId = new Map(problems.map((problem) => [problem.id, problem]));
  const totalOf = (test: (problem: BadgeProblem) => boolean) => problems.filter(test).length;

  const hardTotal = totalOf((problem) => problem.difficulty === "Hard");
  const mediumTotal = totalOf((problem) => problem.difficulty === "Medium");

  const firstAccept = new Track([1]);
  const solver = new Track(reachable([10, 50, 100, 250], problems.length));
  const medium = new Track(reachable([10, 30, 75, 150], mediumTotal));
  const hard = new Track(reachable([1, 5, 15, 40], hardTotal));
  const streak = new Track([3, 7, 30, 100]);
  const activeDays = new Track([10, 50, 100, 200]);
  const firstTry = new Track([5, 25, 75, 150]);
  const comeback = new Track([1, 5, 15, 40]);
  const polyglot = new Track([2, 3, 4, 6]);
  const collector = new Track([50, 250, 1000, 5000]);

  const topics = Object.entries(TOPIC_NAMES)
    .map(([type, label]) => {
      const total = totalOf((problem) => problem.structureType === type);
      return { type: type as StructureType, label: label!, total, track: new Track(reachable([Math.ceil(total / 4), Math.ceil(total / 2), total], total)) };
    })
    .filter((topic) => topic.total >= 4);

  // Acceptance needs enough submissions to mean something: each tier asks
  // for a higher rate over a longer record.
  const sharpshooterNeeds = [
    { rate: 50, over: 20 },
    { rate: 65, over: 50 },
    { rate: 80, over: 100 }
  ];
  const sharpshooterAt: Array<string | undefined> = sharpshooterNeeds.map(() => undefined);

  const solved = new Set<string>();
  const tried = new Map<string, number>();
  const languages = new Set<string>();
  const days = new Set<string>();
  const monthDays = new Map<string, Set<string>>();
  const monthEarned = new Map<string, string>();
  const topicSolved = new Map<StructureType, number>();
  let run = 0;
  let longest = 0;
  let lastDay: number | null = null;
  let mediums = 0;
  let hards = 0;
  let accepted = 0;
  let total = 0;
  let firstTries = 0;
  let comebacks = 0;

  for (const submission of submissions) {
    const at = submission.timestamp;
    const day = dayOf(at);
    total += 1;

    if (!days.has(day)) {
      days.add(day);
      const number = dayNumber(day);
      run = lastDay !== null && number === lastDay + 1 ? run + 1 : 1;
      lastDay = number;
      longest = Math.max(longest, run);
      streak.set(longest, at);
      activeDays.set(days.size, at);
      const month = day.slice(0, 7);
      const inMonth = monthDays.get(month) ?? new Set<string>();
      inMonth.add(day);
      monthDays.set(month, inMonth);
      if (inMonth.size >= MONTH_DAYS && !monthEarned.has(month)) monthEarned.set(month, at);
    }

    const before = tried.get(submission.problemId) ?? 0;
    tried.set(submission.problemId, before + 1);
    if (submission.verdict === "Accepted") accepted += 1;
    // Checked on every submission: the record can grow long enough on a failed one.
    sharpshooterNeeds.forEach((need, index) => {
      if (!sharpshooterAt[index] && total >= need.over && (accepted / total) * 100 >= need.rate) sharpshooterAt[index] = at;
    });
    if (submission.verdict !== "Accepted") continue;

    if (submission.language && !languages.has(submission.language)) {
      languages.add(submission.language);
      polyglot.set(languages.size, at);
    }
    if (solved.has(submission.problemId)) continue;
    solved.add(submission.problemId);
    firstAccept.set(solved.size, at);
    solver.set(solved.size, at);
    if (before === 0) firstTry.set(++firstTries, at);
    if (before >= 3) comeback.set(++comebacks, at);
    const problem = byId.get(submission.problemId);
    if (problem?.difficulty === "Medium") medium.set(++mediums, at);
    if (problem?.difficulty === "Hard") hard.set(++hards, at);
    if (problem) {
      const count = (topicSolved.get(problem.structureType) ?? 0) + 1;
      topicSolved.set(problem.structureType, count);
      topics.find((topic) => topic.type === problem.structureType)?.track.set(count, at);
    }
  }

  const rate = total ? Math.round((accepted / total) * 1000) / 10 : 0;

  let earned = 0;
  for (const event of coinEvents) {
    if (event.amount <= 0) continue;
    earned += event.amount;
    collector.set(earned, event.at);
  }

  const sharpTier = sharpshooterAt.filter(Boolean).length;
  const badges: Badge[] = [
    firstAccept.badge({ id: "first-accept", family: "milestone", name: "First Accepted", description: "Get a solution accepted", icon: "spark", unit: "solved" }),
    solver.badge({ id: "solver", family: "milestone", name: "Solver", description: "Solve problems of any kind", icon: "check", unit: "solved" }),
    medium.badge({ id: "medium", family: "difficulty", name: "Climber", description: "Solve Medium problems", icon: "mountain", unit: "Medium" }),
    hard.badge({ id: "hard", family: "difficulty", name: "Summit", description: "Solve Hard problems", icon: "peak", unit: "Hard" }),
    streak.badge({ id: "streak", family: "consistency", name: "Streak", description: "Submit on consecutive days", icon: "flame", unit: "days in a row" }),
    activeDays.badge({ id: "active-days", family: "consistency", name: "Regular", description: "Submit on many different days", icon: "calendar", unit: "active days" }),
    firstTry.badge({ id: "first-try", family: "performance", name: "Clean Sheet", description: "Solve a problem with your first submission", icon: "target", unit: "first-try solves" }),
    comeback.badge({ id: "comeback", family: "performance", name: "Comeback", description: "Solve a problem after three or more failed submissions", icon: "rebound", unit: "comebacks" }),
    {
      id: "sharpshooter",
      family: "performance",
      name: "Sharpshooter",
      description: "Keep your acceptance rate high: 50% over 20 submissions, 65% over 50, 80% over 100",
      icon: "crosshair",
      tier: sharpTier,
      thresholds: sharpshooterNeeds.map((need) => need.rate),
      value: rate,
      unit: "% accepted",
      earnedAt: sharpTier ? sharpshooterAt[sharpTier - 1] : undefined
    },
    polyglot.badge({ id: "polyglot", family: "performance", name: "Polyglot", description: "Get solutions accepted in different languages", icon: "languages", unit: "languages" }),
    collector.badge({ id: "collector", family: "coins", name: "Collector", description: "Earn Noesis coins by solving and in the waiting game", icon: "coin", unit: "coins earned" }),
    ...topics.map((topic) =>
      topic.track.badge({
        id: `topic-${topic.type}`,
        family: "topic",
        name: topic.label,
        description: `A quarter, half, then all ${topic.total} of its problems`,
        icon: `topic-${topic.type}`,
        unit: "solved"
      })
    )
  ];

  // One badge for every month with MONTH_DAYS active days, and the month in progress.
  const thisMonth = input.today.slice(0, 7);
  const months = new Set([...monthEarned.keys(), thisMonth]);
  for (const month of [...months].sort()) {
    const [year, number] = month.split("-");
    badges.push({
      id: `month-${month}`,
      family: "monthly",
      name: `${MONTHS[Number(number) - 1]} ${year}`,
      description: `Submit on ${MONTH_DAYS} different days of the month`,
      icon: "month",
      tier: monthEarned.has(month) ? 1 : 0,
      thresholds: [MONTH_DAYS],
      value: monthDays.get(month)?.size ?? 0,
      unit: "days",
      earnedAt: monthEarned.get(month)
    });
  }

  return badges.filter((badge) => badge.thresholds.length > 0);
};

/** Every earned tier, keyed for the once-only coin award: "solver:2". */
export const earnedTiers = (badges: Badge[]) =>
  badges.flatMap((badge) =>
    Array.from({ length: badge.tier }, (_, index) => ({
      key: `${badge.id}:${index + 1}`,
      badge,
      tier: index + 1
    }))
  );
