import "./style.css";
import { IOpenIDCredentials } from "matrix-widget-api";
import { widget } from "./widget";
const STATE_EVENT_CALL_MEMBERS = "m.call.member";
const STATE_EVENT_ROOM_NAME = "m.room.name";
// TODO load this from the right place
// this should either be done by reading the current rtc session in the room or by using a config.json fallback
const BBB_SERVICE_URL = "https://droplet-7099.meetbbb.com/service";

async function setup() {
  if (!widget) {
    console.error("Widget not found");
    throw new Error("Widget not found");
  }
  const client = await widget.client;

  const urlParams = new URLSearchParams(window.location.search);
  const deviceId = urlParams.get("device_id")!;
  const roomId = urlParams.get("room_id")!;
  const displayName = urlParams.get("display_name")!;
  const room = client.getRoom(roomId);
  if (!room) {
    console.error("Room not found");
    throw new Error("Room not found");
  }

  const roomName = room.name;

  const token = await client.getOpenIdToken();
  const appContainer = document.getElementById("app");
  if (appContainer) {
    const t = token.access_token ?? "{No access token found!}";
    const d = token.matrix_server_name ?? "{No matrix server found!}";
    const n = roomName;
    const r = roomId;
    appContainer.innerText = `Token: ${t}\n\nServer: ${d}\nroomName: ${n}\nroomId: ${r}\nJoinURL: unknown`;

    const { url } = await getBBBJoinUrl(
      deviceId,
      roomId,
      displayName,
      BBB_SERVICE_URL,
      roomName,
      token
    );

    console.log("Join URL: ", url);
    appContainer.innerText = `Token: ${t}\n\nServer: ${d}\nroomName: ${n}\nroomId: ${r}\nJoinURL: ${url}`;
    const iframe = document.getElementById("widgetFrame") as HTMLIFrameElement;
    const iframeFeatures =
      "microphone *; camera *; encrypted-media *; autoplay *; display-capture *; clipboard-write *; " +
      "clipboard-read *;";
    iframe.allow = iframeFeatures;
    iframe.src = url;

    const session = client.matrixRTC.getRoomSession(room);
    window.onmessage = (event) => {
      if (event.data.api !== "fromBBB") return;

      switch (event.data.action) {
        case "leave":
          session.leaveRoomSession();
          widget?.api.setAlwaysOnScreen(false);
          break;

        case "join":
          widget?.api.setAlwaysOnScreen(true);
          session.joinRoomSession([]);
          session.joinRoomSession([]);
          break;
        case "request_credentials":
          const response = {
            api: "toBBB",
            action: "lk-credentials",
            data: {
              jwt: "test",
              websocket_url: "test",
              lk_alias: "test",
            },
          };
          iframe.contentWindow?.postMessage(response, "*");
      }
    };
    // if there is a running session join it
    session.memberships[0]?.
    // if there is no running session create one with default livekit sfu.
  }
}

interface BBBJoinUrl {
  url: string;
}

async function getBBBJoinUrl(
  deviceId: string,
  roomId: string,
  displayName: string,
  bbbServiceUrl: string,
  roomName: string,
  openIDToken: IOpenIDCredentials
): Promise<BBBJoinUrl> {
  try {
    const health = await fetch(bbbServiceUrl + "/healthz");
    console.log("Health check response: ", health);

    const res = await fetch(bbbServiceUrl + "/get_join_url", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        room_name: roomName,
        room_id: roomId,
        openid_token: openIDToken,
        device_id: deviceId,
        display_name: displayName,
      }),
    });
    if (!res.ok) {
      throw new Error("SFU Config fetch failed with status code " + res.status);
    }
    return await res.json();
  } catch (e) {
    throw new Error("SFU Config fetch failed with exception " + e);
  }
}

setup();
