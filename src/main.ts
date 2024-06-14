window.global ||= window;
import "./style.css";
import { widget } from "./widget";

import { makeFocus } from "./focusLivekit";
import { getSFUConfigWithOpenID } from "./openIdLivekit";
import { getBBBJoinUrl } from "./joinUrlBigBlueButton";
import {
  MatrixEvent,
  RoomEvent,
} from "../node_modules/matrix-js-sdk/src/matrix";

async function fetchConfig() {
  try {
    const response = await fetch('/config.json');
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error("Failed to load configuration:", error);
    throw error;
  }
}

async function setup() {

  const config = await fetchConfig();
  const bbbServiceUrl = config.bbbServiceUrl;
  const livekitServiceUrl = config.livekitServiceUrl;
  console.log("bbb-widget -- config: ", config);

  if (!widget) {
    console.error("Widget not found");
    throw new Error("Widget not found");
  }
  widget.api.requestCapabilityToReceiveEvent("m.room.message");
  widget.api.requestCapabilityToSendEvent("m.room.message");
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
      bbbServiceUrl,
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

    const focus = makeFocus(room.roomId, session, livekitServiceUrl);
    const sfuPromise = getSFUConfigWithOpenID(client, focus);
    console.log("bbb-widget -- got focus: ", focus);

    client.on(RoomEvent.Timeline, (event) => {
      if (event.getType() === "m.room.message") {
        const matrixEvent = event as MatrixEvent;
        const content = matrixEvent.getContent();
        if (content.msgtype === "m.text") {
          const message = content.body;
          const response = {
            api: "toBBB",
            action: "send_message",
            data: {
              message,
            },
          };
          console.log("bbb-widget -- Matrix message to BBB", response);
          iframe.contentWindow?.postMessage(response, "*");
        }
      }
    });

    window.onmessage = async (event) => {
      console.log("bbb-widget -- got postmessage event from BBB: ", event);

      if (event.data.api !== "fromBBB") return;

      switch (event.data.action) {
        case "leave":
          console.log("bbb-widget -- Leaving room session");
          session.leaveRoomSession();
          widget?.api.setAlwaysOnScreen(false);
          break;

        case "join":
          console.log("bbb-widget -- Joining room session");
          widget?.api.setAlwaysOnScreen(true);
          session.joinRoomSession([focus]);
          break;
        case "request_credentials":
          // console.log("Requesting credentials");
          const sfuConf = await sfuPromise;
          const response = {
            api: "toBBB",
            action: "lk-credentials",
            data: {
              jwt: sfuConf?.jwt,
              websocket_url: sfuConf?.url,
              lk_alias: focus.livekit_alias,
            },
          };
          console.log("bbb-widget -- Sent credentials", response);
          iframe.contentWindow?.postMessage(response, "*");
          break;
        case "send_message":
          client.sendTextMessage(roomId, event.data.data.message);
      }
    };
  }
}

setup();
