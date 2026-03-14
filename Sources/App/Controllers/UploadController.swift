import Vapor
import NIOCore
/*
 Ubuntu/Debian: apt install libgd-dev
 macOS: brew install gd
 */
import SwiftGD

struct UploadController: RouteCollection {
    
    static let maxBytes = 150_000_000
    static let previewMaxDimension = 350
    
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
        
        // Generate preview for image files
        generatePreview(for: filePath, fileName: fileName, fileType: fileType, logger: logger)
        
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
        
        // Also delete preview file if it exists
        let previewFileName = Self.previewFileName(for: fileName)
        let previewFilePath = req.application.uploadPath(for: previewFileName)
        if FileManager.default.fileExists(atPath: previewFilePath) {
            try? FileManager.default.removeItem(atPath: previewFilePath)
            logger.info("Preview '\(previewFileName)' deleted successfully.")
        }
        
        // Also check for video preview thumbnails (uploaded as {name}-preview.jpg)
        let nameWithoutExt = (fileName as NSString).deletingPathExtension
        let videoPreviewName = "\(nameWithoutExt)-preview.jpg"
        if videoPreviewName != previewFileName {
            let videoPreviewPath = req.application.uploadPath(for: videoPreviewName)
            if FileManager.default.fileExists(atPath: videoPreviewPath) {
                try? FileManager.default.removeItem(atPath: videoPreviewPath)
                logger.info("Video preview '\(videoPreviewName)' deleted successfully.")
            }
        }
        
        return .ok
    }
    
    // MARK: - Preview Generation
    
    private static let imageFileTypes: Set<String> = ["jpg", "jpeg", "png", "gif", "webp"]
    
    private static func previewFileName(for fileName: String) -> String {
        let name = (fileName as NSString).deletingPathExtension
        let ext = (fileName as NSString).pathExtension
        return "\(name)-preview.\(ext)"
    }
    
    private func generatePreview(for filePath: String, fileName: String, fileType: String, logger: Logger) {
        guard Self.imageFileTypes.contains(fileType.lowercased()) else { return }
        
        let nameWithoutExtension = (fileName as NSString).deletingPathExtension
        let isAlreadyPreview = nameWithoutExtension.hasSuffix("-preview")
        
        // For files that are already previews, resize in place if needed; otherwise generate a separate preview file
        let targetPath: String
        if isAlreadyPreview {
            targetPath = filePath
        } else {
            let previewName = Self.previewFileName(for: fileName)
            targetPath = (filePath as NSString).deletingLastPathComponent + "/" + previewName
        }
        
        let maxDim = Self.previewMaxDimension
        
        guard let image = Image(url: URL(fileURLWithPath: filePath)) else {
            logger.warning("Could not read image for preview: \(fileName)")
            return
        }
        
        let originalWidth = image.size.width
        let originalHeight = image.size.height
        
        // Skip if already fits within preview size
        guard originalWidth > maxDim || originalHeight > maxDim else {
            if !isAlreadyPreview {
                try? FileManager.default.copyItem(atPath: filePath, toPath: targetPath)
                logger.info("Image already small enough, copied as preview: \(fileName)")
            }
            return
        }
        
        // Calculate scaled dimensions maintaining aspect ratio
        let scale = min(Double(maxDim) / Double(originalWidth), Double(maxDim) / Double(originalHeight))
        let newWidth = Int(Double(originalWidth) * scale)
        let newHeight = Int(Double(originalHeight) * scale)
        
        guard let resized = image.resizedTo(width: newWidth, height: newHeight) else {
            logger.warning("Could not resize image for preview: \(fileName)")
            return
        }
        
        do {
            let format: ExportableFormat = fileType.lowercased() == "png" ? .png : .jpg(quality: 85)
            let data = try resized.export(as: format)
            try data.write(to: URL(fileURLWithPath: targetPath))
            logger.info("Preview \(isAlreadyPreview ? "resized in place" : "generated"): \(fileName) (\(newWidth)x\(newHeight))")
        } catch {
            logger.warning("Could not generate preview for \(fileName): \(error)")
        }
    }
}

extension Request {
    
    var fileName: String? {
        headers["File-Name"].first
    }
    
    var fileType: String? {
        guard let contentType = headers.contentType else { return headers["Content-Type"].first }
        switch contentType.subType {
        case "jpeg": return "jpg"
        case "quicktime": return "mov"
        default: return contentType.subType
        }
    }
}
