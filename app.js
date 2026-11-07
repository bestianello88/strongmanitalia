import { athletes, categories, events, initialResults } from './data.js';
import { calculateStandings, rankEvent } from './scoring.js';
import { loadResults, STORAGE_KEY, csvCell } from './state.js';
import { createSharedStore, resultFor } from './arena-state.js';

const $=selector=>document.querySelector(selector);
const number=new Intl.NumberFormat('it-IT',{maximumFractionDigits:2});
const state={category:'M90',search:'',team:'',event:''};
const byId=new Map(athletes.map(a=>[a.id,a]));
let storage;
try {storage=localStorage;} catch {storage={getItem:()=>null,setItem:()=>{throw new Error('Storage unavailable');}};}
const loaded=loadResults(storage);
const sharedStore=createSharedStore({initialResults:loaded.results,eventList:events,storage});
let results=sharedStore.getState().results;
let standings;
let visibleRows=[];
let toastTimer;
const referee={category:'M90',event:events[0]?.id??'',athlete:''};
function el(tag,className,text){const node=document.createElement(tag);if(className)node.className=className;if(text!==undefined)node.textContent=text;return node;}
function toast(message){$('#toast').textContent=message;$('#toast').classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').classList.remove('visible'),4200);}
function initials(name){return name.split(' ').map(part=>part[0]).slice(0,2).join('');}
function formatResult(result,discipline){
  if(!result?.hasMeasure)return result?.status==='DNS'?'DNS':result?.status==='DNF'?'DNF':'—';
  return `${number.format(result.value)} ${discipline.unit}`;
}
function currentCategoryRows(){return standings[state.category]??[];}
function selectedRefereeAthletes(){return athletes.filter(athlete=>athlete.category===referee.category);}
function refereeEvent(){return events.find(event=>event.id===referee.event)??events[0];}
function refereeResult(){return refereeEvent()&&referee.athlete?resultFor(results,referee.athlete,referee.event):{value:null,status:'pending'};}
function eventMeasureLabel(event){return event?.type==='time'?'TEMPO':event?.type==='reps'?'RIPETIZIONI':event?.type==='distance'?'DISTANZA':event?.type==='weight'?'PESO':'MASSIMALE';}
function formatStatus(status){return status==='valid'?'CONFERMATO':status==='pending'?'IN ATTESA':status;}
function getVisibleRows(){
  let rows=currentCategoryRows();
  if(state.event){
    const ranks=rankEvent(athletes.filter(a=>a.category===state.category),events.find(e=>e.id===state.event),results);
    const map=new Map(rows.map(row=>[row.athleteId,row]));
    rows=ranks.map(result=>({...map.get(result.athleteId),displayRank:result.rank,displayPoints:result.points}));
  }else rows=rows.map(row=>({...row,displayRank:row.rank,displayPoints:row.totalPoints}));
  const query=state.search.trim().toLocaleLowerCase('it');
  return rows.filter(row=>{const athlete=byId.get(row.athleteId);return (!state.team||athlete.team===state.team)&&(!query||`${athlete.name} ${athlete.team}`.toLocaleLowerCase('it').includes(query));});
}
function updateTeamOptions(){
  const teams=[...new Set(athletes.filter(a=>a.category===state.category).map(a=>a.team))].sort();
  const select=$('#team');select.replaceChildren(new Option('Tutte le squadre',''),...teams.map(team=>new Option(team,team)));
  if(!teams.includes(state.team))state.team='';
  select.value=state.team;
}
function renderHead(){
  const row=el('tr');
  for(const text of ['POS.','ATLETA','SQUADRA'])row.append(el('th','',text));
  for(const discipline of events){const th=el('th','event-heading'+(state.event===discipline.id?' selected-event':''),discipline.short.toUpperCase());th.scope='col';row.append(th);}
  row.append(el('th','',state.event?'PUNTI PROVA':'TOTALE'));
  for(const th of row.children)th.scope='col';
  $('#table-head').replaceChildren(row);
}
function render(){
  standings=calculateStandings(athletes,events,results);
  visibleRows=getVisibleRows();
  renderHead();
  const fragment=document.createDocumentFragment();
  for(const row of visibleRows){
    const athlete=byId.get(row.athleteId);
    const tr=el('tr',row.displayRank===1?'rank-1':'');
    const pos=el('td','position');pos.append(el('span',row.displayRank<=3&&row.displayRank!==null?'podium':'',row.displayRank===null?'—':row.displayRank));tr.append(pos);
    const name=el('td');const identity=el('div','athlete-cell');
    identity.append(el('span',`avatar tone-${athlete.number%4}`,initials(athlete.name)));
    const identityText=el('div');const button=el('button','athlete-name',athlete.name);button.type='button';button.dataset.athleteId=athlete.id;button.setAttribute('aria-label',`Apri dettaglio di ${athlete.name}`);
    identityText.append(button,el('div','athlete-sub',`${athlete.country} · #${String(athlete.number).padStart(2,'0')}`));identity.append(identityText);name.append(identity);tr.append(name,el('td','team-name',athlete.team));
    for(const discipline of events){
      const result=row.events[discipline.id];const cell=el('td','result-cell');
      cell.append(el('span','result-value'+(result.rank===1?' best':''),formatResult(result,discipline)),el('span','result-points',result.hasMeasure?`${number.format(result.points)} pt`:['DNS','DNF'].includes(result.status)?'0 pt':'in attesa'));
      tr.append(cell);
    }
    const total=el('td','total-cell');total.append(el('strong','',number.format(row.displayPoints)),el('small','',state.event?'PUNTI PROVA':'PUNTI TOTALI'));tr.append(total);fragment.append(tr);
  }
  $('#ranking-body').replaceChildren(fragment);
  $('#empty').hidden=visibleRows.length!==0;
  $('table').hidden=visibleRows.length===0;
  const total=currentCategoryRows().length;
  $('#result-count').textContent=`${visibleRows.length} di ${total} atleti · ${categories.find(c=>c.id===state.category).name}${state.event?' · Ordine per '+events.find(e=>e.id===state.event).name:''}`;
  document.querySelectorAll('[data-category]').forEach(button=>{const selected=button.dataset.category===state.category;button.classList.toggle('active',selected);button.setAttribute('aria-pressed',String(selected));});
  document.querySelectorAll('.event-card').forEach(card=>{const selected=card.dataset.eventId===state.event;card.classList.toggle('selected',selected);card.setAttribute('aria-pressed',String(selected));});
}
function renderArenaPanels(){
  const refereeCategory=$('#referee-category');
  const refereeEventSelect=$('#referee-event');
  const refereeAthlete=$('#referee-athlete');
  if(!refereeCategory||!refereeEventSelect||!refereeAthlete)return;
  if(!selectedRefereeAthletes().some(athlete=>athlete.id===referee.athlete))referee.athlete=selectedRefereeAthletes()[0]?.id??'';
  refereeCategory.value=referee.category;
  refereeEventSelect.value=referee.event;
  refereeAthlete.replaceChildren(...selectedRefereeAthletes().map(athlete=>new Option(`${athlete.name} · #${String(athlete.number).padStart(2,'0')}`,athlete.id)));
  refereeAthlete.value=referee.athlete;
  const event=refereeEvent();
  const result=refereeResult();
  $('#referee-value').value=result.value??'';
  $('#referee-status').value=result.status??'pending';
  $('#referee-value').disabled=(result.status??'pending')==='pending';
  $('#referee-unit').textContent=event?`${eventMeasureLabel(event)} · ${event.unit}`:'';
  $('#referee-current').textContent=event&&referee.athlete?`${byId.get(referee.athlete)?.name??''} · ${event.name}`:'Seleziona atleta e prova';
  $('#referee-state').textContent=formatStatus(result.status??'pending');
  const queue=selectedRefereeAthletes().filter(athlete=>athlete.id!==referee.athlete).map(athlete=>({athlete,result:resultFor(results,athlete.id,referee.event)})).filter(item=>item.result.status==='pending').slice(0,5);
  $('#referee-queue').replaceChildren(...queue.map(item=>{const button=el('button','queue-item');button.type='button';button.dataset.queueAthlete=item.athlete.id;button.append(el('span','queue-number',`#${String(item.athlete.number).padStart(2,'0')}`),el('strong','',item.athlete.name),el('small','',formatStatus(item.result.status)));return button;}));
  if(!queue.length)$('#referee-queue').append(el('p','queue-empty','Nessun risultato in attesa per questa prova.'));

  const liveRows=(standings?.[state.category]??[]).slice(0,6);
  $('#live-category').textContent=categories.find(category=>category.id===state.category)?.name??state.category;
  $('#live-updated').textContent=$('#last-update').textContent;
  $('#live-ranking').replaceChildren(...liveRows.map(row=>{const item=el('div','live-row');item.append(el('span','live-position',String(row.rank)),el('strong','',row.name),el('span','live-points',`${number.format(row.totalPoints)} pt`));return item;}));
  const eventRows=events.map(item=>({event:item,done:(results.filter(result=>result.eventId===item.id&&result.status==='valid').length),pending:results.filter(result=>result.eventId===item.id&&result.status==='pending').length}));
  $('#live-events').replaceChildren(...eventRows.map(item=>{const line=el('div','live-event');line.append(el('span','',item.event.name),el('small','',`${item.done} valid · ${item.pending} in attesa`));return line;}));
}
function openAthlete(id){
  const athlete=byId.get(id);const row=currentCategoryRows().find(item=>item.athleteId===id);if(!athlete||!row)return;
  const content=$('#athlete-content');content.replaceChildren();
  const profile=el('div','athlete-profile');profile.append(el('span',`avatar tone-${athlete.number%4}`,initials(athlete.name)));
  const identity=el('div');const title=el('h2','',athlete.name);title.id='athlete-dialog-title';identity.append(title,el('div','profile-meta',`${athlete.country} · ${athlete.team} · ${categories.find(c=>c.id===athlete.category).name}`));profile.append(identity);content.append(profile);
  const score=el('div','profile-score');
  for(const [value,label] of [[`${row.rank}°`,'Posizione generale'],[number.format(row.totalPoints),'Punti totali'],[`${Object.values(row.events).filter(r=>r.hasMeasure).length}/5`,'Prove registrate']]){
    const item=el('div');item.append(el('strong','',value),el('span','',label));score.append(item);
  }content.append(score);
  for(const discipline of events){const result=row.events[discipline.id];const item=el('div','detail-row');item.append(el('span','',discipline.name));const measure=el('span','',formatResult(result,discipline));measure.append(el('small','',`${number.format(result.points)} pt${result.rank!==null?' · '+result.rank+'°':''}`));item.append(measure);content.append(item);}
  $('#athlete-dialog').showModal();
}
function save(){try{sharedStore.reset(results);return true;}catch{toast('Risultato aggiornato in memoria. Salvataggio nel browser non disponibile.');return false;}}
function selectEvent(id){state.event=state.event===id?'':id;$('#event-filter').value=state.event;render();}

$('#athlete-count').textContent=athletes.length;
for(const discipline of events){
  $('#event-filter').append(new Option(discipline.name,discipline.id));
  const card=el('button','event-card');card.type='button';card.dataset.eventId=discipline.id;card.setAttribute('aria-pressed','false');card.setAttribute('aria-label',`Ordina classifica per ${discipline.name}`);
  const top=el('div','event-card-top');top.append(el('span','',discipline.icon),el('span','',`PROVA ${String(events.indexOf(discipline)+1).padStart(2,'0')}`));
  const foot=el('div','event-card-foot');foot.append(el('span','',discipline.type==='time'?'TEMPO MINIMO':discipline.type==='max'?'PESO MASSIMO':'PIÙ RIPETIZIONI'),el('span','','↗'));
  card.append(top,el('h3','',discipline.name),el('p','',discipline.description),foot);$('#event-cards').append(card);
}
document.querySelectorAll('[data-category]').forEach(button=>button.addEventListener('click',()=>{state.category=button.dataset.category;updateTeamOptions();render();}));
$('#search').addEventListener('input',e=>{state.search=e.target.value;render();});
$('#team').addEventListener('change',e=>{state.team=e.target.value;render();});
$('#event-filter').addEventListener('change',e=>{state.event=e.target.value;render();});
$('#event-cards').addEventListener('click',e=>{const card=e.target.closest('[data-event-id]');if(card)selectEvent(card.dataset.eventId);});
$('#ranking-body').addEventListener('click',e=>{const button=e.target.closest('[data-athlete-id]');if(button)openAthlete(button.dataset.athleteId);});
$('#reset-filters').addEventListener('click',()=>{state.search='';state.team='';state.event='';$('#search').value='';$('#team').value='';$('#event-filter').value='';render();});
for(const id of ['rules-open','event-info'])$('#'+id).addEventListener('click',()=>$('#info-dialog').showModal());
document.querySelectorAll('.close-dialog').forEach(button=>button.addEventListener('click',()=>button.closest('dialog').close()));
document.querySelectorAll('dialog').forEach(dialog=>dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close();}}));
$('#simulate').addEventListener('click',()=>{
  const pool=results.filter(r=>byId.get(r.athleteId).category===state.category&&r.eventId==='farmers');
  const result=pool[Math.floor(Math.random()*pool.length)];result.value=Math.round(Math.max(10,(result.value??22)-.25-Math.random())*100)/100;result.status='valid';
  render();$('#last-update').textContent=`Simulazione · ${new Date().toLocaleTimeString('it-IT')}`;
  if(save())toast(`Demo aggiornata: ${byId.get(result.athleteId).name} · ${number.format(result.value)} s`);
});
$('#demo-reset').addEventListener('click',()=>{results=structuredClone(initialResults);render();$('#last-update').textContent='Dati dimostrativi';if(save())toast('Dati dimostrativi ripristinati.');});
$('#export').addEventListener('click',()=>{
  const header=['Posizione','Atleta','Squadra','Categoria',...events.flatMap(e=>[e.name,`${e.name} punti`]),state.event?'Punti prova':'Punti totali'];
  const lines=[header,...visibleRows.map(row=>{const athlete=byId.get(row.athleteId);return [row.displayRank,athlete.name,athlete.team,categories.find(c=>c.id===athlete.category).name,...events.flatMap(e=>[formatResult(row.events[e.id],e),row.events[e.id].points]),row.displayPoints];})];
  const blob=new Blob(['\uFEFF'+lines.map(line=>line.map(csvCell).join(';')).join('\r\n')],{type:'text/csv;charset=utf-8;'});
  const url=URL.createObjectURL(blob);const a=el('a');a.href=url;a.download=`strongmanitalia-demo-${state.category}${state.event?'-'+state.event:''}.csv`;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);toast(`Esportati ${visibleRows.length} atleti con i filtri attuali.`);
});
document.addEventListener('keydown',e=>{if(e.key==='/'&&!['INPUT','TEXTAREA','SELECT'].includes(document.activeElement.tagName)&&!document.querySelector('dialog[open]')){e.preventDefault();$('#search').focus();}});
for(const category of categories)$('#referee-category').append(new Option(category.name,category.id));
for(const event of events)$('#referee-event').append(new Option(`${event.name} · ${eventMeasureLabel(event)}`,event.id));
referee.category=state.category;
referee.athlete=athletes.find(athlete=>athlete.category===referee.category)?.id??'';
$('#referee-category').addEventListener('change',event=>{referee.category=event.target.value;referee.athlete='';renderArenaPanels();});
$('#referee-event').addEventListener('change',event=>{referee.event=event.target.value;renderArenaPanels();});
$('#referee-athlete').addEventListener('change',event=>{referee.athlete=event.target.value;renderArenaPanels();});
$('#referee-status').addEventListener('change',event=>{$('#referee-value').disabled=event.target.value==='pending';if(event.target.value==='pending')$('#referee-value').value='';});
$('#referee-confirm').addEventListener('click',()=>{
  const event=refereeEvent();
  const status=$('#referee-status').value;
  const raw=$('#referee-value').value.trim();
  const value=raw===''?null:Number(raw);
  try{
    sharedStore.setResult({athleteId:referee.athlete,eventId:event.id,value,status});
    $('#last-update').textContent=`Aggiornato · ${new Date().toLocaleTimeString('it-IT')}`;
    toast(`${byId.get(referee.athlete)?.name??'Atleta'} · risultato ${formatStatus(status).toLocaleLowerCase('it-IT')}`);
    renderArenaPanels();
  }catch(error){toast(error.message||'Risultato non valido.');}
});
$('#referee-queue').addEventListener('click',event=>{const button=event.target.closest('[data-queue-athlete]');if(button){referee.athlete=button.dataset.queueAthlete;renderArenaPanels();}});
sharedStore.subscribe(snapshot=>{results=snapshot.results;render();renderArenaPanels();if(snapshot.remote){$('#last-update').textContent=`Sincronizzato · ${new Date().toLocaleTimeString('it-IT')}`;}});
updateTeamOptions();render();
renderArenaPanels();
if(loaded.recovered)toast('Dati locali non validi o non disponibili: caricata la demo iniziale.');
