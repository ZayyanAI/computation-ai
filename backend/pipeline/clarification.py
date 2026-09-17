"""
Stage 0: Clarification Stage (AI Agent) with Langflow-style Visual Flow representation.
Parses user goals, resolves ambiguities, and builds a declarative node-graph pipeline.
"""
from typing import Dict, Any, List, Optional
import re

SUPPORTED_UNITS = {
    "mm": {"name": "Millimeter", "to_cm": 0.1, "latex": r"\text{mm}"},
    "cm": {"name": "Centimeter", "to_cm": 1.0, "latex": r"\text{cm}"},
    "m": {"name": "Meter", "to_cm": 100.0, "latex": r"\text{m}"},
    "in": {"name": "Inch", "to_cm": 2.54, "latex": r"\text{in}"},
    "inch": {"name": "Inch", "to_cm": 2.54, "latex": r"\text{in}"},
}

DEFAULT_CALIBRATION_REFS = {
    "aruco": {"name": "ArUco Marker (4x4)", "default_size_mm": 50.0, "shape": "square"},
    "coin_idr500": {"name": "Koin 500 IDR (Aluminium)", "default_size_mm": 27.0, "shape": "circle"},
    "coin_quarter": {"name": "US Quarter Coin", "default_size_mm": 24.26, "shape": "circle"},
    "credit_card": {"name": "Standard ID / Credit Card (ISO 7810)", "default_size_mm": 85.60, "height_mm": 53.98, "shape": "rectangle"},
    "manual_ruler": {"name": "Interactive 2-Point Calibrator", "default_size_mm": 100.0, "shape": "line"},
    "camera_focal": {"name": "Camera Focal Length & Distance", "default_size_mm": 0.0, "shape": "optical"},
}

OBJECT_CLASS_KEYWORDS = {
    "fruit": ["apel", "apple", "jeruk", "orange", "buah", "fruit", "pisang", "banana", "tomat", "tomato"],
    "cell": ["sel", "cell", "bakteri", "bacteria", "darah", "blood", "leukosit", "eritrosit", "mikroskop"],
    "box": ["box", "kotak", "paket", "parcel", "kardus", "package", "container", "karton"],
    "vehicle": ["mobil", "car", "kendaraan", "vehicle", "truk", "truck", "motor", "bus"],
    "pill": ["kapsul", "capsule", "tablet", "pill", "obat", "medicine"],
    "part": ["baut", "screw", "washer", "mur", "nut", "komponen", "part", "gear", "alat"],
    "person": ["orang", "person", "manusia", "people", "pejalan kaki", "pedestrian"],
}

