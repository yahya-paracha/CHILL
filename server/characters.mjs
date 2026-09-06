export const CAST = [
  { id: 'alex', name: 'Alex', personality: 'The observer', style: 'calm', color: '#82a9a4', intelligence: 88, aggression: 30, deception: 42, confidence: 72, paranoia: 32, social: 62, bio: 'A measured voice in a room full of noise. Alex watches what people do, not what they promise.' },
  { id: 'sarah', name: 'Sarah', personality: 'The firebrand', style: 'aggressive', color: '#c98571', intelligence: 73, aggression: 93, deception: 62, confidence: 96, paranoia: 53, social: 76, bio: 'Never afraid to make the first accusation. Sarah believes hesitation is just another kind of confession.' },
  { id: 'mike', name: 'Mike', personality: 'The wildcard', style: 'funny', color: '#bca875', intelligence: 57, aggression: 58, deception: 73, confidence: 79, paranoia: 49, social: 85, bio: 'A nervous joke. A sideways glance. Behind the chaos, Mike sometimes spots what everyone else misses.' },
  { id: 'emma', name: 'Emma', personality: 'The analyst', style: 'analytical', color: '#97a6c8', intelligence: 97, aggression: 48, deception: 39, confidence: 84, paranoia: 30, social: 55, bio: 'Every claim is a data point. Every contradiction is a thread. Emma never forgets a detail.' },
  { id: 'daniel', name: 'Daniel', personality: 'The quiet one', style: 'defensive', color: '#8b9c8a', intelligence: 72, aggression: 22, deception: 56, confidence: 42, paranoia: 62, social: 33, bio: 'A man of few words and too many thoughts. Is his silence a shield, or is it hiding something?' },
  { id: 'olivia', name: 'Olivia', personality: 'The diplomat', style: 'social', color: '#bba0b5', intelligence: 82, aggression: 36, deception: 88, confidence: 86, paranoia: 25, social: 98, bio: 'She can make an enemy feel like an old friend. In this room, that might be the most dangerous talent.' },
  { id: 'ryan', name: 'Ryan', personality: 'The skeptic', style: 'paranoid', color: '#ad937a', intelligence: 62, aggression: 72, deception: 47, confidence: 65, paranoia: 97, social: 41, bio: 'The door is locked. The windows are dark. Ryan is quite certain someone here is watching him.' },
  { id: 'sophia', name: 'Sophia', personality: 'The strategist', style: 'strategic', color: '#b0a0cb', intelligence: 95, aggression: 52, deception: 92, confidence: 92, paranoia: 41, social: 88, bio: 'Always two moves ahead. Sophia sees alliances forming long before anyone admits they exist.' }
];
export const clamp = n => Math.max(0, Math.min(100, n));
export const pick = list => list[Math.floor(Math.random() * list.length)];
export function shuffle(list) { const a = [...list]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
export function createPlayers(remix = false) {
  const roles = shuffle(['Mafia', 'Mafia', 'Detective', 'Doctor', ...Array(5).fill('Civilian')]);
  const styles = shuffle(CAST);
  const players = [...CAST.map((p, i) => ({ ...p, ...(remix ? Object.fromEntries(['style', 'personality', 'intelligence', 'aggression', 'deception', 'confidence', 'paranoia', 'social', 'bio'].map(k => [k, styles[i][k]])) : {}) })), { id: 'you', name: 'You', personality: 'The unknown', style: 'human', color: '#d7b883', intelligence: 75, aggression: 50, deception: 50, confidence: 70, paranoia: 50, social: 65, bio: 'The only person at this table you can truly trust. Probably.' }].map((p, i) => ({ ...p, role: roles[i], alive: true, suspicion: {}, trust: {}, memory: [], investigations: {}, emotion: 'Composed', strategy: pick(['frame', 'blend', 'sacrifice', 'defend']), claimed: null }));
  for (const p of players) for (const q of players.filter(q => q.id !== p.id)) { p.suspicion[q.id] = Math.round(18 + Math.random() * 28 + p.paranoia * .15); p.trust[q.id] = 100 - p.suspicion[q.id]; }
  return players;
}
