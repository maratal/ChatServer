@testable import App
import XCTVapor

final class WebSocketTests: XCTestCase {
    
    var app: Application!
    
    override func setUp() {
        app = try! Application.testable(with: .live)
        try! app.startServer()
    }
    
    override func tearDown() {
        app.stopServer()
        app.shutdown()
    }
    
    func testSendingMessageOverWebSocket() async throws {
        let current = try await seedCurrentUser()
        let users = try await seedUsers(count: 1, namePrefix: "User", usernamePrefix: "user")
        let chat = try await makeChat(ownerId: current.id!, users: users.map { $0.id! }, isPersonal: true)
        
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
        
        let assertMessageFromBuffer: (ByteBuffer) -> () = { buffer in
            let data = Data(buffer: buffer)
            let json = try! data.json() as! JSON
            let payload = json["payload"] as! JSON
            
            // Received message! 🎉
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
            self.addTeardownBlock {
                ws.close()
            }
            ws.onPing { ws, buf in
                expectation1.fulfill()
            }
            ws.onBinary { ws, buf in
                assertMessageFromBuffer(buf)
                expectation3.fulfill()
            }
        }
        try await WebSocket.connect(to: "ws://localhost:8080/\(deviceSession2.id)",
                                    headers: .authWith(token: deviceSession2.accessToken),
                                    on: app.eventLoopGroup) { ws in
            self.addTeardownBlock {
                ws.close()
            }
            ws.onPing { ws, buf in
                expectation2.fulfill()
            }
            ws.onBinary { ws, buf in
                assertMessageFromBuffer(buf)
                expectation3.fulfill()
            }
        }
        await fulfillment(of: [expectation1, expectation2], timeout: 10)
        
        // Sending message from user1 to user2:
        
        try app.test(.POST, "chats/\(chat.id!)/messages", headers: .authWith(token: deviceSession1.accessToken), beforeRequest: { req in
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
