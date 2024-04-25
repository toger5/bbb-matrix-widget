import { MatrixRTCSession } from "matrix-js-sdk/src/matrixrtc/MatrixRTCSession";

export interface LivekitFocus {
  type: "livekit";
  livekit_service_url: string;
  livekit_alias: string;
}

export function makeFocus(
  livekitAlias: string,
  session: MatrixRTCSession,
  serviceUrl: string
): LivekitFocus {
  const fociFromSession = session.memberships[0]?.getActiveFoci()[0];
  if (fociFromSession?.type === "livekit") {
    const f = fociFromSession as LivekitFocus;
    return {
      type: "livekit",
      livekit_service_url: f.livekit_service_url,
      livekit_alias: f.livekit_alias,
    };
  }
  return {
    type: "livekit",
    livekit_service_url: serviceUrl,
    livekit_alias: livekitAlias,
  };
}
