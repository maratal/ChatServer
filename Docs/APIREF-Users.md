## API Reference

#### USERS • [CHATS](APIREF-Chats.md) • [CONTACTS](APIREF-Contacts.md) • [FILES](APIREF-Files.md) • [WEBSOCKET](APIREF-WebSocket.md) • [JSON](APIREF-JSON.md)
_________________________________________________________________________________

A collection of methods for managing users. Authentication can differ for each, pay attention to the headers. `Request body` is a `JSON` object, but placeholders for data types instead of concrete samples might be used like so: `<UUID>` or `"…"` for strings.
_________________________________________________________________________________

### 1. Registering a user

Registers and logs in a new user. Response will contain `DeviceSession.accessToken` which you should put to the request header.

__Path__:
```
POST /users
```
__Request body__:
```
{
   "name": "…",
   "username": "…",
   "password": "…",
   "deviceInfo": <DeviceInfo>
}
```
__Response__: [`UserInfo`](APIREF-JSON.md#userinfo) object.

See also: [`DeviceInfo`](APIREF-JSON.md#deviceinfo)
_________________________________________________________________________________

### 2. Logging in user

Logs in user from a particular device. Response will contain `DeviceSession.accessToken` which you should put to the request header.

__Path__:
```
POST /users/login
```
__Headers__:
```
Authorization: Basic <username:password>
```
__Request body__:
```
{
   "deviceInfo": <DeviceInfo>
}
```
__Response__: [`UserInfo`](APIREF-JSON.md#userinfo) object.

See also: [`DeviceInfo`](APIREF-JSON.md#deviceinfo), [`DeviceSession`](APIREF-JSON.md#devicesession)
_________________________________________________________________________________

### 3. Get current user

Gets all the information of the current user.

__Path__:
```
GET /users/me
```
__Headers__:
```
Authorization: Bearer <token>
```
__Response__: [`UserInfo`](APIREF-JSON.md#userinfo) object.
_________________________________________________________________________________

### 4. Logout user

Logs out user and invalidates `DeviceSession.accessToken`. 

__Path__:
```
POST /users/me/logout
```
__Headers__:
```
Authorization: Bearer <token>
```
__Response__: `OK`

See also: [`DeviceSession`](APIREF-JSON.md#devicesession)
_________________________________________________________________________________

### 5. Change password

Changes password for the user. Requires both `DeviceSession.accessToken` and the old password.

__Path__:
```
PUT /users/me/changePassword
```
__Headers__:
```
Authorization: Bearer <token>
```
__Request body__:
```
{
   "oldPassword": "…",
   "newPassword": "…"
}
```
__Response__: `OK`
_________________________________________________________________________________

### 6. Set account key

Sets the account key which is necessary for restoration of the account in case of password loss.

__Path__:
```
PUT /users/me/setAccountKey
```
__Headers__:
```
Authorization: Bearer <token>
```
__Request body__:
```
{
   "password": "…",
   "accountKey": "…"
}
```
__Response__: `OK`
_________________________________________________________________________________

### 7. Reset password

Resets user's password in case of a valid account key provided.

__Path__:
```
PUT /users/resetPassword
```
__Request body__:
```
{
   "userId": <Int>,
   "accountKey": "…",
   "newPassword": "…"
}
```
__Response__: `OK`
_________________________________________________________________________________

### 8. Update user

Updates user's information, such as `name` and `about`.

__Path__:
```
PUT /users/me
```
__Headers__:
```
Authorization: Bearer <token>
```
__Request body__:
```
{
   "name": "…",
   "about": "…"
}
```
__Response__: `OK`
_________________________________________________________________________________

### 9. Update device session

Updates user's device session information, such as `deviceName` and `deviceToken`.

__Path__:
```
PUT /users/me/device
```
__Headers__:
```
Authorization: Bearer <token>
```
__Request body__:
```
{
   "deviceName": "…", // f.e. "My laptop"
   "deviceToken": "…" // Push token (APNS or Android)
}
```
__Response__: `OK`
_________________________________________________________________________________

### 10. Get user info

Gets all the public information about a user.

__Path__:
```
GET /users/<id>
```
__Response__: [`UserInfo`](APIREF-JSON.md#userinfo) object.
_________________________________________________________________________________

### 11. Search for users

Looks for people by their name or username using substring.

__Path__:
```
GET /users/?s=foo
```
__Response__: an array of [`UserInfo`](APIREF-JSON.md#userinfo) objects.
_________________________________________________________________________________

### 12. Add photo

Adds a photo to the current user. Media should be uploaded beforehand. See `Files` section.

__Path__:
```
POST /users/me/photos
```
__Headers__:
```
Authorization: Bearer <token>
```
__Request body__:
```
{
   "photo": {
      "id": <UUID>,      // should be obtained beforehand by uploading a file
      "fileType": "png",
      "fileSize": 100000 // in bytes
   }
}
```
__Response__: `OK`
_________________________________________________________________________________

### 13. Delete photo

Deletes the photo from the current user together with all the media.

__Path__:
```
DELETE /users/me/photos/<UUID>
```
__Headers__:
```
Authorization: Bearer <token>
```
__Response__: `OK`
_________________________________________________________________________________

### 14. Deregistering user

Deletes user with all the associated data (created chats, messages, settings etc.). Can't be undone. Use with caution.

__Path__:
```
DELETE /users/me
```
__Headers__:
```
Authorization: Basic <username:password>
```
__Response__: `OK`
