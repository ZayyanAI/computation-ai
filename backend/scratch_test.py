import cv2
import json
from pipeline.orchestrator import CountMeasureOrchestrator

img_path = "C:/Users/AI-GEN/.gemini/antigravity-ide/brain/183050d6-c86d-4193-8650-7fbe95a96bab/.user_uploaded/media_1789089484946.png"
img = cv2.imread(img_path)
orch = CountMeasureOrchestrator()
res = orch.process_pipeline(image=img, config={"target_object": "casing", "category": "general"})

print("Calibration:", res["calibration"].get("type"), res["calibration"].get("real_dimension"))
print("Total objects:", len(res["objects"]))
for o in res["objects"]:
    print(f"ID {o['id']}: centroid={o['centroid']} len={o['pixel_metrics']['length_px']} wid={o['pixel_metrics']['width_px']} circ={o['pixel_metrics']['circularity']}")
