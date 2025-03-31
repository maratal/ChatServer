## API Reference

#### [USERS](APIREF-Users.md) • CHATS • [CONTACTS](APIREF-Contacts.md) • [FILES](APIREF-Files.md) • [WEBSOCKET](APIREF-WebSocket.md) • [JSON](APIREF-JSON.md)
_________________________________________________________________________________

A collection of methods for managing chats and messages. Each method requires authentication and thus should contain `Authorization: Bearer <token>` in the request header. `Request body` is a `JSON` object, but placeholders for data types instead of concrete samples might be used like so: `<UUID>` or `"…"` for strings.
_________________________________________________________________________________

### 1. Creating a chat

Create a personal or a group chat. An error is returned in case of more than two participants in a personal chat. If participants are the same as for an existing chat, that chat will be returned instead.

__Path__:
```
POST /chats
```
__Request body__:
```
{
    "title": "…",       // ignored for personal chats
    "participants": [
       1, 2             // list of `UserID`s
    ],
    "isPersonal": false // `true` if omitted and number of participants together with the chat creator is two
}
```
__Response__: [`ChatInfo`](APIREF-JSON.md#chatinfo) object.
_________________________________________________________________________________

### 2. Posting a message

You can attach a picture/video with a preview to your message. Depending on how you want your client to behave you might want to upload you media first and using returned file name as an `id` for the message's attachment.
Or vice versa - obtain attachment's `id` first (by posting a message) and then upload files with this attachment's `id` as a file name. You can upload multiple files and then construct their `URL`s as `http://<server[:port]>/files/<file_name>.<file_type>` and for example `http://<server[:port]>/files/<file_name>-preview.jpeg`
<p>All participants will be notified about this event via websocket and push according to their settings.</p>

See also:
- [Files](APIREF-Files.md) section for more details.
- [Tests](../Tests/AppTests/ChatTests.swift#L446) for an example.

__Path__:
```
POST /chats/<id>/messages
```
__Request body__:
```
{
   "localId": "…",       // should be "<UserID>+<UUID>"
   "text": "…",          // up to 2048 bytes
   "isVisible": "…",     // true by default
   "attachment": {
      "fileType": "png",
      "fileSize": 100000 // in bytes
   }
}
```
__Response__: [`MessageInfo`](APIREF-JSON.md#messageinfo) object.
_________________________________________________________________________________

### 3. Get your chats

Returns all the chats where you is a participant. Pass `full=true` in the path if you want the full information for all returned chats (thus all the users in each chat will be included). By default it's `false`.

__Path__:
```
GET /chats/?full=1
```
__Response__: an array of [`ChatInfo`](APIREF-JSON.md#chatinfo) objects.
_________________________________________________________________________________

### 4. Get chat information

Returns all the information about the chat together with all participants or an error if you are not a participant.

__Path__:
```
GET /chats/<id>
```
__Response__: [`ChatInfo`](APIREF-JSON.md#chatinfo) object.
_________________________________________________________________________________

### 5. Update title

Updates the title of the chat. Returns error for personal chat. All participants will be notified about this event via websocket.

__Path__:
```
PUT /chats/<id>
```
__Request body__:
```
{
   "title": "…", // ignored for personal chat
}
```
__Response__: [`ChatInfo`](APIREF-JSON.md#chatinfo) object.
_________________________________________________________________________________

### 6. Update settings

Updates various settings of the chat.

__Path__:
```
PUT /chats/<id>/settings
```
__Request body__:
```
{
   "isMuted": false,            // use to mute chat (stop sending push notifications)
   "isArchived": false,         // use to move chat to "Archive" list
   "isRemovedOnDevice": false,  // see `Remove chat from device` method
}
```
__Response__: [`ChatInfo`](APIREF-JSON.md#chatinfo) object.
_________________________________________________________________________________

### 7. Add picture

Adds a picture to the chat similar to user's avatar. All participants will be notified about this event via websocket.

__Path__:
```
POST /chats/<id>/images
```
__Request body__:
```
{
   "image": {
      "id": <UUID>,       // should be obtained beforehand by uploading a file, see `Files` section
      "fileType": "png",
      "fileSize": 100000  // in bytes
   }
}
```
__Response__: [`ChatInfo`](APIREF-JSON.md#chatinfo) object.
_________________________________________________________________________________

### 8. Remove picture

Removes chat's picture. All participants will be notified about this event via websocket.

__Path__:
```
DELETE /chats/<id>/images/<id>
```
__Response__: `OK`
_________________________________________________________________________________

### 9. Add users

Adds users to the chat if they were not already added. If no users were added error will be returned. Also you can't add more than 10 users at a time. All participants will be notified about this event via websocket.

__Path__:
```
POST /chats/<id>/users
```
__Request body__:
```
{
   "users": {
      1, 2, 3 // list of `UserID`s
   }
}
```
__Response__: [`ChatInfo`](APIREF-JSON.md#chatinfo) object.
_________________________________________________________________________________

### 10. Remove users

Removes users from the chat if they are participants. Returns error for personal chat.

__Path__:
```
DELETE /chats/<id>/users
```
__Request body__:
```
{
   "users": {
      1, 2, 3 // list of `UserID`s
   }
}
```
__Response__: [`ChatInfo`](APIREF-JSON.md#chatinfo) object.
_________________________________________________________________________________

### 11. Delete chat

Deletes the chat with the all the assotiated data (messages, settings, read marks etc.). Can't be undone. All participants will be notified about this event via websocket.

__Path__:
```
DELETE /chats/<id>
```
__Response__: `OK`
_________________________________________________________________________________

### 12. Remove chat from device

Stops appearing of the chat on the device. To get it back you need to find (or create) it again and post message into it. You need to delete the local chat object by yourself.

__Path__:
```
PUT /chats/<id>/settings
```
__Request body__:
```
{
   "isRemovedOnDevice": true
}
```
__Response__: `OK`
_________________________________________________________________________________

### 13. Exit chat

Exits multiuser chat. In case of a personal chat results in an error. All participants will be notified about this event via websocket.

__Path__:
```
DELETE /chats/<id>/me
```
__Response__: `OK`
_________________________________________________________________________________

### 14. Clear chat

Similar to deleting the chat, but instead only deletes all the messages with all the assotiated data (read marks). Can't be undone. All participants will be notified about this event via websocket.

__Path__:
```
DELETE /chats/<id>/messages
```
__Response__: `OK`
_________________________________________________________________________________

### 15. Block chat

Exits the chat and makes it impossible to add the user who blocked it as a participant. Ignored for personal chats.

__Path__:
```
PUT /chats/<id>/block
```
__Response__: `OK`
_________________________________________________________________________________

### 16. Unblock chat

Makes it possible to add the user who blocked it as a participant. Ignored for personal chats.

__Path__:
```
PUT /chats/<id>/unblock
```
__Response__: `OK`
_________________________________________________________________________________

### 17. Block user

Blocks a user from posting messages into the chat.

__Path__:
```
PUT /chats/<id>/users/<id>/block
```
__Response__: `OK`
_________________________________________________________________________________

### 18. Unblock user

Unblocks the user from posting messages into the chat.

__Path__:
```
PUT /chats/<id>/users/<id>/unblock
```
__Response__: `OK`
_________________________________________________________________________________

### 19. Get blocked users

Retrives the list of all blocked users in the chat.

__Path__:
```
GET /chats/<id>/users/blocked
```
__Response__: An array of [`UserInfo`](APIREF-JSON.md#userinfo) objects.
_________________________________________________________________________________

### 20. Get messages

Retrives `number` messages before the message with the `id`. If `id` is omitted retrives last `number` of messages or 50 by default.

__Path__:
```
GET /chats/<id>/messages?count=<number>&before=<id>
```
__Response__: An array of [`MessageInfo`](APIREF-JSON.md#messageinfo) objects.
_________________________________________________________________________________

### 21. Delete message

Message is deleted by deletion of its content (`text` and `attachment`). `MessageInfo` will contain a `deletedAt` field. All participants will be notified about this event via websocket.

__Path__:
```
DELETE /chats/<id>/messages/<id>
```
__Response__: [`MessageInfo`](APIREF-JSON.md#messageinfo) object.
_________________________________________________________________________________

### 22. Edit message

Edits a message. All participants will be notified about this event via websocket.

__Path__:
```
PUT /chats/<id>/messages/<id>
```
__Request body__:
```
{
   "text": "…",           // use this to edit message's content
   "isVisible": true,     // use this to update message's visibility (up to the UI how to use it)
   "fileExists": true,    // use this to inform participants that the file is now uploaded
   "previewExists": true  // use this to inform participants that the preview is now available
}
```
__Response__: [`MessageInfo`](APIREF-JSON.md#messageinfo) object.
_________________________________________________________________________________

### 23. Read message

Puts a read mark on the message by a particular user. All participants will be notified about this event via websocket.

__Path__:
```
PUT /chats/<id>/messages/<id>/read
```
__Response__: `OK`
_________________________________________________________________________________

### 24. Send notification

Sends additional data to the chat that is not required to be saved on the server, so the format is any `JSON`. Can be used to send typing notifications or trigger some animations etc. All participants will be notified about this event via websocket and/or push.

__Path__:
```
POST /chats/<id>/notify
```
__Request body__:
```
{
   "name": "…",    // arbitrary string, use for purpose of this notification, f.e. "typing_started"
   "text": "…",    // arbitrary string (will also be shown as a push text if possible)
   "realm": "…",   // "webSocket", "push" or "all", "webSocket" is by default
   "data": <Data>  // optional JSON dictionary converted to a binary data (f.e. using `Foundation.JSONEncoder()`)
}
```
__Response__: `OK`
