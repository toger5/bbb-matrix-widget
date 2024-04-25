import { MatrixRTCSession } from "matrix-js-sdk/src/matrixrtc/MatrixRTCSession";
import { LIVEKIT_SERVICE_URL } from "./main";

export interface LivekitFocus {
  type: "livekit";
  livekit_service_url: string;
  livekit_alias: string;
}

export function makeFocus(
  livekitAlias: string,
  session: MatrixRTCSession
): LivekitFocus {
  const fociFromSession = session.memberships[0].getActiveFoci()[0];
  if (fociFromSession.type === "livekit") {
    const f = fociFromSession as LivekitFocus;
    return {
      type: "livekit",
      livekit_service_url: f.livekit_service_url,
      livekit_alias: f.livekit_alias,
    };
  }
  const urlFromConf = LIVEKIT_SERVICE_URL;
  return {
    type: "livekit",
    livekit_service_url: urlFromConf,
    livekit_alias: livekitAlias,
  };
}
