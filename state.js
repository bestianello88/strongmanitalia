import { athletes, events, initialResults } from './data.js';
export const STORAGE_KEY = 'strength-arena:demo:v1';
export function validateResults(input) {
  if (!Array.isArray(input) || input.length !== initialResults.length) return false;
  const ids = new Set(athletes.map(a=>a.id));
  const definitions = new Map(events.map(e=>[e.id,e]));
  const seen = new Set();
  return input.every(row=>{
    if (!row || !ids.has(row.athleteId) || !definitions.has(row.eventId)) return false;
    const key=`${row.athleteId}:${row.eventId}`;
    if (seen.has(key)) return false;
    seen.add(key);
    if (!['valid','pending','DNS','DNF'].includes(row.status)) return false;
    if (row.value===null) return row.status!=='valid';
    if (typeof row.value!=='number' || !Number.isFinite(row.value) || row.value<0 || row.value>100000) return false;
    const type=definitions.get(row.eventId).type;
    if(type==='reps' && !Number.isInteger(row.value)) return false;
    if(type==='time' && row.value===0) return false;
    return row.status==='valid';
  });
}
export function loadResults(storage) {
  try {
    const raw=storage.getItem(STORAGE_KEY);
    if(raw){const saved=JSON.parse(raw);if(validateResults(saved)) return {results:saved,recovered:false};return {results:structuredClone(initialResults),recovered:true};}
  } catch {return {results:structuredClone(initialResults),recovered:true};}
  return {results:structuredClone(initialResults),recovered:false};
}
export function csvCell(value) {
  let text=String(value??'');
  if (/^[=+\-@\t\r]/.test(text)) text="'"+text;
  return '"'+text.replaceAll('"','""')+'"';
}
