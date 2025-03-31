## API Reference

#### [USERS](APIREF-Users.md) • [CHATS](APIREF-Chats.md) • CONTACTS • [FILES](APIREF-Files.md) • [WEBSOCKET](APIREF-WebSocket.md) • [JSON](APIREF-JSON.md)
_________________________________________________________________________________

A collection of methods for managing contacts for the user. Each method requires authentication and thus should contain `Authorization: Bearer <token>` in the request header. `Request body` is a `JSON` object, but placeholders for data types instead of concrete samples might be used like so: `<UUID>` or `"…"` for strings.
_________________________________________________________________________________

### 1. Creating a contact

Creates a contact from a user. Only is stored internally within your profile. Users who are contacts may have more permissions over other users, such as initiate calls etc.

__Path__:
```
POST /users/me/contacts
```
__Request body__:
```
{
    "name": "…",          // custom display name for the user with the `id`
    "isFavorite": <Bool>, // use to give the user with `id` even more permissions
    "user": {
       "id": <Int>
    }
}
```
__Response__: [`ContactInfo`](APIREF-JSON.md#contactinfo) object.
_________________________________________________________________________________

### 2. Removing a contact

Removes a contact. The contact's user remains intact.

__Path__:
```
DELETE /users/me/contacts/<id>
```
__Response__: `OK`
_________________________________________________________________________________

### 3. Get all contacts

Gets all the contacts of the current user.

__Path__:
```
GET /users/me/contacts
```
__Response__: an array of [`ContactInfo`](APIREF-JSON.md#contactinfo) objects.
