import React from "react";
import ReactDOM from "react-dom";
import { BrowserRouter } from "react-router-dom";
import { SimplePool } from "nostr-tools";
import * as serviceWorker from "./serviceWorker";
import "bootstrap/dist/css/bootstrap.min.css";
import "./assets/css/sass/themes/gogo.light.blue.scss";
import "./assets/fonts/simple-line-icons/css/simple-line-icons.css";
import "./assets/fonts/iconsmind-s/css/iconsminds.css";
import "./assets/fonts/nostr/css/nostr.css";
import "./editor.css";
import "./Workspace.scss";
import "./App.css";
import "react-quill/dist/quill.bubble.css";
import { createEncryption } from "./encryption";
import { ConfigurationContextProvider } from "./ConfigurationContext";
import { ApiProvider } from "./Apis";
import { App } from "./App";
import { NostrAuthContextProvider } from "./NostrAuthContext";

const BOOTSTRAP_INTERVAL = 10;

function createFileStore(): LocalStorage {
  return {
    setLocalStorage: (key: string, value: string) =>
      window.localStorage.setItem(key, value),
    getLocalStorage: (key: string) => window.localStorage.getItem(key),
    deleteLocalStorage: (key: string) => window.localStorage.removeItem(key),
  };
}

ReactDOM.render(
  <BrowserRouter>
    <ConfigurationContextProvider bootstrapInterval={BOOTSTRAP_INTERVAL}>
      <ApiProvider
        apis={{
          encryption: createEncryption(),
          fileStore: createFileStore(),
          relayPool: new SimplePool(),
        }}
      >
        <NostrAuthContextProvider>
          <App />
        </NostrAuthContextProvider>
      </ApiProvider>
    </ConfigurationContextProvider>
  </BrowserRouter>,
  document.getElementById("root")
);

serviceWorker.unregister();
