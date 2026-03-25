const QUERY_SYNONYMS = {
  brake: ["brakes", "braking", "pads", "pad", "disc", "discs", "shoes", "shoe"],
  oil: ["engine oil", "lubricant", "service", "maintenance", "filter", "atf"],
  cv: ["joint", "axle", "outer cv", "cv joint", "tripod", "boot"],
  ignition: ["coil", "spark", "electrical", "plug", "starter", "alternator"],
  cooling: ["cool", "water pump", "temperature", "overheating", "radiator", "fan", "coolant"],
  tool: ["jack", "workshop", "lift", "spanner", "screwdriver"],
  suspension: ["shock", "joint", "ride", "cv", "ball joint", "tie rod", "bearing"],
  fluid: ["fluid", "atf", "brake fluid", "power steering", "coolant"],
  tyre: ["tyre", "wheel", "wheel nut", "wheel stud", "valve"],
  toyota: ["toyota", "corolla", "wish", "hiace"],
  honda: ["honda", "fit", "civic", "crv"],
  nissan: ["nissan", "ad", "ad van"],
  mazda: ["mazda", "demio"]
};

const SUGGESTED_PROMPTS = [
  "Engine oil for all cars",
  "Toyota Corolla braking parts",
  "Honda Fit ignition parts",
  "Nissan AD Van cooling parts",
  "Workshop tools in stock"
];

function normalize(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9\s/-]/g, " ").replace(/\s+/g, " ").trim();
}

function tokenize(value) {
  return normalize(value).split(" ").filter(Boolean);
}

function getVehicleNames(part) {
  if (Array.isArray(part.vehicles) && part.vehicles.length) {
    if (part.vehicles.includes("Universal")) return ["Universal"];
    return part.vehicles;
  }
  return part.vehicle ? [part.vehicle] : [];
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
  const vehicleNames = getVehicleNames(part);
  const haystack = {
    name: normalize(part.name),
    category: normalize(part.category),
    vehicle: normalize(vehicleNames.join(" ")),
    description: normalize(part.description),
    id: normalize(part.partId),
    barcode: normalize(part.barcode)
  };

  let score = 0;
  const reasons = [];

  tokens.forEach((token) => {
    if (haystack.name.includes(token)) {
      score += 8;
      reasons.push(`matches "${token}" in the part name`);
    }
    if (haystack.category.includes(token)) {
      score += 5;
      reasons.push(`fits the ${part.category} category`);
    }
    if (haystack.vehicle.includes(token)) {
      score += 7;
      reasons.push(`covers ${vehicleNames.join(", ")}`);
    }
    if (haystack.description.includes(token)) {
      score += 3;
      reasons.push(`description references "${token}"`);
    }
    if (haystack.id.includes(token) || haystack.barcode.includes(token)) {
      score += 3;
      reasons.push(`matches an inventory code`);
    }
  });

  if (part.stock === "In Stock") score += 2;
  if (part.stockQty >= 20) score += 2;
  if (vehicleNames.length > 1) score += 1;

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
    filteredParts = filteredParts.filter((part) => getVehicleNames(part).includes(vehicleFilter));
  }

  let ranked = filteredParts.map((part) => {
    const { score, reasons } = scorePartAgainstTokens(part, tokens);
    return { part, score, reasons };
  });

  if (normalizedQuery) {
    ranked = ranked
      .filter((entry) => entry.score > 0)
      .sort((left, right) => right.score - left.score || (right.part.stockQty || 0) - (left.part.stockQty || 0));
  } else {
    ranked = ranked
      .map((entry, index) => ({ ...entry, score: entry.score + Math.max(0, 10 - index) }))
      .sort((left, right) => left.part.partId.localeCompare(right.part.partId));
  }

  const results = ranked.map((entry) => ({
    ...entry.part,
    vehicles: getVehicleNames(entry.part),
    aiScore: entry.score,
    aiReasons: entry.reasons
  }));

  const topResults = results.slice(0, 3);
  const searchLabel = normalizedQuery ? `"${query.trim()}"` : "your current filters";

  let summary = "EasternAI is standing by. Search by part name, vehicle, symptom, or barcode and it will rank the strongest matches here.";
  if (normalizedQuery && results.length) {
    const topVehicles = topResults[0].vehicles.filter((vehicle) => vehicle !== "Universal");
    const vehicleSummary = topVehicles.length ? ` It is currently mapped to ${topVehicles.join(", ")}.` : "";
    summary = `EasternAI found ${results.length} match${results.length === 1 ? "" : "es"} for ${searchLabel} and ranked ${topResults[0].name} as the strongest fit.${vehicleSummary}`;
  } else if (normalizedQuery && !results.length) {
    summary = `EasternAI could not find a strong direct match for ${searchLabel}. Try a car model, category, barcode, or a simpler part phrase such as brake, oil, cooling, tyre, or ignition.`;
  } else if (!normalizedQuery) {
    summary = "EasternAI is showing the best available parts for your current filters. Use the search box and button to retrieve something specific.";
  }

  return {
    results,
    topResults,
    summary,
    mode: normalizedQuery ? "Retrieving" : "Ready",
    badge: normalizedQuery ? "EasternAI Active" : "Awaiting Search",
    matchCountLabel: normalizedQuery ? `${results.length} found` : "All parts",
    suggestions: SUGGESTED_PROMPTS
  };
}
