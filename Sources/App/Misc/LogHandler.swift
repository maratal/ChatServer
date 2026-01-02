import Logging
import Foundation

struct FileHandlerOutputStream: TextOutputStream {
    enum FileHandlerOutputStream: Error {
        case couldNotCreateFile
    }
    
    private let fileHandle: FileHandle
    let encoding: String.Encoding

    init(localFile url: URL, encoding: String.Encoding = .utf8) throws {
        if !FileManager.default.fileExists(atPath: url.path) {
            let logDir = url.deletingLastPathComponent().path
            try? FileManager.default.createDirectory(atPath: logDir, withIntermediateDirectories: true, attributes: nil)
            guard FileManager.default.createFile(atPath: url.path, contents: nil, attributes: nil) else {
                throw FileHandlerOutputStream.couldNotCreateFile
            }
        }
//        print("Log file: \(url.path)")
        
        let fileHandle = try FileHandle(forWritingTo: url)
        fileHandle.seekToEndOfFile()
        self.fileHandle = fileHandle
        self.encoding = encoding
    }

    mutating func write(_ string: String) {
        if let data = string.data(using: encoding) {
            fileHandle.write(data)
        }
    }
}

class FileLogHandler: LogHandler, @unchecked Sendable {
    
    private var stream: TextOutputStream
    private var label: String
    
    private let streamLock = NSLock()
    private let metadataLock = NSLock()
    
    var logLevel: Logger.Level

    private var prettyMetadata: String?
    var metadata = Logger.Metadata() {
        didSet {
            self.prettyMetadata = self.prettify(self.metadata)
        }
    }

    subscript(metadataKey metadataKey: String) -> Logger.Metadata.Value? {
        get {
            self.metadata[metadataKey]
        }
        set {
            metadataLock.lock()
            self.metadata[metadataKey] = newValue
            metadataLock.unlock()
        }
    }
    
    init(label: String, logLevel: Logger.Level, localPath: String) {
        self.label = label
        self.logLevel = logLevel
        self.stream = try! FileHandlerOutputStream(localFile: URL(fileURLWithPath: localPath))
    }

    func log(level: Logger.Level,
             message: Logger.Message,
             metadata: Logger.Metadata?,
             source: String,
             file: String,
             function: String,
             line: UInt) {
        guard level >= self.logLevel else { return }
        
        let prettyMetadata = metadata?.isEmpty ?? true
            ? self.prettyMetadata
            : self.prettify(self.metadata.merging(metadata!, uniquingKeysWith: { _, new in new }))

        streamLock.lock()
        stream.write("\(self.timestamp()) \(level) \(self.label) :\(prettyMetadata.map { " \($0)" } ?? "") \(message)\n")
        streamLock.unlock()
    }

    private func prettify(_ metadata: Logger.Metadata) -> String? {
        return !metadata.isEmpty ? metadata.map { "\($0)=\($1)" }.joined(separator: " ") : nil
    }

    static let dateFormatter: DateFormatter = {
        let df = DateFormatter()
        df.dateFormat = "yyyy-MM-dd'T'HH:mm:ssZ"
        return df
    }()

    private func timestamp() -> String {
        Self.dateFormatter.string(from: Date())
    }
}

extension Logger.Level {
    static func >= (lhs: Logger.Level, rhs: Logger.Level) -> Bool {
        return !(lhs < rhs)
    }
}
