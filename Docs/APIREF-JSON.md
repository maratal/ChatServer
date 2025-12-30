## API Reference

#### [USERS](APIREF-Users.md) • [CHATS](APIREF-Chats.md) • [CONTACTS](APIREF-Contacts.md) • [FILES](APIREF-Files.md) • [WEBSOCKET](APIREF-WebSocket.md) • JSON
_________________________________________________________________________________

A collection of `JSON` objects from all server responses. JSON-like notation is used for better readability - field's name quotes are omitted and placeholders for data types are used instead of concrete samples like so: `<UUID>` or `"…"` for strings. All dates are strings encoded as `ISO 8601`: `yyyy-MM-ddTHH:mm:ss:ssZ`. In the real response some fields may be omitted depending on the method called.
_________________________________________________________________________________

#### `UserInfo`:

```
{
   id: <Int>,
   name: "…",
   username: "…",
   about: "…",
   lastSeen: "…",
   photos: [
      <MediaInfo>,
   ],
   deviceSessions: {
      <DeviceSession>
   }
}
```
_________________________________________________________________________________

#### `MediaInfo`:

```
{
   id: <UUID>,
   fileType: "…",
   fileSize: <Int>,
   previewWidth: <Int>,
   previewHeight: <Int>,
   createdAt: "…"
}
```
_________________________________________________________________________________

#### `DeviceInfo`:

```
{
   id: <UUID>,     // locally generated UUID
   name: "…",      // f.e. "My phone"
   model: "…",
   token: "…",     // Push token (APNS or Android) obtained from OS
   transport: "…"  // "apns", "fcm" etc.
}
```
_________________________________________________________________________________

#### `DeviceSession`:

```
{
   id: <UUID>,
   accessToken: "…",
   ipAddress: "…",
   createdAt: "…",
   updatedAt: "…",
   deviceInfo: <DeviceInfo>,
}
```
_________________________________________________________________________________

#### `MessageInfo`:
```
{
   id: <UUID>,
   localId: "…",
   chatId: <UUID>,
   authorId: <Int>,
   text: "…",
   createdAt: "…",
   updatedAt: "…",
   editedAt: "…",
   deletedAt: "…",
   isVisible: <Bool>,
   attachments: [
      <MediaInfo>
   ],
   readMarks: [
      {
          id: <UUID>,
          user: <UserInfo>,
          createdAt: "…"
      }
   ]
}
```
_________________________________________________________________________________

#### `ChatInfo`:
```
{
   id: <UUID>,
   title: "…",
   isPersonal: <Bool>,
   owner: <UserInfo>,
   allUsers: [
      <UserInfo>
   ],
   addedUsers: [
      <UserInfo>
   ],
   removedUsers: [
      <UserInfo>
   ],
   lastMessage: <MessageInfo>,
   images: [
      <MediaInfo>
   ],
   isMuted: <Bool>,
   isArchived: <Bool>,
   isBlocked: <Bool>
}
```
_________________________________________________________________________________

#### `ContactInfo`:
```
{
   id: <UUID>,
   name: "…",
   isFavorite: <Bool>,
   isBlocked: <Bool>,  // not used currently
   user: <UserInfo>
}
```
