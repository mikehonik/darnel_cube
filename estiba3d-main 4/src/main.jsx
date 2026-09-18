import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import { Puerta } from "./nube/Puerta.jsx";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <Puerta>{(usuario) => <App usuario={usuario} />}</Puerta>
  </React.StrictMode>
);
