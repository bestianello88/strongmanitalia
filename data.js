export const event = { id: 'strength-series-demo-2026', name: 'strongmanitalia · Demo', location: 'Milano', date: '2026-11-07', status: 'demo' };
export const categories = [
  { id: 'M90', name: 'Uomini −90 kg' }, { id: 'M105', name: 'Uomini −105 kg' },
  { id: 'MOPEN', name: 'Uomini Open' }, { id: 'WOPEN', name: 'Donne Open' }
];
export const events = [
  { id: 'log', name: 'Log Lift', short: 'Log lift', type: 'max', unit: 'kg', description: 'Massimale sopra la testa', icon: '↥' },
  { id: 'deadlift', name: 'Deadlift', short: 'Deadlift', type: 'reps', unit: 'rep', description: 'Ripetizioni in 60 secondi', icon: '⇈' },
  { id: 'farmers', name: 'Farmer’s Walk', short: 'Farmer’s', type: 'time', unit: 's', description: '30 metri · tempo minimo', icon: '⇢' },
  { id: 'yoke', name: 'Yoke Run', short: 'Yoke run', type: 'time', unit: 's', description: '20 metri · tempo minimo', icon: '⤴' },
  { id: 'stones', name: 'Atlas Stones', short: 'Stones', type: 'reps', unit: 'rep', description: 'Caricamenti in 60 secondi', icon: '◉' }
];
const roster = [
 ['Luca Moretti','ITA','Iron Valley','M90'], ['Erik Lindberg','SWE','Nordic Strength','M90'],
 ['Marco Rinaldi','ITA','Atlas Milano','M90'], ['Tomas Novak','CZE','Prague Barbell','M90'],
 ['Oliver Hayes','GBR','Iron Valley','M90'], ['Jan Kowalski','POL','Warsaw Strong','M90'],
 ['Matteo Costa','ITA','Atlas Milano','M90'], ['Alex Weber','GER','Berlin Power','M90'],
 ['Davide Romano','ITA','Iron Valley','M105'], ['Viktor Berg','SWE','Nordic Strength','M105'],
 ['Daniel Smith','GBR','Atlas Milano','M105'], ['Adam Nowak','POL','Warsaw Strong','M105'],
 ['Felix Braun','GER','Berlin Power','M105'], ['Pavel Dvorak','CZE','Prague Barbell','M105'],
 ['Andrea Ferri','ITA','Atlas Milano','MOPEN'], ['Oscar Nilsson','SWE','Nordic Strength','MOPEN'],
 ['James Wilson','GBR','Iron Valley','MOPEN'], ['Piotr Zielinski','POL','Warsaw Strong','MOPEN'],
 ['Leon Fischer','GER','Berlin Power','MOPEN'], ['Jakub Svoboda','CZE','Prague Barbell','MOPEN'],
 ['Giulia Conti','ITA','Atlas Milano','WOPEN'], ['Freya Andersson','SWE','Nordic Strength','WOPEN'],
 ['Emma Clarke','GBR','Iron Valley','WOPEN'], ['Anna Wisniewska','POL','Warsaw Strong','WOPEN'],
 ['Sofia Ricci','ITA','Atlas Milano','WOPEN'], ['Mia Schneider','GER','Berlin Power','WOPEN']
];
export const athletes = roster.map(([name,country,team,category],i)=>({id:`a${i+1}`,name,country,team,category,number:i+1}));
const m90 = [
 [145,12,18.42,12.8,6], [140,13,19.16,13.24,5], [140,11,18.95,13.9,5],
 [135,10,20.14,14.5,4], [130,10,21.31,14.12,4], [135,8,22.08,15.3,3],
 [125,9,23.45,16.11,3], [120,7,24.8,17.45,null]
];
export const initialResults = athletes.flatMap((athlete,index)=>events.map((discipline,j)=>{
  let value;
  if(index<8) value=m90[index][j];
  else { const k=(index-8)%6; const adjustment=athlete.category==='WOPEN'?-45:athlete.category==='MOPEN'?30:15;
    value=[145+adjustment-k*5,12-k,Math.round((18.8+k*1.28)*100)/100,Math.round((13.1+k*.87)*100)/100,6-Math.floor(k/2)][j]; }
  return {athleteId:athlete.id,eventId:discipline.id,value,status:value===null?'pending':'valid'};
}));
