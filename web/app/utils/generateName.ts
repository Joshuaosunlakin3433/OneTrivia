const ADJECTIVES = [
  "Neon",
  "Glitch",
  "Cyber",
  "Void",
  "Quantum",
  "Iron",
  "Phantom",
  "Shadow",
  "Flux",
  "Turbo",
  "Blaze",
  "Crimson",
];

const NOUNS = [
  "Samurai",
  "Hacker",
  "Runner",
  "Phantom",
  "Cipher",
  "Nexus",
  "Ronin",
  "Sentinel",
  "Specter",
  "Viper",
  "Byte",
  "Drifter",
];

/**
 * Deterministic name from a Sui address.
 * Parses hex characters to pick one Adjective + one Noun.
 */
export function generateName(address: string): string {
  const hex = address.startsWith("0x") ? address.slice(2) : address;
  const adjIndex = parseInt(hex.slice(0, 4), 16) % ADJECTIVES.length;
  const nounIndex = parseInt(hex.slice(4, 8), 16) % NOUNS.length;
  return `${ADJECTIVES[adjIndex]} ${NOUNS[nounIndex]}`;
}

export function truncateAddress(address: string): string {
  if (address.length < 10) return address;
  return `0x${address.slice(2, 6)}\u2026${address.slice(-4)}`;
}
