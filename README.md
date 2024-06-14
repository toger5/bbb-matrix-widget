## A widget wrapper for BigBlueButton

This is a widget that will communicate over the widget api with element web.

### It does the following

 - Get an openId token form element web.
 - Connect to the bbb jwt auth service with that token and get a bbb join url.
 - Show the bbb html frontend in an iframe using the aquired join url.
 - Communicates with the BBB app (3.0) to listen for sent messages, start and stop of the call.
 - Posts matrixRTC room state events (based on the messages it gets from BBB) to element web using the widget api so they get forwarded to the room state.
- The widget needs to be configured with the url to a hosted version of: https://github.com/toger5/bbb-jwt-service
   - This is a livekit jwt service as used for element call. (See the element call repo for more details on how to host element call)

## Build

 - Clone the repo.
 - Run `yarn` in the cloned folder.
 - Run `yarn build`. Vite will build a dist folder with the static page.

## Deploy

You need to deliver the build using a webserver.
Configure you webserver to expose the `path/to/bbb-matrix-widget/dist/index.html` for your desired url (e.g. `https://some-bbb-domain.com/widget`).

We provide several pre-built options for you:

- For each push to this repo a build artifact can be downloaded from the `build-and-publish` workflow.
- For testing purposes the last build of the `main` branch is deployed to the github-pages of this repository.
- You can use the docker images provided under 'packages'.
  They contain a nginx that delivers the static widget on port 80.
  So you can run the container like this: `docker run -p 8080:80 -d bbb-matrix-widget:latest`.

### Configuration

You need to set at least `bbbServiceUrl` from the [config.json](public/config.json).
This should be the url of where the [bbb-auth-service](https://github.com/toger5/bbb-jwt-service) is hosted.

Optionally a `livekitServiceUrl` can be configured. If BBB has the livekit feature flag activated, full matrixRTC interoperablility is possible (e.g. fluffychat, bbb, element call, ...).

In docker you can simply override the `config.json`:

```
docker run -p 127.0.0.1:8080:80 -v $PWD/config.json:/usr/share/nginx/html/config.json -d bbb-matrix-widget:latest
```

### Integrate into Element-Web

The best way to integrate is using the the BigBlueButton Call integration. For this the widget url needs to be added to the element web config. Read the [PR description](https://github.com/matrix-org/matrix-react-sdk/pull/12452)

To integrate the widget inside element-web use the widget url (`https://some-bbb-domain.com/widget` in this case) with the following parameters:

```
https://some-bbb-domain.com/widget?device_id=$org.matrix.msc3819.matrix_device_id&room_id=$matrix_room_id&display_name=$matrix_display_name&baseUrl=$org.matrix.msc4039.matrix_base_url&userId=$matrix_user_id
```
