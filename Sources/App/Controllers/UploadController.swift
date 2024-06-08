import Vapor
import NIOCore

struct UploadController: RouteCollection {
    
    static let maxBytes = 50_000_000
    
    func boot(routes: RoutesBuilder) throws {
        let uploads = routes.grouped("uploads").grouped(DeviceSession.authenticator())
        uploads.on(.POST, body: .stream, use: upload)
    }
    
    func upload(_ req: Request) async throws -> some AsyncResponseEncodable {
        let logger = Logger(label: "\(UploadController.self)")
        
        let fileName = req.fileName
        let filePath = req.uploadPath(for: fileName)
        
        // Remove any file with the same name
        try? FileManager.default.removeItem(atPath: filePath)
        guard FileManager.default.createFile(atPath: filePath, contents: nil, attributes: nil) else {
            logger.critical("Could not upload '\(fileName)'")
            throw Abort(.internalServerError)
        }
        let fileHandle = try NIOFileHandle(path: filePath, mode: .write)
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
                throw Service.Errors.uploadTooLarge
            }
        }
        catch {
            try FileManager.default.removeItem(atPath: filePath)
            logger.error("Failed to save '\(filePath)': \(error)")
            throw error
        }
        logger.info("File '\(fileName)' saved successfully.")
        return fileName
    }
}

extension Request {
    
    var fileName: String {
        let fileNameHeader = headers["File-Name"]
        if let inferredName = fileNameHeader.first {
            return inferredName
        }
        return "\(UUID().uuidString).\(fileExtension)"
    }
    
    var fileExtension: String {
        var fileExtension = "tmp"
        if let contentType = headers.contentType {
            switch contentType {
            case .jpeg:
                fileExtension = "jpg"
            case .mp3:
                fileExtension = "mp3"
            case .init(type: "video", subType: "mp4"):
                fileExtension = "mp4"
            default:
                fileExtension = "data"
            }
        }
        return fileExtension
    }
    
    func uploadPath(for fileName: String) -> String {
        application.uploadsDirectory + fileName
    }
}

extension Application {
    
    var uploadsDirectory: String {
        directory.publicDirectory
    }
    
    func createUploadsDirectory() throws {
        try FileManager.default.createDirectory(atPath: uploadsDirectory, withIntermediateDirectories: true, attributes: nil)
    }
}
