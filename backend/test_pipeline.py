"""Unit test suite for CountMeasure AI Pipeline"""
from pipeline import CountMeasureOrchestrator, ClarificationAgent, PresetGenerator

def test_clarification_agent():
    agent = ClarificationAgent()
    res = agent.parse_user_goal("Hitung apel dan jeruk dalam cm pakai koin 500 sebagai referensi")
    assert res["target_object"] in ["apel", "jeruk", "buah"]
    assert res["unit"] == "cm"
    assert res["mode"] == "count" or res["mode"] == "both"
    assert "flow_graph" in res
    assert len(res["flow_graph"]["nodes"]) >= 6

def test_pipeline_all_presets():
    orch = CountMeasureOrchestrator()
    presets = ["fruit_sorting", "warehouse_boxes", "microscope_cells", "industrial_parts"]
    for p in presets:
        res = orch.process_pipeline(preset_id=p)
        assert res["status"] == "success"
        assert len(res["objects"]) > 0
        assert "scale" in res["calibration"]
        assert "formula" in res["calibration"]
        assert "summary_formulas" in res["summary_formulas"] or "mean_length" in res["summary_formulas"]
        assert "timings" in res
        print(f"Preset {p}: OK ({len(res['objects'])} objects, scale {res['calibration']['scale']:.5f})")

if __name__ == "__main__":
    test_clarification_agent()
    print("Clarification agent test: PASSED")
    test_pipeline_all_presets()
    print("All preset tests: PASSED")
