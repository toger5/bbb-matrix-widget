import "./style.css";
import { widget } from "./widget";

import { makeFocus } from "./focusLivekit";
import { getSFUConfigWithOpenID } from "./openIdLivekit";
import { getBBBJoinUrl } from "./joinUrlBigBlueButton";
import { MatrixEvent, RoomEvent } from "matrix-js-sdk";

// TODO load this from the right place
// this should either be done by reading the current rtc session in the room or by using a config.json fallback
const BBB_SERVICE_URL = "https://droplet-7099.meetbbb.com/service";
const LIVEKIT_SERVICE_URL = "https://livekit-jwt.call.element.dev";

async function setup() {
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

    const focus = makeFocus(room.roomId, session, LIVEKIT_SERVICE_URL);
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
