export const ROLE_INFO = {
  Civilian: { team: 'Town', tagline: 'Your voice is your weapon.', description: 'Read the room, find contradictions, and vote out the Mafia. You have no night action.' },
  Detective: { team: 'Town', tagline: 'The truth has a price.', description: 'Investigate one living player each night. Their allegiance is revealed only to you. Choose carefully when to share it.' },
  Doctor: { team: 'Town', tagline: 'One life. One decision.', description: 'Protect one living player each night, including yourself. If the Mafia attacks them, they survive.' },
  Mafia: { team: 'Mafia', tagline: 'Lie well. Leave no witnesses.', description: 'Choose a town player to eliminate each night. Deceive the table and reach equal numbers with the town to win.' }
};
export const living = g => g.players.filter(p => p.alive);
export const human = g => g.players.find(p => p.id === 'you');
export const player = (g, id) => g.players.find(p => p.id === id);
export function winner(g) { const alive = living(g); const mafia = alive.filter(p => p.role === 'Mafia').length; return mafia === 0 ? 'Town' : mafia >= alive.length - mafia ? 'Mafia' : null; }
export function eligible(g, role = human(g).role) { return living(g).filter(p => role === 'Doctor' || (p.id !== 'you' && (role !== 'Mafia' || p.role !== 'Mafia'))); }
