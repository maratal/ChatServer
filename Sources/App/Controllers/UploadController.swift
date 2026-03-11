import Vapor
import NIOCore
import CoreGraphics
import ImageIO
import UniformTypeIdentifiers

struct UploadController: RouteCollection {
    
    static let maxBytes = 50_000_000
    static let previewMaxDimension: CGFloat = 350
    
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
        
        let previewName = Self.previewFileName(for: fileName)
        let previewPath = (filePath as NSString).deletingLastPathComponent + "/" + previewName
        
        guard let imageSource = CGImageSourceCreateWithURL(URL(fileURLWithPath: filePath) as CFURL, nil),
              let cgImage = CGImageSourceCreateImageAtIndex(imageSource, 0, nil) else {
            logger.warning("Could not read image for preview: \(fileName)")
            return
        }
        
        let originalWidth = CGFloat(cgImage.width)
        let originalHeight = CGFloat(cgImage.height)
        let maxDim = Self.previewMaxDimension
        
        // Skip if already fits within preview size
        guard originalWidth > maxDim || originalHeight > maxDim else {
            // Just copy the file as the preview
            try? FileManager.default.copyItem(atPath: filePath, toPath: previewPath)
            logger.info("Image already small enough, copied as preview: \(previewName)")
            return
        }
        
        // Calculate scaled dimensions maintaining aspect ratio
        let scale = min(maxDim / originalWidth, maxDim / originalHeight)
        let newWidth = Int(originalWidth * scale)
        let newHeight = Int(originalHeight * scale)
        
        guard let colorSpace = cgImage.colorSpace ?? CGColorSpace(name: CGColorSpace.sRGB),
              let context = CGContext(
                data: nil,
                width: newWidth,
                height: newHeight,
                bitsPerComponent: 8,
                bytesPerRow: 0,
                space: colorSpace,
                bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
              ) else {
            logger.warning("Could not create graphics context for preview: \(fileName)")
            return
        }
        
        context.interpolationQuality = .high
        context.draw(cgImage, in: CGRect(x: 0, y: 0, width: newWidth, height: newHeight))
        
        guard let scaledImage = context.makeImage() else {
            logger.warning("Could not create scaled image for preview: \(fileName)")
            return
        }
        
        // Determine output UTType
        let utType: CFString = switch fileType.lowercased() {
        case "png": UTType.png.identifier as CFString
        case "gif": UTType.gif.identifier as CFString
        case "webp": UTType.webP.identifier as CFString
        default: UTType.jpeg.identifier as CFString
        }
        
        let previewURL = URL(fileURLWithPath: previewPath)
        guard let destination = CGImageDestinationCreateWithURL(previewURL as CFURL, utType, 1, nil) else {
            logger.warning("Could not create image destination for preview: \(fileName)")
            return
        }
        
        let properties: [CFString: Any] = [kCGImageDestinationLossyCompressionQuality: 0.8]
        CGImageDestinationAddImage(destination, scaledImage, properties as CFDictionary)
        
        if CGImageDestinationFinalize(destination) {
            logger.info("Preview generated: \(previewName) (\(newWidth)x\(newHeight))")
        } else {
            logger.warning("Failed to write preview: \(previewName)")
        }
    }
}

extension Request {
    
    var fileName: String? {
        headers["File-Name"].first
    }
    
    var fileType: String? {
        guard let contentType = headers.contentType else { return headers["Content-Type"].first }
        return contentType.subType == "jpeg" ? "jpg" : contentType.subType
    }
}
