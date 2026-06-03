export function add(a: number, b: number): number {
  return a + b;
}

export function divide(a: number, b: number): number {
  // Bug: does not check for zero denominator, returns infinity or NaN
  // Expected to throw an error for b === 0
  return a / b;
}
