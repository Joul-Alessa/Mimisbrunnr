// Anki-like spaced repetition algorithm. All tunable parameters live in
// SR_CONFIG so behavior can be adjusted without touching the logic below.
const SR_CONFIG = {
  initialEaseFactor: 2.5,
  minEaseFactor: 1.3,
  maxEaseFactor: 3.5,
  minIntervalDays: 1,

  // Added to ease_factor on each review, per feedback.
  easeFactorDelta: {
    easy: 0.15,
    medium: 0,
    hard: -0.2,
  },

  // Interval used the first time a card is successfully reviewed
  // (repetitions === 0 or it has no prior interval yet).
  firstIntervalDays: {
    easy: 4,
    medium: 2,
    hard: 1,
  },

  // Multiplier applied to (previous interval * ease_factor) for "easy"/"medium"
  // reviews on a card that already has a real interval.
  intervalMultiplier: {
    easy: 1.3,
    medium: 1.0,
  },

  // "hard" shrinks the previous interval directly (not scaled by ease_factor,
  // which would partly cancel the shrink since ease_factor > 1).
  hardIntervalFactor: 0.5,
};

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function addDaysIso(days, from = new Date()) {
  const date = new Date(from);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString();
}

// Given the current card_review row and a feedback status ("easy" | "medium"
// | "hard"), returns the fields to persist for the next review cycle.
function computeNextReviewState(review, status) {
  if (!['easy', 'medium', 'hard'].includes(status)) {
    throw new Error(`Invalid review status: ${status}`);
  }

  const currentEase = review.ease_factor ?? SR_CONFIG.initialEaseFactor;
  const currentInterval = review.interval_days ?? 0;
  const currentRepetitions = review.repetitions ?? 0;

  const ease_factor = clamp(
    currentEase + SR_CONFIG.easeFactorDelta[status],
    SR_CONFIG.minEaseFactor,
    SR_CONFIG.maxEaseFactor
  );

  let interval_days;
  if (currentRepetitions === 0 || currentInterval <= 0) {
    interval_days = SR_CONFIG.firstIntervalDays[status];
  } else if (status === 'hard') {
    interval_days = Math.round(currentInterval * SR_CONFIG.hardIntervalFactor);
  } else {
    interval_days = Math.round(currentInterval * ease_factor * SR_CONFIG.intervalMultiplier[status]);
  }
  interval_days = Math.max(SR_CONFIG.minIntervalDays, interval_days);

  // A "hard" answer is treated as a lapse: the success streak resets, same
  // as Anki's "again" button, even though the card isn't fully reset to new.
  const repetitions = status === 'hard' ? 0 : currentRepetitions + 1;

  const now = new Date();
  return {
    status,
    ease_factor,
    interval_days,
    repetitions,
    last_reviewed_at: now.toISOString(),
    next_review_at: addDaysIso(interval_days, now),
  };
}

module.exports = { SR_CONFIG, computeNextReviewState, addDaysIso };
