/**
 * This controller object just redirects everything to the appropriate service actor. Do not add any logic here.
 */
import Vapor
import FluentKit

struct NotesController: RouteCollection {

    let service: NotesServiceProtocol
    let usersService: UserServiceProtocol
    
    func boot(routes: RoutesBuilder) throws {
        // API routes (protected)
        let apiNotes = routes.grouped("api", "notes").grouped(DeviceSession.authenticator())
        apiNotes.post("publish", use: publish)
        apiNotes.post("unpublish", use: unpublish)
        apiNotes.get("status", .messageId, use: noteStatus)
        
        // Public API route (no auth) - get notes for a user
        routes.grouped("api", "users").group(.id) { route in
            route.get("notes", use: userNotes)
            route.get("notes", .noteId, use: userNote)
        }
        
        // HTML route (public, no auth)
        routes.get("users", .id, "notes", use: notesPage)
        routes.get("users", .id, "notes", .noteId, use: notesPage)
    }

    func notesPage(_ req: Request) async throws -> View {
        let userId = try req.objectID()
        let user = try await usersService.getUser(id: userId, fullInfo: true)
        
        // Find the personal notes chat for this user (with images loaded)
        let participantsKey = Set([userId]).participantsKey()
        let chat = try await Chat.query(on: req.db)
            .filter(\.$participantsKey == participantsKey)
            .filter(\.$isPersonal == true)
            .with(\.$images)
            .first()
        
        struct NotesPageContext: Encodable {
            let productName: String
            let version: String
            let apiVersion: String
            let userId: Int
            let userName: String
            let userJSON: String
            let notesJSON: String
        }
        
        // Encode user context as JSON string for safe embedding in script
        struct UserContext: Encodable {
            let id: Int
            let name: String
            let username: String?
            let about: String?
            let photos: [MediaResource.Info]?
            let lastSeen: Date?
        }
        
        struct NotesContext: Encodable {
            let title: String?
            let description: String?
            let settings: String?
            let images: [MediaResource.Info]?
            let createdAt: Date?
        }
        
        let userContext = UserContext(
            id: userId,
            name: user.name ?? "Unknown",
            username: user.username,
            about: user.about,
            photos: user.photos,
            lastSeen: user.lastSeen
        )
        
        let notesContext = NotesContext(
            title: chat?.title,
            description: chat?.description,
            settings: chat?.settings,
            images: chat?.images.map { $0.info() },
            createdAt: chat?.createdAt
        )
        
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .custom { date, encoder in
            let timestamp = date.timeIntervalSince1970
            var container = encoder.singleValueContainer()
            try container.encode(timestamp)
        }
        let userJSONData = try encoder.encode(userContext)
        let userJSON = String(data: userJSONData, encoding: .utf8) ?? "{}"
        let notesJSONData = try encoder.encode(notesContext)
        let notesJSON = String(data: notesJSONData, encoding: .utf8) ?? "{}"
        
        let context = NotesPageContext(
            productName: ProductInfo().productName,
            version: ProductInfo().version,
            apiVersion: ProductInfo().apiVersion,
            userId: userId,
            userName: user.name ?? "Unknown",
            userJSON: userJSON,
            notesJSON: notesJSON
        )
        return try await req.view.render("notes", context)
    }
    
    func publish(_ req: Request) async throws -> NoteInfo {
        let currentUser = try await req.requireCurrentUser()
        let body = try req.content.decode(PublishNoteRequest.self)
        return try await service.with(currentUser).publish(messageId: body.messageId, by: currentUser.requireID())
    }
    
    func unpublish(_ req: Request) async throws -> HTTPStatus {
        let currentUser = try await req.requireCurrentUser()
        let body = try req.content.decode(PublishNoteRequest.self)
        try await service.with(currentUser).unpublish(messageId: body.messageId, by: currentUser.requireID())
        return .ok
    }
    
    func noteStatus(_ req: Request) async throws -> NoteStatusResponse {
        let _ = try await req.requireCurrentUser()
        let messageId = try req.messageID()
        let isPublished = try await service.isPublished(messageId: messageId)
        return NoteStatusResponse(isPublished: isPublished)
    }

    func userNote(_ req: Request) async throws -> NoteInfo {
        let userId = try req.objectID()
        return try await service.note(req.noteID(), for: userId)
    }
    
    func userNotes(_ req: Request) async throws -> [NoteInfo] {
        let userId = try req.objectID()
        let before: NoteID? = req.query["before"]
        let count = req.countFromQuery(default: 20)
        return try await service.notes(for: userId, before: before, count: count)
    }
}

struct PublishNoteRequest: Serializable {
    var messageId: MessageID
}

struct NoteStatusResponse: Serializable {
    var isPublished: Bool
}
