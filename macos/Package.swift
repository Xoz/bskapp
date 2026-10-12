// swift-tools-version: 6.0
import PackageDescription

let package = Package(
    name: "BSKMac",
    platforms: [.macOS(.v14)],
    products: [.executable(name: "BSKMac", targets: ["BSKMac"])],
    targets: [
        .executableTarget(name: "BSKMac"),
        .testTarget(name: "BSKMacTests", dependencies: ["BSKMac"])
    ]
)
