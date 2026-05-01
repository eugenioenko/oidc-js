import Router from "preact-router";
import { HomePage } from "./pages/Home.js";
import { CallbackPage } from "./pages/Callback.js";
import { ProtectedA } from "./pages/ProtectedA.js";
import { ProtectedB } from "./pages/ProtectedB.js";

export function App() {
  return (
    <Router>
      <HomePage path="/" />
      <CallbackPage path="/callback" />
      <ProtectedA path="/protected-a" />
      <ProtectedB path="/protected-b" />
    </Router>
  );
}
