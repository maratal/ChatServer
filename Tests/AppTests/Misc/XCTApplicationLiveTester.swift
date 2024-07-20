import AsyncHTTPClient
import NIOCore
import NIOHTTP1
import XCTest
import Vapor
@testable import XCTVapor

protocol XCTApplicationLiveTester {
    func startServer(port: Int) throws
    func performLiveTest(request: XCTHTTPRequest) throws -> XCTHTTPResponse
    func stopServer()
}

extension Application: XCTApplicationLiveTester {
    
    func startServer(port: Int = 8080) throws {
        try boot()
        try server.start(address: .hostname("localhost", port: port))
    }
    
    func performLiveTest(request: XCTHTTPRequest) throws -> XCTHTTPResponse {
        let client = HTTPClient(eventLoopGroup: MultiThreadedEventLoopGroup.singleton)
        defer { try! client.syncShutdown() }
        
        var path = request.url.path
        path = path.hasPrefix("/") ? path : "/\(path)"
        
        let port: Int
        
        guard let portAllocated = http.server.shared.localAddress?.port else {
            throw Abort(.internalServerError, reason: "Failed to get port from local address")
        }
        port = portAllocated
        
        var url = "http://localhost:\(port)\(path)"
        if let query = request.url.query {
            url += "?\(query)"
        }
        var clientRequest = try HTTPClient.Request(
            url: url,
            method: request.method,
            headers: request.headers
        )
        clientRequest.body = .byteBuffer(request.body)
        let response = try client.execute(request: clientRequest).wait()
        return XCTHTTPResponse(
            status: response.status,
            headers: response.headers,
            body: response.body ?? ByteBufferAllocator().buffer(capacity: 0)
        )
    }
    
    func stopServer() {
        server.shutdown()
    }
}

extension XCTApplicationLiveTester {
    
    public func sendRequest(
        _ method: HTTPMethod,
        _ path: String,
        headers: HTTPHeaders = [:],
        body: ByteBuffer? = nil,
        file: StaticString = #filePath,
        line: UInt = #line,
        beforeRequest: (inout XCTHTTPRequest) throws -> () = { _ in },
        afterRequest: (XCTHTTPResponse) throws -> () = { _ in }
    ) throws {
        var request = XCTHTTPRequest(
            method: method,
            url: .init(path: path),
            headers: headers,
            body: body ?? ByteBufferAllocator().buffer(capacity: 0)
        )
        try beforeRequest(&request)
        do {
            let response = try self.performLiveTest(request: request)
            try afterRequest(response)
        } catch {
            XCTFail("\(error)", file: file, line: line)
            throw error
        }
    }
}
