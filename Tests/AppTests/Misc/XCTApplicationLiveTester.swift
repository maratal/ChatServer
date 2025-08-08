import AsyncHTTPClient
import NIOCore
import NIOHTTP1
import XCTest
import Vapor
@testable import XCTVapor

protocol XCTApplicationLiveTester {
    func startServer(port: Int) throws
    func performLiveTest(request: XCTHTTPRequest) throws -> TestingHTTPResponse
    func stopServer()
}

extension Application: XCTApplicationLiveTester {
    
    func startServer(port: Int = 8080) throws {
        try boot()
        try server.start(address: .hostname("localhost", port: port))
    }
    
    func performLiveTest(request: XCTHTTPRequest) throws -> TestingHTTPResponse {
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
        return TestingHTTPResponse(
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
        afterRequest: (TestingHTTPResponse) throws -> () = { _ in }
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

struct TestingHTTPResponse: Sendable {
    var status: HTTPStatus
    var headers: HTTPHeaders
    var body: ByteBuffer
}

extension TestingHTTPResponse {
    private struct _ContentContainer: ContentContainer {
        var body: ByteBuffer
        var headers: HTTPHeaders

        var contentType: HTTPMediaType? {
            return self.headers.contentType
        }

        mutating func encode<E>(_ encodable: E, using encoder: ContentEncoder) throws where E : Encodable {
            fatalError("Encoding to test response is not supported")
        }

        func decode<D>(_ decodable: D.Type, using decoder: ContentDecoder) throws -> D where D : Decodable {
            try decoder.decode(D.self, from: self.body, headers: self.headers)
        }

        func decode<C>(_ content: C.Type, using decoder: ContentDecoder) throws -> C where C : Content {
            var decoded = try decoder.decode(C.self, from: self.body, headers: self.headers)
            try decoded.afterDecode()
            return decoded
        }
    }

    var content: ContentContainer {
        _ContentContainer(body: self.body, headers: self.headers)
    }
}
