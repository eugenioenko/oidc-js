import { render } from "solid-js/web";
import { Router, Route } from "@solidjs/router";
import { App } from "./App.js";
import { HomePage } from "./pages/Home.js";
import { CallbackPage } from "./pages/Callback.js";
import { ProtectedA } from "./pages/ProtectedA.js";
import { ProtectedB } from "./pages/ProtectedB.js";

render(
  () => (
    <Router root={App}>
      <Route path="/" component={HomePage} />
      <Route path="/callback" component={CallbackPage} />
      <Route path="/protected-a" component={ProtectedA} />
      <Route path="/protected-b" component={ProtectedB} />
    </Router>
  ),
  document.getElementById("root")!,
);
