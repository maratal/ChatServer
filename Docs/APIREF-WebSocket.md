## API Reference

#### [USERS](APIREF-Users.md) • [CHATS](APIREF-Chats.md) • [CONTACTS](APIREF-Contacts.md) • [FILES](APIREF-Files.md) • WEBSOCKET • [JSON](APIREF-JSON.md)
_________________________________________________________________________________

### 1. Opening a websocket

Connect your websocket client to `ws://<server>[:port]/<id>`, where `id` is a [`DeviceSession`](APIREF-JSON.md#devicesession) `id` obtained from the [login](APIREF-Users.md#2-logging-in-user) process. After connection succeeds notifications from the websocket client will be received in the following `JSON` format:

```
{
   event: "…",      // an event name, such as "message" or "auxiliary"
   source: "…",     // an entity caused this notification, such as user (`id` converted to string) or "system" (or something else in the future)
   payload: <JSON>  // an actual object you need to decode as your data object, such as `ChatMessage`
}
```

See also: a [test](../Tests/AppTests/WebSocketTests.swift) with a websocket client example.
