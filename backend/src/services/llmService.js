// Interface layer for transforming Plain Knowledge cards via an LLM
// (spec section 5). No LLM is actually wired up yet: `callLLM` is a stub
// that echoes back the prompt that WOULD be sent, so the rest of the app
// (storage, endpoints, study flow) can be built and tested now. Once a local
// LLM runtime (Ollama/LMStudio) is available, only `callLLM` needs to change
// to actually call `config.llm.baseUrl` / `config.llm.model` (see
// backend/src/config/env.js for those settings).
const GENERATION_MODES = ['question', 'cloze', 'example', 'reasoning', 'random'];
const CONCRETE_MODES = GENERATION_MODES.filter((mode) => mode !== 'random');

function pickRandomMode() {
  return CONCRETE_MODES[Math.floor(Math.random() * CONCRETE_MODES.length)];
}

function buildPrompt(mode, content) {
  switch (mode) {
    case 'question':
      return `Turn the following piece of knowledge into a single, clear quiz question that tests understanding of it. Respond with only the question.\n\nKnowledge: "${content}"`;
    case 'cloze':
      return `Rewrite the following piece of knowledge as a cloze deletion prompt (hide the key term(s) with "{{...}}"). Respond with only the cloze text.\n\nKnowledge: "${content}"`;
    case 'example':
      return `Give one concrete, practical example that illustrates the following piece of knowledge. Respond with only the example.\n\nKnowledge: "${content}"`;
    case 'reasoning':
      return `Explain the reasoning or chain of thought behind the following piece of knowledge, as if teaching it step by step. Respond with only the explanation.\n\nKnowledge: "${content}"`;
    default:
      throw new Error(`Unsupported generation mode: ${mode}`);
  }
}

// STUB: returns the prompt itself instead of an actual model response.
// Replace this function's body with a real call to config.llm.baseUrl /
// config.llm.model (e.g. Ollama's /api/generate) when the LLM runtime is ready.
async function callLLM(prompt) {
  return prompt;
}

// Resolves "random" to a concrete mode, builds the prompt for a plain-card's
// content, and returns what the (stubbed) LLM produced for it.
async function generateFromContent(mode, content) {
  if (!GENERATION_MODES.includes(mode)) {
    throw new Error(`mode must be one of: ${GENERATION_MODES.join(', ')}`);
  }

  const resolvedMode = mode === 'random' ? pickRandomMode() : mode;
  const prompt = buildPrompt(resolvedMode, content);
  const generated_content = await callLLM(prompt);

  return { mode: resolvedMode, prompt, generated_content };
}

module.exports = { GENERATION_MODES, generateFromContent, buildPrompt, callLLM };
