"""
Master Pipeline Orchestrator: CountMeasure AI.
Executes Stages 0 through 7 seamlessly, recording latency, state, and audit logs.
"""
import time
import cv2
import numpy as np
import base64
from typing import Dict, Any, Optional

from .clarification import ClarificationAgent
from .calibration import CalibrationEngine
from .detector import DetectionEngine
from .measurement import MeasurementEngine
from .formula_engine import FormulaEngine
from .presets import PresetGenerator
from .annotator import VisualAnnotator

class CountMeasureOrchestrator:
    def __init__(self):
        self.clarification_agent = ClarificationAgent()
        self.calibration_engine = CalibrationEngine()
        self.detection_engine = DetectionEngine()
        self.measurement_engine = MeasurementEngine()
        self.formula_engine = FormulaEngine()
        self.preset_generator = PresetGenerator()
        self.annotator = VisualAnnotator()

    def process_pipeline(
        self,
        image: Optional[np.ndarray] = None,
        preset_id: Optional[str] = None,
        config: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        t0 = time.time()
        timings = {}

        # Stage 0: Configuration / Clarification
        config = config or {}
        if preset_id:
            presets = {p["id"]: p for p in self.preset_generator.get_preset_list()}
            if preset_id in presets:
                p_meta = presets[preset_id]
                for k, v in p_meta.items():
                    if k not in config and k not in ["id", "name", "description"]:
                        config[k] = v

        prompt = config.get("prompt", "")
        parsed_config = self.clarification_agent.parse_user_goal(prompt, config)

        # Merge parsed values with any explicit overrides
        for k, v in config.items():
            if v is not None:
                parsed_config[k] = v

        timings["stage_0_clarification_ms"] = round((time.time() - t0) * 1000, 2)

        # Stage 1: Input Ingestion
        t1 = time.time()
        if image is None and preset_id:
            image = self.preset_generator.generate_image(preset_id)
        elif image is None:
            # Fallback to default fruit sorting preset
            image = self.preset_generator.generate_image("fruit_sorting")
        
        h, w = image.shape[:2]
        timings["stage_1_input_ms"] = round((time.time() - t1) * 1000, 2)

        # Stage 2: Preprocessing & Calibration
        t2 = time.time()
        calib_result = self.calibration_engine.calibrate(image, parsed_config)
        scale = calib_result["scale"]
        unit = calib_result["unit"]
        timings["stage_2_calibration_ms"] = round((time.time() - t2) * 1000, 2)

        # Stage 3: Detection & Segmentation
        t3 = time.time()
        segment_output = self.detection_engine.segment_objects(image, parsed_config, calib_result)
        if isinstance(segment_output, dict):
            raw_objects = segment_output.get("objects", [])
            candidate_raw = segment_output.get("candidate_objects", [])
            primary_id = segment_output.get("primary_object_id")
            single_mode = segment_output.get("single_object_mode", True)
            detection_backend = segment_output.get("detection_backend", "classic_cv")
            ai_detail = segment_output.get("ai")
        else:
            raw_objects = segment_output
            candidate_raw = []
            primary_id = 1
            single_mode = True
            detection_backend = "classic_cv"
            ai_detail = None
        timings["stage_3_detection_ms"] = round((time.time() - t3) * 1000, 2)

        # Stage 4: Measurement Engine
        t4 = time.time()
        vol_model = parsed_config.get("volume_model", "ellipsoid")
        measured_results = self.measurement_engine.compute_dimensions(
            raw_objects, scale, unit, volume_model=vol_model, image_shape=(h, w)
        )
        objects = measured_results["objects"]
        stats = measured_results["stats"]

        # Also measure all candidate objects so frontend can switch immediately
        measured_candidates = []
        if candidate_raw:
            cand_results = self.measurement_engine.compute_dimensions(
                candidate_raw, scale, unit, volume_model=vol_model, image_shape=(h, w)
            )
            measured_candidates = cand_results["objects"]

        timings["stage_4_measurement_ms"] = round((time.time() - t4) * 1000, 2)

        # Confidence floor & detection status: don't present weak detection as certainty
        min_conf = float(parsed_config.get("min_confidence", 0.40))
        detection_status = "ok"
        detection_message = ""
        if not objects:
            detection_status = "no_object"
            detection_message = (
                "Objek tidak terdeteksi. Coba dekatkan benda ke kamera, "
                "jauhkan tangan, dan letakkan benda di tengah frame."
            )
        else:
            primary_conf = float(objects[0].get("confidence") or 0.0)
            if primary_conf < min_conf:
                detection_status = "low_confidence"
                detection_message = (
                    "Deteksi tidak yakin (kepercayaan rendah). Coba foto ulang dengan "
                    "pencahayaan merata atau posisikan benda lebih jelas di tengah frame."
                )
            elif detection_backend == "fastsam":
                detection_status = "ok"
                detection_message = (
                    "Dikenali oleh segmentasi umum (FastSAM) karena objek tidak ada di "
                    "katalog klasifikasi — pastikan benda berada di tengah frame."
                )

        # Stage 5: Formula Engine
        t5 = time.time()
        calibration_formula = self.formula_engine.generate_calibration_formula(calib_result)
        summary_formulas = self.formula_engine.generate_summary_formulas(stats, unit)

        for obj in objects:
            obj["formulas"] = self.formula_engine.generate_object_formulas(obj, scale, unit)

        timings["stage_5_formula_render_ms"] = round((time.time() - t5) * 1000, 2)

        # Stage 6: Aggregation & Reporting metadata
        t6 = time.time()
        total_time_ms = round((time.time() - t0) * 1000, 2)
        timings["stage_6_aggregation_ms"] = round((time.time() - t6) * 1000, 2)

        # Stage 7: Visual Annotation (suppress misleading boxes when detection is weak)
        t7 = time.time()
        annotated_img = self.annotator.annotate(
            image, objects if detection_status == "ok" else [], calib_result,
            show_bbox=True, show_polygon=True, show_labels=True, show_calib=True
        )
        annotated_b64 = self.annotator.to_base64(annotated_img)
        clean_b64 = self.annotator.to_base64(image)
        timings["stage_7_annotation_ms"] = round((time.time() - t7) * 1000, 2)
        timings["total_pipeline_ms"] = total_time_ms

        return {
            "status": "success",
            "pipeline_config": parsed_config,
            "flow_graph": parsed_config.get("flow_graph"),
            "detection_backend": detection_backend,
            "ai": ai_detail,
            "detection_status": detection_status,
            "detection_message": detection_message,
            "calibration": {
                **calib_result,
                "formula": calibration_formula
            },
            "summary_formulas": summary_formulas,
            "objects": objects,
            "candidate_objects": measured_candidates,
            "primary_object_id": primary_id,
            "single_object_mode": single_mode,
            "stats": stats,
            "image": {
                "width": w,
                "height": h,
                "clean_b64": clean_b64,
                "annotated_b64": annotated_b64
            },
            "timings": timings
        }
