# ChatServer

A secure, self-hosted communication platform built with Swift Vapor that gives you complete control over your conversations and data.

## Overview

ChatServer enables you to deploy your own private communication server with enterprise-grade features. Perfect for teams, families, or organizations that prioritize privacy and want full control over their messaging infrastructure.

**Key Benefits:**
- 🔒 **Complete Privacy** - Your data stays on your server
- 🚀 **One-Click Deployment** - Deploy to Heroku instantly  
- 👥 **Invite-Only** - Only people you know can join
- 🌐 **Cross-Platform** - REST API for any client application
- ⚡ **Real-Time** - WebSocket support for instant messaging

## Features

### Core Messaging
- **Personal & Group Chats** - Direct messaging and multi-user conversations
- **Message Attachments** - Share files, images, and media
- **Read Receipts** - Know when messages are delivered and read
- **Typing Indicators** - See when others are composing messages

### User Management  
- **User Profiles** - Customizable user information and avatars
- **Contacts Management** - Organize and manage your contact list
- **Multiple Device Sessions** - Access from multiple devices simultaneously
- **Block/Unblock** - Control who can message you

### Security & Privacy
- **Authentication** - Secure token-based authentication
- **Account Keys** - Additional security layer for sensitive operations
- **Private Server** - Complete control over your communication infrastructure

## Quick Deploy

Deploy your own ChatServer instance to Heroku with one click:

[![Deploy](https://www.herokucdn.com/deploy/button.svg)](https://heroku.com/deploy?template=https://github.com/maratal/ChatServer)

## API Reference

Complete API documentation for building client applications:

- [Users API](Docs/APIREF-Users.md) - Authentication, profiles, and user management
- [Chats API](Docs/APIREF-Chats.md) - Messaging and conversation management  
- [Contacts API](Docs/APIREF-Contacts.md) - Contact list and relationship management
- [Files API](Docs/APIREF-Files.md) - File upload and media handling
- [WebSocket API](Docs/APIREF-WebSocket.md) - Real-time communication
- [JSON Schemas](Docs/APIREF-JSON.md) - Data structures and formats

## Technology Stack

- **Backend**: Swift Vapor 4.x
- **Database**: PostgreSQL with Fluent ORM
- **Real-Time**: WebSocket connections
- **Deployment**: Heroku-ready, Docker support
- **Authentication**: Token-based with bcrypt password hashing

## Contact

For questions and support: my@hopp.network
