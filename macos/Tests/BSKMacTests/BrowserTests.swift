import XCTest
import WebKit
@testable import BSKMac

@MainActor
final class BrowserTests: XCTestCase {
    func testDialogsWithoutWindowCompleteSafely() async throws {
        let model = BrowserModel(loadInitialPage: false, dataStore: .nonPersistent())
        model.webView.loadHTMLString("<html><body>synthetic</body></html>", baseURL: nil)
        while model.webView.isLoading { try await Task.sleep(for: .milliseconds(20)) }
        // Actual WebKit dispatch to the delegate: no window must safely cancel,
        // never approve a destructive form or leave its JavaScript waiting.
        let confirmation = try await model.webView.evaluateJavaScript("confirm('synthetic confirmation')")
        XCTAssertEqual(confirmation as? Bool, false)
        let prompt = try await model.webView.evaluateJavaScript("prompt('synthetic prompt', 'sample') === null")
        XCTAssertEqual(prompt as? Bool, true)
        let alert = try await model.webView.evaluateJavaScript("alert('synthetic notice'); 'completed'")
        XCTAssertEqual(alert as? String, "completed")
    }

    func testWorkflowRoutesRejectNonMatchDestinations() {
        XCTAssertEqual(WorkflowMatch.matchID(in: "/matcher/12/utvardera"), 12)
        for path in ["/matcher/ny-cup", "/matcher/cup/QA", "/spelare/12", "/matcher/-2"] {
            XCTAssertNil(WorkflowMatch.matchID(in: path))
        }
    }

    func testWorkflowStageFollowsSubpageAndKeepsManualChoice() {
        let model = BrowserModel(loadInitialPage: false, dataStore: .nonPersistent())
        model.setWorkflowStage(for: "/matcher/12/utvardera")
        XCTAssertEqual(model.workflowStage, .review)
        model.chooseWorkflowStage(.perform)
        model.setWorkflowStage(for: "/matcher/12")
        XCTAssertEqual(model.workflowStage, .perform)
        model.setWorkflowStage(for: "/matcher/12/laguttagning")
        XCTAssertEqual(model.workflowStage, .prepare)
        model.setWorkflowStage(for: "/matcher/13")
        XCTAssertEqual(model.workflowStage, .prepare)
    }

    func testDelayedMatchDataSelectsSuggestedStageWithoutOverridingManualChoice() {
        let model = BrowserModel(loadInitialPage: false, dataStore: .nonPersistent())
        model.setWorkflowStage(for: "/matcher/214")
        model.applySuggestedWorkflowStage(.review)
        XCTAssertEqual(model.workflowStage, .review)
        model.chooseWorkflowStage(.perform)
        model.applySuggestedWorkflowStage(.review)
        XCTAssertEqual(model.workflowStage, .perform)
        model.setWorkflowStage(for: "/matcher/215")
        model.applySuggestedWorkflowStage(.prepare)
        XCTAssertEqual(model.workflowStage, .prepare)
    }

    func testDownloadRespectsAttachmentHeader() {
        let url = URL(string: "https://bsk2014.se/export")!
        let attachment = HTTPURLResponse(url: url, statusCode: 200, httpVersion: nil, headerFields: ["Content-Disposition": "attachment; filename=synthetic.json"])!
        let inline = HTTPURLResponse(url: url, statusCode: 200, httpVersion: nil, headerFields: ["Content-Disposition": "inline"])!
        XCTAssertTrue(BrowserModel.shouldDownload(attachment, canShowMIMEType: true))
        XCTAssertFalse(BrowserModel.shouldDownload(inline, canShowMIMEType: true))
        XCTAssertTrue(BrowserModel.shouldDownload(inline, canShowMIMEType: false))
    }

    func testUntrustedNavigationIsRejected() {
        let model = BrowserModel(loadInitialPage: false, dataStore: .nonPersistent())
        for path in ["https://example.com", "//example.com/idag", "javascript:alert(1)", "http://bsk2014.se"] {
            model.open(path)
            XCTAssertNil(model.webView.url)
        }
    }

    func testEditorRemembersOriginatingWorkflow() {
        let model=BrowserModel(loadInitialPage:false,dataStore:.nonPersistent())
        model.signedIn=true
        model.currentPath="/samtal"
        model.activateEditor(.conversation(7))
        XCTAssertEqual(model.editorReturnPath,"/samtal")
        model.nativeEditor=nil
        model.currentPath="/uppfoljning"
        model.activateWorkday(.match(12,"evaluation"))
        XCTAssertEqual(model.workdayReturnPath,"/uppfoljning")
    }

    func testPrimaryWorkflowsRespectAvailableAreas() {
        let model=BrowserModel(loadInitialPage:false,dataStore:.nonPersistent())
        model.availablePaths=["/traning"]
        XCTAssertTrue(canOpen(Destination.workspace[0],model))
        XCTAssertFalse(canOpen(Destination.workspace[1],model))
        XCTAssertFalse(canOpen(Destination.workspace[2],model))
        model.availablePaths=["/spelare"]
        XCTAssertTrue(Destination.workspace.allSatisfy{canOpen($0,model)})
        model.availablePaths=[]
        XCTAssertFalse(Destination.workspace.contains{canOpen($0,model)})
    }

    func testLastWindowClosureTerminatesSoAppCanReopen() {
        XCTAssertTrue(MacAppDelegate().applicationShouldTerminateAfterLastWindowClosed(NSApplication.shared))
    }
}
