declare module "*.kasper" {
  import type { Component } from "kasper-js";
  type AnyComponent = new (...args: unknown[]) => Component;
  const exports: Record<string, AnyComponent>;
  export = exports;
}
