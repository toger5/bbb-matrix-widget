import "./style.css";
import {
  WidgetEventCapability,
  EventDirection,
  IOpenIDCredentials,
  MatrixCapabilities,
} from "matrix-widget-api";
import { WidgetApiImpl } from "@matrix-widget-toolkit/api";
import { initClient } from "./matrix-utils";
import { widget } from "./widget";
import { MatrixClient } from "matrix-js-sdk/src/matrix";

const STATE_EVENT_CALL_MEMBERS = "m.call.member";
const STATE_EVENT_ROOM_NAME = "m.room.name";
// TODO load this from the right place
// this should either be done by reading the current rtc session in the room or by using a config.json fallback
const BBB_SERVICE_URL = "https://droplet-7099.meetbbb.com/service";

const initialCapabilities = [
  WidgetEventCapability.forStateEvent(
    EventDirection.Receive,
    STATE_EVENT_CALL_MEMBERS
  ),
  WidgetEventCapability.forStateEvent(
    EventDirection.Send,
    STATE_EVENT_CALL_MEMBERS
  ),
  WidgetEventCapability.forRoomEvent(EventDirection.Send, "m.room.message"),
  WidgetEventCapability.forStateEvent(
    EventDirection.Receive,
    STATE_EVENT_ROOM_NAME
  ),
  MatrixCapabilities.AlwaysOnScreen,
];
async function setup() {
  // const widgetApi = await WidgetApiImpl.create({
  //   capabilities: initialCapabilities,
  // });
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
  // const roomName =
  //   (
  //     await widgetApi.receiveStateEvents<{ name: string }>(
  //       STATE_EVENT_ROOM_NAME
  //     )
  //   )[0]?.content?.name ?? roomId;

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

    // if there is a running session join it

    // if there is no running session create one with default livekit sfu.

    console.log("Join URL: ", url);
    appContainer.innerText = `Token: ${t}\n\nServer: ${d}\nroomName: ${n}\nroomId: ${r}\nJoinURL: ${url}`;
    // (widgetApi as WidgetApiImpl).matrixWidgetApi.setAlwaysOnScreen(true);

    // window.location.replace(url);
    const iframe = document.getElementById("widgetFrame") as HTMLIFrameElement;
    const iframeFeatures =
      "microphone *; camera *; encrypted-media *; autoplay *; display-capture *; clipboard-write *; " +
      "clipboard-read *;";
    iframe.allow = iframeFeatures;
    iframe.src = url;

    const session = client.matrixRTC.getRoomSession(room);
    session.joinRoomSession([]);
    widget.api.setAlwaysOnScreen(true);
    let seconds = 0;
    const count = (): void => {
      if (seconds < 20) {
        seconds++;
        // eslint-disable-next-line no-console
        console.log("Leaving meeting in: ", seconds);
        appContainer.innerText = `Leave in 20 - ${seconds} Token: ${t}\n\nServer: ${d}\nroomName: ${n}\nroomId: ${r}\nJoinURL: unknown`;

        setTimeout(() => count(), 1000);
      } else {
        session.leaveRoomSession();
        widget?.api.setAlwaysOnScreen(false);
      }
    };
    count();
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
