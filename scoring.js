/**
 * Pure scoring engine for strongman events.
 *
 * Events use descending points based on the number of registered athletes:
 * the winner receives N points, the next athlete N - 1, and so on.
 * Missing results and DNS/DNF results without a numeric measure receive zero.
 */

const VALID_EVENT_TYPES = new Set(['max', 'weight', 'reps', 'time', 'distance']);
function assertArray(value, name) {
  if (!Array.isArray(value)) {
    throw new TypeError(`${name} must be an array`);
  }
}

function assertEvent(event) {
  if (!event || typeof event.id !== 'string' || !VALID_EVENT_TYPES.has(event.type)) {
    throw new TypeError('event must have a string id and type max, weight, reps, time, or distance');
  }
}

function isValidMeasure(result) {
  return result && result.status !== 'pending' && typeof result.value === 'number' && Number.isFinite(result.value);
}

function compareValues(left, right, type) {
  return type === 'time'
    ? left.result.value - right.result.value
    : right.result.value - left.result.value;
}

function average(values) {
  return values.reduce((total, value) => total + value, 0) / values.length;
}

function getEventResults(athletes, event, results) {
  const byAthlete = new Map();
  for (const result of results) {
    if (result.eventId !== event.id) continue;
    if (byAthlete.has(result.athleteId)) {
      throw new Error(`Duplicate result for athlete ${result.athleteId} in event ${event.id}`);
    }
    byAthlete.set(result.athleteId, result);
  }

  return athletes.map((athlete) => ({
    athleteId: athlete.id,
    athlete,
    result: byAthlete.get(athlete.id) ?? null,
    hasMeasure: isValidMeasure(byAthlete.get(athlete.id)),
  }));
}

/**
 * Rank one event.
 * @param {Array<object>} athletes Category athletes to rank.
 * @param {{id: string, name: string, type: 'max'|'weight'|'reps'|'time'|'distance'}} event Event definition.
 * @param {Array<{athleteId: string, eventId: string, value?: number|null, status?: string}>} results Results.
 * @returns {Array<object>} Event rows sorted by rank, including points and countback data.
 */
export function rankEvent(athletes, event, results) {
  assertArray(athletes, 'athletes');
  assertArray(results, 'results');
  assertEvent(event);

  const rows = getEventResults(athletes, event, results);
  const measured = rows
    .filter((row) => row.hasMeasure)
    .sort((left, right) => compareValues(left, right, event.type));
  const pointsByAthlete = new Map();
  const rankByAthlete = new Map();

  let index = 0;
  while (index < measured.length) {
    const tied = [measured[index]];
    let next = index + 1;
    while (next < measured.length && measured[next].result.value === measured[index].result.value) {
      tied.push(measured[next]);
      next += 1;
    }

    const occupiedPositions = Array.from({ length: tied.length }, (_, offset) => index + offset + 1);
    const points = average(occupiedPositions.map((position) => athletes.length - position + 1));
    for (const row of tied) {
      pointsByAthlete.set(row.athleteId, points);
      rankByAthlete.set(row.athleteId, {
        rank: index + 1,
        occupiedPositions,
      });
    }
    index = next;
  }

  return rows
    .map((row) => {
      const ranking = rankByAthlete.get(row.athleteId);
      const hasMeasure = row.hasMeasure;
      return {
        athleteId: row.athleteId,
        athlete: row.athlete,
        eventId: event.id,
        value: hasMeasure ? row.result.value : null,
        status: row.result?.status ?? (hasMeasure ? 'valid' : null),
        hasMeasure,
        rank: ranking?.rank ?? null,
        occupiedPositions: ranking?.occupiedPositions ?? [],
        points: hasMeasure ? pointsByAthlete.get(row.athleteId) : 0,
      };
    })
    .sort((left, right) => {
      if (left.hasMeasure !== right.hasMeasure) return left.hasMeasure ? -1 : 1;
      if (left.rank !== right.rank) return (left.rank ?? Infinity) - (right.rank ?? Infinity);
      return left.athleteId.localeCompare(right.athleteId);
    });
}

function compareCountback(left, right) {
  const length = Math.max(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    const difference = (right[index] ?? 0) - (left[index] ?? 0);
    if (difference !== 0) return difference;
  }
  return 0;
}

/**
 * Calculate standings independently for every athlete category.
 * @param {Array<{id: string, name: string, category?: string}>} athletes Athletes.
 * @param {Array<{id: string, name: string, type: 'max'|'weight'|'reps'|'time'|'distance'}>} events Events.
 * @param {Array<{athleteId: string, eventId: string, value?: number|null, status?: string}>} results Results.
 * @returns {Record<string, Array<object>>} Category name to sorted standings rows.
 */
export function calculateStandings(athletes, events, results) {
  assertArray(athletes, 'athletes');
  assertArray(events, 'events');
  assertArray(results, 'results');
  events.forEach(assertEvent);

  const categories = new Map();
  for (const athlete of athletes) {
    const category = athlete.category ?? 'uncategorized';
    if (!categories.has(category)) categories.set(category, []);
    categories.get(category).push(athlete);
  }

  return Object.fromEntries([...categories.entries()].map(([category, categoryAthletes]) => {
    const eventRows = events.map((event) => rankEvent(categoryAthletes, event, results));
    const rows = categoryAthletes.map((athlete) => {
      const eventResults = eventRows.map((eventResult) => eventResult.find((row) => row.athleteId === athlete.id));
      const countback = [];
      for (const eventResult of eventResults) {
        if (eventResult?.rank != null) {
          countback[eventResult.rank - 1] = (countback[eventResult.rank - 1] ?? 0) + 1;
        }
      }
      return {
        athleteId: athlete.id,
        name: athlete.name,
        category,
        totalPoints: eventResults.reduce((total, row) => total + (row?.points ?? 0), 0),
        countback: countback.map((value) => value ?? 0),
        events: Object.fromEntries(events.map((event, index) => [event.id, eventResults[index]])),
      };
    }).sort((left, right) => right.totalPoints - left.totalPoints || compareCountback(left.countback, right.countback) || left.athleteId.localeCompare(right.athleteId));

    let currentRank = 0;
    for (let index = 0; index < rows.length; index += 1) {
      const previous = rows[index - 1];
      if (!previous || previous.totalPoints !== rows[index].totalPoints || compareCountback(previous.countback, rows[index].countback) !== 0) {
        currentRank = index + 1;
      }
      rows[index].rank = currentRank;
    }
    return [category, rows];
  }));
}

