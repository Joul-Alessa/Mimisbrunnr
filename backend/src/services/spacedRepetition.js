// Ease-factor adjustment for a card based on a study-session rating. This is
// used only as a secondary weight for which card should surface next within
// a study session (see studyService's weighted pick) — there is no due-date
// scheduling anymore; every card in a session's scope stays eligible for the
// life of the session.
const SR_CONFIG = {
  initialEaseFactor: 2.5,
  minEaseFactor: 1.3,
  maxEaseFactor: 3.5,
  easeFactorDelta: {
    easy: 0.15,
    medium: 0,
    hard: -0.2,
  },
};

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function nextEaseFactor(currentEase, status) {
  if (!(status in SR_CONFIG.easeFactorDelta)) {
    throw new Error(`Invalid review status: ${status}`);
  }
  return clamp(currentEase + SR_CONFIG.easeFactorDelta[status], SR_CONFIG.minEaseFactor, SR_CONFIG.maxEaseFactor);
}

module.exports = { SR_CONFIG, nextEaseFactor };
