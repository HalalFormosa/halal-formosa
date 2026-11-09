import Foundation
import Capacitor
import AVFoundation
import Vision
import UIKit

// iOS counterpart of LiveTextPlugin.java, for "Live Verdict".
//
// Shows the camera in a view placed behind the (transparent) web view and runs Apple's Vision text
// recognition on the analysed frames. Frames stay in memory and are released as soon as recognition
// finishes; only the recognised text and its boxes are sent to JavaScript, in the pixel space of the
// UPRIGHT analysis image (origin top-left), exactly like the Android plugin.
//
// Registered explicitly in ViewController.swift (see the note there).

/// Hosts the camera preview layer.
final class LiveTextPreviewView: UIView {
    override class var layerClass: AnyClass { AVCaptureVideoPreviewLayer.self }
    var previewLayer: AVCaptureVideoPreviewLayer { layer as! AVCaptureVideoPreviewLayer }
}

/// Receives camera frames on the analysis queue.
final class LiveTextFrameSink: NSObject, AVCaptureVideoDataOutputSampleBufferDelegate {
    var onFrame: ((CVPixelBuffer) -> Void)?

    func captureOutput(_ output: AVCaptureOutput, didOutput sampleBuffer: CMSampleBuffer, from connection: AVCaptureConnection) {
        guard let buffer = CMSampleBufferGetImageBuffer(sampleBuffer) else { return }
        onFrame?(buffer)
    }
}

/// Receives the still photo for the "add this product" flow.
final class LiveTextPhotoSink: NSObject, AVCapturePhotoCaptureDelegate {
    var onPhoto: ((Data?, Error?) -> Void)?

    func photoOutput(_ output: AVCapturePhotoOutput, didFinishProcessingPhoto photo: AVCapturePhoto, error: Error?) {
        onPhoto?(error == nil ? photo.fileDataRepresentation() : nil, error)
    }
}

