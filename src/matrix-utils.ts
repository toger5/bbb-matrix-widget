import { IndexedDBStore } from "matrix-js-sdk/src/store/indexeddb";
import { MemoryStore } from "matrix-js-sdk/src/store/memory";
import { IndexedDBCryptoStore } from "matrix-js-sdk/src/crypto/store/indexeddb-crypto-store";
import { LocalStorageCryptoStore } from "matrix-js-sdk/src/crypto/store/localStorage-crypto-store";
import { MemoryCryptoStore } from "matrix-js-sdk/src/crypto/store/memory-crypto-store";
import { createClient, ICreateClientOpts } from "matrix-js-sdk/src/matrix";
import { ClientEvent } from "matrix-js-sdk/src/client";
import { ISyncStateData, SyncState } from "matrix-js-sdk/src/sync";
import { logger } from "matrix-js-sdk/src/logger";

import type { MatrixClient } from "matrix-js-sdk/src/client";
import IndexedDBWorker from "./IndexedDBWorker?worker";

import Olm from "@matrix-org/olm";
import olmWasmPath from "@matrix-org/olm/olm.wasm?url";

let olmLoaded: Promise<void> | null = null;

/**
 * Loads Olm, if not already loaded.
 */
export const loadOlm = (): Promise<void> =>
  (olmLoaded ??= Olm.init({ locateFile: () => olmWasmPath }));

export class CryptoStoreIntegrityError extends Error {
  public constructor() {
    super("Crypto store data was expected, but none was found");
  }
}

const SYNC_STORE_NAME = "element-call-sync";
// Note that the crypto store name has changed from previous versions
// deliberately in order to force a logout for all users due to
// https://github.com/vector-im/element-call/issues/464
// (It's a good opportunity to make the database names consistent.)
const CRYPTO_STORE_NAME = "element-call-crypto";

function waitForSync(client: MatrixClient): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const onSync = (
      state: SyncState,
      _old: SyncState | null,
      data?: ISyncStateData
    ): void => {
      if (state === "PREPARED") {
        client.removeListener(ClientEvent.Sync, onSync);
        resolve();
      } else if (state === "ERROR") {
        client.removeListener(ClientEvent.Sync, onSync);
        reject(data?.error);
      }
    };
    client.on(ClientEvent.Sync, onSync);
  });
}
/**
 * Initialises and returns a new standalone Matrix Client.
 * If true is passed for the 'restore' parameter, a check will be made
 * to ensure that corresponding crypto data is stored and recovered.
 * If the check fails, CryptoStoreIntegrityError will be thrown.
 * @param clientOptions Object of options passed through to the client
 * @param restore Whether the session is being restored from storage
 * @returns The MatrixClient instance
 */
export async function initClient(
  clientOptions: ICreateClientOpts,
  restore: boolean
): Promise<MatrixClient> {
  await loadOlm();

  let indexedDB: IDBFactory | undefined;
  try {
    indexedDB = window.indexedDB;
  } catch (e) {}

  // options we always pass to the client (stuff that we need in order to work)
  const baseOpts = {
    fallbackICEServerAllowed: true,
  } as ICreateClientOpts;

  if (indexedDB && localStorage) {
    baseOpts.store = new IndexedDBStore({
      indexedDB: window.indexedDB,
      localStorage,
      dbName: SYNC_STORE_NAME,
      // We can't use the worker in dev mode because Vite simply doesn't bundle workers
      // in dev mode: it expects them to use native modules. Ours don't, and even then only
      // Chrome supports it. (It bundles them fine in production mode.)
      workerFactory: import.meta.env.DEV
        ? undefined
        : (): Worker => new IndexedDBWorker(),
    });
  } else if (localStorage) {
    baseOpts.store = new MemoryStore({ localStorage });
  }

  // Check whether we have crypto data store. If we are restoring a session
  // from storage then we will have started the crypto store and therefore
  // have generated keys for that device, so if we can't recover those keys,
  // we must not continue or we'll generate new keys and anyone who saw our
  // previous keys will not accept our new key.
  // It's worth mentioning here that if support for indexeddb or localstorage
  // appears or disappears between sessions (it happens) then the failure mode
  // here will be that we'll try a different store, not find crypto data and
  // fail to restore the session. An alternative would be to continue using
  // whatever we were using before, but that could be confusing since you could
  // enable indexeddb and but the app would still not be using it.
  if (restore) {
    if (indexedDB) {
      const cryptoStoreExists = await IndexedDBCryptoStore.exists(
        indexedDB,
        CRYPTO_STORE_NAME
      );
      if (!cryptoStoreExists) throw new CryptoStoreIntegrityError();
    } else if (localStorage) {
      if (!LocalStorageCryptoStore.exists(localStorage))
        throw new CryptoStoreIntegrityError();
    } else {
      // if we get here then we're using the memory store, which cannot
      // possibly have remembered a session, so it's an error.
      throw new CryptoStoreIntegrityError();
    }
  }

  if (indexedDB) {
    baseOpts.cryptoStore = new IndexedDBCryptoStore(
      indexedDB,
      CRYPTO_STORE_NAME
    );
  } else if (localStorage) {
    baseOpts.cryptoStore = new LocalStorageCryptoStore(localStorage);
  } else {
    baseOpts.cryptoStore = new MemoryCryptoStore();
  }

  const client = createClient({
    ...baseOpts,
    ...clientOptions,
    useAuthorizationHeader: true,
    // Use a relatively low timeout for API calls: this is a realtime app
    // so we don't want API calls taking ages, we'd rather they just fail.
    localTimeoutMs: 5000,
  });

  try {
    await client.store.startup();
  } catch (error) {
    logger.error(
      "Error starting matrix client store. Falling back to memory store.",
      error
    );
    client.store = new MemoryStore({ localStorage });
    await client.store.startup();
  }

  await client.initCrypto();
  client.setGlobalErrorOnUnknownDevices(false);
  await client.startClient();
  await waitForSync(client);

  return client;
}
