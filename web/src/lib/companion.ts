import { minutesInZone } from './pace.js';

type Person = { key: string; name: string };

// Personal display copy only: account keys and saved profile names stay intact.
export function displayName(person: Person): string {
  return person.key === 'principessa' ? 'Amira' : person.name;
}

export function greeting(person: Person, timezone: string, now = new Date()): string {
  const minutes = minutesInZone(timezone, now);
  if (person.key === 'principessa') return minutes < 12 * 60 ? 'Buongiorno Amira💛' : 'Ciao Principessa';
  return `${minutes < 12 * 60 ? 'Buongiorno' : 'Ciao'} ${person.name}`;
}

export function loggedMessage(key: string, goalReached: boolean): string {
  if (key === 'principessa') return goalReached ? "That's my Princess💛" : 'Look at her😍';
  return goalReached ? 'Your daily goal is reached.' : 'Water added to your day.';
}