@objc(LiveTextPlugin)
public class LiveTextPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "LiveTextPlugin"
    public let jsName = "LiveText"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "checkPermissions", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "requestPermissions", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "start", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "stop", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setTorch", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "takePhoto", returnType: CAPPluginReturnPromise)
    ]

    /// Minimum gap between recognised frames. Accurate Chinese recognition is heavy; this keeps the phone cool.
    private static let minFrameInterval: CFTimeInterval = 0.12
    /// Longest side of the photo handed to JavaScript, in pixels.
    private static let maxPhotoSide: CGFloat = 1920

    private let sessionQueue = DispatchQueue(label: "com.rcreative.halalformosa.livetext.session")
    private let analysisQueue = DispatchQueue(label: "com.rcreative.halalformosa.livetext.analysis")

    private var session: AVCaptureSession?
    private var camera: AVCaptureDevice?
    private var photoOutput: AVCapturePhotoOutput?
    private var previewView: LiveTextPreviewView?
    private let frameSink = LiveTextFrameSink()
    private var photoSink: LiveTextPhotoSink?

    // Only touched on analysisQueue.
    private var lastFrameAt: CFTimeInterval = 0
    private var textRequest: VNRecognizeTextRequest?

    private struct SavedWebState {
        let webOpaque: Bool
        let webBackground: UIColor?
        let scrollBackground: UIColor?
        let viewBackground: UIColor?
        let windowBackground: UIColor?
    }
    private var savedWebState: SavedWebState?

    // MARK: Permissions

    private func permissionState() -> String {
        switch AVCaptureDevice.authorizationStatus(for: .video) {
        case .authorized: return "granted"
        case .notDetermined: return "prompt"
        default: return "denied"
        }
    }

    @objc override public func checkPermissions(_ call: CAPPluginCall) {
        call.resolve(["camera": permissionState()])
    }

    @objc override public func requestPermissions(_ call: CAPPluginCall) {
        AVCaptureDevice.requestAccess(for: .video) { [weak self] _ in
            call.resolve(["camera": self?.permissionState() ?? "denied"])
        }
    }

    // MARK: Start / stop

    @objc func start(_ call: CAPPluginCall) {
        guard AVCaptureDevice.authorizationStatus(for: .video) == .authorized else {
            call.reject("Camera permission not granted")
            return
        }
        DispatchQueue.main.async { [weak self] in
            self?.startOnMain(call)
        }
    }

    @objc func stop(_ call: CAPPluginCall) {
        DispatchQueue.main.async { [weak self] in
            self?.teardownOnMain()
            call.resolve()
        }
    }

    private func startOnMain(_ call: CAPPluginCall) {
        teardownOnMain()

        guard let webView = bridge?.webView, let window = webView.window else {
            call.reject("Camera view is not ready")
            return
        }
        guard let device = AVCaptureDevice.default(.builtInWideAngleCamera, for: .video, position: .back),
              let input = try? AVCaptureDeviceInput(device: device) else {
            call.reject("Could not start camera: no back camera")
            return
        }

        let session = AVCaptureSession()
        session.beginConfiguration()
        // 16:9, like the Android analysis; the preview and the analysed frame must share one aspect
        // ratio so the boxes line up with what is shown.
        if session.canSetSessionPreset(.hd1280x720) { session.sessionPreset = .hd1280x720 }
        guard session.canAddInput(input) else {
            session.commitConfiguration()
            call.reject("Could not start camera: input not supported")
            return
        }
        session.addInput(input)

        let video = AVCaptureVideoDataOutput()
        video.alwaysDiscardsLateVideoFrames = true
        video.videoSettings = [kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA]
        frameSink.onFrame = { [weak self] buffer in self?.analyse(buffer) }
        video.setSampleBufferDelegate(frameSink, queue: analysisQueue)
        guard session.canAddOutput(video) else {
            session.commitConfiguration()
            call.reject("Could not start camera: output not supported")
            return
        }
        session.addOutput(video)
        setPortrait(video.connection(with: .video))

        let photo = AVCapturePhotoOutput()
        if session.canAddOutput(photo) {
            session.addOutput(photo)
            photoOutput = photo
        } else {
            photoOutput = nil
        }
        session.commitConfiguration()

        // Reading small print: keep refocusing.
        if (try? device.lockForConfiguration()) != nil {
            if device.isFocusModeSupported(.continuousAutoFocus) { device.focusMode = .continuousAutoFocus }
            device.unlockForConfiguration()
        }

        // Preview goes at the very bottom of the window, under the web view, so it shows through
        // wherever the page is transparent (whatever the Capacitor view hierarchy looks like).
        let preview = LiveTextPreviewView(frame: window.convert(webView.bounds, from: webView))
        preview.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        preview.isUserInteractionEnabled = false
        preview.backgroundColor = .black
        preview.previewLayer.session = session
        preview.previewLayer.videoGravity = .resizeAspectFill
        setPortrait(preview.previewLayer.connection)
        window.insertSubview(preview, at: 0)

        let viewControllerView = bridge?.viewController?.view
        savedWebState = SavedWebState(
            webOpaque: webView.isOpaque,
            webBackground: webView.backgroundColor,
            scrollBackground: webView.scrollView.backgroundColor,
            viewBackground: viewControllerView?.backgroundColor,
            windowBackground: window.backgroundColor
        )
        webView.isOpaque = false
        webView.backgroundColor = .clear
        webView.scrollView.backgroundColor = .clear
        viewControllerView?.backgroundColor = .clear
        window.backgroundColor = .black
        // A held-steady phone gets no touches; without this the screen locks mid-scan.
        UIApplication.shared.isIdleTimerDisabled = true

        self.session = session
        self.camera = device
        self.previewView = preview

        sessionQueue.async {
            session.startRunning()
            DispatchQueue.main.async {
                if session.isRunning {
                    call.resolve()
                } else {
                    self.teardownOnMain()
                    call.reject("Could not start camera")
                }
            }
        }
    }

    private func teardownOnMain() {
        let session = self.session
        let camera = self.camera
        self.session = nil
        self.camera = nil
        self.photoOutput = nil
        frameSink.onFrame = nil

        sessionQueue.async {
            if let camera = camera, camera.hasTorch, camera.torchMode != .off, (try? camera.lockForConfiguration()) != nil {
                camera.torchMode = .off
                camera.unlockForConfiguration()
            }
            session?.stopRunning()
        }

        previewView?.removeFromSuperview()
        previewView = nil

        if let saved = savedWebState, let webView = bridge?.webView {
            webView.isOpaque = saved.webOpaque
            webView.backgroundColor = saved.webBackground
            webView.scrollView.backgroundColor = saved.scrollBackground
            bridge?.viewController?.view.backgroundColor = saved.viewBackground
            webView.window?.backgroundColor = saved.windowBackground
        }
        savedWebState = nil
        UIApplication.shared.isIdleTimerDisabled = false
    }

    /// Frames and preview in portrait, so the analysed image is upright like on Android.
    private func setPortrait(_ connection: AVCaptureConnection?) {
        guard let connection = connection else { return }
        if #available(iOS 17.0, *) {
            if connection.isVideoRotationAngleSupported(90) { connection.videoRotationAngle = 90 }
        } else if connection.isVideoOrientationSupported {
            connection.videoOrientation = .portrait
        }
    }

    // MARK: Torch

    @objc func setTorch(_ call: CAPPluginCall) {
        let enabled = call.getBool("enabled") ?? false
        sessionQueue.async { [weak self] in
            guard let camera = self?.camera, camera.hasTorch else {
                call.reject("Torch unavailable")
                return
            }
            do {
                try camera.lockForConfiguration()
                camera.torchMode = enabled ? .on : .off
                camera.unlockForConfiguration()
                call.resolve()
            } catch {
                call.reject("Torch unavailable")
            }
        }
    }

    // MARK: Photo

    /// One still photo for the "add this product" flow. Kept in memory only: decoded, turned upright
    /// and handed to JavaScript as base64; nothing is written to storage.
    @objc func takePhoto(_ call: CAPPluginCall) {
        guard let output = photoOutput, session?.isRunning == true else {
            call.reject("Camera is not running")
            return
        }
        let settings: AVCapturePhotoSettings
        if output.availablePhotoCodecTypes.contains(.jpeg) {
            settings = AVCapturePhotoSettings(format: [AVVideoCodecKey: AVVideoCodecType.jpeg])
        } else {
            settings = AVCapturePhotoSettings()
        }

        let sink = LiveTextPhotoSink()
        sink.onPhoto = { [weak self] data, error in
            self?.analysisQueue.async {
                guard let data = data, error == nil, let image = UIImage(data: data) else {
                    call.reject("Could not take the photo")
                    return
                }
                let upright = Self.uprightJpeg(image)
                call.resolve([
                    "base64": upright.data.base64EncodedString(),
                    "width": upright.width,
                    "height": upright.height
                ])
            }
            self?.photoSink = nil
        }
        photoSink = sink
        sessionQueue.async {
            output.capturePhoto(with: settings, delegate: sink)
        }
    }

    /// Redraws the photo so its pixels are upright (the camera stores a rotation flag instead), and
    /// shrinks it to a sensible size.
    private static func uprightJpeg(_ image: UIImage) -> (data: Data, width: Int, height: Int) {
        let size = image.size   // already accounts for imageOrientation
        let longest = max(size.width, size.height)
        let scale = longest > maxPhotoSide ? maxPhotoSide / longest : 1
        let target = CGSize(width: (size.width * scale).rounded(), height: (size.height * scale).rounded())
        let format = UIGraphicsImageRendererFormat()
        format.scale = 1
        let renderer = UIGraphicsImageRenderer(size: target, format: format)
        let data = renderer.jpegData(withCompressionQuality: 0.9) { _ in
            image.draw(in: CGRect(origin: .zero, size: target))
        }
        return (data, Int(target.width), Int(target.height))
    }

    // MARK: Recognition

    private func makeRequest() -> VNRecognizeTextRequest {
        let request = VNRecognizeTextRequest()
        // .fast cannot read Chinese; accurate can.
        request.recognitionLevel = .accurate
        // Correction would "fix" ingredient names into ordinary words.
        request.usesLanguageCorrection = false
        request.recognitionLanguages = ["zh-Hant", "zh-Hans", "en-US"]
        if #available(iOS 16.0, *) { request.revision = VNRecognizeTextRequestRevision3 }
        return request
    }

    /// Runs on analysisQueue. Recognition is synchronous, so frames that arrive meanwhile are dropped
    /// (alwaysDiscardsLateVideoFrames) instead of piling up.
    private func analyse(_ buffer: CVPixelBuffer) {
        let now = CACurrentMediaTime()
        guard now - lastFrameAt >= Self.minFrameInterval else { return }
        lastFrameAt = now

        let rawWidth = CVPixelBufferGetWidth(buffer)
        let rawHeight = CVPixelBufferGetHeight(buffer)
        // If the camera did not rotate the frame to portrait, turn it for Vision and report upright sizes.
        let landscape = rawWidth > rawHeight
        let width = landscape ? rawHeight : rawWidth
        let height = landscape ? rawWidth : rawHeight

        let request = textRequest ?? makeRequest()
        textRequest = request
        let handler = VNImageRequestHandler(cvPixelBuffer: buffer, orientation: landscape ? .right : .up, options: [:])
        do {
            try handler.perform([request])
        } catch {
            return
        }

        let observations = request.results ?? []
        var lines: [LiveLine] = []
        for observation in observations {
            guard let candidate = observation.topCandidates(1).first else { continue }
            let text = candidate.string
            let box = Self.pixelRect(observation.boundingBox, width: width, height: height)
            var elements: [[String: Any]] = []
            for token in Self.tokens(of: text) {
                let tokenBox: CGRect
                if let rectangle = try? candidate.boundingBox(for: token.range) {
                    tokenBox = Self.pixelRect(rectangle.boundingBox, width: width, height: height)
                } else {
                    tokenBox = box
                }
                elements.append(["text": token.text, "box": Self.boxJs(tokenBox)])
            }
            if elements.isEmpty { continue }
            lines.append(LiveLine(text: text, box: box, elements: elements))
        }

        let blocks: [[String: Any]] = Self.group(lines).map { block in
            [
                "lines": block.map { line -> [String: Any] in
                    ["text": line.text, "box": Self.boxJs(line.box), "elements": line.elements]
                }
            ]
        }
        notifyListeners("textFrame", data: ["width": width, "height": height, "blocks": blocks])
    }

    private struct LiveLine {
        let text: String
        let box: CGRect
        let elements: [[String: Any]]
    }

    /// Words (Latin) or punctuation-separated runs (Chinese), each with its range in the line.
    /// Boxes for a run are cut by the matcher in proportion to the matched characters.
    private static func tokens(of text: String) -> [(text: String, range: Range<String.Index>)] {
        text.split(whereSeparator: { $0.isWhitespace || $0.isPunctuation }).map { part in
            (String(part), part.startIndex..<part.endIndex)
        }
    }

    /// Vision boxes are normalised with the origin at the bottom left; ours are pixels from the top left.
    private static func pixelRect(_ normalised: CGRect, width: Int, height: Int) -> CGRect {
        let w = CGFloat(width)
        let h = CGFloat(height)
        return CGRect(
            x: normalised.minX * w,
            y: (1 - normalised.maxY) * h,
            width: normalised.width * w,
            height: normalised.height * h
        )
    }

    private static func boxJs(_ rect: CGRect) -> [String: Int] {
        [
            "x": Int(rect.minX.rounded()),
            "y": Int(rect.minY.rounded()),
            "width": Int(rect.width.rounded()),
            "height": Int(rect.height.rounded())
        ]
    }

    /// Vision returns separate lines; ML Kit (Android) returns blocks. The matcher joins the lines of
    /// one block so an ingredient wrapped over two lines still matches, so group lines that sit right
    /// under each other and overlap horizontally.
    private static func group(_ lines: [LiveLine]) -> [[LiveLine]] {
        let sorted = lines.sorted { $0.box.minY < $1.box.minY }
        var blocks: [[LiveLine]] = []
        for line in sorted {
            if var current = blocks.last, let last = current.last {
                let gap = line.box.minY - last.box.maxY
                let tolerance = max(last.box.height, line.box.height) * 0.9
                let overlapsHorizontally = line.box.minX < last.box.maxX && line.box.maxX > last.box.minX
                if gap < tolerance && overlapsHorizontally {
                    current.append(line)
                    blocks[blocks.count - 1] = current
                    continue
                }
            }
            blocks.append([line])
        }
        return blocks
    }
}
