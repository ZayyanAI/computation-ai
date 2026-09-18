"""
FastAPI Server for CountMeasure AI.
Provides REST APIs for Clarification (Langflow-style Visual Flow), Processing, Calibration, Presets, and Export.
"""
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response
from pydantic import BaseModel
from typing import Optional, Dict, Any, List
import json
import cv2
import numpy as np
import base64
import io

from pipeline import CountMeasureOrchestrator, ClarificationAgent, PresetGenerator
from pipeline.solver import solve_equation

app = FastAPI(
    title="Compute API",
    description="Compute - Advanced Vision & Equation Solving System",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://computation-ai.vercel.app"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

orchestrator = CountMeasureOrchestrator()
clarification_agent = ClarificationAgent()
preset_generator = PresetGenerator()

class ClarifyRequest(BaseModel):
    prompt: str
    current_config: Optional[Dict[str, Any]] = None

class ProcessPresetRequest(BaseModel):
    preset_id: str
    config: Optional[Dict[str, Any]] = None

class EquationSolveRequest(BaseModel):
    equation: str
    variable: Optional[str] = "x"

@app.post("/api/solve-equation")
def solve_math_equation(req: EquationSolveRequest):
    """
    Solves a mathematical equation (exponential, linear, quadratic, polynomial, etc.)
    and returns step-by-step KaTeX solutions.
    """
    result = solve_equation(req.equation, req.variable or "x")
    return result

@app.get("/api/health")
def health_check():
    return {"status": "ok", "service": "CountMeasure AI API", "version": "1.0.0"}

@app.get("/api/presets")
def list_presets():
    return {"presets": preset_generator.get_preset_list()}

@app.get("/api/presets/{preset_id}")
def get_preset(preset_id: str):
    presets = {p["id"]: p for p in preset_generator.get_preset_list()}
    if preset_id not in presets:
        raise HTTPException(status_code=404, detail="Preset not found")
    b64 = preset_generator.get_preset_base64(preset_id)
    return {
        "preset": presets[preset_id],
        "image_b64": b64
    }

@app.post("/api/clarify")
def clarify_intent(req: ClarifyRequest):
    """
    Stage 0: Evaluates user prompt, extracts entities, and generates Langflow node graph.
    """
    result = clarification_agent.parse_user_goal(req.prompt, req.current_config)
    return result

@app.post("/api/process/preset")
def process_preset(req: ProcessPresetRequest):
    """
    Executes the complete pipeline (Stages 0-7) using a selected preset.
    """
    try:
        result = orchestrator.process_pipeline(
            image=None,
            preset_id=req.preset_id,
            config=req.config
        )
        return result
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/process/upload")
async def process_upload(
    file: UploadFile = File(...),
    config: Optional[str] = Form(None)
):
    """
    Executes the complete pipeline (Stages 0-7) on an uploaded image file.
    """
    try:
        contents = await file.read()
        nparr = np.frombuffer(contents, np.uint8)
        image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        if image is None:
            raise HTTPException(status_code=400, detail="Invalid image file")

        parsed_config = {}
        if config:
            try:
                parsed_config = json.loads(config)
            except Exception:
                pass

        result = orchestrator.process_pipeline(
            image=image,
            preset_id=None,
            config=parsed_config
        )
        return result
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/process/frame")
def process_live_frame(data: Dict[str, Any]):
    """
    Processes a single frame from webcam stream in base64 format.
    """
    try:
        b64_data = data.get("frame_b64", "")
        if "," in b64_data:
            b64_data = b64_data.split(",")[1]
        
        img_bytes = base64.b64decode(b64_data)
        nparr = np.frombuffer(img_bytes, np.uint8)
        image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        if image is None:
            raise HTTPException(status_code=400, detail="Invalid image frame")

        config = data.get("config", {}) or {}
        if "single_object_mode" not in config:
            config["single_object_mode"] = True
        if "category" not in config:
            config["category"] = "general"
        # Live camera frames now default to AI detection (YOLOv8-seg first, FastSAM
        # class-agnostic fallback). Classic CV remains available via config override.
        if "ai_detection" not in config:
            config["ai_detection"] = True
        if "fastsam_fallback" not in config:
            config["fastsam_fallback"] = True

        result = orchestrator.process_pipeline(
            image=image,
            preset_id=None,
            config=config
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        reload_excludes=["scratch_*.py", "*.py~", "*.py[cod]", ".sw.*", "~*"],
    )
