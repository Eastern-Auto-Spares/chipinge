const QUERY_SYNONYMS = {
  brake: ["brakes", "braking", "pads", "pad", "stopping"],
  oil: ["engine oil", "lubricant", "service", "maintenance"],
  cv: ["joint", "axle", "outer cv", "cv joint"],
  ignition: ["coil", "spark", "electrical"],
  cooling: ["cool", "water pump", "temperature", "overheating", "radiator"],
  tool: ["jack", "workshop", "lift"],
  suspension: ["shock", "joint", "ride", "cv"],
  toyota: ["hilux", "corolla", "toyota"],
  honda: ["fit", "crv", "civic", "honda"],
  nissan: ["hardbody", "np200", "nissan"],
  mazda: ["bt50", "demio", "mazda"]
};

const SUGGESTED_PROMPTS = [
  "Toyota braking parts",
  "Engine oil for service",
  "Cooling parts for Nissan",
  "Workshop tools in stock",
  "Suspension part for Toyota"
];

function normalize(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

function tokenize(value) {
  return normalize(value).split(" ").filter(Boolean);
}

function expandTokens(tokens) {
  const expanded = new Set(tokens);

  tokens.forEach((token) => {
    Object.entries(QUERY_SYNONYMS).forEach(([key, values]) => {
      if (token === key || values.includes(token)) {
        expanded.add(key);
        values.forEach((value) => tokenize(value).forEach((item) => expanded.add(item)));
      }
    });
  });

  return [...expanded];
}

function scorePartAgainstTokens(part, tokens) {
  const haystack = {
    name: normalize(part.name),
    category: normalize(part.category),
    vehicle: normalize(part.vehicle),
    description: normalize(part.description),
    id: normalize(part.partId)
  };

  let score = 0;
  const reasons = [];

  tokens.forEach((token) => {
    if (haystack.name.includes(token)) {
      score += 7;
      reasons.push(`matches "${token}" in the part name`);
    }
    if (haystack.category.includes(token)) {
      score += 5;
      reasons.push(`aligns with the ${part.category} category`);
    }
    if (haystack.vehicle.includes(token)) {
      score += 6;
      reasons.push(`fits the ${part.vehicle} vehicle filter`);
    }
    if (haystack.description.includes(token)) {
      score += 3;
      reasons.push(`description mentions "${token}"`);
    }
    if (haystack.id.includes(token)) {
      score += 2;
      reasons.push(`part ID references "${token}"`);
    }
  });

  if (part.stock === "In Stock") score += 2;
  if (part.stock === "Order Ready") score += 1;

  return {
    score,
    reasons: [...new Set(reasons)].slice(0, 3)
  };
}

export function runEasternAISearch(query, parts, filters = {}) {
  const normalizedQuery = normalize(query);
  const baseTokens = tokenize(normalizedQuery);
  const tokens = expandTokens(baseTokens);
  const categoryFilter = filters.category || "all";
  const vehicleFilter = filters.vehicle || "all";

  let filteredParts = [...parts];
  if (categoryFilter !== "all") {
    filteredParts = filteredParts.filter((part) => part.category === categoryFilter);
  }
  if (vehicleFilter !== "all") {
    filteredParts = filteredParts.filter((part) => part.vehicle === vehicleFilter);
  }

  let ranked = filteredParts.map((part) => {
    const { score, reasons } = scorePartAgainstTokens(part, tokens);
    return {
      part,
      score,
      reasons
    };
  });

  if (normalizedQuery) {
    ranked = ranked
      .filter((entry) => entry.score > 0)
      .sort((left, right) => right.score - left.score || left.part.price - right.part.price);
  } else {
    ranked = ranked
      .map((entry, index) => ({ ...entry, score: entry.score + Math.max(0, 10 - index) }))
      .sort((left, right) => left.part.partId.localeCompare(right.part.partId));
  }

  const results = ranked.map((entry) => ({
    ...entry.part,
    aiScore: entry.score,
    aiReasons: entry.reasons
  }));

  const topResults = results.slice(0, 3);
  const searchLabel = normalizedQuery ? `"${query.trim()}"` : "your current filters";

  let summary = `EasternAI is standing by. Search by part name, vehicle, or problem and it will rank the strongest matches here.`;
  if (normalizedQuery && results.length) {
    summary = `EasternAI found ${results.length} match${results.length === 1 ? "" : "es"} for ${searchLabel} and ranked ${topResults[0].name} as the strongest fit.`;
  } else if (normalizedQuery && !results.length) {
    summary = `EasternAI could not find a strong direct match for ${searchLabel}. Try a vehicle, category, or a simpler symptom such as brake, oil, cooling, or ignition.`;
  } else if (!normalizedQuery) {
    summary = `EasternAI is showing the best available parts for your current filters. Use the search box and button to retrieve something specific.`;
  }

  const mode = normalizedQuery ? "Retrieving" : "Ready";
  const badge = normalizedQuery ? "EasternAI Active" : "Awaiting Search";
  const matchCountLabel = normalizedQuery ? `${results.length} found` : "All parts";

  return {
    results,
    topResults,
    summary,
    mode,
    badge,
    matchCountLabel,
    suggestions: SUGGESTED_PROMPTS
  };
}
