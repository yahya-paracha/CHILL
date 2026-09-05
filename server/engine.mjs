import { createPlayers, pick } from './characters.mjs';
import { ROLE_INFO, living, human, player, winner, eligible } from './roles.mjs';
import { chooseSuspect, changeOpinion, remember, makeDiscussion, answerQuestion, enhancedAnswer, styleLine } from './dialogue.mjs';
export class GameError extends Error { constructor(message, status = 400) { super(message); this.status = status; } }
export function addEvent(g, event) { g.events.push({ id: ++g.seq, round: g.round, phase: g.phase, ...event }); }
export function addMessage(g, actor, text, type = 'statement', source = 'simulation') { g.messages.push({ id: ++g.seq, round: g.round, actor, text, type, source }); }
export function createGame(options = {}) {
  const g = { id: crypto.randomUUID(), players: createPlayers(options.remix), phase: 'ROLE_ASSIGNMENT', round: 1, seq: 0, events: [], messages: [], votes: [], privateNotes: [], accusationTargets: [], questionCount: 0, dynamicDialogue: !!options.dynamicDialogue, winner: null, nightResult: null, ballot: null, elimination: null, startedAt: Date.now() };
  addEvent(g, { type: 'start', text: 'Nine strangers took their seats. Two of them are Mafia.' });
  return g;
}
export function publicState(g) {
  const you = human(g); const end = g.phase === 'GAME_OVER';
  return { id: g.id, phase: g.phase, round: g.round, winner: g.winner, alive: living(g).length, players: g.players.map(p => {
    const heat = living(g).filter(a => a.id !== p.id).reduce((s, a) => s + (a.suspicion[p.id] || 0), 0) / Math.max(1, living(g).length - Number(p.alive));
    return { id: p.id, name: p.name, personality: p.personality, color: p.color, bio: p.bio, alive: p.alive, emotion: p.emotion, claimed: p.claimed, suspicionHint: heat < 32 ? 'Low suspicion' : heat < 49 ? 'Watching' : heat < 67 ? 'Suspicious' : 'Highly suspicious', ...(p.id === 'you' || !p.alive || end ? { role: p.role } : {}) };
  }), you: { role: you.role, alive: you.alive, ...ROLE_INFO[you.role], teammates: you.role === 'Mafia' ? g.players.filter(p => p.role === 'Mafia' && p.id !== 'you').map(p => p.id) : [], notes: g.privateNotes },
  events: g.events, messages: g.messages, votes: g.votes, ballot: g.ballot, elimination: g.elimination, nightResult: g.nightResult, targets: g.phase === 'NIGHT' && you.alive && you.role !== 'Civilian' ? eligible(g).map(p => p.id) : [], dynamicDialogue: g.dynamicDialogue,
  summary: end ? { rounds: g.round, eliminated: g.players.filter(p => !p.alive).length, mafiaFound: g.players.filter(p => !p.alive && p.role === 'Mafia').length, correctVotes: g.votes.filter(v => v.voter === 'you' && player(g, v.target).role === 'Mafia').length, wrongVotes: g.votes.filter(v => v.voter === 'you' && player(g, v.target).role !== 'Mafia').length, humanWon: ROLE_INFO[you.role].team === g.winner, explanation: g.winner === 'Mafia' ? 'The Mafia redirected suspicion and survived the town’s votes. With as many Mafia as townspeople remaining, they control the table.' : 'The town followed the trail through accusations, investigations, and voting patterns. The last Mafia member has been exposed.' } : null };
}
function expect(g, phases) { if (!phases.includes(g.phase)) throw new GameError(`That action is not available during ${g.phase.toLowerCase().replaceAll('_', ' ')}.`); }
function validTarget(g, id, allowSelf = false) { const p = player(g, id); if (!p || !p.alive || (!allowSelf && id === 'you')) throw new GameError('Choose a living character.'); return p; }
function finish(g) { g.winner = winner(g); if (g.winner) { g.phase = 'GAME_OVER'; addEvent(g, { type: 'end', text: `${g.winner.toUpperCase()} WINS. Every secret is revealed.` }); return true; } return false; }
function night(g, targetId) {
  const you = human(g); const alive = living(g); let target;
  if (you.alive && you.role !== 'Civilian') { target = validTarget(g, targetId, you.role === 'Doctor'); if (!eligible(g).includes(target)) throw new GameError('You cannot target your Mafia teammate.'); }
  // All choices are made from the same snapshot, before anyone is removed.
  const mafiosi = alive.filter(p => p.role === 'Mafia'); const town = alive.filter(p => p.role !== 'Mafia');
  const attack = you.alive && you.role === 'Mafia' ? target : [...town].sort((a, b) => threat(b) - threat(a))[0];
  function threat(p) { return (p.claimed === 'Detective' ? 60 : 0) + p.intelligence * .19 + p.social * .1 + mafiosi.reduce((s, m) => s + (p.suspicion[m.id] || 0), 0) * .23 + Math.random() * 12; }
  const doctor = alive.find(p => p.role === 'Doctor'); let protectedPlayer;
  if (doctor) {
    if (doctor.id === 'you') protectedPlayer = target;
    else { const options = [...alive].sort((a, b) => protectionScore(b) - protectionScore(a)); protectedPlayer = options[0]; }
  }
  function protectionScore(p) { const oldAttack = [...g.events].reverse().find(e => e.type === 'death' && e.phase === 'MORNING'); return (p.claimed === 'Detective' ? 65 : 0) + (doctor.trust[p.id] || 50) * .25 + p.social * .15 + (p.id === doctor.id ? 17 : 0) + (oldAttack && p.intelligence > 80 ? 8 : 0) + Math.random() * 23; }
  const detective = alive.find(p => p.role === 'Detective');
  if (detective) {
    const investigate = detective.id === 'you' ? target : [...alive].filter(p => p.id !== detective.id && !detective.investigations[p.id]).sort((a, b) => detective.suspicion[b.id] - detective.suspicion[a.id])[0];
    if (investigate) { const result = investigate.role === 'Mafia' ? 'Mafia' : 'Town'; detective.investigations[investigate.id] = result; changeOpinion(detective, investigate.id, result === 'Mafia' ? 100 : -100); if (detective.id === 'you') g.privateNotes.push({ round: g.round, target: investigate.id, name: investigate.name, result, text: `Investigated ${investigate.name}: ${result === 'Mafia' ? 'MAFIA' : 'NOT MAFIA'}.` }); }
  }
  g.phase = 'MORNING';
  if (attack && protectedPlayer?.id === attack.id) { g.nightResult = { saved: true, text: 'Someone was attacked last night… but survived. The Doctor chose well.' }; addEvent(g, { type: 'save', text: g.nightResult.text }); }
  else if (attack) {
    attack.alive = false; g.nightResult = { saved: false, target: attack.id, name: attack.name, role: attack.role, text: `${attack.name} didn’t survive the night. Their role was ${attack.role}.` }; addEvent(g, { type: 'death', target: attack.id, text: g.nightResult.text });
    for (const p of living(g)) { remember(p, { type: 'night', target: attack.id, round: g.round, text: g.nightResult.text }); const enemies = g.events.filter(e => e.type === 'accusation' && e.actor === attack.id); for (const e of enemies.slice(-2)) changeOpinion(p, e.target, p.intelligence * .08); }
  }
  addMessage(g, 'system', g.nightResult.text, 'night');
}
function ballot(g, targetId) {
  const you = human(g); const voters = living(g); const entries = [];
  if (you.alive) { const target = validTarget(g, targetId); entries.push({ voter: 'you', target: target.id, round: g.round }); }
  for (const p of voters.filter(p => p.id !== 'you')) { const target = chooseSuspect(g, p, true); entries.push({ voter: p.id, target: target.id, round: g.round }); }
  const counts = {}; entries.forEach(v => { counts[v.target] = (counts[v.target] || 0) + 1; });
  const high = Math.max(...Object.values(counts)); const leaders = Object.keys(counts).filter(id => counts[id] === high);
  g.ballot = { entries, counts, tie: leaders.length > 1, eliminated: leaders.length === 1 ? leaders[0] : null };
  g.votes.push(...entries); g.phase = 'VOTE_REVEAL';
  for (const v of entries) { const event = { type: 'vote', actor: v.voter, target: v.target, round: g.round, text: `${player(g, v.voter).name} voted for ${player(g, v.target).name}.` }; addEvent(g, event); for (const p of voters) remember(p, event); changeOpinion(player(g, v.target), v.voter, 17); }
}
function eliminate(g) {
  g.phase = 'ELIMINATION';
  if (g.ballot.tie) { g.elimination = { tie: true, text: 'The vote is tied. No one is eliminated. The Mafia gets another night.' }; addEvent(g, { type: 'tie', text: g.elimination.text }); addMessage(g, 'system', g.elimination.text); return; }
  const victim = player(g, g.ballot.eliminated); victim.alive = false;
  g.elimination = { target: victim.id, name: victim.name, role: victim.role, count: g.ballot.counts[victim.id], text: `${victim.name} was eliminated with ${g.ballot.counts[victim.id]} votes. Role: ${victim.role}.` }; addEvent(g, { type: 'elimination', target: victim.id, text: g.elimination.text });
  for (const p of living(g)) for (const v of g.ballot.entries) changeOpinion(p, v.voter, v.target === victim.id ? (victim.role === 'Mafia' ? -22 : 13) : (victim.role === 'Mafia' ? 8 : -4));
  for (const p of living(g).filter(p => p.id !== 'you').slice(0, 3)) addMessage(g, p.id, styleLine(p, victim.role === 'Mafia' ? `${victim.name} was Mafia. Now look at who tried to keep them here.` : `${victim.name} was innocent. We need to rethink this—and remember who drove that vote.`), 'reaction');
}
export async function act(g, action, data = {}) {
  if (action === 'next') {
    switch (g.phase) {
      case 'ROLE_ASSIGNMENT': g.phase = 'NIGHT'; addEvent(g, { type: 'phase', text: 'Night falls. The city keeps its secrets.' }); break;
      case 'MORNING': if (!finish(g)) { g.phase = 'DISCUSSION'; makeDiscussion(g, addMessage, addEvent); } break;
      case 'DISCUSSION': g.phase = 'QUESTIONING'; break;
      case 'QUESTIONING': g.phase = 'VOTING'; addEvent(g, { type: 'phase', text: 'The table must decide. Who is the Mafia?' }); break;
      case 'VOTE_REVEAL': eliminate(g); break;
      case 'ELIMINATION': if (!finish(g)) { g.round++; g.phase = 'NIGHT'; g.accusationTargets = []; g.questionCount = 0; g.nightResult = null; g.elimination = null; g.ballot = null; addEvent(g, { type: 'phase', text: 'Night falls. Every empty chair tells a story.' }); } break;
      default: throw new GameError('Complete the current phase first.');
    }
  } else if (action === 'night') { expect(g, ['NIGHT']); night(g, data.target); }
  else if (action === 'vote') { expect(g, ['VOTING']); ballot(g, data.target); }
  else if (action === 'question') {
    expect(g, ['DISCUSSION', 'QUESTIONING']); if (!human(g).alive) throw new GameError('You are a spectator. The living must decide.');
    if (g.questionCount >= 24) throw new GameError('The table has heard enough. It’s time to vote.');
    const p = validTarget(g, data.target); const question = String(data.question || '').trim(); if (!question || question.length > 400) throw new GameError('Ask a question between 1 and 400 characters.');
    g.questionCount++; addMessage(g, 'you', `${p.name}, ${question}`, 'question');
    const result = await enhancedAnswer(g, p, question, answerQuestion(g, p, question)); addMessage(g, p.id, result.text, 'answer', result.source);
    remember(p, { type: 'question', actor: 'you', round: g.round, text: `You asked ${p.name}: ${question}` }); changeOpinion(p, 'you', /lying|mafia|guilty/i.test(question) ? 4 : -2);
  } else if (action === 'accuse') {
    expect(g, ['DISCUSSION', 'QUESTIONING']); if (!human(g).alive) throw new GameError('Spectators cannot accuse players.'); const p = validTarget(g, data.target);
    if (g.accusationTargets.includes(p.id) || g.accusationTargets.length >= 3) throw new GameError('You’ve made your point. Let the table consider it.');
    g.accusationTargets.push(p.id); const evidence = human(g).investigations[p.id] === 'Mafia';
    const text = evidence ? `I’m the Detective. I investigated ${p.name} and the result was MAFIA.` : `I suspect ${p.name}. I want everyone to watch their story and their vote.`;
    if (evidence) human(g).claimed = 'Detective'; addMessage(g, 'you', text, 'accusation');
    const e = { type: 'accusation', actor: 'you', target: p.id, text: `You ${evidence ? 'shared an investigation against' : 'accused'} ${p.name}.`, round: g.round }; addEvent(g, e);
    for (const a of living(g)) { remember(a, e); changeOpinion(a, p.id, evidence ? 35 : 10 * ((a.trust.you || 40) / 60)); }
    changeOpinion(p, 'you', 15); p.emotion = 'Under pressure'; addMessage(g, p.id, styleLine(p, `That’s a serious accusation. ${answerQuestion(g, p, 'Who do you suspect?')}`), 'response');
  } else throw new GameError('Unknown game action.');
  return publicState(g);
}