class ClarificationAgent:
    def __init__(self):
        pass

    def parse_user_goal(self, prompt: str, initial_config: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """
        Parses free-text user prompt into structured configuration and validation flags.
        """
        text = (prompt or "").lower().strip()
        config = initial_config.copy() if initial_config else {}

        # 1. Detect Target Object
        detected_object = config.get("target_object")
        detected_category = config.get("category", "general")
        
        if not detected_object:
            for cat, keywords in OBJECT_CLASS_KEYWORDS.items():
                for kw in keywords:
                    if kw in text:
                        detected_object = kw
                        detected_category = cat
                        break
                if detected_object:
                    break

        if not detected_object:
            detected_object = "all_objects"
            detected_category = "general"

        # 2. Detect Mode (Count, Measure, Both)
        has_count = any(k in text for k in ["hitung", "count", "jumlah", "banyak", "total", "cacah"])
        has_measure = any(k in text for k in ["ukur", "measure", "dimensi", "panjang", "lebar", "luas", "volume", "diameter", "size", "area"])
        
        if has_count and has_measure:
            mode = "both"
        elif has_measure:
            mode = "measure"
        elif has_count:
            mode = "count"
        else:
            mode = config.get("mode", "both")

        # 3. Detect Unit
        unit = config.get("unit", "cm")
        if " mm" in text or "milimeter" in text:
            unit = "mm"
        elif " cm" in text or "sentimeter" in text:
            unit = "cm"
        elif " meter" in text or " m " in text or text.endswith(" m"):
            unit = "m"
        elif " inch" in text or " in " in text or "inci" in text:
            unit = "in"

        # 4. Detect Calibration Reference
        calib_type = config.get("calibration_type", "coin_idr500")
        custom_ref_size = config.get("reference_real_size", None)

        if "aruco" in text:
            calib_type = "aruco"
        elif "koin" in text or "coin" in text:
            if "quarter" in text:
                calib_type = "coin_quarter"
            else:
                calib_type = "coin_idr500"
        elif "kartu" in text or "card" in text or "ktp" in text:
            calib_type = "credit_card"
        elif "penggaris" in text or "ruler" in text or "manual" in text or "titik" in text:
            calib_type = "manual_ruler"
        elif "kamera" in text or "focal" in text:
            calib_type = "camera_focal"

        # Extract numerical size if specified (e.g., "koin 27mm" or "penggaris 15cm")
        num_match = re.search(r"(\d+(?:\.\d+)?)\s*(mm|cm|in|inch|m)", text)
        if num_match and custom_ref_size is None:
            val = float(num_match.group(1))
            u = num_match.group(2)
            if u == "mm":
                custom_ref_size = val
            elif u == "cm":
                custom_ref_size = val * 10.0
            elif u == "m":
                custom_ref_size = val * 1000.0
            elif u in ["in", "inch"]:
                custom_ref_size = val * 25.4

        ref_info = DEFAULT_CALIBRATION_REFS.get(calib_type, DEFAULT_CALIBRATION_REFS["coin_idr500"])
        final_ref_size_mm = custom_ref_size if custom_ref_size is not None else ref_info["default_size_mm"]

        # Volume model estimation recommendation
        if detected_category in ["fruit", "cell"]:
            volume_model = "ellipsoid"
        elif detected_category in ["pill"]:
            volume_model = "cylinder"
        elif detected_category in ["box"]:
            volume_model = "box"
        else:
            volume_model = config.get("volume_model", "ellipsoid")

        # Clarification questions if ambiguous
        clarification_needed = []
        if text and len(text) < 4:
            clarification_needed.append({
                "field": "prompt",
                "question": "Prompt Anda sangat singkat. Objek spesifik apa yang ingin diproses?",
                "options": ["Buah (Apel / Jeruk)", "Paket Kotak / Gudang", "Sel Mikroskopis", "Komponen Industri / Mur Baut"]
            })
        if mode in ["measure", "both"] and not any(k in text for k in ["koin", "aruco", "kartu", "penggaris", "card", "coin", "marker", "ref"]):
            clarification_needed.append({
                "field": "calibration_type",
                "question": "Untuk pengukuran dimensi nyata, objek kalibrasi apa yang ada di dalam gambar/video?",
                "options": ["Koin 500 IDR (27 mm)", "Kartu Standar (85.6 mm)", "ArUco Marker (50 mm)", "Penggaris / Garis 2-Titik Manual"]
            })

        parsed_result = {
            "prompt": prompt,
            "target_object": detected_object,
            "category": detected_category,
            "mode": mode,
            "unit": unit,
            "calibration_type": calib_type,
            "calibration_name": ref_info["name"],
            "reference_real_size_mm": final_ref_size_mm,
            "volume_model": volume_model,
            "is_ambiguous": len(clarification_needed) > 0,
            "clarification_questions": clarification_needed,
            "confidence": 0.95 if detected_object != "all_objects" else 0.75
        }

        # Build visual node workflow representation (Langflow-style)
        flow_graph = self.generate_flow_graph(parsed_result)
        parsed_result["flow_graph"] = flow_graph

        return parsed_result

    def generate_flow_graph(self, parsed: Dict[str, Any]) -> Dict[str, Any]:
        """
        Generates a declarative Langflow-style Node Graph.
        Each node represents an atomic agent/processing stage with inputs, outputs, parameters, and status.
        """
        nodes = [
            {
                "id": "node-prompt",
                "type": "inputNode",
                "position": {"x": 50, "y": 140},
                "data": {
                    "label": "User Goal Prompt",
                    "category": "input",
                    "icon": "MessageSquare",
                    "description": "Menerima deskripsi tujuan dari pengguna",
                    "inputs": [],
                    "outputs": [{"id": "prompt_text", "label": "Text", "type": "string"}],
                    "values": {"text": parsed.get("prompt", "Hitung dan ukur buah dengan koin referensi")}
                },
                "status": "success"
            },
            {
                "id": "node-extractor",
                "type": "agentNode",
                "position": {"x": 330, "y": 80},
                "data": {
                    "label": "Entity Extractor Agent",
                    "category": "agent",
                    "icon": "Cpu",
                    "description": "Mengekstrak kelas target dan sinonim",
                    "inputs": [{"id": "prompt_in", "label": "Prompt", "type": "string"}],
                    "outputs": [{"id": "target_class", "label": "Target Class", "type": "string"}, {"id": "category", "label": "Category", "type": "string"}],
                    "values": {
                        "target_object": parsed.get("target_object", "fruit"),
                        "category": parsed.get("category", "fruit"),
                        "confidence": f"{int(parsed.get('confidence', 0.9)*100)}%"
                    }
                },
                "status": "success"
            },
            {
                "id": "node-mode",
                "type": "decisionNode",
                "position": {"x": 330, "y": 280},
                "data": {
                    "label": "Task Mode Router",
                    "category": "logic",
                    "icon": "GitBranch",
                    "description": "Menentukan alur: Hitung, Ukur, atau Keduanya",
                    "inputs": [{"id": "prompt_in", "label": "Prompt", "type": "string"}],
                    "outputs": [{"id": "selected_mode", "label": "Mode", "type": "string"}],
                    "values": {"mode": parsed.get("mode", "both")}
                },
                "status": "success"
            },
            {
                "id": "node-unit",
                "type": "configNode",
                "position": {"x": 620, "y": 50},
                "data": {
                    "label": "Unit Normalizer",
                    "category": "config",
                    "icon": "Scale",
                    "description": "Menetapkan satuan metrik output",
                    "inputs": [{"id": "mode_in", "label": "Mode", "type": "string"}],
                    "outputs": [{"id": "unit_out", "label": "Unit", "type": "string"}],
                    "values": {"unit": parsed.get("unit", "cm"), "latex": rf"\text{{{parsed.get('unit', 'cm')}}}"}
                },
                "status": "success"
            },
            {
                "id": "node-calibration",
                "type": "strategyNode",
                "position": {"x": 620, "y": 210},
                "data": {
                    "label": "Calibration Reference",
                    "category": "calibration",
                    "icon": "Compass",
                    "description": "Konfigurasi referensi kalibrasi skala px → fisik",
                    "inputs": [{"id": "mode_in", "label": "Mode", "type": "string"}],
                    "outputs": [{"id": "calib_spec", "label": "Scale Spec", "type": "object"}],
                    "values": {
                        "type": parsed.get("calibration_type", "coin_idr500"),
                        "name": parsed.get("calibration_name", "Koin 500 IDR"),
                        "real_size_mm": parsed.get("reference_real_size_mm", 27.0),
                        "volume_model": parsed.get("volume_model", "ellipsoid")
                    }
                },
                "status": "success"
            },
            {
                "id": "node-guardrail",
                "type": "guardrailNode",
                "position": {"x": 620, "y": 380},
                "data": {
                    "label": "Ambiguity Guardrail",
                    "category": "security",
                    "icon": "ShieldAlert",
                    "description": "Validasi kelengkapan spesifikasi tugas",
                    "inputs": [{"id": "config_in", "label": "Pipeline State", "type": "object"}],
                    "outputs": [{"id": "is_valid", "label": "Validated", "type": "boolean"}],
                    "values": {
                        "is_ambiguous": parsed.get("is_ambiguous", False),
                        "questions_count": len(parsed.get("clarification_questions", []))
                    }
                },
                "status": "warning" if parsed.get("is_ambiguous", False) else "success"
            },
            {
                "id": "node-pipeline-exec",
                "type": "outputNode",
                "position": {"x": 920, "y": 180},
                "data": {
                    "label": "Stage 1–7 CV Pipeline",
                    "category": "pipeline",
                    "icon": "PlayCircle",
                    "description": "Menjalankan Deteksi, Pengukuran, KaTeX Formula & Pelaporan",
                    "inputs": [
                        {"id": "in_target", "label": "Target", "type": "string"},
                        {"id": "in_unit", "label": "Unit", "type": "string"},
                        {"id": "in_calib", "label": "Calib", "type": "object"}
                    ],
                    "outputs": [{"id": "results", "label": "Audit Report", "type": "report"}],
                    "values": {"ready": True}
                },
                "status": "active"
            }
        ]

        edges = [
            {"id": "e1-2", "source": "node-prompt", "target": "node-extractor", "animated": True},
            {"id": "e1-3", "source": "node-prompt", "target": "node-mode", "animated": True},
            {"id": "e2-4", "source": "node-extractor", "target": "node-unit"},
            {"id": "e3-5", "source": "node-mode", "target": "node-calibration", "animated": True},
            {"id": "e3-6", "source": "node-mode", "target": "node-guardrail"},
            {"id": "e4-7", "source": "node-unit", "target": "node-pipeline-exec", "animated": True},
            {"id": "e5-7", "source": "node-calibration", "target": "node-pipeline-exec", "animated": True},
            {"id": "e6-7", "source": "node-guardrail", "target": "node-pipeline-exec"}
        ]

        return {
            "nodes": nodes,
            "edges": edges,
            "summary": {
                "total_nodes": len(nodes),
                "total_edges": len(edges),
                "status": "ready" if not parsed.get("is_ambiguous", False) else "clarification_needed"
            }
        }
