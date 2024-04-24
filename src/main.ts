import "./style.css";
import {
  WidgetEventCapability,
  EventDirection,
  IOpenIDCredentials,
  MatrixCapabilities,
} from "matrix-widget-api";
import { WidgetApiImpl } from "@matrix-widget-toolkit/api";

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
  const widgetApi = await WidgetApiImpl.create({
    capabilities: initialCapabilities,
  });

  const urlParams = new URLSearchParams(window.location.search);
  const deviceId = urlParams.get("device_id")!;
  const roomId = urlParams.get("room_id")!;
  const displayName = urlParams.get("display_name")!;

  const roomName =
    (
      await widgetApi.receiveStateEvents<{ name: string }>(
        STATE_EVENT_ROOM_NAME
      )
    )[0]?.content?.name ?? roomId;

  const token = await widgetApi.requestOpenIDConnectToken();
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
    (widgetApi as WidgetApiImpl).matrixWidgetApi.setAlwaysOnScreen(true);

    window.location.replace(url);
    // const iframe = document.getElementById("widgetFrame") as HTMLIFrameElement;
    // iframe.src = url;
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
