import Vapor
import NIOCore

struct UploadController: RouteCollection {
    
    static let maxBytes = 50_000_000
    
    func boot(routes: RoutesBuilder) throws {
        let uploads = routes.grouped("uploads").grouped(DeviceSession.authenticator())
        uploads.on(.POST, body: .stream, use: upload)
        uploads.delete(.catchall, use: deleteUpload)
    }
    
    func upload(_ req: Request) async throws -> some AsyncResponseEncodable {
        let logger = Logger(label: "\(UploadController.self)")
        
        var fileName = req.fileName ?? UUID().uuidString
        
        guard let fileType = req.fileType else {
            logger.critical("Could not upload without file type.")
            throw Abort(.internalServerError, reason: "Could not upload without file type.")
        }
        fileName = fileName + "." + fileType
        let tmpFileName = fileName + ".upload"
        
        let filePath = req.application.uploadPath(for: fileName)
        let tmpFilePath = req.application.uploadPath(for: tmpFileName)
        
        // Remove any files with the same names
        try? FileManager.default.removeItem(atPath: filePath)
        try? FileManager.default.removeItem(atPath: tmpFilePath)
        
        guard FileManager.default.createFile(atPath: tmpFilePath, contents: nil, attributes: nil) else {
            logger.critical("Could not create '\(tmpFilePath)'")
            throw Abort(.internalServerError, reason: "Could not create file.")
        }
        let fileHandle = try NIOFileHandle(path: tmpFilePath, mode: .write)
        defer {
            do {
                try fileHandle.close()
            }
            catch {
                logger.error("\(error)")
            }
        }
        do {
            var offset: Int64 = 0
            for try await byteBuffer in req.body {
                do {
                    try await req.application.fileio.write(fileHandle: fileHandle,
                                                           toOffset: offset,
                                                           buffer: byteBuffer,
                                                           eventLoop: req.eventLoop).get()
                    offset += Int64(byteBuffer.readableBytes)
                    guard offset < Self.maxBytes else { break }
                }
                catch {
                    logger.error("\(error)")
                }
            }
            guard offset < Self.maxBytes else {
                throw CoreService.Errors.uploadTooLarge
            }
            // Rename temporary upload file 
            try FileManager.default.moveItem(atPath: tmpFilePath, toPath: filePath)
        }
        catch {
            try FileManager.default.removeItem(atPath: tmpFilePath)
            logger.error("Failed to save file: \(error)")
            throw error
        }
        logger.info("File '\(fileName)' saved successfully.")
        return fileName
    }
    
    func deleteUpload(_ req: Request) async throws -> HTTPStatus {
        let logger = Logger(label: "\(UploadController.self)")
        
        // Get filename from path (everything after /uploads/)
        let pathComponents = req.url.path.split(separator: "/")
        guard pathComponents.count >= 2 else {
            throw Abort(.badRequest, reason: "Invalid file path")
        }
        
        let fileName = String(pathComponents[1])
        let filePath = req.application.uploadPath(for: fileName)
        
        if FileManager.default.fileExists(atPath: filePath) {
            try? FileManager.default.removeItem(atPath: filePath)
            logger.info("File '\(fileName)' deleted successfully.")
        } else {
            logger.warning("File '\(fileName)' not found for deletion.")
        }
        
        return .ok
    }
}

extension Request {
    
    var fileName: String? {
        headers["File-Name"].first
    }
    
    var fileType: String? {
        guard let contentType = headers.contentType else { return headers["Content-Type"].first }
        switch contentType {
        case .jpeg:
            return "jpg"
        case .mp3:
            return "mp3"
        case .init(type: "video", subType: "mp4"):
            return "mp4"
        default:
            return headers["Content-Type"].first
        }
    }
}
