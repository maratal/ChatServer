@testable import App
import XCTVapor

final class WebSocketTests: AppLiveTestCase {
    
    override func setUp() {
        super.setUp()
        try! app.startServer()
    }
    
    override func tearDown() {
        app.stopServer()
        super.tearDown()
    }

    func test_01_sendingMessageOverWebSocket() async throws {
        let current = try await service.seedCurrentUser()
        let users = try await service.seedUsers(count: 1, namePrefix: "User", usernamePrefix: "user")
        let chat = try await service.makeChat(ownerId: current.id!, users: users.map { $0.id! }, isPersonal: true)
        
        // Login both users:
        
        var deviceSession1: DeviceSession.Info!
        var deviceSession2: DeviceSession.Info!
        
        try app.sendRequest(.POST, "users/login",
                            headers: .authWith(username: CurrentUser.username, password: CurrentUser.password),
                            beforeRequest: { req in
            try req.content.encode(
                DeviceInfo.testInfoDesktop
            )
        }, afterRequest: { res in
            XCTAssertEqual(res.status, .ok, res.body.string)
            let privateInfo = try res.content.decode(User.PrivateInfo.self)
            deviceSession1 = try XCTUnwrap(privateInfo.sessionForDeviceId(DeviceInfo.testInfoDesktop.id))
        })
        
        try app.sendRequest(.POST, "users/login",
                            headers: .authWith(username: users[0].username, password: ""),
                            beforeRequest: { req in
            try req.content.encode(
                DeviceInfo.testInfoDesktop
            )
        }, afterRequest: { res in
            XCTAssertEqual(res.status, .ok, res.body.string)
            let privateInfo = try res.content.decode(User.PrivateInfo.self)
            deviceSession2 = try XCTUnwrap(privateInfo.sessionForDeviceId(DeviceInfo.testInfoDesktop.id))
        })
        
        // Subroutine to check the validity of the incoming message:
        
        let assertMessageFromBuffer: @Sendable (ByteBuffer) -> () = { buffer in
            let data = Data(buffer: buffer)
            let json = try! data.json() as! JSON
            let payload = json["payload"] as! JSON
            
            // Received message! 🎉🎉 // add emoji here each time this breaks after swift/vapor update
            let message = try! MessageInfo.fromData(payload.data())
            
            XCTAssertEqual(message.text, "Hey")
            XCTAssertEqual(message.authorId, 1)
            XCTAssertEqual(json["event"] as! String, "message")
            XCTAssertEqual(UserID(json["source"] as! String), message.authorId)
        }
        
        // Connect web sockets of both users:
        
        let expectation1 = XCTestExpectation(description: "Ping 1")
        let expectation2 = XCTestExpectation(description: "Ping 2")
        let expectation3 = XCTestExpectation(description: "Message")
        expectation3.expectedFulfillmentCount = 3
        
        try await WebSocket.connect(to: "ws://localhost:8080/\(deviceSession1.id)",
                                    headers: .authWith(token: deviceSession1.accessToken),
                                    on: app.eventLoopGroup) { ws in
            ws.onPing { ws, buf in
                expectation1.fulfill()
            }
            ws.onBinary { ws, buf in
                assertMessageFromBuffer(buf)
                expectation3.fulfill()
                ws.close()
            }
        }
        try await WebSocket.connect(to: "ws://localhost:8080/\(deviceSession2.id)",
                                    headers: .authWith(token: deviceSession2.accessToken),
                                    on: app.eventLoopGroup) { ws in
            ws.onPing { ws, buf in
                expectation2.fulfill()
            }
            ws.onBinary { ws, buf in
                assertMessageFromBuffer(buf)
                expectation3.fulfill()
                ws.close()
            }
        }
        await fulfillment(of: [expectation1, expectation2], timeout: 10)
        
        // Sending message from user1 to user2:
        
        try await asyncTest(.POST, "chats/\(chat.id!)/messages", headers: .authWith(token: deviceSession1.accessToken), beforeRequest: { req in
            try req.content.encode(
                PostMessageRequest(localId: UUID(), text: "Hey")
            )
        }, afterResponse: { res in
            XCTAssertEqual(res.status, .ok, res.body.string)
            let message = try res.content.decode(MessageInfo.self)
            XCTAssertEqual(message.text, "Hey")
            expectation3.fulfill()
        })
        await fulfillment(of: [expectation3], timeout: 10)
    }
}
