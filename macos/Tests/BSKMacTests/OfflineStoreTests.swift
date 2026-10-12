import XCTest
@testable import BSKMac

@MainActor
final class OfflineStoreTests:XCTestCase {
    func testEncryptedCacheAndQueueSurviveRestartAndStayUserScoped() throws {
        let root=FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        defer{try? FileManager.default.removeItem(at:root)}
        let first=OfflineStore(root:root)
        try first.authenticate(scope:"user-qa-A",name:"QA A",paths:["/matcher"])
        let payload=Data("{\"commandId\":\"qa-command\",\"kind\":\"checkpoint\",\"note\":\"QA PRIVATE SENTINEL\"}".utf8)
        try first.cache(path:"editor?kind=checkpoint&id=1",data:payload)
        try first.enqueue(endpoint:"editor",body:payload,title:"QA checkpoint")
        try first.enqueue(endpoint:"editor",body:payload,title:"QA checkpoint")
        XCTAssertEqual(first.pending.count,1)
        let files=try FileManager.default.contentsOfDirectory(at:root,includingPropertiesForKeys:nil)
        for file in files where file.pathExtension=="sealed"{XCTAssertFalse(String(decoding:try Data(contentsOf:file),as:UTF8.self).contains("QA PRIVATE SENTINEL"))}
        let second=OfflineStore(root:root)
        XCTAssertEqual(second.pending.first?.body,payload)
        XCTAssertEqual(second.cached("editor?kind=checkpoint&id=1")?.data,payload)
        try second.authenticate(scope:"user-qa-B",name:"QA B",paths:[])
        XCTAssertNil(second.cached("editor?kind=checkpoint&id=1"));XCTAssertTrue(second.pending.isEmpty)
        try second.authenticate(scope:"user-qa-A",name:"QA A",paths:[])
        XCTAssertEqual(second.pending.count,1)
        try second.mark("qa-command",error:"QA conflict",conflict:true)
        XCTAssertTrue(second.pending[0].conflict)
        second.lock()
        XCTAssertFalse(second.canResume);XCTAssertTrue(second.pending.isEmpty)
        XCTAssertFalse(OfflineStore(root:root).canResume)
    }
    func testSameCommandCannotBeReplacedByDifferentPayload() throws {
        let root=FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString);defer{try? FileManager.default.removeItem(at:root)}
        let store=OfflineStore(root:root);try store.authenticate(scope:"qa",name:"QA",paths:[])
        try store.enqueue(endpoint:"workday",body:Data("{\"commandId\":\"same\",\"value\":1}".utf8),title:"QA")
        XCTAssertThrowsError(try store.enqueue(endpoint:"workday",body:Data("{\"commandId\":\"same\",\"value\":2}".utf8),title:"QA"))
        XCTAssertEqual(store.pending.count,1)
        try store.remove("same");XCTAssertTrue(OfflineStore(root:root).pending.isEmpty)
    }
    func testNativeWorkdayRoutesKeepEditingRoutesDistinct() throws {
        let base=URL(string:"https://bsk2014.se")!
        XCTAssertEqual(WorkdayRoute.parse(URL(string:"/spelare/7",relativeTo:base)!),.player(7))
        XCTAssertEqual(WorkdayRoute.parse(URL(string:"/matcher/8/laguttagning",relativeTo:base)!),.match(8,"selection"))
        XCTAssertEqual(WorkdayRoute.parse(URL(string:"/matcher/8/utvardera",relativeTo:base)!),.match(8,"evaluation"))
        XCTAssertNil(WorkdayRoute.parse(URL(string:"/matcher/8/live",relativeTo:base)!))
        XCTAssertNil(WorkdayRoute.parse(URL(string:"/spelare/7/utveckling/avstamning",relativeTo:base)!))
    }
    func testTrainingDocumentUndoRedoPreservesIdentityAndBranching() {
        let session=NativeEditorSession(.training("nytt"));session.loaded=true
        let first=session.plan;session.plan.title="QA one";session.rememberPlan(first,session.plan)
        let one=session.plan;session.plan.title="QA two";session.rememberPlan(one,session.plan)
        session.undoPlan();session.rememberPlan(one,session.plan);XCTAssertEqual(session.plan.title,"QA one")
        session.redoPlan();session.rememberPlan(one,session.plan);XCTAssertEqual(session.plan.title,"QA two")
        session.undoPlan();session.rememberPlan(one,session.plan)
        let old=session.plan;session.plan.title="QA other branch";session.rememberPlan(old,session.plan)
        XCTAssertFalse(session.canRedoPlan)
    }
    func testDevelopmentUndoRedoIncludesFocusNotesAndConversation() {
        let session=NativeEditorSession(.checkpoint(1));session.loaded=true;session.rememberDevelopment()
        session.focus=["qa-skill"];session.strengths="QA strength";session.rememberDevelopment()
        session.undoDevelopment();session.rememberDevelopment();XCTAssertTrue(session.focus.isEmpty);XCTAssertEqual(session.strengths,"")
        session.redoDevelopment();session.rememberDevelopment();XCTAssertEqual(session.focus,["qa-skill"]);XCTAssertEqual(session.strengths,"QA strength")
        session.undoDevelopment();session.rememberDevelopment();session.agreement="QA new branch";session.rememberDevelopment();XCTAssertFalse(session.canRedoDevelopment)
    }
    func testEmptyPitchSpotEncodesExplicitNullAndCoordinatesSurviveRoundtrip() throws {
        let plan=NativeMatchPlan(formation:"1-2-3-1",spots:[.init(playerId:nil,x:0.2,y:0.8)],ideas:["focus":"QA"])
        let data=try JSONEncoder().encode(plan)
        let object=try JSONSerialization.jsonObject(with:data) as! [String:Any]
        let spots=object["spots"] as! [[String:Any]]
        XCTAssertTrue(spots[0]["playerId"] is NSNull)
        XCTAssertEqual(try JSONDecoder().decode(NativeMatchPlan.self,from:data),plan)
    }

    private func matchFixture()->WorkdayMatch {
        WorkdayMatch(scope:"qa",fetchedAt:"2026-10-12T10:00:00.123Z",version:"all",versions:["plan":"p","selection":"s","evaluation":"e"],match:.init(id:1,opponent:"QA United",date:"2026-10-11",home_away:"home",location:"QA",level:"3",formation:"1-2-3-1",start_time:nil,finished:1,cancelled:0,our_score:nil,opponent_score:nil),candidates:[],roster:[],plan:.init(revision:0,document:.init(formation:"1-2-3-1",spots:[],ideas:[:])),evaluation:.init(match:.init(ourScore:nil,opponentScore:nil,hasLiveData:false,coachComment:""),players:[.init(id:7,name:"QA Player",rating:nil,ratingComment:"",skipped:false,selfComparison:"usual",matchImpact:"held",reasonTag:"effort")]),formations:[],ideaFields:[],canSelect:false,canPlan:true,canEvaluate:true)
    }
    func testMatchDecodesUnratedPlayerWithNullComment() throws {
        let data = try JSONEncoder().encode(matchFixture())
        var json = try XCTUnwrap(JSONSerialization.jsonObject(with:data) as? [String:Any])
        var evaluation = try XCTUnwrap(json["evaluation"] as? [String:Any])
        var players = try XCTUnwrap(evaluation["players"] as? [[String:Any]])
        players[0]["ratingComment"] = NSNull()
        evaluation["players"] = players; json["evaluation"] = evaluation
        let decoded = try JSONDecoder().decode(WorkdayMatch.self,from:JSONSerialization.data(withJSONObject:json))
        let session = WorkdaySession(.match(1,"evaluation"))
        session.match = decoded
        session.changeTab("evaluation")
        XCTAssertEqual(session.comments[7], "")
    }
    func testMatchUndoRedoBranchesAndQueuedChangesAreLocked() {
        let session=WorkdaySession(.match(1,"plan"));session.match=matchFixture();session.plan=session.match!.plan.document;session.resetHistory()
        session.plan?.ideas["focus"]="QA first";session.rememberEdit()
        session.plan?.ideas["focus"]="QA second";session.rememberEdit()
        session.undo();session.rememberEdit();XCTAssertEqual(session.plan?.ideas["focus"],"QA first")
        session.redo();session.rememberEdit();XCTAssertEqual(session.plan?.ideas["focus"],"QA second")
        session.undo();session.rememberEdit();session.plan?.ideas["focus"]="QA branch";session.rememberEdit();XCTAssertFalse(session.canRedo)
        session.queued=true;XCTAssertFalse(session.canUndo)
    }
    func testEvaluationPreservesExistingAssessmentUntilCoachChoosesRatingOrSkip() throws {
        let session=WorkdaySession(.match(1,"evaluation"));session.match=matchFixture()
        func answer() throws -> [String:Any]{let b=try JSONSerialization.jsonObject(with:session.payload()!) as! [String:Any];XCTAssertEqual(b["version"] as? String,"e");return (b["answers"] as! [[String:Any]])[0]}
        var a=try answer();XCTAssertNil(a["rating"]);XCTAssertEqual(a["selfComparison"] as? String,"usual");XCTAssertEqual(a["matchImpact"] as? String,"held");XCTAssertEqual(a["reasonTag"] as? String,"effort")
        session.skipped.insert(7);a=try answer();XCTAssertTrue(a["rating"] is NSNull);XCTAssertEqual(a["skipped"] as? Bool,true)
        session.skipped=[];session.ratings[7]=4;a=try answer();XCTAssertEqual(a["rating"] as? Int,4)
    }

    func testUnavailableStorageNeverAcknowledgesLocalSave() throws {
        let root=FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString);defer{try? FileManager.default.removeItem(at:root)}
        try Data("QA storage blocker".utf8).write(to:root)
        let store=OfflineStore(root:root)
        XCTAssertThrowsError(try store.authenticate(scope:"qa",name:"QA",paths:[]))
        XCTAssertThrowsError(try store.enqueue(endpoint:"workday",body:Data("{}".utf8),title:"QA"))
        XCTAssertTrue(store.pending.isEmpty);XCTAssertFalse(store.canResume)
    }

}
