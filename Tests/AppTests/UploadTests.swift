@testable import App
import XCTVapor

final class UploadTests: AppTestCase {

    func testUploadVideo() async throws {
        // app.test(...) doesn't support streaming uploads, that's why this custom setup is used together with `UploadClient`
        app.http.server.configuration.hostname = "127.0.0.1"
        app.http.server.configuration.port = 0
        app.environment.arguments = ["serve"]
        try await app.startup()
        
        XCTAssertNotNil(app.http.server.shared.localAddress)
        guard let localAddress = app.http.server.shared.localAddress,
              let ip = localAddress.ipAddress,
              let port = localAddress.port else {
            return XCTFail("couldn't get ip/port from \(app.http.server.shared.localAddress.debugDescription)")
        }
        
        let data = Data(repeating: 1, count: 49_000_000)
        let filePath = URL.temporaryDirectory.appending(path: "test.tmp").path()
        
        try (data as NSData).write(toFile: filePath)
        XCTAssertTrue(FileManager.default.fileExists(atPath: filePath))
        
        let expectation = expectation(description: "Uploaded")
        
        let newFileName = UUID().uuidString
        let client = UploadClient("http://\(ip):\(port)/uploads", filePath: filePath, fileName: newFileName) { error in
            XCTAssertNil(error)
            expectation.fulfill()
        }
        client.startUpload()
        await fulfillment(of: [expectation])
        
        let newFilePath = app.uploadPath(for: newFileName) + "." + (filePath as NSString).pathExtension.lowercased()
        
        // Uploaded
        XCTAssertTrue(FileManager.default.fileExists(atPath: newFilePath))
        
        // Cleanup
        try FileManager.default.removeItem(atPath: newFilePath)
        XCTAssertFalse(FileManager.default.fileExists(atPath: newFilePath))
        try FileManager.default.removeItem(atPath: filePath)
        XCTAssertFalse(FileManager.default.fileExists(atPath: filePath))
    }
}
