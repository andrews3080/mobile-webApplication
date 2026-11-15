import type { Clock } from "../application/ports";
import { NOW } from "./builders";

// A clock the test can move forward, to prove rate-limit windows reset
export class MutableClock implements Clock {
  constructor(private current: Date = NOW) {}
  now(): Date {
    return this.current;
  }
  advance(milliseconds: number): void {
    this.current = new Date(this.current.getTime() + milliseconds);
  }
}
