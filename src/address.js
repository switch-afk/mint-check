const ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

// Decodes a base58 string into bytes. Returns null if the input is not valid base58.
export function decodeBase58(input) {
  if (typeof input !== 'string' || input.length === 0) return null;

  let num = 0n;
  for (const char of input) {
    const digit = ALPHABET.indexOf(char);
    if (digit === -1) return null;
    num = num * 58n + BigInt(digit);
  }

  const bytes = [];
  while (num > 0n) {
    bytes.unshift(Number(num % 256n));
    num /= 256n;
  }

  // Each leading "1" stands for a leading zero byte.
  for (const char of input) {
    if (char !== '1') break;
    bytes.unshift(0);
  }

  return Uint8Array.from(bytes);
}

// A Solana address is a base58 string that decodes to exactly 32 bytes.
export function isValidAddress(input) {
  const bytes = decodeBase58(input);
  return bytes !== null && bytes.length === 32;
}