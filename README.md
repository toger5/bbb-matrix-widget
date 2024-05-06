## A widget wrapper for BigBlueButton
It is a widget that will communicate over the widget api with element web.

It does the following
 - Get an openId token form element web.
 - Connect to the bbb jwt auth service with that token and get a bbb join url.
 - Show the bbb html frontend in an iframe using the aquired join url.
 - Communicates with the BBB app (3.0) to listen for sent messages, start and stop of the call.
 - Posts matrixRTC room state events (based on the messages it gets from BBB) to element web using the widget api so they get forwarded to the room state.
- The widget needs to be configured with the url to a hosted version of: https://github.com/toger5/bbb-jwt-service
 - This configuration is done by changing the values here: https://github.com/toger5/bbb-matrix-widget/blob/main/src/main.ts#L15-L16
 - Optionally a [livekit service url](https://github.com/toger5/bbb-matrix-widget/blob/main/src/main.ts#L15-L16) can be configured! If BBB has the livekit feature flag activated, full matrixRTC interoperablility is possible (e.g. fluffychat, bbb, element call, ...)
   - This is a livekit jwt service as used for element call. (See the element call repo for more details on how to host element call)


Build and deploy
 - clone the repo.
 - run `yarn` in the cloned folder.
 - run `yarn build`. Vite will build a dist folder with the static page.
 - configure you webserver to expose the `path/to/bbb-matrix-widget/dist/index.html`for your desired url. (e.g. `https://some-bbb-domain.com/widget`)
 - To integrate the widget inside element-web use the following widget url:
```
https://some-bbb-domain.com/widget?device_id=$org.matrix.msc3819.matrix_device_id&room_id=$matrix_room_id&display_name=$matrix_display_name&baseUrl=$org.matrix.msc4039.matrix_base_url&userId=$matrix_user_id
```
 - The best way to integrate is using the the BigBlueButton Call integration. For this the widget url needs to be added to the element web config. Read the [PR description](https://github.com/matrix-org/matrix-react-sdk/pull/12452)
