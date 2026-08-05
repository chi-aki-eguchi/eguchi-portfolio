// Where the visitor was on each page, for the lifetime of this tab.
//
// PageTransition scrolls to the top on every route change, which is right going
// forward and wrong on Back — on a gallery thousands of pixels tall, one tap on
// About threw away all the browsing.
//
// The restore is clamped by however much content the returning page has
// rendered: a gallery that was 84 tiles deep comes back with its first batch,
// so asking for 2400px lands at 692px. Restoring the batch count as well is
// backlog B-18.
//
// Deliberately in memory rather than sessionStorage: a reload should start
// clean, and this must never outlive the tab.
const positions = new Map<string, number>();

export const scrollMemory = {
  remember(path: string, y: number) {
    positions.set(path, y);
  },
  get(path: string): number {
    return positions.get(path) ?? 0;
  },
  forget(path: string) {
    positions.delete(path);
  },
};
