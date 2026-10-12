import XCTest
import WebKit
@testable import BSKMac

@MainActor
final class NativeEditorTests: XCTestCase {
    func testNativeRoutesCoverEditorsAndPreserveOrdinaryPages() throws {
        let base = URL(string: "https://bsk2014.se")!
        XCTAssertEqual(NativeRoute.parse(URL(string: "/traning/nytt", relativeTo: base)!), .training("nytt"))
        XCTAssertEqual(NativeRoute.parse(URL(string: "/spelare/12/utveckling/avstamning", relativeTo: base)!), .checkpoint(12))
        XCTAssertEqual(NativeRoute.parse(URL(string: "/spelare/12?samtal=forbered#samtal", relativeTo: base)!), .conversation(12))
        for path in ["/traning/invalid", "/traning", "/spelare/12", "/spelare/12/utveckling", "/spelare/-1?samtal=forbered", "/spelare/12?samtal=sparat"] {
            XCTAssertNil(NativeRoute.parse(URL(string: path, relativeTo: base)!))
        }
    }
    func testNativeNavigationDoesNotLoadWebForms() {
        let browser = BrowserModel(loadInitialPage: false, dataStore: .nonPersistent())
        browser.signedIn = true
        browser.open("/traning/nytt")
        XCTAssertEqual(browser.nativeEditor?.route, .training("nytt"))
        XCTAssertNil(browser.webView.url)
        browser.open("/spelare/12/utveckling/avstamning")
        XCTAssertEqual(browser.nativeEditor?.route, .checkpoint(12))
        XCTAssertNil(browser.webView.url)
        browser.open("https://untrusted.test/traning/nytt")
        XCTAssertEqual(browser.nativeEditor?.route, .checkpoint(12))
    }
    func testExistingExerciseBankRoundTripsThroughNativeDocumentWithoutLosingDrawingObjects() throws {
        var root = URL(fileURLWithPath: #filePath)
        for _ in 0..<4 { root.deleteLastPathComponent() }
        let bank = try JSONDecoder().decode([NativeBank].self, from: Data(contentsOf: root.appendingPathComponent("lib/training/bank.json")))
        XCTAssertFalse(bank.isEmpty)
        var plan = NativePlan(); plan.blocks = bank.map { NativeBlock(minutes: 8, diagram: $0.model) }
        XCTAssertTrue(plan.valid)
        let roundtrip = try JSONDecoder().decode(NativePlan.self, from: JSONEncoder().encode(plan))
        XCTAssertEqual(roundtrip, plan)
        XCTAssertTrue(roundtrip.blocks.contains { $0.diagram.objects.contains { $0.arrow && $0.cx != nil } })
    }
    func testInvalidImportedDocumentCannotBeSaved() {
        var plan = NativePlan(); plan.date = "2026-02-30"; XCTAssertFalse(plan.valid)
        plan.date = ""; plan.blocks = [NativeBlock(minutes: 0)]; XCTAssertFalse(plan.valid)
        plan.blocks = [NativeBlock(diagram: NativeDiagram(objects: [NativeObject(type: "pass", x: 10, y: 20)]))]
        XCTAssertFalse(plan.valid)
    }
    func testLeavingInFlightEditorIsBlockedAndInvalidationClearsPrivateData() {
        let browser = BrowserModel(loadInitialPage: false, dataStore: .nonPersistent())
        browser.signedIn = true; browser.activateEditor(.conversation(1))
        let editor = browser.nativeEditor!
        editor.busy = true; editor.perspective = "QA private fixture"
        XCTAssertFalse(browser.confirmLeavingEditor())
        editor.invalidate()
        XCTAssertTrue(editor.perspective.isEmpty)
        XCTAssertFalse(editor.loaded)
    }
    func testLostSaveResponseRestoresDraftAndRetriesExactPayloadAcrossSessions() async throws {
        let browser = BrowserModel(loadInitialPage: false, dataStore: .nonPersistent()); browser.signedIn = true
        let scope = "qa-" + UUID().uuidString
        let planID = UUID().uuidString
        func initial(_ revision: Int) throws -> Data {
            let document = try JSONSerialization.jsonObject(with: JSONEncoder().encode(NativePlan()))
            return try JSONSerialization.data(withJSONObject: ["scope": scope, "id": planID, "revision": revision, "document": document, "bank": []])
        }
        let firstLoad = try initial(0), secondLoad = try initial(1)
        var firstBody: Data?
        let first = NativeEditorSession(.training(planID)) { _, body in
            if let body { firstBody = body; throw URLError(.networkConnectionLost) }
            return firstLoad
        }
        await first.load(browser); first.plan.title = "QA persistent draft"
        await first.save(browser)
        XCTAssertTrue(first.uncertain); XCTAssertTrue(first.dirty); XCTAssertTrue(first.locked)
        first.storeDraft()
        var replayBody: Data?
        let second = NativeEditorSession(.training(planID)) { _, body in
            if let body { replayBody = body; return Data("{\"revision\":1}".utf8) }
            return secondLoad
        }
        defer { second.clearDraft() }
        await second.load(browser)
        XCTAssertEqual(second.plan.title, "QA persistent draft")
        XCTAssertTrue(second.uncertain)
        await second.save(browser)
        XCTAssertEqual(replayBody, firstBody)
        XCTAssertFalse(second.dirty); XCTAssertTrue(second.saved)
    }

    func testServerFailureKeepsExactCommandForRetry() async throws {
        let browser = BrowserModel(loadInitialPage: false, dataStore: .nonPersistent()); browser.signedIn = true
        let document = try JSONSerialization.jsonObject(with: JSONEncoder().encode(NativePlan()))
        let initial = try JSONSerialization.data(withJSONObject: ["scope": "qa-" + UUID().uuidString, "id": UUID().uuidString, "revision": 0, "document": document, "bank": []])
        var bodies: [Data] = []
        let editor = NativeEditorSession(.training("nytt")) { _, body in
            guard let body else { return initial }
            bodies.append(body)
            if bodies.count == 1 { throw NativeAPIError(message: "QA server error", status: 500) }
            return Data("{\"revision\":1}".utf8)
        }
        await editor.load(browser); editor.plan.title = "QA server retry"
        await editor.save(browser)
        XCTAssertTrue(editor.uncertain); XCTAssertTrue(editor.locked)
        await editor.save(browser)
        XCTAssertEqual(bodies.count, 2); XCTAssertEqual(bodies.first, bodies.last)
        XCTAssertTrue(editor.saved); XCTAssertFalse(editor.dirty)
        editor.clearDraft()
    }

}
