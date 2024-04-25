import { IOpenIDCredentials } from "matrix-widget-api";

export interface BBBJoinUrl {
  url: string;
}

export async function getBBBJoinUrl(
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
