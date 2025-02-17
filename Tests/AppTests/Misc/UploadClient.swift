import Foundation

typealias UploadCompletionHandler = @Sendable (Error?)->()

final class UploadClient: NSObject, URLSessionTaskDelegate {
    
    let urlAddress: String
    let filePath: String
    let fileName: String
    
    let onComplete: UploadCompletionHandler
    
    init(_ urlAddress: String, filePath: String, fileName: String, onComplete: @escaping UploadCompletionHandler) {
        self.urlAddress = urlAddress
        self.filePath = filePath
        self.fileName = fileName
        self.onComplete = onComplete
    }
    
    func startUpload() {
        let urlSession = URLSession(configuration: .default, delegate: self, delegateQueue: .main)
        var request = URLRequest(url: URL(string: urlAddress)!)
        request.httpMethod = "POST"
        request.addValue(fileName, forHTTPHeaderField: "File-Name")
        request.addValue((filePath as NSString).pathExtension.lowercased(), forHTTPHeaderField: "Content-Type")
        let task = urlSession.uploadTask(withStreamedRequest: request)
        task.resume()
    }
    
    func urlSession(
        _ session: URLSession,
        task: URLSessionTask,
        needNewBodyStream completionHandler: @escaping @Sendable (InputStream?) -> Void
    ) {
        let stream = InputStream(fileAtPath: filePath)
        completionHandler(stream)
    }
    
    func urlSession(
        _ session: URLSession,
        task: URLSessionTask,
        didSendBodyData bytesSent: Int64,
        totalBytesSent: Int64,
        totalBytesExpectedToSend: Int64
    ) {
        print("Uploaded bytes: \(totalBytesSent)")
    }
    
    func urlSession(_ session: URLSession, task: URLSessionTask, didCompleteWithError error: Error?) {
        if let response = task.response as? HTTPURLResponse, response.statusCode != 200 {
            return onComplete(NSError(domain: "\(Self.self)Error", code: response.statusCode))
        }
        onComplete(error)
    }
}
